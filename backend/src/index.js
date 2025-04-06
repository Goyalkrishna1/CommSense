import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { config } from './config/index.js'
import analysisRoutes from './routes/analysis.js'
import resultsRoutes from './routes/results.js'
import searchRoutes from './routes/search.js'
// Importing the queue module initializes the Bull processor and event listeners
import './queue/analysisQueue.js'

// Main Express application entry point.
// Connects to MongoDB, sets up middleware, and mounts route handlers.
const app = express()

app.use(cors())
app.use(express.json({ limit: '50mb' }))

// Health check endpoint — used to verify the backend is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend service is running' })
})

// Route mounts
app.use('/api/analyze', analysisRoutes)
app.use('/api/results', resultsRoutes)
app.use('/api/search', searchRoutes)

// Mongoose connection options for resilience:
// - auto_reconnect: re-establish connection automatically if MongoDB drops
// - serverSelectionTimeoutMS: wait up to 10s for server selection before erroring
// - heartbeatFrequencyMS: check connection health every 5s
// - maxPoolSize: maintain up to 10 connections
const mongooseOptions = {
  autoIndex: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000,
  heartbeatFrequencyMS: 5000,
}

// Log Mongoose connection lifecycle events for debugging
mongoose.connection.on('connected', () => {
  console.log('[Backend] MongoDB connected')
})
mongoose.connection.on('disconnected', () => {
  console.warn('[Backend] MongoDB disconnected — will attempt auto-reconnect')
})
mongoose.connection.on('reconnected', () => {
  console.log('[Backend] MongoDB reconnected successfully')
})
mongoose.connection.on('error', (err) => {
  console.error('[Backend] MongoDB connection error:', err.message)
})

// Connect to MongoDB and start the server
async function startServer() {
  try {
    console.log('[Backend] Connecting to MongoDB...')
    await mongoose.connect(config.mongoUri, mongooseOptions)
    console.log('[Backend] MongoDB connected successfully')

    app.listen(config.port, () => {
      console.log(`[Backend] Server running on port ${config.port}`)
    })
  } catch (error) {
    console.error('[Backend] Failed to start server:', error.message)
    process.exit(1)
  }
}

startServer()
