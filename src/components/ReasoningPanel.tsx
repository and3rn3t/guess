import { motion } from 'framer-motion'
import { Brain, Lightbulb, Sparkle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { ReasoningExplanation } from '@/lib/types'

interface ReasoningPanelProps {
  reasoning: ReasoningExplanation | null
  isThinking?: boolean
}

export function ReasoningPanel({ reasoning, isThinking = false }: ReasoningPanelProps) {
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
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Brain className="text-accent" size={24} weight="duotone" />
            <h3 className="text-xl font-semibold">AI Reasoning</h3>
            {isThinking && (
              <Badge variant="outline" className="ml-auto border-accent text-accent">
                Processing...
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="text-primary" size={20} weight="fill" />
                <h4 className="font-semibold text-sm">Why This Question?</h4>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">{reasoning.why}</p>
            </div>

            <Separator className="bg-border/50" />

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkle className="text-accent" size={20} weight="fill" />
                <h4 className="font-semibold text-sm">Expected Impact</h4>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">{reasoning.impact}</p>
            </div>

            <Separator className="bg-border/50" />

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-secondary/20 border border-secondary">
                <div className="text-2xl font-bold text-accent">{reasoning.remaining}</div>
                <div className="text-xs text-muted-foreground mt-1">Possibilities</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-secondary/20 border border-secondary">
                <div className="text-2xl font-bold text-accent">{reasoning.confidence}%</div>
                <div className="text-xs text-muted-foreground mt-1">Confidence</div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
