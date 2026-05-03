// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { CuratorQueuePanel } from './CuratorQueuePanel'
/* eslint-disable @typescript-eslint/no-explicit-any */

describe('CuratorQueuePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads and displays curator queue data', async () => {
    const mockData = {
      report: {
        totals: {
          totalItems: 50,
          unresolved: 35,
          assigned: 15,
          locked: 5,
          avgAgedDays: 3,
        },
        perIssueType: {
          cannot_infer: { count: 20, percentOfTotal: 40.0 },
          canon_conflict: { count: 15, percentOfTotal: 30.0 },
          subjective: { count: 15, percentOfTotal: 30.0 },
        },
        items: [
          {
            id: 1,
            characterId: 'c1',
            attributeKey: 'personality',
            issueType: 'canon_conflict' as const,
            issueReason: 'Multiple interpretations',
            category: 'anime',
            assignedTo: null,
            resolvedAt: null,
            locked: false,
            lockedUntil: null,
            lockReason: null,
            agedDays: 5,
            popularity: 0.8,
            priorityScore: 0.7,
          },
        ],
      },
      fetchedAt: Date.now(),
      limit: 200,
    }

    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    })

    render(<CuratorQueuePanel />)

    await waitFor(() => {
      expect(screen.getByText('Curator Queue')).toBeInTheDocument()
    })

    // Check totals
    expect(screen.getByText('50')).toBeInTheDocument() // total items
    expect(screen.getByText('35')).toBeInTheDocument() // unresolved

    // Check per-type breakdown (component renders breakdown section)
    const breakdownHeading = screen.getByText('By Issue Type')
    expect(breakdownHeading).toBeInTheDocument()
    // Component renders breakdown items within that section
    expect(screen.getAllByText(/cannot infer/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/canon conflict/i).length).toBeGreaterThan(0)
  })

  it('displays loading skeleton initially', () => {
    ;(globalThis.fetch as any).mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<CuratorQueuePanel />)

    expect(screen.getByText('Curator Queue')).toBeInTheDocument()
    // Skeleton should be present during loading
  })

  it('displays error message on fetch failure', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new Error('Network error'))

    render(<CuratorQueuePanel />)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('displays no data message when response is empty', async () => {
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => null,
    })

    render(<CuratorQueuePanel />)

    await waitFor(() => {
      expect(screen.getByText('No curator queue data available')).toBeInTheDocument()
    })
  })

  it('displays unresolved items with status indicators', async () => {
    const mockData = {
      report: {
        totals: {
          totalItems: 3,
          unresolved: 3,
          assigned: 1,
          locked: 1,
          avgAgedDays: 2,
        },
        perIssueType: {
          cannot_infer: { count: 1, percentOfTotal: 33.3 },
          canon_conflict: { count: 1, percentOfTotal: 33.3 },
          subjective: { count: 1, percentOfTotal: 33.3 },
        },
        items: [
          {
            id: 1,
            characterId: 'c1',
            attributeKey: 'attr1',
            issueType: 'canon_conflict' as const,
            issueReason: 'Conflict',
            category: 'anime',
            assignedTo: null,
            resolvedAt: null,
            locked: false,
            lockedUntil: null,
            lockReason: null,
            agedDays: 3,
            popularity: 0.9,
            priorityScore: 0.8,
          },
          {
            id: 2,
            characterId: 'c2',
            attributeKey: 'attr2',
            issueType: 'cannot_infer' as const,
            issueReason: 'Insufficient',
            category: 'movies',
            assignedTo: 'curator@test.com',
            resolvedAt: null,
            locked: false,
            lockedUntil: null,
            lockReason: null,
            agedDays: 1,
            popularity: 0.7,
            priorityScore: 0.6,
          },
          {
            id: 3,
            characterId: 'c3',
            attributeKey: 'attr3',
            issueType: 'subjective' as const,
            issueReason: 'Opinion',
            category: 'anime',
            assignedTo: null,
            resolvedAt: null,
            locked: true,
            lockedUntil: Date.now() + 3600000,
            lockReason: 'Awaiting feedback',
            agedDays: 0,
            popularity: 0.5,
            priorityScore: 0.4,
          },
        ],
      },
      fetchedAt: Date.now(),
      limit: 200,
    }

    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    })

    render(<CuratorQueuePanel />)

    await waitFor(() => {
      expect(screen.getByText('c1 · attr1')).toBeInTheDocument()
    })

    // Check for assigned indicator
    expect(screen.getByText(/curator@test.com/)).toBeInTheDocument()

    // Check for locked indicator
    const lockedBadges = screen.getAllByText(/Locked/)
    expect(lockedBadges.length).toBeGreaterThan(0)
  })
})
