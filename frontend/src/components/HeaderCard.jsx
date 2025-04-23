/**
 * Header card showing video metadata and overall sentiment summary.
 */

import React from 'react'
import { Users, ThumbsUp, MessageCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { motion } from 'framer-motion'

export default function HeaderCard({ video, analysis }) {
  const sentiment = analysis?.sentimentDistribution || {}
  const total = (sentiment.positive || 0) + (sentiment.negative || 0) + (sentiment.neutral || 0)
  const positivePct = total > 0 ? Math.round((sentiment.positive / total) * 100) : 0
  const negativePct = total > 0 ? Math.round((sentiment.negative / total) * 100) : 0

  // Determine overall sentiment label
  const overallSentiment = positivePct > negativePct
    ? { label: 'Positive', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-950/50', border: 'border-green-900' }
    : negativePct > positivePct
    ? { label: 'Negative', icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-950/50', border: 'border-red-900' }
    : { label: 'Neutral', icon: Minus, color: 'text-yellow-400', bg: 'bg-yellow-950/50', border: 'border-yellow-900' }

  const SentimentIcon = overallSentiment.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-900 rounded-2xl border border-dark-800 overflow-hidden"
    >
      <div className="flex flex-col md:flex-row">
        {/* Thumbnail */}
        {video?.thumbnailUrl && (
          <div className="md:w-80 flex-shrink-0">
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white mb-2">{video?.title || 'Unknown Video'}</h2>
              <p className="text-dark-400 text-sm mb-4">{video?.channelName || 'Unknown Channel'}</p>

              {/* Stats */}
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2 text-dark-300">
                  <MessageCircle className="w-4 h-4 text-blue-400" />
                  <span>{video?.commentCount || total} comments</span>
                </div>
                <div className="flex items-center gap-2 text-dark-300">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>{analysis?.comments?.length || 0} analyzed</span>
                </div>
              </div>
            </div>

            {/* Overall sentiment badge */}
            <div className={`px-4 py-3 rounded-xl border ${overallSentiment.bg} ${overallSentiment.border}`}>
              <div className={`flex items-center gap-2 ${overallSentiment.color}`}>
                <SentimentIcon className="w-5 h-5" />
                <span className="font-semibold">{overallSentiment.label}</span>
              </div>
              <div className="mt-1 text-xs text-dark-400">
                {positivePct}% pos · {negativePct}% neg
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
