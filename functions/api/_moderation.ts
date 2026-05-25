/**
 * AI.6 — Content moderation gate (Llama-Guard via Workers AI).
 *
 * Two-stage classifier:
 *   1. **LDNOOBW fast-path** — a short hardcoded regex matches the most
 *      egregious slurs/explicit terms that should never need LLM judgement.
 *      Rejects synchronously, no neuron cost.
 *   2. **Llama-Guard escalation** — everything else is sent to
 *      `@cf/meta/llama-guard-3-8b` (free tier, ~hundreds of neurons/call).
 *      Model returns `"safe"` or `"unsafe\nS1,S5"` where S-codes map to
 *      categories (S1=Violent Crimes, S5=Defamation, etc).
 *
 * Failure modes are **fail-open** on purpose: a Workers AI outage or
 * missing binding should never block legitimate submissions. False-negatives
 * land in `moderation_rejections` only when the model returns `unsafe`;
 * everything else passes through with a `reason` annotation the admin
 * review surface can use to spot-check.
 *
 * Used by:
 *   - POST /api/v2/characters         (name + description)
 *   - POST /api/admin/proposed-attributes (proposal text)
 *   - POST /api/v2/game/feedback      (feedbackText)
 */

import type { Env } from './_helpers'

const LLAMA_GUARD_MODEL = '@cf/meta/llama-guard-3-8b'

/**
 * Minimal LDNOOBW-style fast-path. Intentionally short — borderline cases
 * escalate to Llama-Guard so we don't ship a maintenance-burden regex.
 * Pattern covers the most common slurs and explicit terms that the
 * Llama-Guard call would also reject; matching them locally saves a neuron
 * round-trip and a few hundred ms on the hot submission path.
 */
const LDNOOBW_PATTERN = /\b(n[i1]gg(?:er|a)|f[a@]gg?[o0]t|k[i1]ke|ch[i1]nk|sp[i1]c|tr[a@]nny|ret[a@]rd|c[u*]nt|wh[o0]re)\b/i

export interface ModerationResult {
  allowed: boolean
  /**
   * When `allowed=false`, a short machine-readable reason code:
   *   - `'ldnoobw'`                — fast-path regex hit
   *   - `'llama-guard:S1,S5,...'`  — Llama-Guard rejected with these S-codes
   * When `allowed=true`, may carry a non-rejection annotation:
   *   - `'ai-binding-missing'`     — Workers AI binding absent (local dev)
   *   - `'llama-guard-error'`      — call threw / timed out (failed open)
   *   - `'empty'`                  — input was empty/whitespace
   */
  reason?: string
}

/**
 * Moderate a single text payload. Returns `{ allowed: true }` on success;
 * `{ allowed: false, reason }` when the content should be rejected.
 *
 * Safe to call with empty strings (returns allowed=true). Safe to call
 * when `env.AI` is undefined (returns allowed=true with a reason flag).
 */
export async function moderate(env: Env, text: string | null | undefined): Promise<ModerationResult> {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return { allowed: true, reason: 'empty' }

  if (LDNOOBW_PATTERN.test(trimmed)) {
    return { allowed: false, reason: 'ldnoobw' }
  }

  // Graceful degradation: no AI binding means we can't escalate. Fail open
  // so local dev / preview without Workers AI bindings stays usable. The
  // LDNOOBW fast-path above already catches the worst offenders.
  if (!env.AI) {
    return { allowed: true, reason: 'ai-binding-missing' }
  }

  try {
    const result = (await env.AI.run(LLAMA_GUARD_MODEL, {
      messages: [{ role: 'user', content: trimmed }],
    })) as { response?: string }

    const response = (result?.response ?? '').trim().toLowerCase()
    if (!response || response.startsWith('safe')) {
      return { allowed: true }
    }

    // "unsafe\ns1,s5" — extract the S-codes line and pass them through so
    // the admin review surface can categorise hits without re-running.
    const codes = response.split('\n')[1]?.trim() || 'unspecified'
    return { allowed: false, reason: `llama-guard:${codes}` }
  } catch {
    // AI overloaded / quota exhausted / network error → fail open. The
    // LDNOOBW fast-path already ran, so the most egregious content was
    // still rejected; everything else falls through to the existing
    // validation layers (length caps, rate limits, dedup).
    return { allowed: true, reason: 'llama-guard-error' }
  }
}

/**
 * Convenience wrapper for endpoints that need to gate a single payload.
 * Persists rejections to `moderation_rejections` (best-effort, fire-and-forget)
 * and returns the moderation result. Callers turn `allowed=false` into a 422.
 */
export async function moderateAndLog(
  env: Env,
  text: string | null | undefined,
  source: string,
  actorId: string | null,
): Promise<ModerationResult> {
  const result = await moderate(env, text)
  if (!result.allowed && env.GUESS_DB) {
    // Truncate payload to the same 2000-char cap used by feedbackText / description.
    const snippet = (text ?? '').slice(0, 2000)
    try {
      await env.GUESS_DB.prepare(
        `INSERT INTO moderation_rejections (source, reason, payload, actor_id) VALUES (?, ?, ?, ?)`
      ).bind(source, result.reason ?? 'unspecified', snippet, actorId).run()
    } catch {
      // Logging failures must never block the user-facing response.
    }
  }
  return result
}
