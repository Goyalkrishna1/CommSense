import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

// Centralized configuration for the backend service.
// All env vars are read here so they can be validated in one place.
export const config = {
  port: 5001,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/yt-comments-analyzer',
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
}
