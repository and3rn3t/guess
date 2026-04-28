import { z } from 'zod'

// ── Primitive enum schemas ────────────────────────────────────────────────────

export const AnswerValueSchema = z.enum(['yes', 'no', 'maybe', 'unknown'])

export const PersonaSchema = z.enum(['sherlock', 'watson', 'poirot'])

export const GuessTriggerSchema = z.enum([
  'singleton',
  'max_questions',
  'high_certainty',
  'strict_readiness',
  'time_pressure',
  'insufficient_data',
])

// ── Engine entity schemas ─────────────────────────────────────────────────────

export const GameCharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  attributes: z.record(z.string(), z.union([z.boolean(), z.null()])),
  imageUrl: z.string().nullable().optional(),
})

export const GameQuestionSchema = z.object({
  attribute: z.string(),
  category: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
})

export const GameAnswerSchema = z.object({
  questionId: z.string(),
  value: AnswerValueSchema,
})
