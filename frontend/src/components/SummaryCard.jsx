/**
 * LLM Summary card — displays the AI-generated executive summary.
 * Prominent placement near the top of the dashboard.
 */

import React from 'react'
import { Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

export default function SummaryCard({ summary }) {
  if (!summary) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-blue-950/50 to-purple-950/50 rounded-2xl border border-blue-900/50 p-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-700/50 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">AI Executive Summary</h3>
        <span className="text-xs text-dark-400 ml-auto">Powered by Groq</span>
      </div>
      <p className="text-dark-200 leading-relaxed">{summary}</p>
    </motion.div>
  )
}
