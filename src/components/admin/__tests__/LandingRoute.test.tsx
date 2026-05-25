// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import LandingRoute from '../routes/LandingRoute'

interface MockDashboard {
  stats: {
    totalCharacters: number
    enriched: number
    pendingEnrich: number
    activeQuestions: number
    openDisputes: number
    pendingProposals: number
    games7d: number
  }
  recentGames: Array<{
    id: string
    won: number
    questions_asked: number
    character_name: string | null
  }>
}

const DEFAULT_DASHBOARD: MockDashboard = {
  stats: {
    totalCharacters: 120,
    enriched: 100,
    pendingEnrich: 20,
    activeQuestions: 55,
    openDisputes: 3,
    pendingProposals: 7,
    games7d: 42,
  },
  recentGames: [
    { id: 'g1', won: 1, questions_asked: 8, character_name: 'Goku' },
    { id: 'g2', won: 0, questions_asked: 20, character_name: 'Batman' },
  ],
}

interface FetchCall {
  url: string
  method: string
  body: unknown
}

function buildFetchMock(options: {
  dashboard?: MockDashboard
  dashboardStatus?: number
  automation?: unknown
  workflowProgress?: unknown
} = {}) {
  const calls: FetchCall[] = []
  const dashboard = options.dashboard ?? DEFAULT_DASHBOARD
  const dashboardStatus = options.dashboardStatus ?? 200

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = (() => {
      if (typeof input === 'string') return input
      if (input instanceof URL) return input.toString()
      return input.url
    })()
    const method = init?.method ?? 'GET'
    calls.push({ url, method, body: init?.body })

    if (url.includes('/api/admin/dashboard')) {
      return {
        ok: dashboardStatus >= 200 && dashboardStatus < 300,
        status: dashboardStatus,
        json: async () => dashboard,
      } as unknown as Response
    }

    if (url.includes('/api/admin/automation-status')) {
      return {
        ok: true,
        status: 200,
        json: async () => options.automation ?? null,
      } as unknown as Response
    }

    if (url.includes('/api/admin/workflow-progress')) {
      if (method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => options.workflowProgress ?? { progress: {} },
        } as unknown as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as unknown as Response
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({ error: 'not mocked' }),
    } as unknown as Response
  })

  return { fetchMock, calls }
}

function renderRoute() {
  return render(
    <MemoryRouter>
      <LandingRoute />
    </MemoryRouter>,
  )
}

describe('LandingRoute (characterization)', () => {
  let originalFetch: typeof fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    localStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('renders dashboard stats after successful load', async () => {
    const { fetchMock } = buildFetchMock()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    renderRoute()

    await waitFor(() => expect(screen.getByText('Total Characters')).toBeInTheDocument())
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('Enriched')).toBeInTheDocument()
    expect(screen.getByText('Active Questions')).toBeInTheDocument()
  })

  it('renders error banner when dashboard request fails', async () => {
    const { fetchMock } = buildFetchMock({ dashboardStatus: 500 })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    renderRoute()

    await waitFor(() => expect(screen.getByText(/500/)).toBeInTheDocument())
  })

  it('calls /api/admin/dashboard and /api/admin/automation-status on mount', async () => {
    const { fetchMock, calls } = buildFetchMock()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    renderRoute()

    await waitFor(() => expect(screen.getByText('Total Characters')).toBeInTheDocument())
    const urls = calls.map((c) => c.url)
    expect(urls.some((u) => u.includes('/api/admin/dashboard'))).toBe(true)
    expect(urls.some((u) => u.includes('/api/admin/automation-status'))).toBe(true)
  })

  it('refetches dashboard when Refresh button is clicked', async () => {
    const { fetchMock, calls } = buildFetchMock()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    renderRoute()
    await waitFor(() => expect(screen.getByText('Total Characters')).toBeInTheDocument())

    const initialDashboardCalls = calls.filter((c) => c.url.includes('/api/admin/dashboard')).length
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => {
      const after = calls.filter((c) => c.url.includes('/api/admin/dashboard')).length
      expect(after).toBeGreaterThan(initialDashboardCalls)
    })
  })

  it('renders recent games table when games are present', async () => {
    const { fetchMock } = buildFetchMock()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    renderRoute()

    await waitFor(() => expect(screen.getByText('Goku')).toBeInTheDocument())
    expect(screen.getByText('Batman')).toBeInTheDocument()
    expect(screen.getByText('Recent Games (24h)')).toBeInTheDocument()
  })

  it('shows priority queue items when stats exceed thresholds', async () => {
    const { fetchMock } = buildFetchMock()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    renderRoute()

    // Default thresholds: pendingEnrich:0, openDisputes:0, pendingProposals:0 — all > 0 in fixture.
    await waitFor(() => expect(screen.getByText(/20 characters need enrichment/)).toBeInTheDocument())
    expect(screen.getByText(/3 open attribute disputes/)).toBeInTheDocument()
    expect(screen.getByText(/7 attribute proposals pending review/)).toBeInTheDocument()
  })

  it('shows "all clear" priority message when stats sit under thresholds', async () => {
    const { fetchMock } = buildFetchMock({
      dashboard: {
        ...DEFAULT_DASHBOARD,
        stats: { ...DEFAULT_DASHBOARD.stats, pendingEnrich: 0, openDisputes: 0, pendingProposals: 0, games7d: 100 },
      },
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    renderRoute()

    await waitFor(() => expect(screen.getByText(/No urgent actions/i)).toBeInTheDocument())
  })

  it('persists threshold updates to localStorage', async () => {
    const { fetchMock } = buildFetchMock()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    renderRoute()
    await waitFor(() => expect(screen.getByText('Total Characters')).toBeInTheDocument())

    const input = screen.getByLabelText(/pending enrich/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: '50' } })

    await waitFor(() => {
      const raw = localStorage.getItem('admin.missionControl.thresholds.v1')
      expect(raw).toBeTruthy()
      expect(JSON.parse(raw!).pendingEnrich).toBe(50)
    })
  })

  it('renders all four workflow playbooks', async () => {
    const { fetchMock } = buildFetchMock()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    renderRoute()

    await waitFor(() => expect(screen.getByText('Curate Core Data')).toBeInTheDocument())
    expect(screen.getByText('Expand Knowledge Base')).toBeInTheDocument()
    expect(screen.getByText('Govern Community Inputs')).toBeInTheDocument()
    expect(screen.getByText('Monitor & Improve Loop')).toBeInTheDocument()
  })
})
