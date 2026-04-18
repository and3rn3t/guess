import { memo, useMemo } from 'react'
import { Area, AreaChart, XAxis, YAxis } from 'recharts'
import { TrendDown } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { Character, Answer } from '@/lib/types'

interface PossibilitySpaceChartProps {
  /** All characters in the initial pool (before filtering) */
  totalCharacters: number
  /** Remaining characters after each answer, computed from game steps */
  characters: Character[]
  answers: Answer[]
}

interface DataPoint {
  question: number
  label: string
  remaining: number
  confidence: number
}

const chartConfig = {
  remaining: {
    label: 'Remaining',
    color: 'var(--color-accent)',
  },
  confidence: {
    label: 'Confidence',
    color: 'var(--color-primary)',
  },
} satisfies ChartConfig

/**
 * Shows how the possibility space shrinks after each answer.
 * Computes the count of viable characters at each step by replaying answers.
 */
export const PossibilitySpaceChart = memo(function PossibilitySpaceChart({
  totalCharacters,
  characters,
  answers,
}: PossibilitySpaceChartProps) {
  const data = useMemo((): DataPoint[] => {
    const points: DataPoint[] = [
      { question: 0, label: 'Start', remaining: totalCharacters, confidence: 0 },
    ]

    // Replay answers incrementally to get remaining count at each step
    for (let i = 0; i < answers.length; i++) {
      const partialAnswers = answers.slice(0, i + 1)
      const remaining = characters.filter((char) => {
        for (const answer of partialAnswers) {
          const attr = char.attributes[answer.questionId]
          if (answer.value === 'yes' && attr === false) return false
          if (answer.value === 'no' && attr === true) return false
        }
        return true
      }).length

      const confidence = remaining > 0 ? Math.round((1 / remaining) * 100) : 100

      points.push({
        question: i + 1,
        label: `Q${i + 1}`,
        remaining,
        confidence: Math.min(confidence, 100),
      })
    }

    return points
  }, [totalCharacters, characters, answers])

  if (answers.length === 0) return null

  const eliminated = totalCharacters - data[data.length - 1].remaining

  return (
    <Card className="p-4 bg-card/50 backdrop-blur-sm border border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <TrendDown size={18} weight="bold" className="text-accent" />
        <h4 className="text-sm font-semibold text-foreground">Elimination Progress</h4>
        <Badge variant="secondary" className="ml-auto text-xs">
          {eliminated} eliminated
        </Badge>
      </div>

      <ChartContainer config={chartConfig} className="h-[140px] w-full">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="fillRemaining" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10 }}
            allowDecimals={false}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) =>
                  name === 'remaining' ? `${value} characters` : `${value}%`
                }
              />
            }
          />
          <Area
            dataKey="remaining"
            type="monotone"
            stroke="var(--color-accent)"
            strokeWidth={2}
            fill="url(#fillRemaining)"
            animationDuration={500}
          />
        </AreaChart>
      </ChartContainer>
    </Card>
  )
});
