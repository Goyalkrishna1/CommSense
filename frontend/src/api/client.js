/**
 * API client for communicating with the backend.
 * Handles analysis job creation, status polling, and results fetching.
 */

import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Submit a YouTube URL for analysis.
 * Returns { jobId, videoId, status } or { status: 'completed' } if cached.
 */
export async function submitAnalysis(url, maxComments = 500) {
  const { data } = await api.post('/analyze', { url, maxComments })
  return data
}

/**
 * Poll job status by jobId.
 * Returns { jobId, status, progress, videoId, error?, result? }
 */
export async function getJobStatus(jobId) {
  const { data } = await api.get(`/analyze/status/${jobId}`)
  return data
}

/**
 * Fetch full analysis results by videoId.
 * Returns { video, analysis } object.
 */
export async function getResults(videoId) {
  const { data } = await api.get(`/results/${videoId}`)
  return data
}

/**
 * Search comments for a video.
 * @param {string} videoId - YouTube video ID
 * @param {string} query - Search query
 * @param {string} mode - "semantic", "keyword", or "hybrid"
 * @param {number} topK - Number of results
 * @returns {Promise<object>} - Search results from the backend
 */
export async function searchCommentsApi(videoId, query, mode = 'semantic', topK = 20) {
  const { data } = await api.get(`/search/${videoId}`, {
    params: { query, mode, topK },
  })
  return data
}

/**
 * Health check for the backend.
 */
export async function checkHealth() {
  const { data } = await api.get('/health')
  return data
}

/**
 * Poll job status until it completes or fails.
 * Calls onProgress callback with each status update.
 * @param {string} jobId - The Bull job ID
 * @param {function} onProgress - Callback receiving status updates
 * @param {number} intervalMs - Polling interval (default 2000ms)
 * @returns {Promise<object>} - Final job result or throws on failure
 */
export async function pollJobUntilDone(jobId, onProgress, intervalMs = 2000) {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await getJobStatus(jobId)
        onProgress(status)

        if (status.status === 'completed') {
          resolve(status)
          return
        }

        if (status.status === 'failed') {
          reject(new Error(status.error || 'Analysis job failed'))
          return
        }

        // Continue polling
        setTimeout(poll, intervalMs)
      } catch (error) {
        reject(error)
      }
    }

    poll()
  })
}
