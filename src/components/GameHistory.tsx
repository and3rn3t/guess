import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ClockCounterClockwise, Trophy, XCircle, CaretDown, ArrowLeft } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { GameHistoryEntry } from '@/lib/types'
import { DIFFICULTIES } from '@/lib/types'

interface GameHistoryProps {
  history: GameHistoryEntry[]
  loading?: boolean
  onBack: () => void
}

const PAGE_SIZE = 20

export function GameHistory({ history, loading = false, onBack }: GameHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp)
  const visible = sorted.slice(0, visibleCount)
  const hasMore = visibleCount < sorted.length
  const wins = history.filter((g) => g.won).length
  const winRate = history.length > 0 ? Math.round((wins / history.length) * 100) : 0

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={onBack} variant="ghost" size="icon">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h2 className="text-3xl font-bold text-foreground">Game History</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {history.length} game{history.length !== 1 ? 's' : ''} played
            </p>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}
      {!loading && history.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card className="p-3 sm:p-4 text-center bg-card/50 backdrop-blur-sm border-primary/20">
            <div className="text-xl sm:text-2xl font-bold text-accent">{history.length}</div>
            <div className="text-xs text-muted-foreground">Games</div>
          </Card>
          <Card className="p-3 sm:p-4 text-center bg-card/50 backdrop-blur-sm border-primary/20">
            <div className="text-xl sm:text-2xl font-bold text-accent">{wins}</div>
            <div className="text-xs text-muted-foreground">Wins</div>
          </Card>
          <Card className="p-3 sm:p-4 text-center bg-card/50 backdrop-blur-sm border-primary/20">
            <div className="text-xl sm:text-2xl font-bold text-accent">{winRate}%</div>
            <div className="text-xs text-muted-foreground">Win Rate</div>
          </Card>
        </div>
      )}

      {/* Game list */}
      {!loading && sorted.length === 0 ? (
        <Card className="p-5 sm:p-8 text-center bg-card/50 backdrop-blur-sm border-primary/20">
          <ClockCounterClockwise size={48} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No games played yet. Start a game to see your history!</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((game) => {
            const isExpanded = expandedId === game.id
            const date = new Date(game.timestamp)
            const diffLabel = DIFFICULTIES[game.difficulty]?.label ?? game.difficulty

            return (
              <Card key={game.id} className="bg-card/50 backdrop-blur-sm border-primary/20 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : game.id)}
                  className="w-full text-left p-4 flex items-center gap-3"
                >
                  {game.won ? (
                    <Trophy size={24} weight="fill" className="text-accent shrink-0" />
                  ) : (
                    <XCircle size={24} weight="fill" className="text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground truncate">{game.characterName}</span>
                      <Badge variant={game.won ? 'default' : 'secondary'} className="text-xs">
                        {game.won ? 'Won' : 'Lost'}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {diffLabel}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {game.steps.length} question{game.steps.length !== 1 ? 's' : ''} · {formatDate(date)}
                    </div>
                  </div>
                  <CaretDown
                    size={18}
                    className={`text-muted-foreground transition-transform shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-border/50 pt-3">
                        <ol className="space-y-2">
                          {game.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm">
                              <span className="text-muted-foreground font-mono text-xs w-5 pt-0.5 text-right shrink-0">
                                {i + 1}.
                              </span>
                              <span className="text-foreground/90 flex-1">{step.questionText}</span>
                              <Badge
                                variant="outline"
                                className={`text-xs shrink-0 ${answerColor(step.answer)}`}
                              >
                                {step.answer}
                              </Badge>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            )
          })}
          {hasMore && (
            <div className="text-center pt-2">
              <Button
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                variant="outline"
                size="sm"
              >
                Show more ({sorted.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function answerColor(answer: string): string {
  switch (answer) {
    case 'yes': return 'border-green-500/50 text-green-400'
    case 'no': return 'border-red-500/50 text-red-400'
    case 'maybe': return 'border-yellow-500/50 text-yellow-400'
    default: return 'border-muted-foreground/50 text-muted-foreground'
  }
}

function formatDate(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
