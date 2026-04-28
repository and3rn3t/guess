import { z } from 'zod'
import {
  AnswerValueSchema,
  GuessTriggerSchema,
} from '@guess/game-engine'
import { CHARACTER_CATEGORIES } from './types'

export { AnswerValueSchema, GuessTriggerSchema }

// ── Domain enums ──────────────────────────────────────────────────────────────

export const CharacterCategorySchema = z.enum(CHARACTER_CATEGORIES)

export const DifficultySchema = z.enum(['easy', 'medium', 'hard'])

// ── Domain entities ───────────────────────────────────────────────────────────

export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: CharacterCategorySchema,
  attributes: z.record(z.string(), z.union([z.boolean(), z.null()])),
  imageUrl: z.string().optional(),
  isCustom: z.boolean().optional(),
  createdBy: z.string().optional(),
  createdAt: z.number().optional(),
})

export const QuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  attribute: z.string(),
  displayText: z.string().optional(),
  category: z.string().optional(),
})

export const AnswerSchema = z.object({
  questionId: z.string(),
  value: AnswerValueSchema,
})

export const ReasoningExplanationSchema = z.object({
  why: z.string(),
  impact: z.string(),
  remaining: z.number(),
  confidence: z.number(),
  topCandidates: z
    .array(
      z.object({
        name: z.string(),
        probability: z.number(),
        imageUrl: z.string().nullable().optional(),
      }),
    )
    .optional(),
})

export const GuessReadinessSnapshotSchema = z.object({
  trigger: GuessTriggerSchema,
  blockedByRejectCooldown: z.boolean(),
  rejectCooldownRemaining: z.number(),
  topProbability: z.number().optional(),
  gap: z.number().optional(),
  aliveCount: z.number().optional(),
  questionsRemaining: z.number().optional(),
  forced: z.boolean().optional(),
})

export const GameHistoryStepSchema = z.object({
  questionId: z.string().optional(),
  questionText: z.string(),
  attribute: z.string(),
  answer: AnswerValueSchema,
})

export const GameHistoryEntrySchema = z.object({
  id: z.string(),
  characterId: z.string(),
  characterName: z.string(),
  won: z.boolean(),
  timestamp: z.number(),
  difficulty: DifficultySchema,
  totalQuestions: z.number(),
  steps: z.array(GameHistoryStepSchema),
})

// ── API response schemas ──────────────────────────────────────────────────────

export const StartResponseSchema = z.object({
  sessionId: z.string(),
  question: QuestionSchema,
  reasoning: ReasoningExplanationSchema,
  totalCharacters: z.number(),
  maxQuestions: z.number().optional(),
})

const ReadinessSchema = z.object({
  trigger: GuessTriggerSchema.optional(),
  blockedByRejectCooldown: z.boolean().optional(),
  rejectCooldownRemaining: z.number().optional(),
  topProbability: z.number().optional(),
  gap: z.number().optional(),
  aliveCount: z.number().optional(),
  questionsRemaining: z.number().optional(),
  forced: z.boolean().optional(),
})

export const AnswerResponseSchema = z.object({
  type: z.enum(['question', 'guess', 'contradiction']),
  question: QuestionSchema.optional(),
  reasoning: ReasoningExplanationSchema.optional(),
  character: z
    .object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      imageUrl: z.string().nullable(),
    })
    .optional(),
  confidence: z.number().optional(),
  remaining: z.number().optional(),
  eliminated: z.number().optional(),
  questionCount: z.number().optional(),
  guessCount: z.number().optional(),
  message: z.string().optional(),
  readiness: ReadinessSchema.optional(),
})

export const SkipResponseSchema = z.object({
  type: z.literal('question'),
  question: QuestionSchema,
  reasoning: ReasoningExplanationSchema,
  remaining: z.number(),
  questionCount: z.number(),
  skippedCount: z.number(),
})

export const RejectGuessResponseSchema = z.object({
  type: z.enum(['question', 'exhausted']),
  question: QuestionSchema.optional(),
  reasoning: ReasoningExplanationSchema.optional(),
  remaining: z.number().optional(),
  questionCount: z.number().optional(),
  maxQuestions: z.number().optional(),
  guessCount: z.number().optional(),
  rejectCooldownRemaining: z.number().optional(),
  message: z.string().optional(),
})

export const ResumeResponseSchema = z.object({
  expired: z.boolean(),
  question: QuestionSchema.optional(),
  reasoning: ReasoningExplanationSchema.optional(),
  remaining: z.number().optional(),
  totalCharacters: z.number().optional(),
  questionCount: z.number().optional(),
  guessCount: z.number().optional(),
  answers: z
    .array(z.object({ questionId: z.string(), value: AnswerValueSchema }))
    .optional(),
})

