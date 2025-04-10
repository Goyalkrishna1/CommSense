/**
 * Bull queue setup for async analysis jobs.
 *
 * Job flow: fetchComments → sendToAIService → storeResults
 * Job status: queued → fetching → analyzing → completed / failed
 *
 * Uses Redis for queue persistence. If Redis is not available,
 * the queue will fail gracefully and the API will return an error.
 */

import Bull from 'bull'
import { config } from '../config/index.js'
import { fetchVideoMetadata, fetchComments } from '../services/youtube.js'
import { analyzeComments } from '../services/aiClient.js'
import { buildSearchIndex } from '../services/searchService.js'
import Video from '../models/Video.js'
import AnalysisResult from '../models/AnalysisResult.js'

/**
 * Retry a MongoDB operation up to `maxRetries` times with a delay between attempts.
 * This handles transient connection drops (e.g. MongoDB restarting) without
 * losing the entire analysis job.
 * @param {function} fn - Async function to retry
 * @param {number} maxRetries - Max retry attempts (default: 3)
 * @param {number} delayMs - Delay between retries in ms (default: 2000)
 * @returns {Promise<any>} - Result of fn()
 */
async function retryMongoOperation(fn, maxRetries = 3, delayMs = 2000) {
  let lastError
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < maxRetries) {
        console.warn(`[Queue] MongoDB operation failed (attempt ${attempt}/${maxRetries}): ${error.message} — retrying in ${delayMs / 1000}s...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }
  throw lastError
}

// Redis connection config for Bull
const redisConfig = {
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null, // Required by Bull
}

// Create the analysis queue
export const analysisQueue = new Bull('analysis-jobs', { redis: redisConfig })

/**
 * Process an analysis job through the full pipeline:
 * 1. Fetch video metadata from YouTube API
 * 2. Fetch comments (with pagination)
 * 3. Send comments to AI service for NLP analysis
 * 4. Store results in MongoDB
 *
 * Job data: { videoId, url, maxComments }
 */
analysisQueue.process(async (job) => {
  const { videoId, url, maxComments = 500 } = job.data

  // Step 1: Fetch video metadata
  job.progress(10)
  await job.update({ ...job.data, status: 'fetching' })
  console.log(`[Queue] Job ${job.id}: Fetching video metadata for ${videoId}`)

  const videoMetadata = await fetchVideoMetadata(videoId)

  // Store/update video metadata in MongoDB (with retry for transient disconnects)
  await retryMongoOperation(() =>
    Video.findOneAndUpdate(
      { videoId },
      {
        ...videoMetadata,
        analyzedAt: new Date(),
      },
      { upsert: true, new: true }
    )
  )

  // Step 2: Fetch comments
  job.progress(25)
  console.log(`[Queue] Job ${job.id}: Fetching comments`)

  const comments = await fetchComments(videoId, maxComments, (fetchedCount) => {
    // Update progress within the fetch step (25% → 45%)
    const fetchProgress = 25 + Math.floor((fetchedCount / maxComments) * 20)
    job.progress(fetchProgress)
  })

  if (comments.length === 0) {
    throw new Error('No comments found for this video')
  }

  // Update video with actual comment count (with retry)
  await retryMongoOperation(() =>
    Video.findOneAndUpdate(
      { videoId },
      { commentCount: comments.length }
    )
  )

  // Step 3: Send to AI service for analysis
  job.progress(50)
  await job.update({ ...job.data, status: 'analyzing' })
  console.log(`[Queue] Job ${job.id}: Sending ${comments.length} comments to AI service`)

  const analysisResults = await analyzeComments(comments)

  // Step 4: Store results in MongoDB
  job.progress(85)
  await job.update({ ...job.data, status: 'storing' })
  console.log(`[Queue] Job ${job.id}: Storing results in MongoDB`)

  await retryMongoOperation(() =>
    AnalysisResult.findOneAndUpdate(
      { videoId },
      {
        videoId,
        sentimentDistribution: analysisResults.sentimentDistribution,
        aspectSentiment: analysisResults.aspectSentiment,
        intentBreakdown: analysisResults.intentBreakdown,
        topicClusters: analysisResults.topicClusters || [],
        timelineData: analysisResults.timelineData || [],
        llmSummary: analysisResults.llmSummary || null,
        toxicComments: analysisResults.toxicComments || [],
        comments: analysisResults.comments || [],
      },
      { upsert: true, new: true }
    )
  )

  // Step 5: Build FAISS search index for semantic search
  job.progress(95)
  await job.update({ ...job.data, status: 'indexing' })
  console.log(`[Queue] Job ${job.id}: Building FAISS search index`)

  try {
    await buildSearchIndex(videoId, analysisResults.comments || [])
  } catch (indexError) {
    // Index building failure is non-fatal — analysis results are already stored
    console.warn(`[Queue] Job ${job.id}: FAISS index building failed (non-fatal): ${indexError.message}`)
  }

  job.progress(100)
  console.log(`[Queue] Job ${job.id}: Analysis complete for video ${videoId}`)

  return {
    videoId,
    commentCount: comments.length,
    processingTime: analysisResults.processingTime,
  }
})

// Log job lifecycle events for debugging
analysisQueue.on('completed', (job, result) => {
  console.log(`[Queue] Job ${job.id} completed: ${result.commentCount} comments analyzed in ${result.processingTime}s`)
})

analysisQueue.on('failed', (job, error) => {
  console.error(`[Queue] Job ${job.id} failed: ${error.message}`)
})

analysisQueue.on('error', (error) => {
  console.error(`[Queue] Queue error: ${error.message}`)
})

/**
 * Add a new analysis job to the queue.
 * @param {string} videoId - YouTube video ID
 * @param {string} url - Original YouTube URL
 * @param {number} maxComments - Max comments to fetch
 * @returns {Promise<Bull.Job>} - The created Bull job
 */
export async function addAnalysisJob(videoId, url, maxComments = 500) {
  const job = await analysisQueue.add({
    videoId,
    url,
    maxComments,
    status: 'queued',
  })
  console.log(`[Queue] Created job ${job.id} for video ${videoId}`)
  return job
}
