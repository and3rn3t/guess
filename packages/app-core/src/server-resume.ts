export interface ServerResumeResponseLike {
  expired?: boolean
  question?: unknown
  reasoning?: unknown
  remaining?: number
  totalCharacters?: number
  guessCount?: number
}

export interface ServerResumeAnswerLike<TAnswerValue = string> {
  questionId: string
  value: TAnswerValue
}

export interface ResumeReplayQuestion {
  id: string
  text: string
  attribute: string
}

export interface ResumeReplayReasoning {
  why: string
  impact: string
  remaining: number
  confidence: number
  topCandidates: []
}

export interface ResumeReplayStep<TAnswerValue = string> {
  question: ResumeReplayQuestion
  reasoning: ResumeReplayReasoning
  value: TAnswerValue
}

export interface ResumedSessionSnapshot<
  TQuestion = unknown,
  TReasoning = unknown,
  TAnswerValue = string,
> {
  remaining: number
  totalCharacters: number
  guessCount: number
  question: TQuestion
  reasoning: TReasoning
  replaySteps: ResumeReplayStep<TAnswerValue>[]
}

export const canResumeServerSession = <T extends ServerResumeResponseLike>(
  response?: T | null,
): response is T & {
  expired?: false
  question: NonNullable<T['question']>
  reasoning: NonNullable<T['reasoning']>
} =>
  Boolean(response && !response.expired && response.question && response.reasoning)

export const buildResumeAnswerReplaySteps = <TAnswerValue>(
  answers?: Array<ServerResumeAnswerLike<TAnswerValue>> | null,
): ResumeReplayStep<TAnswerValue>[] =>
  (answers ?? []).map((answer) => ({
    question: {
      id: answer.questionId,
      text: '',
      attribute: answer.questionId,
    },
    reasoning: {
      why: '',
      impact: '',
      remaining: 0,
      confidence: 0,
      topCandidates: [],
    },
    value: answer.value,
  }))

export const buildResumedSessionSnapshot = <
  TQuestion,
  TReasoning,
  TAnswerValue,
  TResume extends ServerResumeResponseLike & {
    question: TQuestion
    reasoning: TReasoning
    answers?: Array<ServerResumeAnswerLike<TAnswerValue>> | null
  },
>(response: TResume): ResumedSessionSnapshot<TQuestion, TReasoning, TAnswerValue> => ({
  remaining: response.remaining ?? 0,
  totalCharacters: response.totalCharacters ?? 0,
  guessCount: response.guessCount ?? 0,
  question: response.question,
  reasoning: response.reasoning,
  replaySteps: buildResumeAnswerReplaySteps(response.answers),
})