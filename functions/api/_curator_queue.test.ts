import { describe, it, expect } from 'vitest'
import { buildCurationQueueReport, type CurationQueueRow } from './_curator_queue'

describe('buildCurationQueueReport', () => {
  const mockNow = 1714860000000 // 2026-05-03T16:00:00Z
  const oneDayAgo = mockNow - 86400000
  const sevenDaysAgo = mockNow - 7 * 86400000

  it('returns correct totals and per-issue-type breakdown', () => {
    const rows: CurationQueueRow[] = [
      {
        id: 1,
        character_id: 'c1',
        attribute_key: 'personality',
        issue_type: 'cannot_infer',
        issue_reason: 'Insufficient evidence',
        category: 'anime',
        assigned_to: null,
        resolved_at: null,
        resolution_reason: null,
        resolution_value: null,
        locked_until: null,
        lock_reason: null,
        created_at: sevenDaysAgo,
        updated_at: sevenDaysAgo,
        popularity: 0.8,
        priority_score: 0.5,
      },
      {
        id: 2,
        character_id: 'c2',
        attribute_key: 'isHuman',
        issue_type: 'canon_conflict',
        issue_reason: 'Multiple valid interpretations',
        category: 'movies',
        assigned_to: 'curator1',
        resolved_at: null,
        resolution_reason: null,
        resolution_value: null,
        locked_until: null,
        lock_reason: null,
        created_at: oneDayAgo,
        updated_at: oneDayAgo,
        popularity: 0.9,
        priority_score: 0.7,
      },
      {
        id: 3,
        character_id: 'c3',
        attribute_key: 'appearance',
        issue_type: 'subjective',
        issue_reason: 'Opinion-dependent',
        category: 'anime',
        assigned_to: null,
        resolved_at: null,
        resolution_reason: null,
        resolution_value: null,
        locked_until: null,
        lock_reason: null,
        created_at: mockNow - 3600000, // 1 hour ago
        updated_at: mockNow - 3600000,
        popularity: 0.5,
        priority_score: 0.2,
      },
    ]

    // Mock Date.now() for test
    const report = buildCurationQueueReport(rows, { limit: 10, nowMs: mockNow })

    expect(report.totals.totalItems).toBe(3)
    expect(report.totals.unresolved).toBe(3)
    expect(report.totals.assigned).toBe(1)
    expect(report.totals.locked).toBe(0)
    expect(report.totals.avgAgedDays).toBe(Math.round((7 + 1 + 0) / 3))

    expect(report.perIssueType.cannot_infer.count).toBe(1)
    expect(report.perIssueType.cannot_infer.percentOfTotal).toBe(33.3)
    expect(report.perIssueType.canon_conflict.count).toBe(1)
    expect(report.perIssueType.subjective.count).toBe(1)
  })

  it('filters out resolved items when onlyUnresolved is true', () => {
    const rows: CurationQueueRow[] = [
      {
        id: 1,
        character_id: 'c1',
        attribute_key: 'personality',
        issue_type: 'cannot_infer',
        issue_reason: 'Test',
        category: 'anime',
        assigned_to: null,
        resolved_at: null,
        resolution_reason: null,
        resolution_value: null,
        locked_until: null,
        lock_reason: null,
        created_at: oneDayAgo,
        updated_at: oneDayAgo,
        popularity: 0.5,
        priority_score: 0.3,
      },
      {
        id: 2,
        character_id: 'c2',
        attribute_key: 'isHuman',
        issue_type: 'canon_conflict',
        issue_reason: 'Test',
        category: 'movies',
        assigned_to: null,
        resolved_at: mockNow - 3600000, // Resolved 1 hour ago
        resolution_reason: 'Curator decision',
        resolution_value: 'true',
        locked_until: null,
        lock_reason: null,
        created_at: sevenDaysAgo,
        updated_at: mockNow - 3600000,
        popularity: 0.7,
        priority_score: 0.5,
      },
    ]

    const report = buildCurationQueueReport(rows, { onlyUnresolved: true, limit: 10, nowMs: mockNow })

    expect(report.items.length).toBe(1)
    expect(report.items[0].characterId).toBe('c1')
    expect(report.totals.unresolved).toBe(1) // Total totals count all rows, not filtered
    expect(report.totals.totalItems).toBe(2)
  })

  it('sorts items by priority score (highest first), then by age', () => {
    const rows: CurationQueueRow[] = [
      {
        id: 1,
        character_id: 'c1',
        attribute_key: 'attr1',
        issue_type: 'subjective',
        issue_reason: 'Test',
        category: 'anime',
        assigned_to: null,
        resolved_at: null,
        resolution_reason: null,
        resolution_value: null,
        locked_until: null,
        lock_reason: null,
        created_at: mockNow - 10 * 86400000, // 10 days old
        updated_at: mockNow - 10 * 86400000,
        popularity: 0.5,
        priority_score: 0.3,
      },
      {
        id: 2,
        character_id: 'c2',
        attribute_key: 'attr2',
        issue_type: 'canon_conflict',
        issue_reason: 'Test',
        category: 'movies',
        assigned_to: null,
        resolved_at: null,
        resolution_reason: null,
        resolution_value: null,
        locked_until: null,
        lock_reason: null,
        created_at: mockNow - 5 * 86400000, // 5 days old
        updated_at: mockNow - 5 * 86400000,
        popularity: 0.5,
        priority_score: 0.8, // Higher priority
      },
    ]

    const report = buildCurationQueueReport(rows, { limit: 10, nowMs: mockNow })

    expect(report.items.length).toBe(2)
    expect(report.items[0].id).toBe(2) // canon_conflict (higher priority) comes first
    expect(report.items[1].id).toBe(1) // subjective comes second
  })

  it('respects limit parameter', () => {
    const rows: CurationQueueRow[] = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      character_id: `c${i}`,
      attribute_key: 'attr',
      issue_type: 'cannot_infer' as const,
      issue_reason: 'Test',
      category: 'anime',
      assigned_to: null,
      resolved_at: null,
      resolution_reason: null,
      resolution_value: null,
      locked_until: null,
      lock_reason: null,
      created_at: oneDayAgo,
      updated_at: oneDayAgo,
      popularity: 0.5,
      priority_score: 0.3,
    }))

    const report = buildCurationQueueReport(rows, { limit: 25, nowMs: mockNow })

    expect(report.items.length).toBe(25)
    expect(report.totals.totalItems).toBe(100) // Totals reflect all rows
  })

  it('correctly identifies locked items', () => {
    const futureTime = mockNow + 3600000 // 1 hour in future
    const pastTime = mockNow - 3600000 // 1 hour in past

    const rows: CurationQueueRow[] = [
      {
        id: 1,
        character_id: 'c1',
        attribute_key: 'attr1',
        issue_type: 'cannot_infer',
        issue_reason: 'Test',
        category: 'anime',
        assigned_to: null,
        resolved_at: null,
        resolution_reason: null,
        resolution_value: null,
        locked_until: futureTime, // Still locked
        lock_reason: 'Awaiting feedback',
        created_at: oneDayAgo,
        updated_at: oneDayAgo,
        popularity: 0.5,
        priority_score: 0.3,
      },
      {
        id: 2,
        character_id: 'c2',
        attribute_key: 'attr2',
        issue_type: 'cannot_infer',
        issue_reason: 'Test',
        category: 'movies',
        assigned_to: null,
        resolved_at: null,
        resolution_reason: null,
        resolution_value: null,
        locked_until: pastTime, // Lock expired
        lock_reason: 'Old lock',
        created_at: oneDayAgo,
        updated_at: oneDayAgo,
        popularity: 0.5,
        priority_score: 0.3,
      },
    ]

    const report = buildCurationQueueReport(rows, { limit: 10, nowMs: mockNow })

    expect(report.totals.locked).toBe(1)
    expect(report.items[0].locked).toBe(true) // Future lock is active
    expect(report.items[1].locked).toBe(false) // Past lock is expired
  })
})
