export interface ServerSkipResponseLike {
  question?: unknown
  reasoning?: unknown
}

export const canContinueAfterSkip = <T extends ServerSkipResponseLike>(
  response?: T | null,
): response is T & {
  question: NonNullable<T['question']>
  reasoning: NonNullable<T['reasoning']>
} => Boolean(response && response.question && response.reasoning)

export type ServerSkipActionStep<TQuestion = unknown, TReasoning = unknown> =
  | { type: 'set-question'; question: TQuestion; reasoning: TReasoning }
  | { type: 'set-exhausted' }

export const buildServerSkipActionPlan = <
  TQuestion,
  TReasoning,
>(
  response:
    | (ServerSkipResponseLike & { question?: TQuestion; reasoning?: TReasoning })
    | null
    | undefined,
): ServerSkipActionStep<TQuestion, TReasoning>[] => {
  if (!response || !response.question || !response.reasoning) {
    return [{ type: 'set-exhausted' }]
  }
  return [
    {
      type: 'set-question',
      question: response.question,
      reasoning: response.reasoning,
    },
  ]
}