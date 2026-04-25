import { memo } from 'react'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'
import { Card } from '@/components/ui/card'

interface PossibilitySpaceChartProps {
  /** Each entry = [first, second, third] candidate probability after a turn */
  probHistory: Array<[number, number, number]>
}

/**
 * Shows how the top-3 candidate probabilities diverge over turns.
 * When one line pulls away from the others, the AI is homing in.
 */
export const PossibilitySpaceChart = memo(function PossibilitySpaceChart({ probHistory }: PossibilitySpaceChartProps) {
  const data = probHistory.map((entry, i) => ({
    turn: i + 1,
    first: entry[0],
    second: entry[1],
    third: entry[2],
  }))

  return (
    <Card className="p-4 bg-card/50 backdrop-blur-sm border border-border/50">
      <p className="text-xs font-semibold text-muted-foreground mb-2">
        Top suspect probability trace
      </p>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded border border-border bg-card/90 px-2 py-1 text-xs">
                  <p className="font-medium mb-1">Turn {label}</p>
                  {payload.map((p) => (
                    <p key={p.dataKey as string} style={{ color: p.color }}>
                      #{p.dataKey === 'first' ? 1 : p.dataKey === 'second' ? 2 : 3}: {p.value}%
                    </p>
                  ))}
                </div>
              )
            }}
          />
          <Line type="monotone" dataKey="first" dot={false} strokeWidth={2} stroke="oklch(0.72 0.18 155)" isAnimationActive={false} />
          <Line type="monotone" dataKey="second" dot={false} strokeWidth={1.5} stroke="oklch(0.70 0.15 220)" isAnimationActive={false} />
          <Line type="monotone" dataKey="third" dot={false} strokeWidth={1} stroke="oklch(0.55 0.08 240)" isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  )
})

