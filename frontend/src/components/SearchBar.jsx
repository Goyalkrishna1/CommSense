/**
 * Search bar with mode toggle (Semantic / Keyword / Hybrid) and results panel.
 * Always visible above the dashboard when results are shown.
 */

import React, { useState, useCallback, useEffect } from 'react'
import { Search, X, Loader2, Brain, Type, Layers } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { searchCommentsApi } from '../api/client'

const MODES = [
  { value: 'semantic', label: 'Semantic', icon: Brain },
  { value: 'keyword', label: 'Keyword', icon: Type },
  { value: 'hybrid', label: 'Hybrid', icon: Layers },
]

const SENTIMENT_COLORS = {
  positive: 'text-green-400 bg-green-950/50 border-green-900',
  negative: 'text-red-400 bg-red-950/50 border-red-900',
  neutral: 'text-yellow-400 bg-yellow-950/50 border-yellow-900',
}

export default function SearchBar({ videoId }) {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState('hybrid')
  const [results, setResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState(null)

  // Debounced search — 300ms after user stops typing
  const debouncedSearch = useCallback(
    debounce(async (q, m) => {
      if (!q.trim()) {
        setResults(null)
        return
      }

      setIsSearching(true)
      setError(null)

      try {
        const data = await searchCommentsApi(videoId, q, m, 20)
        setResults(data)
      } catch (err) {
        console.error('Search failed:', err)
        setError(err.response?.data?.error || 'Search failed')
        setResults(null)
      } finally {
        setIsSearching(false)
      }
    }, 300),
    [videoId]
  )

  useEffect(() => {
    debouncedSearch(query, mode)
  }, [query, mode, debouncedSearch])

  const handleClear = () => {
    setQuery('')
    setResults(null)
    setError(null)
  }

  return (
    <div className="mb-6">
      {/* Search input + mode toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search comments... (semantic, keyword, or hybrid)"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-dark-900 border border-dark-700 text-white placeholder-dark-500 focus:outline-none focus:border-blue-500 text-sm"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {isSearching && (
            <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
          )}
        </div>

        {/* Mode toggle buttons */}
        <div className="flex gap-1 bg-dark-900 rounded-xl border border-dark-700 p-1">
          {MODES.map((m) => {
            const Icon = m.icon
            return (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  mode === m.value
                    ? 'bg-blue-600 text-white'
                    : 'text-dark-400 hover:text-white hover:bg-dark-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 bg-red-950/50 border border-red-900 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Search results */}
      <AnimatePresence>
        {results && results.results && results.results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden"
          >
            <div className="bg-dark-900 rounded-xl border border-dark-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-white">
                  {results.results.length} results
                  {results.weights && (
                    <span className="ml-2 text-xs text-dark-400 font-normal">
                      (keyword: {results.weights.keyword}, semantic: {results.weights.semantic})
                    </span>
                  )}
                </h4>
                {results.queryAnalysis?.entities?.length > 0 && (
                  <span className="text-xs text-dark-400">
                    Entities: {results.queryAnalysis.entities.join(', ')}
                  </span>
                )}
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.results.map((result, i) => (
                  <div
                    key={result.commentId || i}
                    className="bg-dark-950 rounded-lg p-3 border border-dark-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-dark-200 flex-1">"{result.text}"</p>
                      <div className="flex-shrink-0 flex flex-col items-end gap-1">
                        {/* Score badge */}
                        {results.mode === 'hybrid' && (
                          <span className="text-xs font-mono text-blue-400">
                            {(result.hybridScore * 100).toFixed(1)}%
                          </span>
                        )}
                        {results.mode === 'semantic' && (
                          <span className="text-xs font-mono text-blue-400">
                            {(result.semanticScore * 100).toFixed(1)}%
                          </span>
                        )}
                        {results.mode === 'keyword' && (
                          <span className="text-xs font-mono text-green-400">
                            {(result.keywordScore * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Classification tags */}
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {result.sentiment && (
                        <span className={`px-2 py-0.5 rounded-md border text-xs ${SENTIMENT_COLORS[result.sentiment] || SENTIMENT_COLORS.neutral}`}>
                          {result.sentiment}
                        </span>
                      )}
                      {result.intent && (
                        <span className="px-2 py-0.5 rounded-md bg-dark-800 border border-dark-700 text-dark-300 text-xs">
                          {result.intent}
                        </span>
                      )}
                      {result.aspect && (
                        <span className="px-2 py-0.5 rounded-md bg-dark-800 border border-dark-700 text-dark-300 text-xs">
                          {result.aspect}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {results && results.results && results.results.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-center text-dark-500 text-sm py-4"
          >
            No results found for "{query}"
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Simple debounce utility
function debounce(fn, delay) {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn.apply(this, args), delay)
  }
}
