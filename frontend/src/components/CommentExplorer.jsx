/**
 * Comment explorer — searchable, sortable table of all analyzed comments.
 * Columns: comment text, sentiment, intent, topic, toxicity score, likes
 */

import React, { useState, useMemo } from 'react'
import { Search, ArrowUpDown, ThumbsUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'

const SENTIMENT_COLORS = {
  positive: 'text-green-400 bg-green-950/50 border-green-900',
  negative: 'text-red-400 bg-red-950/50 border-red-900',
  neutral: 'text-yellow-400 bg-yellow-950/50 border-yellow-900',
}

const PAGE_SIZE = 20

export default function CommentExplorer({ comments }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('likes')
  const [sortOrder, setSortOrder] = useState('desc')
  const [page, setPage] = useState(0)

  // Filter comments by search text
  const filtered = useMemo(() => {
    if (!search.trim()) return comments || []
    const query = search.toLowerCase()
    return (comments || []).filter(
      (c) =>
        c.text?.toLowerCase().includes(query) ||
        c.author?.toLowerCase().includes(query) ||
        c.sentiment?.toLowerCase().includes(query) ||
        c.intent?.toLowerCase().includes(query) ||
        c.aspect?.toLowerCase().includes(query)
    )
  }, [comments, search])

  // Sort filtered comments
  const sorted = useMemo(() => {
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      let aVal, bVal
      switch (sortBy) {
        case 'likes':
          aVal = a.likes || 0
          bVal = b.likes || 0
          break
        case 'sentiment':
          aVal = a.sentimentScore || 0
          bVal = b.sentimentScore || 0
          break
        case 'toxicity':
          aVal = a.toxicityScore || 0
          bVal = b.toxicityScore || 0
          break
        default:
          return 0
      }
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal
    })
    return sorted
  }, [filtered, sortBy, sortOrder])

  // Paginate
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(0)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-900 rounded-2xl border border-dark-800 p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          Comment Explorer
          <span className="ml-2 text-sm text-dark-400 font-normal">
            ({filtered.length} comments)
          </span>
        </h3>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          placeholder="Search comments by text, author, sentiment, intent..."
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-dark-950 border border-dark-700 text-white placeholder-dark-500 focus:outline-none focus:border-blue-500 text-sm"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-800 text-dark-400">
              <th className="text-left py-2 px-3 font-medium">Comment</th>
              <th className="text-left py-2 px-3 font-medium">Sentiment</th>
              <th className="text-left py-2 px-3 font-medium">Intent</th>
              <th className="text-left py-2 px-3 font-medium">Aspect</th>
              <th
                className="text-left py-2 px-3 font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('likes')}
              >
                <span className="flex items-center gap-1">
                  Likes
                  <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
              <th
                className="text-left py-2 px-3 font-medium cursor-pointer hover:text-white"
                onClick={() => handleSort('toxicity')}
              >
                <span className="flex items-center gap-1">
                  Toxicity
                  <ArrowUpDown className="w-3 h-3" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((comment, i) => (
              <tr
                key={comment.commentId || i}
                className="border-b border-dark-800/50 hover:bg-dark-800/30 transition-colors"
              >
                <td className="py-3 px-3 max-w-md">
                  <p className="text-dark-200 truncate">{comment.text}</p>
                  <p className="text-xs text-dark-500 mt-1">{comment.author}</p>
                </td>
                <td className="py-3 px-3">
                  <span
                    className={`px-2 py-1 rounded-md border text-xs ${
                      SENTIMENT_COLORS[comment.sentiment] || SENTIMENT_COLORS.neutral
                    }`}
                  >
                    {comment.sentiment}
                  </span>
                </td>
                <td className="py-3 px-3 text-dark-300">{comment.intent}</td>
                <td className="py-3 px-3 text-dark-300">{comment.aspect}</td>
                <td className="py-3 px-3">
                  <span className="flex items-center gap-1 text-dark-300">
                    <ThumbsUp className="w-3 h-3" />
                    {comment.likes || 0}
                  </span>
                </td>
                <td className="py-3 px-3">
                  {comment.toxicityScore > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-dark-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            comment.toxicityScore >= 0.5 ? 'bg-red-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${comment.toxicityScore * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-dark-400 font-mono">
                        {(comment.toxicityScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-dark-600 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-dark-400">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg bg-dark-800 text-dark-300 hover:bg-dark-700 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-lg bg-dark-800 text-dark-300 hover:bg-dark-700 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-8 text-dark-500">
          {search ? 'No comments match your search.' : 'No comments available.'}
        </div>
      )}
    </motion.div>
  )
}
