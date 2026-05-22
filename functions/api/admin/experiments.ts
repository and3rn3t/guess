/**
 * GET /api/admin/experiments — A/B variant performance dashboard.
 *
 * Aggregates `game_stats` by `variant` × `selector` over the requested window
 * (default 14 days) and computes a two-proportion z-test on win rate between
 * each non-control arm and the control arm. Used by the admin /experiments
 * page to decide promotion/rollback of an experiment.
 *
 * Also returns the current KV experiment configuration so the dashboard can
 * surface the live variant split.
 *
 * Protected by the Basic auth gate in functions/_middleware.ts.
 */
import { type Env, jsonResponse, errorResponse } from '../_helpers'
import { d1ConfigGetMulti, d1ConfigSet } from '../_d1_cache'

interface ArmRow {
  variant: string | null
  selector: string | null
  games: number
  wins: number
  win_rate: number
  avg_questions: number | null
  avg_confidence: number | null
}

interface ArmStat {
  variant: string
  selector: string
  games: number
  wins: number
  winRate: number
  avgQuestions: number | null
  avgConfidence: number | null
  /** Two-proportion z statistic vs control. null when arm IS control or
   *  when there is no control arm with data. */
  z: number | null
  /** Two-tailed p-value derived from |z|. null when z is null. */
  pValue: number | null
  /** 95% confidence interval half-width on win rate (Wald). */
  ci95: number
}

/** Two-tailed p-value from a z-statistic via a rational approximation of
 *  the standard normal CDF (Abramowitz & Stegun 26.2.17). Sufficient for
 *  a dashboard surface — not for a clinical trial. */
function twoTailedPFromZ(z: number): number {
  const absZ = Math.abs(z)
  // Constants for A&S 26.2.17
  const b1 = 0.31938153
  const b2 = -0.356563782
  const b3 = 1.781477937
  const b4 = -1.821255978
  const b5 = 1.330274429
  const p = 0.2316419
  const c = 0.39894228 // 1 / sqrt(2π)

  const t = 1 / (1 + p * absZ)
  const pdf = c * Math.exp((-absZ * absZ) / 2)
  const oneMinusCdf = pdf * (b1 * t + b2 * t ** 2 + b3 * t ** 3 + b4 * t ** 4 + b5 * t ** 5)
  // Two-tailed
  return Math.min(1, Math.max(0, 2 * oneMinusCdf))
}

/** Two-proportion z-test on win rate. Returns null when either arm has 0 games. */
function twoPropZ(armWins: number, armN: number, ctrlWins: number, ctrlN: number): number | null {
  if (armN <= 0 || ctrlN <= 0) return null
  const pArm = armWins / armN
  const pCtrl = ctrlWins / ctrlN
  const pPool = (armWins + ctrlWins) / (armN + ctrlN)
  const variance = pPool * (1 - pPool) * (1 / armN + 1 / ctrlN)
  if (variance <= 0) return null
  return (pArm - pCtrl) / Math.sqrt(variance)
}

