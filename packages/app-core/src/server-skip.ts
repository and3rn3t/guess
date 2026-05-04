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