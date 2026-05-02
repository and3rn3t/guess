import type { Env } from '../../_helpers'
import {
  saveSessionState,
  type GameSession,
  type ReasoningExplanation,
  type ServerQuestion,
} from '../_game-engine'
import { rephraseQuestion } from '../_llm-rephrase'

interface AdvanceQuestionInput {
  env: Env
  kv: KVNamespace
  session: GameSession
  nextQuestion: ServerQuestion
  reasoning: ReasoningExplanation
  questionNumber: number
}

export async function advanceToNextQuestion(input: AdvanceQuestionInput): Promise<void> {
  const {
    env,
    kv,
    session,
    nextQuestion,
    reasoning,
    questionNumber,
  } = input

  const questionLookup = new Map(session.questions.map((q) => [q.attribute, q.text]))

  session.currentQuestion = nextQuestion
  const [rephrased] = await Promise.all([
    rephraseQuestion(
      env,
      nextQuestion,
      session.answers,
      reasoning,
      questionNumber,
      session.maxQuestions,
      questionLookup,
      session.persona,
    ),
    saveSessionState(kv, session),
  ])

  if (rephrased) {
    nextQuestion.displayText = rephrased
  }
}