export const RevealResponseSchema = z.object({
  found: z.boolean(),
  characterId: z.string().nullable().optional(),
  characterName: z.string().nullable().optional(),
  attributesFilled: z.number().optional(),
  discrepancies: z.number().optional(),
})

// ── Global stats (from /api/v2/stats) ────────────────────────────────────────

export const GlobalStatsSchema = z.object({
  characters: z.number(),
  attributes: z.number(),
  questions: z.number(),
  characterAttributes: z.object({
    total: z.number(),
    filled: z.number(),
    fillRate: z.number(),
  }),
  byCategory: z.array(z.object({ category: z.string(), count: z.number() })),
  bySource: z.array(z.object({ source: z.string(), count: z.number() })),
  gameStats: z
    .object({
      totalGames: z.number(),
      wins: z.number(),
      winRate: z.number(),
      avgQuestions: z.number(),
      avgPoolSize: z.number(),
      byDifficulty: z.array(
        z.object({
          difficulty: z.string(),
          games: z.number(),
          wins: z.number(),
          winRate: z.number(),
          avgQuestions: z.number(),
        }),
      ),
      recentGames: z.array(
        z.object({
          won: z.boolean(),
          difficulty: z.string(),
          questionsAsked: z.number(),
          poolSize: z.number(),
          timestamp: z.number(),
        }),
      ),
      readiness: z
        .object({
          instrumentedGames: z.number(),
          recentInstrumentedGames: z.number(),
          avgConfidence: z.number(),
          avgQuestionsAtGuess: z.number(),
          strictReadinessWinRate: z.number().nullable(),
          highCertaintyWinRate: z.number().nullable(),
          forcedGuessRate: z.number(),
          forcedGuessWinRate: z.number().nullable(),
          earlyGuessWinRate: z.number().nullable(),
          lowAmbiguityWinRate: z.number().nullable(),
          maxQuestionGuessRate: z.number(),
        })
        .nullable(),
    })
    .nullable(),
  confusion: z
    .array(
      z.object({
        targetName: z.string(),
        secondBestName: z.string(),
        count: z.number(),
        lossRate: z.number(),
      }),
    )
    .nullable(),
  calibration: z
    .array(
      z.object({
        difficulty: z.string(),
        realGames: z.number(),
        realWinRate: z.number(),
        realAvgQ: z.number(),
        simGames: z.number(),
        simWinRate: z.number(),
        simAvgQ: z.number(),
      }),
    )
    .nullable(),
})

export const HistoryApiResponseSchema = z.object({
  games: z.array(
    z.object({
      id: z.string(),
      characterId: z.string(),
      characterName: z.string(),
      won: z.boolean(),
      difficulty: DifficultySchema,
      questionsAsked: z.number(),
      poolSize: z.number(),
      steps: z.array(GameHistoryStepSchema),
      timestamp: z.number(),
    }),
  ),
  total: z.number(),
})

// ── Character row from sync API (has attributes_json instead of attributes) ──

export const SyncCharacterRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: CharacterCategorySchema,
  attributes_json: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  isCustom: z.boolean().optional(),
  createdBy: z.string().optional(),
  createdAt: z.number().optional(),
})

// ── localStorage: game session ────────────────────────────────────────────────

const GamePhaseSchema = z.enum([
  'welcome', 'playing', 'guessing', 'gameOver', 'teaching',
  'manage', 'stats', 'compare', 'history', 'challenge', 'describeYourself',
])

export const GameStateSchema = z.object({
  phase: GamePhaseSchema,
  answers: z.array(AnswerSchema),
  currentQuestion: QuestionSchema.nullable(),
  reasoning: ReasoningExplanationSchema.nullable(),
  possibleCharacters: z.array(CharacterSchema),
  finalGuess: CharacterSchema.nullable(),
  isThinking: z.boolean(),
  gameWon: z.boolean(),
  gameSteps: z.array(GameHistoryStepSchema),
  selectedCharacter: CharacterSchema.nullable(),
  showDevTools: z.boolean(),
  guessCount: z.number(),
  exhausted: z.boolean(),
  surrendered: z.boolean(),
})

// ── sharing.ts compact challenge ──────────────────────────────────────────────

export const CompactChallengeSchema = z.object({
  c: z.string(),
  n: z.string(),
  w: z.number(),
  d: z.string(),
  q: z.number().optional(),
  s: z.array(z.object({ a: z.string().optional(), v: z.string().optional() })).optional(),
})

// ── LLM output schemas ────────────────────────────────────────────────────────

export const GeneratedQuestionSchema = z.object({
  attribute: z.string(),
  text: z.string(),
  displayText: z.string().optional(),
})

export const AttributeRecommendationSchema = z.object({
  attribute: z.string(),
  label: z.string(),
  reason: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
})
