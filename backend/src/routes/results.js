import { Router } from 'express'
import AnalysisResult from '../models/AnalysisResult.js'
import Video from '../models/Video.js'

// Route handler for retrieving analysis results from MongoDB.
const router = Router()

// GET /api/results/:videoId — get full analysis results for a video
// Returns the complete analysis result including sentiment, aspects, intents, topics, and per-comment data
router.get('/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params

    // Fetch analysis result from MongoDB
    const result = await AnalysisResult.findOne({ videoId })
    if (!result) {
      return res.status(404).json({ error: 'No analysis found for this video. Submit the URL to /api/analyze first.' })
    }

    // Also fetch video metadata for context
    const video = await Video.findOne({ videoId })

    res.json({
      video: video ? {
        videoId: video.videoId,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
        channelName: video.channelName,
        publishedAt: video.publishedAt,
        commentCount: video.commentCount,
        analyzedAt: video.analyzedAt,
      } : null,
      analysis: {
        sentimentDistribution: result.sentimentDistribution,
        aspectSentiment: result.aspectSentiment,
        intentBreakdown: result.intentBreakdown,
        topicClusters: result.topicClusters,
        timelineData: result.timelineData,
        llmSummary: result.llmSummary,
        toxicComments: result.toxicComments,
        comments: result.comments,
        createdAt: result.createdAt,
      },
    })
  } catch (error) {
    console.error('[Results] Error fetching results:', error.message)
    res.status(500).json({ error: 'Failed to fetch analysis results' })
  }
})

export default router
