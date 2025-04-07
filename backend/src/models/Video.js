import mongoose from 'mongoose'

// Mongoose schema for a YouTube video's metadata.
// Stored once per video when analysis is first triggered.
const videoSchema = new mongoose.Schema({
  videoId: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  thumbnailUrl: { type: String },
  channelName: { type: String },
  publishedAt: { type: Date },
  commentCount: { type: Number, default: 0 },
  analyzedAt: { type: Date, default: Date.now },
})

export default mongoose.model('Video', videoSchema)
