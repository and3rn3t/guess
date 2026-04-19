import { memo, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, UserCircle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Character, Answer } from '@/lib/types'
import { calculateProbabilities } from '@/lib/gameEngine'

interface ProbabilityLeaderboardProps {
  characters: Character[]
  answers: Answer[]
  /** Pre-computed probabilities map — avoids redundant recalculation */
  probabilities?: Map<string, number> | null
}

interface RankedCandidate {
  id: string
  name: string
  category: string
  probability: number
  imageUrl?: string
}

export const ProbabilityLeaderboard = memo(function ProbabilityLeaderboard({ characters, answers, probabilities: externalProbs }: ProbabilityLeaderboardProps) {
  const topCandidates = useMemo((): RankedCandidate[] => {
    if (characters.length === 0) return []

    const probabilities = externalProbs ?? calculateProbabilities(characters, answers)

    return Array.from(probabilities.entries())
      .map(([id, probability]) => {
        const char = characters.find((c) => c.id === id)
        return {
          id,
          name: char?.name ?? id,
          category: char?.category ?? '',
          probability,
          imageUrl: char?.imageUrl,
        }
      })
      .filter((c) => c.probability > 0)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5)
  }, [characters, answers, externalProbs])

  if (topCandidates.length === 0) return null

  const maxProb = topCandidates[0].probability

  return (
    <Card className="p-4 bg-card/50 backdrop-blur-sm border border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <Crown size={18} weight="fill" className="text-accent" />
        <h4 className="text-sm font-semibold text-foreground">Top Suspects</h4>
        <Badge variant="secondary" className="ml-auto text-xs">
          Live
        </Badge>
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {topCandidates.map((candidate, index) => {
            const pct = Math.round(candidate.probability * 100)
            return (
              <motion.div
                key={candidate.id}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="relative"
              >
                <div className="flex items-center gap-2 relative z-10 py-1.5 px-2 rounded-md">
                  <span className="text-xs font-bold text-muted-foreground w-4 text-right shrink-0">
                    {index + 1}
                  </span>
                  {candidate.imageUrl ? (
                    <img
                      src={candidate.imageUrl}
                      alt=""
                      className={`w-5 h-5 rounded-full object-cover shrink-0 ${index === 0 ? 'ring-1 ring-accent' : ''}`}
                    />
                  ) : (
                    <UserCircle
                      size={20}
                      weight={index === 0 ? 'fill' : 'regular'}
                      className={index === 0 ? 'text-accent' : 'text-muted-foreground'}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm truncate ${index === 0 ? 'font-semibold text-foreground' : 'text-foreground/80'}`}
                      >
                        {candidate.name}
                      </span>
                      <span
                        className={`text-sm font-mono shrink-0 ${index === 0 ? 'font-bold text-accent' : 'text-muted-foreground'}`}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary/30 mt-1 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${index === 0 ? 'bg-accent' : 'bg-accent/40'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${maxProb > 0 ? (candidate.probability / maxProb) * 100 : 0}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </Card>
  )
});
