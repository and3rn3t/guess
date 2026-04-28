import { z } from 'zod'

// ── Shared primitives ─────────────────────────────────────────────────────────

const VALID_CATEGORIES = [
  'video-games',
  'movies',
  'anime',
  'comics',
  'books',
  'cartoons',
  'tv-shows',
  'pop-culture',
] as const

const CharacterCategorySchema = z.enum(VALID_CATEGORIES)
const DifficultySchema = z.enum(['easy', 'medium', 'hard'])
const AnswerValueSchema = z.enum(['yes', 'no', 'maybe', 'unknown'])
const UuidSchema = z.string().regex(/^[0-9a-f-]{36}$/i, 'Must be a UUID')

// ── Game v2 endpoints ─────────────────────────────────────────────────────────

export const StartRequestSchema = z.object({
  // categories are filtered server-side; accept any strings to match existing lenient behaviour
  categories: z.array(z.string()).optional(),
  difficulty: DifficultySchema.optional(),
  characterId: z
    .string()
    .regex(/^[a-z0-9_-]+$/, 'Must be a valid character ID')
    .optional(),
})

export const AnswerRequestSchema = z.object({
  sessionId: UuidSchema,
  value: AnswerValueSchema,
})

export const SkipRequestSchema = z.object({
  sessionId: UuidSchema,
})

export const RejectGuessRequestSchema = z.object({
  sessionId: UuidSchema,
  characterId: z.string().min(1),
})

export const ResultRequestSchema = z.object({
  sessionId: UuidSchema,
  correct: z.boolean(),
  actualCharacterId: z.string().optional(),
})

export const ResumeRequestSchema = z.object({
  sessionId: UuidSchema,
})

// ── Character & question endpoints (v1 KV-based) ──────────────────────────────

export const CreateCharacterRequestSchema = z.object({
  name: z.string().min(2).max(50),
  category: CharacterCategorySchema,
  attributes: z
    .record(z.union([z.boolean(), z.null()]))
    .refine(
      (attrs) => Object.values(attrs).filter((v) => v !== null).length >= 5,
      { message: 'Character must have at least 5 non-null attributes' },
    ),
})

export const CreateQuestionRequestSchema = z.object({
  text: z.string().min(10).max(200),
  attribute: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z][a-zA-Z]*$/, 'Attribute must be camelCase (letters only)'),
})

// ── Stats endpoint ────────────────────────────────────────────────────────────

export const RecordStatRequestSchema = z.object({
  characterId: z.string().min(1),
  won: z.boolean(),
  questionsAsked: z.number().int().min(0),
  difficulty: DifficultySchema.optional().default('medium'),
})

// ── Corrections endpoint ──────────────────────────────────────────────────────

export const SubmitCorrectionRequestSchema = z.object({
  characterId: z.string().min(1),
  attribute: z.string().min(1),
  currentValue: z.union([z.boolean(), z.null()]).optional(),
  suggestedValue: z.boolean(),
})

// ── Events endpoint ───────────────────────────────────────────────────────────

const ALLOWED_EVENT_TYPES = [
  'game_start',
  'game_end',
  'share',
  'feature_use',
  'question_skip',
  'guess_rejected',
] as const

export const ClientEventSchema = z.object({
  id: z.string().regex(/^[0-9a-f-]{36}$/i, 'Must be a UUID'),
  sessionId: z
    .string()
    .regex(/^[0-9a-f-]{36}$/i)
    .optional(),
  eventType: z.enum(ALLOWED_EVENT_TYPES),
  data: z.unknown().optional(),
  clientTs: z.number().optional(),
})

/** Validates the batch wrapper only; individual events are filtered via ClientEventSchema.safeParse. */
export const EventsBatchRequestSchema = z.object({
  events: z.array(z.unknown()).max(50),
})
