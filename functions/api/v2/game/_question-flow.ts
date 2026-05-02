import type { Env } from '../../_helpers'
import {
  filterPossibleCharacters,
  saveSessionState,
  type Answer,
  type GameSession,
  type ReasoningExplanation,
  type ServerCharacter,
  type ServerQuestion,
} from '../_game-engine'
import { rephraseQuestion } from '../_llm-rephrase'

interface ApplyAnswerAndFilterResult {
  askedQuestion: NonNullable<GameSession['currentQuestion']>
  questionIndex: number
  candidatesBefore: number
  filtered: ServerCharacter[]
}

export function applyAnswerAndFilter(
  session: GameSession,
  value: Answer['value'],
): ApplyAnswerAndFilterResult {
  const askedQuestion = session.currentQuestion as NonNullable<GameSession['currentQuestion']>
  const questionIndex = session.answers.length
  const candidatesBefore = filterPossibleCharacters(
    session.characters,
    session.answers,
    session.rejectedGuesses,
  ).length

  session.answers.push({
    questionId: askedQuestion.attribute,
    value,
  })

  const filtered = filterPossibleCharacters(
    session.characters,
    session.answers,
    session.rejectedGuesses,
  )

  return {
    askedQuestion,
    questionIndex,
    candidatesBefore,
    filtered,
  }
}

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
