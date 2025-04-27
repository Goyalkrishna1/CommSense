/**
 * Dashboard — assembles all analysis result components into a grid layout.
 * Renders when analysis results are available.
 *
 * Heavy chart components are lazy-loaded via React.lazy + Suspense to
 * reduce the initial bundle parse time. The first render shows the
 * header, summary, and search bar immediately while charts load
 * on-demand.
 */

import React, { Suspense, lazy } from 'react'
import { motion } from 'framer-motion'
import HeaderCard from './HeaderCard'
import SummaryCard from './SummaryCard'
import SearchBar from './SearchBar'

// Lazy-loaded chart components — loaded on-demand when Dashboard renders
const SentimentChart = lazy(() => import('./SentimentChart'))
const AspectChart = lazy(() => import('./AspectChart'))
const IntentChart = lazy(() => import('./IntentChart'))
const TimelineChart = lazy(() => import('./TimelineChart'))
const TopicClusters = lazy(() => import('./TopicClusters'))
const ToxicComments = lazy(() => import('./ToxicComments'))
const CommentExplorer = lazy(() => import('./CommentExplorer'))

// Simple loading fallback for lazy-loaded chart components
function ChartFallback() {
  return (
    <div className="flex items-center justify-center h-48 bg-dark-900/50 rounded-xl border border-dark-800">
      <div className="w-6 h-6 border-2 border-dark-700 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )
}

export default function Dashboard({ data }) {
  const { video, analysis } = data

  if (!analysis) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-6xl mx-auto space-y-6 pb-12"
    >
      {/* Header card with video info + overall sentiment */}
      <HeaderCard video={video} analysis={analysis} />

      {/* LLM executive summary (prominent placement) */}
      <SummaryCard summary={analysis.llmSummary} />

      {/* Search bar — always visible above dashboard */}
      <SearchBar videoId={video?.videoId} />

      {/* Lazy-loaded charts — wrapped in Suspense with spinner fallback */}
      <Suspense fallback={<ChartFallback />}>
        {/* Charts row: sentiment + intent */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SentimentChart sentimentDistribution={analysis.sentimentDistribution} />
          <IntentChart intentBreakdown={analysis.intentBreakdown} />
        </div>

        {/* Aspect-based sentiment */}
        <AspectChart aspectSentiment={analysis.aspectSentiment} />

        {/* Timeline sentiment */}
        <TimelineChart timelineData={analysis.timelineData} />

        {/* Topic clusters */}
        <TopicClusters topicClusters={analysis.topicClusters} />

        {/* Toxic comments */}
        <ToxicComments toxicComments={analysis.toxicComments} />

        {/* Comment explorer */}
        <CommentExplorer comments={analysis.comments} />
      </Suspense>
    </motion.div>
  )
}
