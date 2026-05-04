/**
 * Workers Analytics Engine writer for LLM cost telemetry (I.2).
 *
 * Replaces the brittle `costs:{userId}:{date}` KV-counter pattern with one
 * Analytics Engine data point per LLM call. AE is columnar, time-series,
 * 100K data points/day free, and queryable via SQL in the CF dashboard
 * without enumerating KV keys.
 *
 * Schema (kept tiny so the 6-blob / 20-double / 1-index AE caps are easy
 * to live within):
 *   blobs[0]  = model              (e.g. "gpt-4o-mini")
 *   blobs[1]  = userId             (per-cookie identifier)
 *   blobs[2]  = cacheStatus        ("HIT" | "MISS")
 *   blobs[3]  = endpoint           ("llm" | "llm-stream" | …)
 *   doubles[0] = promptTokens
 *   doubles[1] = completionTokens
 *   doubles[2] = totalTokens
 *   doubles[3] = estCostUsd        (model-aware, see PRICES below)
 *   doubles[4] = retryCount        (number of retry attempts before success/final error)
 *   indexes[0] = userId            (sampling key)
 *
 * Pricing table is intentionally hard-coded — these change rarely and
 * checking them in keeps cost math reproducible across environments.
 * Source: https://openai.com/api/pricing/ (snapshotted 2026-04-30).
 */

export interface AnalyticsEngineDataPoint {
  blobs?: string[]
  doubles?: number[]
  indexes?: string[]
}

export interface AnalyticsEngineDataset {
  writeDataPoint(point: AnalyticsEngineDataPoint): void
}

export interface TokenUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface RecordLLMUsageInput {
  model: string
  userId: string
  usage: TokenUsage
  cacheStatus: 'HIT' | 'MISS'
  endpoint: string
  retryCount: number
}

function normalizeRetryCount(retryCount: number): number {
  const safe = Number.isFinite(retryCount) ? Math.trunc(retryCount) : 0
  return Math.max(0, safe)
}

/** USD per 1K input/output tokens (snapshot 2026-04-30). */
const PRICES_PER_1K: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
}

const FALLBACK_PRICE = { input: 0.001, output: 0.003 }

/** Compute the USD cost for a single completion. Pure helper, exported for tests. */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const price = PRICES_PER_1K[model] ?? FALLBACK_PRICE
  const cost =
    (usage.prompt_tokens / 1000) * price.input +
    (usage.completion_tokens / 1000) * price.output
  // 6 decimals = sub-millicent precision, plenty for AE doubles.
  return Math.round(cost * 1_000_000) / 1_000_000
}

/**
 * Build the AE data point. Pure so unit tests can assert the exact payload
 * without spinning up a real binding.
 */
export function buildLLMUsageDataPoint(input: RecordLLMUsageInput): AnalyticsEngineDataPoint {
  const { model, userId, usage, cacheStatus, endpoint, retryCount } = input
  const normalizedRetryCount = normalizeRetryCount(retryCount)

  return {
    blobs: [model, userId, cacheStatus, endpoint],
    doubles: [
      usage.prompt_tokens,
      usage.completion_tokens,
      usage.total_tokens,
      estimateCostUsd(model, usage),
      normalizedRetryCount,
    ],
    indexes: [userId],
  }
}

/**
 * Write one data point to the LLM_COSTS dataset. No-ops cleanly when the
 * binding isn't wired (local dev without `wrangler dev --remote`, preview
 * deploys before the dataset is provisioned, etc.) so callers never need
 * to feature-flag the call site.
 */
export function recordLLMUsage(
  dataset: AnalyticsEngineDataset | undefined,
  input: RecordLLMUsageInput
): void {
  if (!dataset) return
  try {
    dataset.writeDataPoint(buildLLMUsageDataPoint(input))
  } catch {
    // AE writes are fire-and-forget telemetry — never fail a user request.
  }
}
