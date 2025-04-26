/**
 * Timeline sentiment chart — shows sentiment intensity across video timestamps.
 * Uses a horizontal bar chart with color gradient (green → red) per time bucket.
 */

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'

const SENTIMENT_COLORS = {
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#eab308',
}

export default function TimelineChart({ timelineData }) {
  if (!timelineData || timelineData.length === 0) {
    return null
  }

  const data = timelineData.map((bucket) => ({
    time: bucket.timeStart,
    score: bucket.sentimentScore,
    count: bucket.commentCount,
    dominant: bucket.dominantSentiment,
    label: `${bucket.timeStart}–${bucket.timeEnd}`,
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-900 rounded-2xl border border-dark-800 p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Timeline Sentiment</h3>
        <span className="text-sm text-dark-400 font-normal ml-2">
          ({data.length} time segments)
        </span>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 20, top: 10, bottom: 10 }}>
            <XAxis
              dataKey="time"
              stroke="#636e87"
              fontSize={11}
              angle={-30}
              textAnchor="end"
              height={60}
            />
            <YAxis
              stroke="#636e87"
              fontSize={12}
              domain={[-1, 1]}
              ticks={[-1, -0.5, 0, 0.5, 1]}
              label={{ value: 'Sentiment', angle: -90, position: 'insideLeft', fill: '#636e87', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1d27',
                border: '1px solid #2a2f3d',
                borderRadius: '8px',
                color: '#fff',
              }}
              cursor={{ fill: '#2a2f3d40' }}
              formatter={(value, name, props) => {
                if (name === 'score') {
                  const dominant = props.payload.dominant
                  const count = props.payload.count
                  return [`Score: ${value.toFixed(2)} (${dominant}, ${count} comments)`, 'Sentiment']
                }
                return [value, name]
              }}
            />
            <ReferenceLine y={0} stroke="#4e566f" strokeDasharray="3 3" />
            <Bar dataKey="score" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={SENTIMENT_COLORS[entry.dominant] || SENTIMENT_COLORS.neutral}
                  fillOpacity={0.3 + Math.abs(entry.score) * 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-xs text-dark-500">
        Bars show sentiment intensity per time segment. Green = positive, Red = negative, Yellow = neutral.
        Opensity indicates strength of sentiment.
      </p>
    </motion.div>
  )
}
