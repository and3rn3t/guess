import { describe, it, expect } from 'vitest'
import {
  computeBaseline,
  detectAnomaly,
  formatWebhookPayload,
} from './_anomaly_detector'

describe('computeBaseline', () => {
  it('returns zeros for empty input', () => {
    expect(computeBaseline([])).toEqual({ mean: 0, std: 0, count: 0 })
  })

  it('returns mean only with std=0 for a single sample', () => {
    expect(computeBaseline([42])).toEqual({ mean: 42, std: 0, count: 1 })
  })

  it('computes sample stddev (n-1 denominator)', () => {
    // values 2,4,4,4,5,5,7,9 → mean 5, sample variance 32/7, stddev √(32/7)
    const b = computeBaseline([2, 4, 4, 4, 5, 5, 7, 9])
    expect(b.mean).toBe(5)
    expect(b.std).toBeCloseTo(Math.sqrt(32 / 7), 10)
    expect(b.count).toBe(8)
  })

  it('skips non-finite values', () => {
    const b = computeBaseline([1, 2, 3, NaN, Infinity])
    expect(b.count).toBe(3)
    expect(b.mean).toBe(2)
  })
})

describe('detectAnomaly', () => {
  // baseline of fourteen 0.9s + tiny jitter — std small
  const baseline = computeBaseline([
    0.9, 0.91, 0.89, 0.9, 0.92, 0.88, 0.9, 0.91, 0.89, 0.9, 0.9, 0.91, 0.89, 0.9,
  ])

  it('returns null when value is in band', () => {
    expect(detectAnomaly(0.91, baseline)).toBeNull()
  })

  it('flags an above-band value', () => {
    const a = detectAnomaly(0.99, baseline)
    expect(a).not.toBeNull()
    expect(a!.direction).toBe('above')
    expect(Math.abs(a!.zScore)).toBeGreaterThan(2)
  })

  it('flags a below-band value', () => {
    const a = detectAnomaly(0.5, baseline)
    expect(a).not.toBeNull()
    expect(a!.direction).toBe('below')
  })

  it('returns null when sample is too small', () => {
    const small = computeBaseline([1, 2, 3])
    expect(detectAnomaly(100, small)).toBeNull()
  })

  it('respects custom sigma', () => {
    const a = detectAnomaly(0.93, baseline, { sigma: 1 })
    // 0.93 ought to be > 1σ from the ~0.9 mean
    expect(a).not.toBeNull()
  })

  it('flags any departure when std is 0', () => {
    const flat = computeBaseline([5, 5, 5, 5, 5, 5, 5, 5])
    expect(detectAnomaly(5, flat)).toBeNull()
    const a = detectAnomaly(6, flat)
    expect(a).not.toBeNull()
    expect(a!.zScore).toBe(0)
    expect(a!.direction).toBe('above')
  })

  it('returns null for non-finite input', () => {
    expect(detectAnomaly(NaN, baseline)).toBeNull()
  })
})

describe('formatWebhookPayload', () => {
  const baseline = { mean: 0.9, std: 0.02, count: 14 }
  const anomaly = {
    value: 0.6,
    baseline,
    delta: -0.3,
    zScore: -15,
    direction: 'below' as const,
  }

  it('renders a Slack-compatible text payload', () => {
    const out = formatWebhookPayload({ metric: 'win_rate', anomaly })
    expect(out.text).toContain('▼')
    expect(out.text).toContain('*win_rate*')
    expect(out.text).toContain('z=-15.00')
    expect(out.text).toContain('0.6')
    expect(out.text).toContain('0.9')
    expect(out.text).toContain('n=14')
  })

  it('appends a dashboard link when supplied', () => {
    const out = formatWebhookPayload({
      metric: 'win_rate',
      anomaly,
      dashboardUrl: 'https://example.com/admin/alerts',
    })
    expect(out.text).toContain('<https://example.com/admin/alerts|view chart>')
  })
})
