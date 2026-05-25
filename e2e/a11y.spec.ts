/**
 * A11Y.1 — axe-core accessibility floor for critical game phases.
 *
 * Scans Lobby (welcome) → Question → Reveal/Guess → Result. Fails the run on
 * any `serious` or `critical` WCAG 2.1 A/AA violation; surfaces `moderate` and
 * `minor` violations as warnings (Playwright reporter + JSON artifact).
 *
 * Artifacts: `.ci-artifacts/a11y/<phase>.json` per phase, plus an aggregate
 * `summary.json` so CI can attach the count to the run summary.
 */
import AxeBuilder from '@axe-core/playwright'
import type { Result } from 'axe-core'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './fixtures'

const ARTIFACT_DIR = join(process.cwd(), '.ci-artifacts', 'a11y')
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

type PhaseSummary = {
  phase: string
  blocking: number
  warning: number
  violations: Array<{ id: string; impact: string | null; nodes: number; helpUrl: string }>
}

const summaries: PhaseSummary[] = []

function persist(phase: string, results: { violations: Result[] }): PhaseSummary {
  mkdirSync(ARTIFACT_DIR, { recursive: true })
  writeFileSync(
    join(ARTIFACT_DIR, `${phase}.json`),
    JSON.stringify({ phase, violations: results.violations }, null, 2),
  )
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  const warning = results.violations.filter(
    (v) => v.impact === 'moderate' || v.impact === 'minor' || v.impact == null,
  )
  const summary: PhaseSummary = {
    phase,
    blocking: blocking.length,
    warning: warning.length,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      nodes: v.nodes.length,
      helpUrl: v.helpUrl,
    })),
  }
  summaries.push(summary)
  if (warning.length > 0) {
    console.warn(
      `[a11y][${phase}] ${warning.length} non-blocking violation(s):`,
      warning.map((v) => `${v.id} (${v.impact})`).join(', '),
    )
  }
  return summary
}

test.describe('A11Y floor — critical game phases', () => {
  test.afterAll(() => {
    mkdirSync(ARTIFACT_DIR, { recursive: true })
    writeFileSync(
      join(ARTIFACT_DIR, 'summary.json'),
      JSON.stringify(
        {
          totalBlocking: summaries.reduce((s, p) => s + p.blocking, 0),
          totalWarning: summaries.reduce((s, p) => s + p.warning, 0),
          phases: summaries,
        },
        null,
        2,
      ),
    )
  })

  test('Lobby phase has no serious or critical violations', async ({ gamePage }) => {
    await expect(gamePage.getByText('Andernator')).toBeVisible()
    const results = await new AxeBuilder({ page: gamePage.page }).withTags(TAGS).analyze()
    const summary = persist('lobby', results)
    expect(summary.blocking, `blocking a11y violations: ${JSON.stringify(summary.violations)}`).toBe(0)
  })

  test('Question phase has no serious or critical violations', async ({ gamePage }) => {
    await gamePage.startGame()
    await gamePage.waitForQuestion()
    const results = await new AxeBuilder({ page: gamePage.page }).withTags(TAGS).analyze()
    const summary = persist('question', results)
    expect(summary.blocking, `blocking a11y violations: ${JSON.stringify(summary.violations)}`).toBe(0)
  })

  test('Reveal (guess) phase has no serious or critical violations', async ({ gamePage }) => {
    await gamePage.startGame()
    await gamePage.answerQuestions(3)
    await gamePage.waitForGuessScreen()
    const results = await new AxeBuilder({ page: gamePage.page }).withTags(TAGS).analyze()
    const summary = persist('reveal', results)
    expect(summary.blocking, `blocking a11y violations: ${JSON.stringify(summary.violations)}`).toBe(0)
  })

  test('Result phase has no serious or critical violations', async ({ gamePage }) => {
    await gamePage.startGame()
    await gamePage.answerQuestions(3)
    await gamePage.waitForGuessScreen()
    // Confirm the guess to advance to the result/celebration screen.
    await gamePage.getByTestId('guess-correct-btn').click()
    // Result screen reliably renders a "Play Again" affordance.
    await expect(gamePage.getByRole('button', { name: /play again/i }).first()).toBeVisible()
    const results = await new AxeBuilder({ page: gamePage.page }).withTags(TAGS).analyze()
    const summary = persist('result', results)
    expect(summary.blocking, `blocking a11y violations: ${JSON.stringify(summary.violations)}`).toBe(0)
  })
})
