/**
 * AI service client — communicates with the Python FastAPI microservice.
 *
 * Sends batched comments to the /analyze endpoint and retrieves
 * the full NLP analysis results (sentiment, aspects, intents, toxicity, topics).
 */

import axios from 'axios'
import { config } from '../config/index.js'

/**
 * Send comments to the AI service for full NLP pipeline analysis.
 *
 * @param {array} comments - Array of comment objects with commentId, text, author, likes, publishedAt
 * @returns {Promise<object>} - Analysis results from the AI service
 */
export async function analyzeComments(comments) {
  console.log(`[AIService] Sending ${comments.length} comments to AI service at ${config.aiServiceUrl}`)

  try {
    const response = await axios.post(
      `${config.aiServiceUrl}/api/analyze`,
      { comments },
      {
        timeout: 600000, // 10 minutes — ML pipelines can be slow on CPU
        headers: { 'Content-Type': 'application/json' },
      }
    )

    console.log(`[AIService] Analysis complete in ${response.data.processingTime}s`)
    return response.data
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('[AIService] Could not connect to AI service — is it running?')
      throw new Error('AI service is not available')
    }
    if (error.code === 'ETIMEDOUT') {
      console.error('[AIService] Request timed out')
      throw new Error('AI service request timed out')
    }
    console.error('[AIService] Error:', error.message)
    throw error
  }
}
