import { Router } from 'express'
import AnalysisResult from '../models/AnalysisResult.js'
import { searchComments } from '../services/searchService.js'

// Route handler for semantic/keyword/hybrid comment search.
// Calls the AI service /search endpoint and returns enriched results.
const router = Router()

// GET /api/search/:videoId?query=...&mode=semantic|keyword|hybrid&topK=20
router.get('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params
    const { query, mode = 'semantic', topK } = req.query

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' })
    }

    // Fetch analysis results from MongoDB to get comments for keyword matching
    const analysisResult = await AnalysisResult.findOne({ videoId })
    if (!analysisResult) {
      return res.status(404).json({
        error: 'No analysis found for this video. Analyze the video first.',
      })
    }

    // Call the AI service search endpoint
    const searchResults = await searchComments(
      videoId,
      query,
      mode,
      analysisResult.comments,
      parseInt(topK) || 20
    )

    res.json(searchResults)
  } catch (error) {
    console.error('[Search] Error:', error.message)

    // Handle AI service connection errors gracefully
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'AI service is not available for search' })
    }

    res.status(500).json({ error: 'Search failed' })
  }
})

export default router
