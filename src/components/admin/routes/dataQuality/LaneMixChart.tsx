import React from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface LaneMixChartProps {
  title: string
  data: Array<{ day: string; automation: number; manual: number }>
  emptyHint: string
}

export function LaneMixChart({
  title,
  data,
  emptyHint,
}: Readonly<LaneMixChartProps>): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                domain={[0, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value: unknown, name) => {
                  const n = typeof value === 'number' ? value : Number(value)
                  const label = name === 'automation' ? 'Automation share' : 'Manual share'
                  return [`${(n * 100).toFixed(1)}%`, label]
                }}
              />
              <Line type="monotone" dataKey="automation" stroke="#16a34a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="manual" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
