import type { Answer, GuessAnalytics } from '../_game-engine'

interface GuessAnalyticsInput {
  guessId: string
  probs: Map<string, number>
  answers: Answer[]
  remaining: number
  readiness: {
    trigger?: string | null
    forced?: boolean
    gap?: number
    aliveCount?: number
    questionsRemaining?: number
  }
}

function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100
}

export function buildGuessAnalytics(input: GuessAnalyticsInput): GuessAnalytics {
  const confidence = input.probs.get(input.guessId) || 0
  const probValues = Array.from(input.probs.values()).filter((p) => p > 0)
  const entropy = probValues.reduce((sum, p) => (p > 0 ? sum - p * Math.log2(p) : sum), 0)

  const answerDistribution: Record<string, number> = { yes: 0, no: 0, maybe: 0, unknown: 0 }
  for (const answer of input.answers) {
    answerDistribution[answer.value] = (answerDistribution[answer.value] || 0) + 1
  }

  return {
    confidence: roundToTwo(confidence),
    entropy: roundToTwo(entropy),
    remaining: input.remaining,
    answerDistribution,
    trigger: input.readiness.trigger ?? undefined,
    forced: input.readiness.forced,
    gap: input.readiness.gap != null ? roundToTwo(input.readiness.gap) : undefined,
    aliveCount: input.readiness.aliveCount,
    questionsRemaining: input.readiness.questionsRemaining,
  }
}
