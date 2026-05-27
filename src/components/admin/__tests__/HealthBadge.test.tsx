// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/mocks/server'
import { HealthBadge } from '../HealthBadge'
import { LiveOpsProvider } from '../LiveOpsContext'
import { computeStatus } from '../liveOps'

interface SummaryFields {
  games1h?: number
  errors1h?: number
  warns1h?: number
  errorRate?: number | null
  telemetryErrors1h?: number | null
  loggingGap?: boolean | null
  generatedAt?: number
}

function buildSummary(over: SummaryFields = {}): Record<string, unknown> {
  return {
    games1h: 10,
    wins1h: 6,
    losses1h: 4,
    errors1h: 0,
    warns1h: 0,
    gamesPerMin: 0.17,
    errorsPerMin: 0,
    winRate: 0.6,
    errorRate: 0,
    p95LatencyMs: 250,
    telemetryErrors1h: null,
    loggingGap: null,
    generatedAt: Math.floor(Date.now() / 1000),
    ...over,
  }
}

describe('computeStatus', () => {
  it('returns unknown for null data', () => {
    expect(computeStatus(null)).toBe('unknown')
  })

  it('returns healthy when no errors and no warns', () => {
    expect(
      computeStatus(buildSummary({ errorRate: 0 }) as never),
    ).toBe('healthy')
  })

  it('returns warn when errorRate > 1% but ≤ 5%', () => {
    expect(
      computeStatus(buildSummary({ errorRate: 0.02 }) as never),
    ).toBe('warn')
  })

  it('returns warn when warns1h > 0 even with no errors', () => {
    expect(
      computeStatus(buildSummary({ errorRate: 0, warns1h: 3 }) as never),
    ).toBe('warn')
  })

  it('returns critical when errorRate > 5%', () => {
    expect(
      computeStatus(buildSummary({ errorRate: 0.1 }) as never),
    ).toBe('critical')
  })

  it('returns critical when logging gap is detected', () => {
    expect(
      computeStatus(buildSummary({ loggingGap: true }) as never),
    ).toBe('critical')
  })
})

describe('HealthBadge', () => {
  it('renders the unknown placeholder when no provider is mounted', () => {
    render(<HealthBadge />)
    const badge = screen.getByTestId('health-badge')
    expect(badge.getAttribute('data-status')).toBe('unknown')
    expect(badge).toHaveTextContent('—')
  })

  it('reflects healthy state from the live-ops endpoint', async () => {
    server.use(
      http.get('/api/admin/live-ops', () => HttpResponse.json(buildSummary({ errorRate: 0 }))),
    )

    render(
      <LiveOpsProvider>
        <HealthBadge />
      </LiveOpsProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('health-badge').getAttribute('data-status')).toBe('healthy')
    })
    expect(screen.getByTestId('health-badge')).toHaveTextContent('OK')
  })

  it('reflects critical state when errorRate is high', async () => {
    server.use(
      http.get('/api/admin/live-ops', () =>
        HttpResponse.json(buildSummary({ errorRate: 0.5, errors1h: 5 }))),
    )

    render(
      <LiveOpsProvider>
        <HealthBadge />
      </LiveOpsProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('health-badge').getAttribute('data-status')).toBe('critical')
    })
    expect(screen.getByTestId('health-badge')).toHaveTextContent('DOWN')
  })

  it('shows error detail in title when fetch fails', async () => {
    server.use(
      http.get('/api/admin/live-ops', () => new HttpResponse('boom', { status: 500 })),
    )

    render(
      <LiveOpsProvider>
        <HealthBadge />
      </LiveOpsProvider>,
    )

    await waitFor(() => {
      const badge = screen.getByTestId('health-badge')
      expect(badge.getAttribute('title') ?? '').toMatch(/Live-ops error:.*500/)
    })
  })
})
