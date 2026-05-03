// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import CoverageRoute from '../routes/CoverageRoute'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CoverageRoute', () => {
  it('renders and exposes an accessible dismiss control for AI priorities', async () => {
    const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = (() => {
        if (typeof input === 'string') return input
        if (input instanceof URL) return input.toString()
        return input.url
      })()

      if (url.includes('/api/admin/coverage-priority') && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                key: 'isHuman',
                displayText: 'Human',
                nullPct: 42,
                reason: 'High impact and sparse coverage',
              },
            ],
          }),
        }
      }

      return {
        ok: true,
        json: async () => ({
          totalEnriched: 12,
          totalActive: 1,
          category: null,
          attributes: [
            {
              key: 'isHuman',
              displayText: 'Human',
              trueCount: 8,
              falseCount: 4,
              nullCount: 0,
              definedCount: 12,
              missingCount: 0,
              coveragePct: 100,
              diversityScore: 0.5,
            },
          ],
        }),
      }
    })

    vi.stubGlobal('fetch', fetchMock)

    render(<CoverageRoute />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Attribute Coverage Report' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'AI Prioritize' }))

    await waitFor(() => {
      expect(screen.getByText('AI Enrichment Priorities')).toBeInTheDocument()
    })

    const dismissButton = screen.getByRole('button', { name: 'Dismiss AI priorities' })
    expect(dismissButton).toBeInTheDocument()

    fireEvent.click(dismissButton)

    await waitFor(() => {
      expect(screen.queryByText('AI Enrichment Priorities')).not.toBeInTheDocument()
    })
  })
})
