/**
 * Search service — handles FAISS index building and search queries
 * via the AI service.
 */

import axios from 'axios'
import { config } from '../config/index.js'
import SearchIndex from '../models/SearchIndex.js'

/**
 * Build a FAISS search index for a video by calling the AI service /embed endpoint.
 * Stores the position→commentId mapping in MongoDB SearchIndex.
 *
 * @param {string} videoId - YouTube video ID
 * @param {array} comments - Array of analyzed comment objects
 */
export async function buildSearchIndex(videoId, comments) {
  console.log(`[SearchService] Building FAISS index for video ${videoId} (${comments.length} comments)`)

  const response = await axios.post(
    `${config.aiServiceUrl}/api/embed`,
    { videoId, comments },
    { timeout: 120000, headers: { 'Content-Type': 'application/json' } }
  )

  const { indexSize, mapping } = response.data

  // Store the mapping in MongoDB for later search queries
  await SearchIndex.findOneAndUpdate(
    { videoId },
    {
      videoId,
      faissIndexPath: `data/faiss/${videoId}.index`,
      embeddingModel: 'all-MiniLM-L6-v2',
      indexSize,
      commentMapping: mapping,
    },
    { upsert: true, new: true }
  )

  console.log(`[SearchService] FAISS index built and mapping stored (${indexSize} vectors)`)
}

/**
 * Search comments via the AI service.
 *
 * @param {string} videoId - YouTube video ID
 * @param {string} query - Search query
 * @param {string} mode - "semantic", "keyword", or "hybrid"
 * @param {array} comments - Comments from AnalysisResult (for keyword matching)
 * @param {number} topK - Number of results to return
 * @returns {Promise<object>} - Search results from AI service
 */
export async function searchComments(videoId, query, mode, comments, topK = 20) {
  console.log(`[SearchService] Searching: videoId=${videoId}, query="${query}", mode=${mode}`)

  const response = await axios.post(
    `${config.aiServiceUrl}/api/search`,
    {
      videoId,
      query,
      mode,
      topK,
      comments,
    },
    { timeout: 30000, headers: { 'Content-Type': 'application/json' } }
  )

  return response.data
}
