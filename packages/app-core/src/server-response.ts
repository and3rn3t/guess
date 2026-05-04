export type ServerAnswerResponseKind =
  | 'contradiction'
  | 'guess'
  | 'question'
  | 'unknown'

export interface ServerAnswerResponseLike {
  type?: string
  question?: unknown
  reasoning?: unknown
  character?: ServerGuessCharacterLike
  message?: string
  remaining?: number
  readiness?: unknown
}

export interface ServerGuessCharacterLike {
  id: string
  name: string
  category?: string
  imageUrl?: string | null
  trivia?: string[]
}

export interface NormalizedGuessCharacter {
  id: string
  name: string
  category: string
  imageUrl?: string
  trivia?: string[]
}

export type ServerAnswerOutcome<
  TQuestion = unknown,
  TReasoning = unknown,
  TReadiness = unknown,
> =
  | {
      kind: 'contradiction'
      message: string
      question?: TQuestion
      reasoning?: TReasoning
    }
  | {
      kind: 'guess'
      character: NormalizedGuessCharacter
      remaining: number
      readiness?: TReadiness
    }
  | {
      kind: 'question'
      question: TQuestion
      reasoning: TReasoning
      remaining?: number
      readiness?: TReadiness
    }
  | {
      kind: 'unknown'
    }

export type ServerAnswerActionPlanStep<TQuestion = unknown, TReasoning = unknown> =
  | {
      type: 'undo-last-answer'
    }
  | {
      type: 'set-question'
      question: TQuestion
      reasoning: TReasoning
    }
  | {
      type: 'make-guess'
      character: NormalizedGuessCharacter
    }

export const classifyServerAnswerResponse = (
  response: ServerAnswerResponseLike,
): ServerAnswerResponseKind => {
  if (response.type === 'contradiction') {
    return 'contradiction'
  }
  if (response.type === 'guess' && response.character) {
    return 'guess'
  }
  if (response.type === 'question' && response.question && response.reasoning) {
    return 'question'
  }
  return 'unknown'
}

export const normalizeGuessCharacter = (
  character: ServerGuessCharacterLike,
): NormalizedGuessCharacter => ({
  id: character.id,
  name: character.name,
  category: character.category || 'other',
  imageUrl: character.imageUrl ?? undefined,
  trivia: character.trivia,
})

export const buildServerAnswerOutcome = <
  TQuestion,
  TReasoning,
  TReadiness,
  TResponse extends ServerAnswerResponseLike & {
    question?: TQuestion
    reasoning?: TReasoning
    readiness?: TReadiness
  },
>(response: TResponse): ServerAnswerOutcome<TQuestion, TReasoning, TReadiness> => {
  const responseKind = classifyServerAnswerResponse(response)

  if (responseKind === 'contradiction') {
    return {
      kind: 'contradiction',
      message: response.message || 'Contradictory answers — undoing last answer.',
      question: response.question,
      reasoning: response.reasoning,
    }
  }

  if (responseKind === 'guess' && response.character) {
    return {
      kind: 'guess',
      character: normalizeGuessCharacter(response.character),
      remaining: response.remaining ?? 1,
      readiness: response.readiness,
    }
  }

  if (responseKind === 'question' && response.question && response.reasoning) {
    return {
      kind: 'question',
      question: response.question,
      reasoning: response.reasoning,
      remaining: response.remaining,
      readiness: response.readiness,
    }
  }

  return { kind: 'unknown' }
}

export const buildServerAnswerActionPlan = <TQuestion, TReasoning, TReadiness>(
  outcome: ServerAnswerOutcome<TQuestion, TReasoning, TReadiness>,
): ServerAnswerActionPlanStep<TQuestion, TReasoning>[] => {
  if (outcome.kind === 'contradiction') {
    return outcome.question && outcome.reasoning
      ? [
          { type: 'undo-last-answer' },
          {
            type: 'set-question',
            question: outcome.question,
            reasoning: outcome.reasoning,
          },
        ]
      : [{ type: 'undo-last-answer' }]
  }

  if (outcome.kind === 'guess') {
    return [{ type: 'make-guess', character: outcome.character }]
  }

  if (outcome.kind === 'question') {
    return [
      {
        type: 'set-question',
        question: outcome.question,
        reasoning: outcome.reasoning,
      },
    ]
  }

  return []
}