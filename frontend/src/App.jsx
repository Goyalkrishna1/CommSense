import React, { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import UrlInput from './components/UrlInput'
import LoadingState from './components/LoadingState'
import Dashboard from './components/Dashboard'
import { submitAnalysis, pollJobUntilDone, getResults } from './api/client'

// Main App component — orchestrates the analysis flow:
// URL input → job creation → progress polling → results display
function App() {
  const [isLoading, setIsLoading] = useState(false)
  const [jobStatus, setJobStatus] = useState(null)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const handleAnalyze = async (url) => {
    setIsLoading(true)
    setError(null)
    setResults(null)
    setJobStatus({ status: 'waiting', progress: 0 })

    try {
      // Step 1: Submit the URL for analysis
      const response = await submitAnalysis(url)

      // If already analyzed (cache hit), fetch results directly
      if (response.status === 'completed' && response.videoId) {
        const data = await getResults(response.videoId)
        setResults(data)
        setIsLoading(false)
        setJobStatus(null)
        return
      }

      // Step 2: Poll job status until complete
      await pollJobUntilDone(
        response.jobId,
        (status) => setJobStatus(status),
        2000
      )

      // Step 3: Fetch the full results
      const data = await getResults(response.videoId)
      setResults(data)
      setJobStatus(null)
    } catch (err) {
      console.error('Analysis failed:', err)
      setError(err.message || 'Failed to analyze comments. Please try again.')
      setJobStatus(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-950 text-dark-100">
      {/* Header */}
      <header className="border-b border-dark-800 px-6 py-4 sticky top-0 bg-dark-950/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">
            YouTube Comments Analyzer
          </h1>
          <span className="text-sm text-dark-400">AI-Powered Comment Analysis</span>
        </div>
      </header>

      {/* Main content */}
      <main className="px-6 py-8">
        {/* URL input — always visible when not loading and no results */}
        {!isLoading && !results && (
          <div className="py-16">
            <UrlInput onAnalyze={handleAnalyze} isLoading={isLoading} />
          </div>
        )}

        {/* Compact URL input when results are shown (for re-analysis) */}
        {results && !isLoading && (
          <div className="mb-6">
            <UrlInput onAnalyze={handleAnalyze} isLoading={isLoading} />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-950/50 border border-red-900 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Loading state with progress */}
        <AnimatePresence mode="wait">
          {isLoading && jobStatus && (
            <LoadingState jobStatus={jobStatus} />
          )}
        </AnimatePresence>

        {/* Results dashboard */}
        {results && !isLoading && (
          <Dashboard data={results} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-800 px-6 py-4 text-center text-dark-500 text-sm">
        Built with React, FastAPI, Transformers, BERTopic & Groq
      </footer>
    </div>
  )
}

export default App
