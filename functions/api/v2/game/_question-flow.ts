import type { Env } from '../../_helpers'
import {
  filterPossibleCharacters,
  generateReasoning,
  saveSessionState,
  type Answer,
  type GameSession,
  type ReasoningExplanation,
  type ServerCharacter,
  type ServerQuestion,
} from '../_game-engine'
import { calculateEliminatedCount } from './_elimination'
import { buildQuestionResponse } from './_responses'
import { queueAnswerSessionSync } from './_turn-effects'
import { rephraseQuestion } from '../_llm-rephrase'

type QuestionResponseScoring = Parameters<typeof generateReasoning>[3]

interface QuestionReadinessShape {
  trigger?: string | null
  blockedByRejectCooldown?: boolean
  rejectCooldownRemaining?: number
  topProbability?: number
  gap?: number
  aliveCount?: number
  questionsRemaining?: number
  forced?: boolean
}

export function buildNextQuestionResponse(input: {
  session: GameSession
  nextQuestion: ServerQuestion
  filtered: ServerCharacter[]
  scoring: QuestionResponseScoring
  questionCount: number
  readiness: QuestionReadinessShape
}): {
  reasoning: ReasoningExplanation
  response: ReturnType<typeof buildQuestionResponse>
} {
  const reasoning = generateReasoning(
    input.nextQuestion,
    input.filtered,
    input.session.answers,
    input.scoring,
  )
  const eliminated = calculateEliminatedCount(input.session, input.filtered.length)

  return {
    reasoning,
    response: buildQuestionResponse({
      question: input.nextQuestion,
      reasoning,
      remaining: input.filtered.length,
      eliminated,
      questionCount: input.questionCount,
      readiness: input.readiness,
    }),
  }
}

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

interface PersistAndSyncAnswerTurnInput {
  env: Env
  kv: KVNamespace
  db: D1Database | null | undefined
  waitUntil: (promise: Promise<unknown>) => void
  session: GameSession
  nextQuestion: ServerQuestion
  reasoning: ReasoningExplanation
  questionNumber: number
}

export async function persistAndSyncAnswerTurn(input: PersistAndSyncAnswerTurnInput): Promise<void> {
  await advanceToNextQuestion({
    env: input.env,
    kv: input.kv,
    session: input.session,
    nextQuestion: input.nextQuestion,
    reasoning: input.reasoning,
    questionNumber: input.questionNumber,
  })

  queueAnswerSessionSync(input.waitUntil, input.db, {
    sessionId: input.session.id,
    answersJson: JSON.stringify(input.session.answers),
    currentQuestionAttr: input.nextQuestion.attribute,
  })
}
