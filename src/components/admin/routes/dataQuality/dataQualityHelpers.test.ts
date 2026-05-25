import { describe, it, expect } from 'vitest'

import {
  buildTrendSeries,
  fmtPct,
  fmtPctPrecise,
  fmtPp,
  formatAutomationShareDelta,
  gateTone,
  relativeFromIso,
  toDay,
} from './dataQualityHelpers'
import type { HistoryRow, LiveSnapshot } from './dataQualityTypes'

function makeSnapshot(overrides: Partial<LiveSnapshot['completeness']['gate']> = {}): LiveSnapshot {
  return {
    capturedAt: 0,
    dataHealthScore: 0,
    components: { coverage: 0, evidence: 0, agreement: 0, disputeHealth: 0 },
    weights: { coverage: 0, evidence: 0, agreement: 0, disputeHealth: 0 },
    coveragePct: 0,
    evidencePct: 0,
    agreementAvg: 0,
    agreementSampleSize: 0,
    openDisputes: 0,
    totalCharacters: 0,
    activeAttributes: 0,
    attributeRows: 0,
    completeness: {
      dataCompleteScore: 0,
      components: { global: 0, categoryFloor: 0, evidence: 0, sourceId: 0, disputeHealth: 0 },
      weights: { global: 0, categoryFloor: 0, evidence: 0, sourceId: 0, disputeHealth: 0 },
      categoryFloorScore: 0,
      categoryCompleteness: {},
      globalCompleteness: 0,
      evidenceCoverage: 0,
      sourceIdCoverage: 0,
      openHighPriorityDisputes: 0,
      totalRequiredCells: 0,
      filledRequiredCells: 0,
      gate: {
        warn: false,
        fail: false,
        warnThreshold: 0.92,
        failThreshold: 0.95,
        categoryFloorThreshold: 0.9,
        disputeBudget: 25,
        categoriesBelowFloor: [],
        ...overrides,
      },
      config: { warnScore: 0.92, failScore: 0.95, defaultCategoryFloor: 0.9, disputeBudget: 25 },
    },
  }
}

describe('dataQualityHelpers', () => {
  describe('fmtPct / fmtPctPrecise / fmtPp', () => {
    it('formats percentages with 1 decimal', () => {
      expect(fmtPct(0.9)).toBe('90.0%')
      expect(fmtPct(0.9342)).toBe('93.4%')
    })
    it('formats precise percentages with 2 decimals', () => {
      expect(fmtPctPrecise(0.92)).toBe('92.00%')
      expect(fmtPctPrecise(0.9543)).toBe('95.43%')
    })
    it('formats percentage-point deltas with sign', () => {
      expect(fmtPp(2.5)).toBe('+2.5 pp')
      expect(fmtPp(-1.2)).toBe('-1.2 pp')
      expect(fmtPp(0)).toBe('0.0 pp')
    })
  })

  describe('gateTone', () => {
    it('returns PASS when warn and fail are false', () => {
      const t = gateTone(makeSnapshot())
      expect(t.label).toBe('PASS')
      expect(t.className).toContain('emerald')
    })
    it('returns WARN when only warn is true', () => {
      const t = gateTone(makeSnapshot({ warn: true }))
      expect(t.label).toBe('WARN')
      expect(t.className).toContain('amber')
    })
    it('returns FAIL when fail is true (takes precedence over warn)', () => {
      const t = gateTone(makeSnapshot({ warn: true, fail: true }))
      expect(t.label).toBe('FAIL')
      expect(t.className).toContain('destructive')
    })
  })

  describe('toDay', () => {
    it('converts unix seconds to ISO date', () => {
      expect(toDay(1714650000)).toBe('2024-05-02')
    })
  })

  describe('relativeFromIso', () => {
    it('returns "unknown" for invalid input', () => {
      expect(relativeFromIso('not-a-date')).toBe('unknown')
    })
    it('returns "just now" for very recent timestamps', () => {
      expect(relativeFromIso(new Date().toISOString())).toBe('just now')
    })
    it('returns minute granularity for sub-hour deltas', () => {
      const iso = new Date(Date.now() - 5 * 60_000).toISOString()
      expect(relativeFromIso(iso)).toMatch(/^[45]m ago$/)
    })
    it('returns day granularity for multi-day deltas', () => {
      const iso = new Date(Date.now() - 3 * 86_400_000).toISOString()
      expect(relativeFromIso(iso)).toBe('3d ago')
    })
  })

  describe('formatAutomationShareDelta', () => {
    it('returns "n/a" for null', () => {
      expect(formatAutomationShareDelta(null)).toBe('n/a')
    })
    it('delegates to fmtPp otherwise', () => {
      expect(formatAutomationShareDelta(2.1)).toBe('+2.1 pp')
    })
  })

  describe('buildTrendSeries', () => {
    const baseRow: HistoryRow = {
      captured_at: 1714650000,
      data_health_score: 85,
      coverage_pct: 0.88,
      evidence_pct: 0.84,
      agreement_avg: 0.78,
      open_disputes: 6,
      golden_pass_rate: null,
      vision_pass_rate: null,
      closure_total_pairs: null,
      closure_automation_pairs: null,
      closure_manual_pairs: null,
    }

    it('returns empty series for empty history', () => {
      const out = buildTrendSeries([])
      expect(out.healthSeries).toEqual([])
      expect(out.closureLaneMixSeries).toEqual([])
      expect(out.latestLaneMix).toBeNull()
      expect(out.automationShareDeltaPp).toBeNull()
    })

    it('filters null golden/vision rates but keeps health/agreement/dispute', () => {
      const out = buildTrendSeries([baseRow])
      expect(out.goldenSeries).toEqual([])
      expect(out.visionSeries).toEqual([])
      expect(out.healthSeries).toHaveLength(1)
      expect(out.agreementSeries[0].value).toBe(0.78)
    })

    it('computes lane mix shares and automation-share delta when 2+ closure rows present', () => {
      const out = buildTrendSeries([
        { ...baseRow, captured_at: 1714650000, closure_total_pairs: 100, closure_automation_pairs: 50, closure_manual_pairs: 50 },
        { ...baseRow, captured_at: 1714736400, closure_total_pairs: 100, closure_automation_pairs: 70, closure_manual_pairs: 30 },
      ])
      expect(out.closureLaneMixSeries).toHaveLength(2)
      expect(out.latestLaneMix?.automation).toBeCloseTo(0.7)
      expect(out.automationShareDeltaPp).toBeCloseTo(20)
    })

    it('skips closure rows with zero total pairs', () => {
      const out = buildTrendSeries([
        { ...baseRow, closure_total_pairs: 0, closure_automation_pairs: 0, closure_manual_pairs: 0 },
      ])
      expect(out.closureLaneMixSeries).toEqual([])
    })
  })
})
