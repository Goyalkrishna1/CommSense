import mongoose from 'mongoose'

// Mongoose schema for the FAISS vector search index metadata.
// Tracks where the FAISS index file is stored on disk and the
// mapping between FAISS internal positions and comment IDs.
const searchIndexSchema = new mongoose.Schema({
  videoId: { type: String, required: true, unique: true, index: true },
  faissIndexPath: { type: String, required: true },
  embeddingModel: { type: String, default: 'all-MiniLM-L6-v2' },
  indexSize: { type: Number, default: 0 },
  // Mapping: FAISS index position -> comment ID
  commentMapping: [{
    position: { type: Number },
    commentId: { type: String },
  }],
  createdAt: { type: Date, default: Date.now },
})

export default mongoose.model('SearchIndex', searchIndexSchema)
