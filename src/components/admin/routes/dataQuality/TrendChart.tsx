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

interface TrendChartProps {
  title: string
  data: { day: string; value: number }[]
  stroke: string
  yDomain?: [number, number]
  yFormat?: (v: number) => string
  emptyHint: string
}

export function TrendChart({
  title,
  data,
  stroke,
  yDomain,
  yFormat,
  emptyHint,
}: Readonly<TrendChartProps>): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                domain={yDomain ?? ['auto', 'auto']}
                tickFormatter={yFormat}
              />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(value: unknown) => {
                  const n = typeof value === 'number' ? value : Number(value)
                  return yFormat ? yFormat(n) : n
                }}
              />
              <Line type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