/** Wald 95% half-width on a binomial proportion. */
function wald95(wins: number, n: number): number {
  if (n <= 0) return 0
  const p = wins / n
  return 1.96 * Math.sqrt((p * (1 - p)) / n)
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  const url = new URL(context.request.url)
  const daysParam = Number.parseInt(url.searchParams.get('days') ?? '14', 10)
  const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 90 ? daysParam : 14

  // Window expressed as ms epoch (game_stats.created_at is ms-epoch, matching
  // other admin endpoints).
  const since = `unixepoch('now', '-${days} days') * 1000`

  const armsResult = await db
    .prepare(
      `
      SELECT
        COALESCE(variant, 'unassigned') AS variant,
        COALESCE(selector, 'unknown') AS selector,
        COUNT(*) AS games,
        SUM(CASE WHEN won = 1 THEN 1 ELSE 0 END) AS wins,
        AVG(CASE WHEN won = 1 THEN 1.0 ELSE 0.0 END) AS win_rate,
        AVG(questions_asked) AS avg_questions,
        AVG(confidence_at_guess) AS avg_confidence
      FROM game_stats
      WHERE created_at >= ${since}
      GROUP BY variant, selector
      ORDER BY games DESC
    `
    )
    .all<ArmRow>()

  const rows = armsResult.results ?? []

  const control = rows.find((r) => r.variant === 'control')

  const arms: ArmStat[] = rows.map((r) => {
    const variant = r.variant ?? 'unassigned'
    const selector = r.selector ?? 'unknown'
    const isControl = variant === 'control'
    let z: number | null = null
    let pValue: number | null = null
    if (!isControl && control && control.games > 0) {
      z = twoPropZ(r.wins, r.games, control.wins, control.games)
      pValue = z === null ? null : twoTailedPFromZ(z)
    }
    return {
      variant,
      selector,
      games: r.games,
      wins: r.wins,
      winRate: r.win_rate ?? 0,
      avgQuestions: r.avg_questions,
      avgConfidence: r.avg_confidence,
      z,
      pValue,
      ci95: wald95(r.wins, r.games),
    }
  })

  // Live experiment configuration from engine_config D1 table.
  const cfgMap = await d1ConfigGetMulti(db, [
    'ab:experiment-pct',
    'ab:experiment-selector',
    'ab:experiment-weights',
    'engine:weights-active',
    'engine:auto-tune-enabled',
  ]).catch(() => new Map<string, string>())

  const pctStr = cfgMap.get('ab:experiment-pct') ?? null
  const pct = pctStr ? Number.parseInt(pctStr, 10) : 0
  const config = {
    pct: Number.isFinite(pct) ? pct : 0,
    selector: cfgMap.get('ab:experiment-selector') ?? null,
    weights: cfgMap.get('ab:experiment-weights') ?? null,
    activeWeights: cfgMap.get('engine:weights-active') ?? null,
    autoTuneEnabled:
      typeof cfgMap.get('engine:auto-tune-enabled') === 'string' &&
      (cfgMap.get('engine:auto-tune-enabled') ?? '').trim().toLowerCase() === 'true',
  }

  return jsonResponse({
    windowDays: days,
    config,
    arms,
  })
}

/**
 * POST /api/admin/experiments — update live experiment configuration.
 *
 * Body: { pct?: number, selector?: 'greedy' | 'mcts', autoTuneEnabled?: boolean }
 *
 * Each field is optional and updates only the corresponding KV key. Used by
 * the admin dashboard to start/stop experiments and toggle the auto-tune
 * kill switch without touching the CLI.
 */
interface UpdateBody {
  pct?: number
  selector?: 'greedy' | 'mcts'
  autoTuneEnabled?: boolean
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.GUESS_DB
  if (!db) return errorResponse('DB not configured', 503)

  let body: UpdateBody
  try {
    body = await context.request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const updates: string[] = []

  if (body.pct !== undefined) {
    if (!Number.isInteger(body.pct) || body.pct < 0 || body.pct > 100) {
      return errorResponse('pct must be an integer 0-100', 400)
    }
    await d1ConfigSet(db, 'ab:experiment-pct', String(body.pct))
    updates.push('pct')
  }

  if (body.selector !== undefined) {
    if (body.selector !== 'greedy' && body.selector !== 'mcts') {
      return errorResponse("selector must be 'greedy' or 'mcts'", 400)
    }
    await d1ConfigSet(db, 'ab:experiment-selector', body.selector)
    updates.push('selector')
  }

  if (body.autoTuneEnabled !== undefined) {
    if (typeof body.autoTuneEnabled !== 'boolean') {
      return errorResponse('autoTuneEnabled must be boolean', 400)
    }
    await d1ConfigSet(db, 'engine:auto-tune-enabled', body.autoTuneEnabled ? 'true' : 'false')
    updates.push('autoTuneEnabled')
  }

  return jsonResponse({ ok: true, updated: updates })
}
