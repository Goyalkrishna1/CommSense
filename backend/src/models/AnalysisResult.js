import mongoose from 'mongoose'

// Mongoose schema for the full analysis result of a video.
// Each document contains all pipeline outputs + per-comment classifications.
const analysisResultSchema = new mongoose.Schema({
  videoId: { type: String, required: true, unique: true, index: true },
  sentimentDistribution: {
    positive: { type: Number, default: 0 },
    negative: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 },
  },
  aspectSentiment: [{
    aspect: { type: String },
    positive: { type: Number, default: 0 },
    negative: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 },
  }],
  intentBreakdown: [{
    intent: { type: String },
    count: { type: Number, default: 0 },
  }],
  topicClusters: [{
    topicId: { type: Number },
    topKeywords: [{ type: String }],
    representativeComments: [{ type: String }],
    commentCount: { type: Number, default: 0 },
  }],
  timelineData: [{
    timeStart: { type: String },
    timeEnd: { type: String },
    sentimentScore: { type: Number },
    commentCount: { type: Number, default: 0 },
    dominantSentiment: { type: String },
  }],
  toxicComments: [{
    commentId: { type: String },
    text: { type: String },
    toxicityScore: { type: Number },
  }],
  llmSummary: { type: String },
  // Per-comment classifications embedded for fast querying
  comments: [{
    commentId: { type: String },
    text: { type: String },
    author: { type: String },
    likes: { type: Number, default: 0 },
    publishedAt: { type: Date },
    sentiment: { type: String },
    sentimentScore: { type: Number },
    aspect: { type: String },
    aspectSentiment: { type: String },
    intent: { type: String },
    intentConfidence: { type: Number },
    toxicityScore: { type: Number },
    isToxic: { type: Boolean, default: false },
    topicId: { type: Number },
    language: { type: String },
  }],
  createdAt: { type: Date, default: Date.now },
})

export default mongoose.model('AnalysisResult', analysisResultSchema)
