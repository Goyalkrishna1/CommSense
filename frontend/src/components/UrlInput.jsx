/**
 * URL input bar with Analyze button.
 * Validates YouTube URLs and triggers the analysis flow.
 */

import React, { useState } from 'react'
import { Search, Loader2, AlertCircle } from 'lucide-react'

export default function UrlInput({ onAnalyze, isLoading }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!url.trim()) {
      setError('Please enter a YouTube URL')
      return
    }

    // Basic URL validation
    const patterns = [
      /youtube\.com\/watch\?v=/,
      /youtu\.be\//,
      /youtube\.com\/embed\//,
      /youtube\.com\/shorts\//,
    ]
    const isValid = patterns.some((p) => p.test(url))
    if (!isValid) {
      setError('Please enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=...)')
      return
    }

    onAnalyze(url.trim())
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube video URL..."
            disabled={isLoading}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-dark-900 border border-dark-700 text-white placeholder-dark-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Analyze'
          )}
        </button>
      </form>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <p className="mt-4 text-dark-400 text-sm">
        Enter a YouTube video URL to analyze its comments with AI-powered sentiment, topic modeling, and semantic search.
      </p>
    </div>
  )
}
