import {
  buildResumedSessionSnapshot,
  type ServerResumeAnswerLike,
  type ServerResumeResponseLike,
} from './server-resume'

export type ServerBootstrapStep<TQuestion, TReasoning, TAnswerValue> =
  | {
      type: 'start-game'
      guessCount?: number
    }
  | {
      type: 'set-question'
      question: TQuestion
      reasoning: TReasoning
    }
  | {
      type: 'answer'
      value: TAnswerValue
    }

export interface ServerStartResponseLike<TQuestion = unknown, TReasoning = unknown> {
  question: TQuestion
  reasoning: TReasoning
}

export const buildStartBootstrapPlan = <TQuestion, TReasoning>(
  response: ServerStartResponseLike<TQuestion, TReasoning>,
): ServerBootstrapStep<TQuestion, TReasoning, never>[] => [
  { type: 'start-game' },
  {
    type: 'set-question',
    question: response.question,
    reasoning: response.reasoning,
  },
]

export const buildResumeBootstrapPlan = <
  TQuestion,
  TReasoning,
  TAnswerValue,
  TResume extends ServerResumeResponseLike & {
    question: TQuestion
    reasoning: TReasoning
    answers?: Array<ServerResumeAnswerLike<TAnswerValue>> | null
  },
>(response: TResume): ServerBootstrapStep<TQuestion, TReasoning, TAnswerValue>[] => {
  const snapshot = buildResumedSessionSnapshot<TQuestion, TReasoning, TAnswerValue, TResume>(response)

  return [
    {
      type: 'start-game',
      guessCount: snapshot.guessCount,
    },
    ...snapshot.replaySteps.flatMap((step) => [
      {
        type: 'set-question' as const,
        question: step.question as TQuestion,
        reasoning: step.reasoning as TReasoning,
      },
      {
        type: 'answer' as const,
        value: step.value,
      },
    ]),
    {
      type: 'set-question',
      question: snapshot.question,
      reasoning: snapshot.reasoning,
    },
  ]
}