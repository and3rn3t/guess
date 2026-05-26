/**
 * Shared source-adapter base (DQ.v2.3).
 *
 * All five ingest source adapters (`comicvine`, `igdb`, `tmdb`, `anilist`,
 * `wikidata`) historically reimplemented the same boilerplate: acquire a
 * rate-limit slot → fetch with retry → throw on non-2xx → JSON-parse → cast
 * to an interface. This module centralizes the three pieces that are
 * actually shared:
 *
 *   1. `withRateLimit(limiter, fn, opts?)` — combine `limiter.wait()` with
 *      `withRetry()` in a single call so adapters can write
 *      `return withRateLimit(limiter, async () => { … fetch … })` instead
 *      of repeating the pattern.
 *   2. `withRetry` — re-exported verbatim from `../rate-limiter.ts` so
 *      adapters only need to import from this base module.
 *   3. `parseWithSchema(data, schema, context)` — Zod-backed runtime
 *      validation with adapter-tagged error messages. Adapters that want
 *      runtime validation (vs. unchecked `as T` casts) can opt in.
 *
 * Adapter-specific concerns (auth headers, 429 reading `Retry-After`,
 * pagination, normalization to `RawCharacter`) stay in the adapter file.
 */
import type { ZodType } from 'zod';

import { RateLimiter, withRetry } from '../rate-limiter.js';

export { RateLimiter, withRetry };

/** Options for `withRateLimit` — passes through to `withRetry`. */
export interface WithRateLimitOptions {
  /** Max retry attempts after the first try. Default: 3. */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms. Default: 1000. */
  baseDelay?: number;
  /**
   * Optional predicate. When provided, only retry if it returns true for
   * the thrown error. Use this to fast-fail on permanent errors (e.g.
   * 400/401/403) while still retrying transient ones (429/5xx).
   */
  shouldRetry?: (err: Error) => boolean;
}

/**
 * Acquire a rate-limit slot, then run `fn` with exponential-backoff retry.
 *
 * Equivalent to:
 *
 *   await limiter.wait();
 *   return withRetry(fn, maxRetries, baseDelay, shouldRetry);
 *
 * The slot is acquired exactly once — retries do **not** re-acquire,
 * because the original interval already paid the cost. (This matches the
 * pre-base behavior of every adapter.)
 */
export async function withRateLimit<T>(
  limiter: RateLimiter,
  fn: () => Promise<T>,
  opts: WithRateLimitOptions = {}
): Promise<T> {
  await limiter.wait();
  return withRetry(fn, opts.maxRetries ?? 3, opts.baseDelay ?? 1000, opts.shouldRetry);
}

/**
 * Validate an untyped value against a Zod schema, throwing a tagged error
 * on mismatch.  The thrown `Error.message` begins with `[<context>]` so
 * adapter logs make it obvious which source produced the bad payload.
 *
 * Returns the parsed value (which Zod narrows to the schema's inferred
 * type) on success.
 *
 * Adapters can opt in selectively — passing a schema is purely a runtime
 * safety net; the existing `as Interface` casts continue to work for
 * legacy call sites.
 */
export function parseWithSchema<T>(data: unknown, schema: ZodType<T>, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const summary = result.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`[${context}] schema validation failed: ${summary}`);
  }
  return result.data;
}
