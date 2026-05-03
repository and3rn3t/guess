import { describe, it, expect } from 'vitest'

import { computeDataCompletenessScore } from './_data_completeness'

describe('computeDataCompletenessScore', () => {
  it('computes weighted score using canonical DQ.31 formula', () => {
    const result = computeDataCompletenessScore({
      globalCompleteness: 0.9,
      categoryCompleteness: { anime: 0.94, movies: 0.96 },
      evidenceCoverage: 0.8,
      sourceIdCoverage: 0.85,
      openHighPriorityDisputes: 10,
      disputeBudget: 25,
      categoryFloorThreshold: 0.9,
      warnScoreThreshold: 0.92,
      failScoreThreshold: 0.95,
    })

    // 0.35*0.9 + 0.25*0.94 + 0.2*0.8 + 0.1*0.85 + 0.1*(1-10/25)
    // = 0.315 + 0.235 + 0.16 + 0.085 + 0.06 = 0.855
    expect(result.score).toBe(0.855)
    expect(result.components.categoryFloor).toBe(0.94)
  })

  it('warns and does not fail when score is between warn and fail thresholds', () => {
    const result = computeDataCompletenessScore({
      globalCompleteness: 0.94,
      categoryCompleteness: { anime: 0.95, movies: 0.95 },
      evidenceCoverage: 0.94,
      sourceIdCoverage: 0.94,
      openHighPriorityDisputes: 0,
      disputeBudget: 25,
      categoryFloorThreshold: 0.9,
      warnScoreThreshold: 0.95,
      failScoreThreshold: 0.9,
    })

    expect(result.gate.warn).toBe(true)
    expect(result.gate.fail).toBe(false)
  })

  it('fails when high-priority disputes exceed budget', () => {
    const result = computeDataCompletenessScore({
      globalCompleteness: 1,
      categoryCompleteness: { anime: 1, movies: 1 },
      evidenceCoverage: 1,
      sourceIdCoverage: 1,
      openHighPriorityDisputes: 26,
      disputeBudget: 25,
      categoryFloorThreshold: 0.9,
      warnScoreThreshold: 0.92,
      failScoreThreshold: 0.95,
    })

    expect(result.gate.fail).toBe(true)
  })

  it('reports categories below floor and uses that to trigger gates', () => {
    const result = computeDataCompletenessScore({
      globalCompleteness: 1,
      categoryCompleteness: { anime: 0.88, movies: 1 },
      evidenceCoverage: 1,
      sourceIdCoverage: 1,
      openHighPriorityDisputes: 0,
      disputeBudget: 25,
      categoryFloorThreshold: 0.9,
      warnScoreThreshold: 0.92,
      failScoreThreshold: 0.95,
    })

    expect(result.gate.categoriesBelowFloor).toEqual(['anime'])
    expect(result.gate.warn).toBe(true)
    expect(result.gate.fail).toBe(true)
  })

  it('clamps non-finite and out-of-range values defensively', () => {
    const result = computeDataCompletenessScore({
      globalCompleteness: Number.NaN,
      categoryCompleteness: { anime: Number.POSITIVE_INFINITY, movies: -1 },
      evidenceCoverage: Number.POSITIVE_INFINITY,
      sourceIdCoverage: Number.NEGATIVE_INFINITY,
      openHighPriorityDisputes: 0,
      disputeBudget: 0,
      categoryFloorThreshold: 2,
      warnScoreThreshold: -1,
      failScoreThreshold: 5,
    })

    expect(result.components.global).toBe(0)
    expect(result.components.categoryFloor).toBe(0)
    expect(result.components.evidence).toBe(0)
    expect(result.gate.disputeBudget).toBe(1)
    expect(result.gate.warnThreshold).toBe(0)
    expect(result.gate.failThreshold).toBe(1)
  })
})