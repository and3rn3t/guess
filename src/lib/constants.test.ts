import { describe, it, expect } from 'vitest'
import {
  SCORE_MATCH,
  SCORE_MISMATCH,
  SCORE_UNKNOWN,
  SCORE_MAYBE,
  SCORE_MAYBE_MISS,
  LLM_MAX_RETRIES,
  LLM_RETRY_BASE_MS,
  LLM_RETRYABLE_STATUSES,
  LLM_NON_RETRYABLE_CODES,
  SYNC_CACHE_TTL,
  MAX_ANALYTICS_EVENTS,
  KV_USER_ID,
  KV_ANALYTICS,
} from './constants'

describe('Bayesian scoring constants', () => {
  it('SCORE_MATCH is 1.0', () => {
    expect(SCORE_MATCH).toBe(1.0)
  })

  it('SCORE_MISMATCH is 0.05 (soft penalty for resilience)', () => {
    expect(SCORE_MISMATCH).toBe(0.05)
  })

  it('SCORE_UNKNOWN is 0.35', () => {
    expect(SCORE_UNKNOWN).toBe(0.35)
  })

  it('SCORE_MAYBE > SCORE_MAYBE_MISS', () => {
    expect(SCORE_MAYBE).toBeGreaterThan(SCORE_MAYBE_MISS)
  })

  it('all scores are between 0 and 1', () => {
    for (const score of [SCORE_MATCH, SCORE_MISMATCH, SCORE_UNKNOWN, SCORE_MAYBE, SCORE_MAYBE_MISS]) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    }
  })
})

describe('LLM retry constants', () => {
  it('has positive max retries', () => {
    expect(LLM_MAX_RETRIES).toBeGreaterThan(0)
  })

  it('has positive retry base delay', () => {
    expect(LLM_RETRY_BASE_MS).toBeGreaterThan(0)
  })

  it('retryable statuses include 429, 502, 503', () => {
    expect(LLM_RETRYABLE_STATUSES.has(429)).toBe(true)
    expect(LLM_RETRYABLE_STATUSES.has(502)).toBe(true)
    expect(LLM_RETRYABLE_STATUSES.has(503)).toBe(true)
  })

  it('non-retryable codes include QUOTA_EXCEEDED', () => {
    expect(LLM_NON_RETRYABLE_CODES.has('QUOTA_EXCEEDED')).toBe(true)
  })
})

describe('storage/DB constants', () => {
  it('SYNC_CACHE_TTL is 10 minutes', () => {
    expect(SYNC_CACHE_TTL).toBe(10 * 60 * 1000)
  })

  it('MAX_ANALYTICS_EVENTS is 500', () => {
    expect(MAX_ANALYTICS_EVENTS).toBe(500)
  })

  it('KV keys are prefixed', () => {
    expect(KV_USER_ID).toMatch(/^kv:/)
    expect(KV_ANALYTICS).toMatch(/^kv:/)
  })
})
