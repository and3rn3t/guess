import { describe, expect, it, vi } from 'vitest'

import {
  buildLLMUsageDataPoint,
  estimateCostUsd,
  recordLLMUsage,
  type AnalyticsEngineDataset,
  type TokenUsage,
} from './_llm_metrics'

const usage: TokenUsage = {
  prompt_tokens: 1000,
  completion_tokens: 500,
  total_tokens: 1500,
}

describe('estimateCostUsd', () => {
  it('prices gpt-4o-mini correctly', () => {
    // 1000 in × $0.00015/1K + 500 out × $0.0006/1K = 0.00015 + 0.0003 = 0.00045
    expect(estimateCostUsd('gpt-4o-mini', usage)).toBe(0.00045)
  })

  it('prices gpt-4o correctly', () => {
    // 1000 in × $0.0025/1K + 500 out × $0.01/1K = 0.0025 + 0.005 = 0.0075
    expect(estimateCostUsd('gpt-4o', usage)).toBe(0.0075)
  })

  it('falls back to a generic price for unknown models', () => {
    const cost = estimateCostUsd('claude-mythical', usage)
    expect(cost).toBeGreaterThan(0)
  })

  it('rounds to 6 decimal places', () => {
    const cost = estimateCostUsd('gpt-4o-mini', { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 })
    expect(cost.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6)
  })

  it('returns 0 for zero usage', () => {
    expect(estimateCostUsd('gpt-4o', { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 })).toBe(0)
  })
})

describe('buildLLMUsageDataPoint', () => {
  it('packs blobs, doubles, and indexes per the documented schema', () => {
    const point = buildLLMUsageDataPoint({
      model: 'gpt-4o-mini',
      userId: 'user-abc',
      usage,
      cacheStatus: 'MISS',
      endpoint: 'llm',
      retryCount: 2,
      retryOutcome: '5xx',
    })
    expect(point.blobs).toEqual(['gpt-4o-mini', 'user-abc', 'MISS', 'llm', '5xx'])
    expect(point.doubles).toEqual([1000, 500, 1500, 0.00045, 2])
    expect(point.indexes).toEqual(['user-abc'])
  })

  it('reflects HIT cache status', () => {
    const point = buildLLMUsageDataPoint({
      model: 'gpt-4o',
      userId: 'u1',
      usage,
      cacheStatus: 'HIT',
      endpoint: 'llm',
      retryCount: 0,
      retryOutcome: 'none',
    })
    expect(point.blobs?.[2]).toBe('HIT')
  })

  it('normalizes negative retry counts to zero', () => {
    const point = buildLLMUsageDataPoint({
      model: 'gpt-4o-mini',
      userId: 'u1',
      usage,
      cacheStatus: 'MISS',
      endpoint: 'llm',
      retryCount: -5,
      retryOutcome: 'mixed',
    })
    expect(point.doubles?.[4]).toBe(0)
  })
})

describe('recordLLMUsage', () => {
  it('no-ops when dataset is undefined', () => {
    expect(() =>
      recordLLMUsage(undefined, {
        model: 'gpt-4o',
        userId: 'u',
        usage,
        cacheStatus: 'MISS',
        endpoint: 'llm',
        retryCount: 0,
        retryOutcome: 'none',
      })
    ).not.toThrow()
  })

  it('writes one data point when dataset is bound', () => {
    const writeDataPoint = vi.fn()
    const dataset: AnalyticsEngineDataset = { writeDataPoint }
    recordLLMUsage(dataset, {
      model: 'gpt-4o-mini',
      userId: 'u1',
      usage,
      cacheStatus: 'MISS',
      endpoint: 'llm',
      retryCount: 1,
      retryOutcome: '429',
    })
    expect(writeDataPoint).toHaveBeenCalledTimes(1)
    expect(writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: ['gpt-4o-mini', 'u1', 'MISS', 'llm', '429'],
        indexes: ['u1'],
      })
    )
  })

  it('swallows binding errors so user requests never fail on telemetry', () => {
    const dataset: AnalyticsEngineDataset = {
      writeDataPoint: () => {
        throw new Error('AE quota exceeded')
      },
    }
    expect(() =>
      recordLLMUsage(dataset, {
        model: 'gpt-4o',
        userId: 'u',
        usage,
        cacheStatus: 'MISS',
        endpoint: 'llm',
        retryCount: 0,
        retryOutcome: 'none',
      })
    ).not.toThrow()
  })
})
