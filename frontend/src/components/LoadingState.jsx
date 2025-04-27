/**
 * Loading state component with progress indicator.
 * Shows pipeline stages as the analysis job progresses.
 */

import React from 'react'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'

const STAGES = [
  { threshold: 0, label: 'Queued' },
  { threshold: 10, label: 'Fetching video metadata' },
  { threshold: 25, label: 'Fetching comments' },
  { threshold: 50, label: 'Running NLP analysis' },
  { threshold: 90, label: 'Storing results' },
  { threshold: 100, label: 'Complete' },
]

export default function LoadingState({ jobStatus }) {
  const progress = jobStatus?.progress || 0
  const status = jobStatus?.status || 'waiting'

  const getStageIndex = () => {
    for (let i = STAGES.length - 1; i >= 0; i--) {
      if (progress >= STAGES[i].threshold) return i
    }
    return 0
  }

  const currentStage = getStageIndex()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl mx-auto py-12"
    >
      <div className="bg-dark-900 rounded-2xl border border-dark-800 p-8">
        <div className="flex items-center gap-3 mb-6">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          <h2 className="text-lg font-semibold text-white">Analyzing comments...</h2>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-dark-400 mb-2">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Pipeline stages */}
        <div className="space-y-3">
          {STAGES.map((stage, index) => {
            const isComplete = index < currentStage
            const isActive = index === currentStage
            const isFailed = status === 'failed' && isActive

            return (
              <div
                key={stage.label}
                className={`flex items-center gap-3 text-sm transition-opacity ${
                  index <= currentStage ? 'opacity-100' : 'opacity-40'
                }`}
              >
                {isFailed ? (
                  <XCircle className="w-5 h-5 text-red-500" />
                ) : isComplete ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-dark-700" />
                )}
                <span className={isComplete ? 'text-dark-300' : isActive ? 'text-white' : 'text-dark-500'}>
                  {stage.label}
                </span>
              </div>
            )
          })}
        </div>

        {status === 'failed' && jobStatus?.error && (
          <div className="mt-6 p-4 bg-red-950/50 border border-red-900 rounded-lg text-red-300 text-sm">
            {jobStatus.error}
          </div>
        )}
      </div>
    </motion.div>
  )
}
