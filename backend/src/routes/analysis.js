import { Router } from 'express'
import { extractVideoId } from '../services/youtube.js'
import { addAnalysisJob, analysisQueue } from '../queue/analysisQueue.js'
import AnalysisResult from '../models/AnalysisResult.js'

// Route handler for analysis submission and job status tracking.
// Flow: POST / → parse URL → check cache → create Bull job → return jobId
const router = Router()

// POST /api/analyze — submit a YouTube URL for analysis
// Request body: { url: string, maxComments?: number }
// Response: { jobId: string, videoId: string, status: string }
router.post('/', async (req, res) => {
  try {
    const { url, maxComments } = req.body

    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' })
    }

    // Extract video ID from the URL
    const videoId = extractVideoId(url)
    if (!videoId) {
      return res.status(400).json({
        error: 'Invalid YouTube URL. Supported formats: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/',
      })
    }

    // Check if analysis already exists in MongoDB (cache)
    const existingResult = await AnalysisResult.findOne({ videoId })
    if (existingResult) {
      console.log(`[Analysis] Cache hit for video: ${videoId}`)
      return res.json({
        jobId: null,
        videoId,
        status: 'completed',
        message: 'Analysis already exists for this video',
      })
    }

    // Create a new Bull job for the analysis pipeline
    const job = await addAnalysisJob(videoId, url, maxComments || 500)

    res.status(202).json({
      jobId: job.id.toString(),
      videoId,
      status: 'queued',
      message: 'Analysis job created. Poll GET /api/analyze/status/' + job.id + ' for updates.',
    })
  } catch (error) {
    console.error('[Analysis] Error creating job:', error.message)
    res.status(500).json({ error: 'Failed to create analysis job' })
  }
})

// GET /api/analyze/status/:jobId — check job status and progress
// Response: { jobId, status, progress, videoId, error? }
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params

    const job = await analysisQueue.getJob(jobId)
    if (!job) {
      return res.status(404).json({ error: 'Job not found' })
    }

    const state = await job.getState()
    const progress = job.progress
    const jobData = job.data

    const response = {
      jobId: job.id.toString(),
      status: state, // 'waiting', 'active', 'completed', 'failed', 'delayed'
      progress: typeof progress === 'number' ? progress : 0,
      videoId: jobData.videoId,
    }

    // Include error message if the job failed
    if (state === 'failed' && job.failedReason) {
      response.error = job.failedReason
    }

    // Include result if the job completed
    if (state === 'completed' && job.returnvalue) {
      response.result = job.returnvalue
    }

    res.json(response)
  } catch (error) {
    console.error('[Analysis] Error fetching job status:', error.message)
    res.status(500).json({ error: 'Failed to fetch job status' })
  }
})

export default router
