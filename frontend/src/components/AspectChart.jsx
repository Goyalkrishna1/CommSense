/**
 * Aspect-based sentiment horizontal bar chart using Recharts.
 * Shows positive vs negative counts per aspect.
 */

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts'
import { motion } from 'framer-motion'

export default function AspectChart({ aspectSentiment }) {
  if (!aspectSentiment || aspectSentiment.length === 0) {
    return null
  }

  const data = aspectSentiment.map((a) => ({
    aspect: a.aspect,
    positive: a.positive || 0,
    negative: a.negative || 0,
    neutral: a.neutral || 0,
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-900 rounded-2xl border border-dark-800 p-6"
    >
      <h3 className="text-lg font-semibold text-white mb-4">Aspect-Based Sentiment</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 20, right: 20, top: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3d" />
            <XAxis
              type="number"
              stroke="#636e87"
              fontSize={12}
            />
            <YAxis
              type="category"
              dataKey="aspect"
              stroke="#aeb6c4"
              fontSize={12}
              width={120}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1d27',
                border: '1px solid #2a2f3d',
                borderRadius: '8px',
                color: '#fff',
              }}
              cursor={{ fill: '#2a2f3d40' }}
            />
            <Legend wrapperStyle={{ fontSize: '14px' }} />
            <Bar dataKey="positive" name="Positive" fill="#22c55e" radius={[0, 4, 4, 0]} />
            <Bar dataKey="negative" name="Negative" fill="#ef4444" radius={[0, 4, 4, 0]} />
            <Bar dataKey="neutral" name="Neutral" fill="#eab308" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
