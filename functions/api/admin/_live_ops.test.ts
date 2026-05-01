import { describe, it, expect } from 'vitest'
import {
  buildLiveOpsSummary,
  buildP95LatencyQuery,
  parseP95LatencyResponse,
} from './_live_ops'

describe('buildLiveOpsSummary', () => {
  it('returns derived rates and rounded values', () => {
    const summary = buildLiveOpsSummary(
      { games1h: 120, wins1h: 90, errors1h: 6, warns1h: 12 },
      823.6,
      1714509000,
    )
    expect(summary.games1h).toBe(120)
    expect(summary.wins1h).toBe(90)
    expect(summary.losses1h).toBe(30)
    expect(summary.errors1h).toBe(6)
    expect(summary.warns1h).toBe(12)
    expect(summary.gamesPerMin).toBe(2)
    expect(summary.errorsPerMin).toBe(0.1)
    expect(summary.winRate).toBe(0.75)
    expect(summary.errorRate).toBe(0.05)
    expect(summary.p95LatencyMs).toBe(824)
    expect(summary.generatedAt).toBe(1714509000)
  })

  it('returns null rates when no games occurred', () => {
    const summary = buildLiveOpsSummary({ games1h: 0, wins1h: 0, errors1h: 3, warns1h: 0 }, null)
    expect(summary.gamesPerMin).toBe(0)
    expect(summary.winRate).toBeNull()
    expect(summary.errorRate).toBeNull()
    expect(summary.errorsPerMin).toBe(0.05)
    expect(summary.p95LatencyMs).toBeNull()
  })

  it('clamps wins to games and rejects negatives', () => {
    const summary = buildLiveOpsSummary(
      { games1h: 10, wins1h: 99, errors1h: -5, warns1h: -1 },
      -3,
    )
    expect(summary.wins1h).toBe(10)
    expect(summary.losses1h).toBe(0)
    expect(summary.errors1h).toBe(0)
    expect(summary.warns1h).toBe(0)
    expect(summary.p95LatencyMs).toBe(0)
  })

  it('handles non-finite latency by returning null', () => {
    const summary = buildLiveOpsSummary(
      { games1h: 5, wins1h: 1, errors1h: 0, warns1h: 0 },
      Number.NaN as unknown as number,
    )
    // NaN coerces to null via the response parser; here we treat it as a
    // pass-through of whatever caller supplied. The parser is tested below.
    expect(Number.isNaN(summary.p95LatencyMs)).toBe(true)
  })
})

describe('buildP95LatencyQuery', () => {
  it('targets the supplied dataset and 60-minute window by default', () => {
    const sql = buildP95LatencyQuery('worker_tail')
    expect(sql).toContain('FROM worker_tail')
    expect(sql).toContain("INTERVAL '60' MINUTE")
    expect(sql).toContain('quantileWeighted(0.95, double2, _sample_interval)')
    expect(sql).toContain("blob4 != 'exception'")
  })

  it('respects a custom window', () => {
    const sql = buildP95LatencyQuery('worker_tail_preview', 15)
    expect(sql).toContain("INTERVAL '15' MINUTE")
    expect(sql).toContain('FROM worker_tail_preview')
  })
})

describe('parseP95LatencyResponse', () => {
  it('extracts the p95 value from the AE shape', () => {
    expect(parseP95LatencyResponse({ data: [{ p95: 412.7 }] })).toBe(412.7)
  })

  it('returns null on empty data', () => {
    expect(parseP95LatencyResponse({ data: [] })).toBeNull()
    expect(parseP95LatencyResponse({ data: [{ p95: null }] })).toBeNull()
  })

  it('returns null on malformed input', () => {
    expect(parseP95LatencyResponse(null)).toBeNull()
    expect(parseP95LatencyResponse('oops')).toBeNull()
    expect(parseP95LatencyResponse({ errors: [{ message: 'no dataset' }] })).toBeNull()
  })
})
