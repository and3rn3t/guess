export interface ServerResumeResponseLike {
  expired?: boolean
  question?: unknown
  reasoning?: unknown
}

export const canResumeServerSession = <T extends ServerResumeResponseLike>(
  response?: T | null,
): response is T & {
  expired?: false
  question: NonNullable<T['question']>
  reasoning: NonNullable<T['reasoning']>
} =>
  Boolean(response && !response.expired && response.question && response.reasoning)