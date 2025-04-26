/**
 * Sentiment distribution donut chart using Recharts.
 * Shows positive/negative/neutral percentages.
 */

import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { motion } from 'framer-motion'

const COLORS = {
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#eab308',
}

export default function SentimentChart({ sentimentDistribution }) {
  const data = [
    { name: 'Positive', value: sentimentDistribution?.positive || 0, key: 'positive' },
    { name: 'Negative', value: sentimentDistribution?.negative || 0, key: 'negative' },
    { name: 'Neutral', value: sentimentDistribution?.neutral || 0, key: 'neutral' },
  ].filter((d) => d.value > 0)

  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (total === 0) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-900 rounded-2xl border border-dark-800 p-6"
    >
      <h3 className="text-lg font-semibold text-white mb-4">Sentiment Distribution</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1d27',
                border: '1px solid #2a2f3d',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value) => [`${value} (${Math.round((value / total) * 100)}%)`, '']}
            />
            <Legend
              wrapperStyle={{ fontSize: '14px', color: '#aeb6c4' }}
              formatter={(value, entry) => (
                <span style={{ color: '#aeb6c4' }}>
                  {value}: {entry.payload?.value} ({Math.round((entry.payload?.value / total) * 100)}%)
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
