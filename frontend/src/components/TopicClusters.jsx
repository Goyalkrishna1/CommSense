/**
 * Topic clusters grid — shows discovered topics with keywords and representative comments.
 */

import React, { useState } from 'react'
import { Tag, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function TopicClusters({ topicClusters }) {
  if (!topicClusters || topicClusters.length === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-900 rounded-2xl border border-dark-800 p-6"
    >
      <h3 className="text-lg font-semibold text-white mb-4">
        Topic Clusters
        <span className="ml-2 text-sm text-dark-400 font-normal">({topicClusters.length} topics discovered)</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topicClusters.map((topic) => (
          <TopicCard key={topic.topicId} topic={topic} />
        ))}
      </div>
    </motion.div>
  )
}

function TopicCard({ topic }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-dark-950 rounded-xl border border-dark-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-dark-400">Topic #{topic.topicId}</span>
        <span className="text-xs text-dark-500 flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {topic.commentCount} comments
        </span>
      </div>

      {/* Keywords */}
      <div className="flex flex-wrap gap-2 mb-3">
        {topic.topKeywords?.slice(0, 6).map((keyword, i) => (
          <span
            key={i}
            className="px-2 py-1 rounded-md bg-blue-950/50 border border-blue-900 text-blue-300 text-xs flex items-center gap-1"
          >
            <Tag className="w-3 h-3" />
            {keyword}
          </span>
        ))}
      </div>

      {/* Representative comments */}
      <div className="space-y-2">
        {topic.representativeComments?.slice(0, expanded ? undefined : 2).map((comment, i) => (
          <p key={i} className="text-sm text-dark-300 bg-dark-900 rounded-lg p-3 border border-dark-800">
            "{comment.length > 150 ? comment.slice(0, 150) + '...' : comment}"
          </p>
        ))}
      </div>

      {/* Expand toggle */}
      {topic.representativeComments?.length > 2 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          {expanded ? (
            <>Show less <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>Show more <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </div>
  )
}
