import { d1Run } from '../../_helpers'

type WaitUntil = (promise: Promise<unknown>) => void

interface QuestionAttemptInput {
  sessionId: string
  questionId: string
  attribute: string
  answer: string
  candidatesBefore: number
  candidatesAfter: number
  questionIndex: number
  createdAt: number
}

export function queueQuestionAttemptWrite(
  waitUntil: WaitUntil,
  db: D1Database | null | undefined,
  input: QuestionAttemptInput,
): void {
  if (!db) return

  waitUntil(
    d1Run(
      db,
      `INSERT INTO question_attempts (session_id, question_id, attribute, answer, probability_delta, candidates_before, candidates_after, question_index, created_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`,
      [
        input.sessionId,
        input.questionId,
        input.attribute,
        input.answer,
        input.candidatesBefore,
        input.candidatesAfter,
        input.questionIndex,
        input.createdAt,
      ],
    ).catch(() => {
      // Non-critical telemetry write
    }),
  )
}

export function queueAnswerSessionSync(
  waitUntil: WaitUntil,
  db: D1Database | null | undefined,
  input: { sessionId: string; answersJson: string; currentQuestionAttr: string },
): void {
  if (!db) return

  waitUntil(
    d1Run(
      db,
      `UPDATE game_sessions SET answers = ?, current_question_attr = ? WHERE id = ?`,
      [input.answersJson, input.currentQuestionAttr, input.sessionId],
    ).catch(() => {
      // Non-critical backup sync
    }),
  )
}

export function queueRejectSessionSync(
  waitUntil: WaitUntil,
  db: D1Database | null | undefined,
  input: { sessionId: string; currentQuestionAttr: string; maxQuestions: number },
): void {
  if (!db) return

  waitUntil(
    d1Run(
      db,
      `UPDATE game_sessions SET current_question_attr = ?, max_questions = ? WHERE id = ?`,
      [input.currentQuestionAttr, input.maxQuestions, input.sessionId],
    ).catch(() => {
      // Non-critical backup sync
    }),
  )
}
