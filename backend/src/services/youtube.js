/**
 * YouTube Data API v3 integration using direct axios HTTP calls.
 *
 * We switched from the googleapis npm package to axios because the googleapis
 * client was producing "Premature close" connection errors in some network
 * environments. Direct HTTP requests are simpler, more predictable, and easier
 * to debug.
 *
 * Responsibilities:
 * 1. Extract video ID from YouTube URLs
 * 2. Fetch video metadata via videos.list
 * 3. Fetch comments via commentThreads.list with pagination
 * 4. Handle quota/comments-disabled errors gracefully
 */

import http from 'http'
import https from 'https'
import axios from 'axios'
import { config } from '../config/index.js'

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

/**
 * Extract the 11-character video ID from a YouTube URL.
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/shorts/
 * @param {string} url - YouTube video URL
 * @returns {string|null} - Video ID or null if invalid
 */
export function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  // If the input is already an 11-char video ID, return it directly
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
    return url.trim()
  }

  return null
}

/**
 * Make a request to the YouTube Data API.
 * Centralizes error handling and logging.
 */
async function youtubeRequest(endpoint, params) {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`)

  // Add params to URL
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      url.searchParams.append(key, value)
    }
  })

  // Add API key
  url.searchParams.append('key', config.youtubeApiKey)

  const logUrl = url.toString().replace(/key=[^&]+/, 'key=***')
  console.log(`[YouTube] GET ${endpoint} → ${logUrl}`)

  try {
    const response = await axios.get(url.toString(), {
      timeout: 30000,
      headers: {
        Accept: 'application/json',
      },
      // Keep connection alive to avoid repeated TLS handshakes
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
    })

    return response.data
  } catch (error) {
    if (error.response) {
      const err = error.response.data?.error
      const reason = err?.errors?.[0]?.reason || err?.message || 'unknown'
      const code = error.response.status
      console.error(`[YouTube] API error ${code}: ${reason}`)

      if (code === 403) {
        if (reason === 'quotaExceeded') {
          const quotaError = new Error('YouTube API quota exceeded')
          quotaError.code = 403
          quotaError.reason = 'quotaExceeded'
          throw quotaError
        }
        if (reason === 'commentsDisabled') {
          const disabledError = new Error('Comments are disabled for this video')
          disabledError.code = 403
          disabledError.reason = 'commentsDisabled'
          throw disabledError
        }
      }

      if (code === 404) {
        throw new Error(`Video not found on YouTube`)
      }
    }
    throw error
  }
}

/**
 * Fetch video metadata (title, thumbnail, channel, publishedAt).
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<object>} - Video metadata object
 */
export async function fetchVideoMetadata(videoId) {
  console.log(`[YouTube] Fetching metadata for video: ${videoId}`)

  const data = await youtubeRequest('videos', {
    part: 'snippet',
    id: videoId,
  })

  if (!data.items || data.items.length === 0) {
    throw new Error(`Video not found: ${videoId}`)
  }

  const snippet = data.items[0].snippet
  return {
    videoId,
    title: snippet.title,
    thumbnailUrl: snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '',
    channelName: snippet.channelTitle,
    publishedAt: new Date(snippet.publishedAt),
  }
}

/**
 * Fetch all comments for a video with pagination.
 * YouTube API returns 100 comments per page; we fetch up to maxComments.
 *
 * @param {string} videoId - YouTube video ID
 * @param {number} maxComments - Maximum number of comments to fetch (default: 500)
 * @param {function} onProgress - Optional callback for progress updates (fetchedCount)
 * @returns {Promise<array>} - Array of comment objects
 */
export async function fetchComments(videoId, maxComments = 500, onProgress = null) {
  console.log(`[YouTube] Fetching comments for video: ${videoId} (max: ${maxComments})`)

  const comments = []
  let pageToken = null
  let totalFetched = 0

  do {
    try {
      const params = {
        part: 'snippet',
        videoId: videoId,
        maxResults: 100,
        order: 'relevance',
        textFormat: 'plainText',
      }

      if (pageToken) {
        params.pageToken = pageToken
      }

      const data = await youtubeRequest('commentThreads', params)

      if (!data.items) {
        break
      }

      for (const item of data.items) {
        const snippet = item.snippet?.topLevelComment?.snippet
        if (!snippet) continue

        comments.push({
          commentId: item.id,
          text: snippet.textDisplay || snippet.textOriginal || '',
          author: snippet.authorDisplayName || 'Unknown',
          likes: snippet.likeCount || 0,
          publishedAt: snippet.publishedAt || '',
          replyCount: item.snippet?.totalReplyCount || 0,
        })

        totalFetched++
        if (totalFetched >= maxComments) {
          break
        }
      }

      if (onProgress) {
        onProgress(totalFetched)
      }

      pageToken = data.nextPageToken

      if (totalFetched >= maxComments || !pageToken) {
        break
      }
    } catch (error) {
      if (error.code === 403 && error.reason === 'quotaExceeded') {
        console.warn('[YouTube] API quota exceeded, returning partial results')
        break
      }
      if (error.code === 403 && error.reason === 'commentsDisabled') {
        console.warn(`[YouTube] Comments are disabled for video: ${videoId}`)
        throw new Error('Comments are disabled for this video')
      }
      throw error
    }
  } while (pageToken && totalFetched < maxComments)

  console.log(`[YouTube] Fetched ${comments.length} comments`)
  return comments
}
