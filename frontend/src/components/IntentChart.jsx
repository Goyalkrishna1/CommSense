/**
 * Intent breakdown chart using Recharts treemap.
 * Shows proportion of each intent type (praise, question, complaint, etc.)
 */

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { motion } from 'framer-motion'

const INTENT_COLORS = {
  praise: '#22c55e',
  question: '#3b82f6',
  feedback: '#8b5cf6',
  complaint: '#ef4444',
  suggestion: '#06b6d4',
  'off-topic': '#6b7280',
}

export default function IntentChart({ intentBreakdown }) {
  if (!intentBreakdown || intentBreakdown.length === 0) {
    return null
  }

  const data = intentBreakdown.map((i) => ({
    intent: i.intent,
    count: i.count,
    fill: INTENT_COLORS[i.intent] || '#6b7280',
  }))

  const total = data.reduce((sum, d) => sum + d.count, 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-900 rounded-2xl border border-dark-800 p-6"
    >
      <h3 className="text-lg font-semibold text-white mb-4">Intent Breakdown</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
            <XAxis
              dataKey="intent"
              stroke="#636e87"
              fontSize={11}
              angle={-20}
              textAnchor="end"
              height={60}
            />
            <YAxis stroke="#636e87" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1d27',
                border: '1px solid #2a2f3d',
                borderRadius: '8px',
                color: '#fff',
              }}
              cursor={{ fill: '#2a2f3d40' }}
              formatter={(value) => [`${value} (${Math.round((value / total) * 100)}%)`, 'Count']}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
