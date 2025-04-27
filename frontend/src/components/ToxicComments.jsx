/**
 * Toxic comments section — collapsible list of flagged comments with toxicity scores.
 */

import React, { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function ToxicComments({ toxicComments }) {
  const [expanded, setExpanded] = useState(false)

  if (!toxicComments || toxicComments.length === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-900 rounded-2xl border border-dark-800 p-6"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-950/50 border border-red-900 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-semibold text-white">Toxic Comments</h3>
            <p className="text-sm text-dark-400">{toxicComments.length} flagged comments</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-dark-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-dark-400" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              {toxicComments.map((comment, i) => (
                <div
                  key={comment.commentId || i}
                  className="bg-red-950/30 border border-red-900/50 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-dark-200 flex-1">"{comment.text}"</p>
                    <div className="flex-shrink-0">
                      <span className="text-xs text-red-400 font-mono">
                        {(comment.toxicityScore * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  {/* Toxicity score bar */}
                  <div className="mt-2 h-1.5 bg-dark-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${comment.toxicityScore * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
