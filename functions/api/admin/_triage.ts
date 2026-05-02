/**
 * AN.21 — Catastrophic-failure triage helpers (pure, no I/O).
 *
 * A "catastrophic failure" is any game where the player's actual character was
 * never in the engine's top-10 candidate list at any question step.  These
 * games are auto-snapshotted into `triage_queue` for admin replay.
 */

import type { Answer } from '../v2/_game-engine'
import type { ServerQuestion } from '../v2/_game-engine'

/** One element of session.stepTopTen */
export interface TopTenEntry {
  id: string
  name: string
}

/** One row as stored in triage_queue.steps_json */
export interface TriageStep {
  attr: string
  answer: string
  questionText: string
  top10: TopTenEntry[]
}

/**
 * Compute the lowest (best) rank the `actualCharId` achieved across all steps.
 * Rank is 1-based.  Returns `null` if the character never appeared in any top-10.
 */
export function computeMinRank(
  actualCharId: string,
  stepTopTen: TopTenEntry[][]
): number | null {
  let minRank: number | null = null
  for (const top10 of stepTopTen) {
    const idx = top10.findIndex((e) => e.id === actualCharId)
    if (idx >= 0) {
      const rank = idx + 1
      if (minRank === null || rank < minRank) minRank = rank
    }
  }
  return minRank
}

/**
 * Returns `true` when this game qualifies as a catastrophic failure.
 * Criterion: actual character never appeared in any step's top-10.
 */
export function detectCatastrophicFailure(
  actualCharId: string,
  stepTopTen: TopTenEntry[][]
): boolean {
  if (stepTopTen.length === 0) return false
  return computeMinRank(actualCharId, stepTopTen) === null
}

/**
 * Build the `steps_json` payload stored in `triage_queue`.
 * Combines session answers, questions lookup, and per-step top-10 arrays.
 *
 * `answers[i]` and `stepTopTen[i]` must be aligned (same index = same step).
 */
export function buildStepsJson(
  answers: Pick<Answer, 'questionId' | 'value'>[],
  questions: Pick<ServerQuestion, 'attribute' | 'text' | 'displayText'>[],
  stepTopTen: TopTenEntry[][]
): TriageStep[] {
  const questionMap = new Map(questions.map((q) => [q.attribute, q.displayText ?? q.text]))

  return answers.map((answer, i) => ({
    attr: answer.questionId,
    answer: answer.value,
    questionText: questionMap.get(answer.questionId) ?? answer.questionId,
    top10: stepTopTen[i] ?? [],
  }))
}

/** Shape returned by the admin list endpoint. */
export interface TriageListRow {
  id: number
  actual_character_id: string
  actual_character_name: string | null
  min_rank: number | null
  created_at: number
}

/** Shape returned by the admin detail endpoint. */
export interface TriageDetailRow extends TriageListRow {
  steps: TriageStep[]
}
