import { memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Lightbulb, Sparkle, CaretDown, Trophy, UserCircle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import type { GuessReadinessSnapshot, ReasoningExplanation } from '@/lib/types'

interface ReasoningPanelProps {
  reasoning: ReasoningExplanation | null
  readiness?: GuessReadinessSnapshot | null
  isThinking?: boolean
}

function ReasoningPanelBase({ reasoning, readiness = null, isThinking = false }: Readonly<ReasoningPanelProps>) {
  const [expanded, setExpanded] = useState(false)

  if (!reasoning) {
    return (
      <Card className="p-6 bg-card/50 backdrop-blur-sm border-2 border-primary/20">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="text-accent" size={24} weight="duotone" />
          <h3 className="text-xl font-semibold">AI Reasoning</h3>
        </div>
        <p className="text-muted-foreground">
          Start the game to see how the AI analyzes your answers and narrows down possibilities.
        </p>
      </Card>
    )
  }

  const statsBar = (
    <div className="grid grid-cols-2 gap-4" aria-live="polite">
      <div className="text-center p-3 rounded-lg bg-secondary/20 border border-secondary">
        <div className="text-2xl font-bold text-accent">{reasoning.remaining}</div>
        <div className="text-xs text-muted-foreground mt-1">Possibilities</div>
      </div>
      <div className="text-center p-3 rounded-lg bg-secondary/20 border border-secondary">
        <div className="text-2xl font-bold text-accent">{reasoning.confidence}%</div>
        <div className="text-xs text-muted-foreground mt-1">Confidence</div>
      </div>
    </div>
  )

  const topCandidatesSection = reasoning.topCandidates && reasoning.topCandidates.length > 0 ? (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="text-accent" size={20} weight="fill" />
        <h4 className="font-semibold text-sm">Top Suspects</h4>
      </div>
      <div className="space-y-1.5">
        {reasoning.topCandidates.slice(0, 5).map((candidate, i) => (
          <div key={candidate.name} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}.</span>
            {candidate.imageUrl ? (
              <img src={candidate.imageUrl} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
            ) : (
              <UserCircle size={16} className="text-muted-foreground shrink-0" />
            )}
            <span className="text-sm text-foreground/90 flex-1 truncate">{candidate.name}</span>
            <Progress value={candidate.probability} className="w-16 h-1.5" />
            <span className="text-xs text-muted-foreground w-8 text-right">{candidate.probability}%</span>
          </div>
        ))}
      </div>
    </div>
  ) : null

  const readinessLabel = readiness?.blockedByRejectCooldown
    ? 'Collecting More Evidence'
    : readiness?.trigger === 'high_certainty'
      ? 'Very Close'
      : readiness?.trigger === 'strict_readiness'
        ? 'Almost Ready To Guess'
        : 'Still Narrowing'

  const readinessDetail = readiness?.blockedByRejectCooldown
    ? `${readiness.rejectCooldownRemaining} more answer${readiness.rejectCooldownRemaining === 1 ? '' : 's'} before the next guess.`
    : readiness?.aliveCount != null && readiness?.questionsRemaining != null
      ? `${readiness.aliveCount} viable suspects with ${readiness.questionsRemaining} question${readiness.questionsRemaining === 1 ? '' : 's'} remaining.`
      : 'The AI is still reducing ambiguity before it commits to a guess.'

  const detailContent = (
    <>
      <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h4 className="font-semibold text-sm">Guess Readiness</h4>
          <Badge variant="outline" className="border-accent/30 text-accent">{readinessLabel}</Badge>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{readinessDetail}</p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="text-primary" size={20} weight="fill" />
          <h4 className="font-semibold text-sm">Why This Question?</h4>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">{reasoning.why}</p>
      </div>
      {topCandidatesSection && (
        <>
          <Separator className="bg-border/50" />
          {topCandidatesSection}
        </>
      )}
      <Separator className="bg-border/50" />
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkle className="text-accent" size={20} weight="fill" />
          <h4 className="font-semibold text-sm">Expected Impact</h4>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">{reasoning.impact}</p>
      </div>
    </>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={`p-6 bg-card/50 backdrop-blur-sm border-2 transition-all duration-300 ${
          isThinking ? 'border-accent animate-glow-pulse' : 'border-primary/20'
        }`}
      >
        <div className="space-y-4 lg:space-y-6">
          {/* Header — tappable on mobile to expand/collapse */}
          <button
            onClick={() => setExpanded((p) => !p)}
            className="flex items-center gap-3 w-full text-left min-h-[44px] lg:cursor-default"
          >
            <Brain className="text-accent" size={24} weight="duotone" />
            <h3 className="text-xl font-semibold">AI Reasoning</h3>
            {isThinking && (
              <Badge variant="outline" className="ml-auto border-accent text-accent lg:ml-auto" role="status">
                Processing...
              </Badge>
            )}
            <CaretDown
              size={20}
              className={`ml-auto text-muted-foreground transition-transform lg:hidden ${expanded ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Stats always visible */}
          {statsBar}

          {/* Peek strip: mobile-only persistent hint showing the #1 suspect */}
          {reasoning.topCandidates && reasoning.topCandidates.length > 0 && (
            <div className="flex items-center gap-2 py-0.5 lg:hidden">
              <Trophy className="text-accent shrink-0" size={14} weight="fill" />
              <span className="text-xs text-muted-foreground shrink-0">Most likely:</span>
              {reasoning.topCandidates[0].imageUrl ? (
                <img
                  src={reasoning.topCandidates[0].imageUrl}
                  alt=""
                  className="w-4 h-4 rounded-full object-cover shrink-0"
                />
              ) : (
                <UserCircle size={14} className="text-muted-foreground shrink-0" />
              )}
              <span className="text-sm font-medium text-foreground flex-1 truncate">
                {reasoning.topCandidates[0].name}
              </span>
              <Badge variant="outline" className="text-xs border-accent/40 text-accent shrink-0">
                {reasoning.topCandidates[0].probability}%
              </Badge>
            </div>
          )}

          {/* Details: always visible on lg+, collapsible on mobile */}
          <div className="hidden lg:block space-y-4">
            {detailContent}
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden lg:hidden space-y-4"
              >
                {detailContent}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  )
}

export const ReasoningPanel = memo(ReasoningPanelBase);
