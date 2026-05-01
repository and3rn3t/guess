import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createTestDb, type TestDb } from '../api/admin/__tests__/harness'
import { runAnomalyCheck, TRACKED_METRICS } from './_anomaly_check'

let db: TestDb

beforeEach(() => {
  db = createTestDb()
})

afterEach(() => {
  db.close()
})

interface SnapshotInput {
  data_health_score: number
  coverage_pct: number
  evidence_pct: number
  agreement_avg: number
  open_disputes: number
}

function seedSnapshots(rows: Array<SnapshotInput & { ts: number }>): void {
  const stmt = db.raw.prepare(
    `INSERT INTO data_quality_snapshots (
        captured_at, data_health_score, coverage_pct, evidence_pct,
        agreement_avg, open_disputes
     ) VALUES (?, ?, ?, ?, ?, ?)`,
  )
  for (const row of rows) {
    stmt.run(
      row.ts,
      row.data_health_score,
      row.coverage_pct,
      row.evidence_pct,
      row.agreement_avg,
      row.open_disputes,
    )
  }
}

function buildHistory(now: number, length: number, base: SnapshotInput): Array<SnapshotInput & { ts: number }> {
  return Array.from({ length }, (_, i) => ({
    ts: now - (i + 1) * 86400,
    ...base,
  }))
}

describe('runAnomalyCheck', () => {
  it('does nothing when there is insufficient history', async () => {
    const env = { GUESS_DB: db.d1 as unknown as D1Database }
    const log = vi.fn()
    const result = await runAnomalyCheck(env, log)
    expect(result.alerts).toBe(0)
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'anomaly.skip', reason: 'insufficient_history' }),
    )
  })

  it('writes an alert row when a metric crosses the band', async () => {
    const now = Math.floor(Date.now() / 1000)
    const stableBase: SnapshotInput = {
      data_health_score: 80,
      coverage_pct: 0.9,
      evidence_pct: 0.8,
      agreement_avg: 0.85,
      open_disputes: 5,
    }
    // 14 days of history with tiny jitter, then today crashes data_health_score
    seedSnapshots(buildHistory(now, 14, stableBase))
    seedSnapshots([
      {
        ts: now,
        data_health_score: 30, // huge drop
        coverage_pct: 0.9,
        evidence_pct: 0.8,
        agreement_avg: 0.85,
        open_disputes: 5,
      },
    ])

    const env = { GUESS_DB: db.d1 as unknown as D1Database }
    const result = await runAnomalyCheck(env, () => {})
    expect(result.alerts).toBe(1)
    expect(result.webhookSkipped).toBe(1) // no webhook configured

    const alerts = db.raw
      .prepare('SELECT * FROM alerts ORDER BY id DESC')
      .all() as Array<{
      metric: string
      direction: string
      webhook_status: string
    }>
    expect(alerts).toHaveLength(1)
    expect(alerts[0].metric).toBe('data_health_score')
    expect(alerts[0].direction).toBe('below')
    expect(alerts[0].webhook_status).toBe('skipped')
  })

  it('posts a webhook payload when ALERTS_WEBHOOK_URL is set', async () => {
    const now = Math.floor(Date.now() / 1000)
    const stableBase: SnapshotInput = {
      data_health_score: 80,
      coverage_pct: 0.9,
      evidence_pct: 0.8,
      agreement_avg: 0.85,
      open_disputes: 5,
    }
    seedSnapshots(buildHistory(now, 14, stableBase))
    seedSnapshots([{ ts: now, ...stableBase, open_disputes: 99 }])

    const fetchMock = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const env = {
        GUESS_DB: db.d1 as unknown as D1Database,
        ALERTS_WEBHOOK_URL: 'https://hooks.example.com/abc',
        ALERTS_DASHBOARD_URL: 'https://example.com/admin/alerts',
      }
      const result = await runAnomalyCheck(env, () => {})
      expect(result.alerts).toBe(1)
      expect(result.webhookSent).toBe(1)

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://hooks.example.com/abc')
      const body = JSON.parse((init as RequestInit).body as string) as { text: string }
      expect(body.text).toContain('open_disputes')
      expect(body.text).toContain('view chart')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('records webhook failure but still inserts the alert', async () => {
    const now = Math.floor(Date.now() / 1000)
    const stableBase: SnapshotInput = {
      data_health_score: 80,
      coverage_pct: 0.9,
      evidence_pct: 0.8,
      agreement_avg: 0.85,
      open_disputes: 5,
    }
    seedSnapshots(buildHistory(now, 14, stableBase))
    seedSnapshots([{ ts: now, ...stableBase, coverage_pct: 0.1 }])

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('boom', { status: 500 })) as unknown as typeof fetch

    try {
      const env = {
        GUESS_DB: db.d1 as unknown as D1Database,
        ALERTS_WEBHOOK_URL: 'https://hooks.example.com/abc',
      }
      const result = await runAnomalyCheck(env, () => {})
      expect(result.alerts).toBe(1)
      expect(result.webhookFailed).toBe(1)

      const [row] = db.raw
        .prepare('SELECT webhook_status, webhook_error FROM alerts')
        .all() as Array<{ webhook_status: string; webhook_error: string }>
      expect(row.webhook_status).toBe('failed')
      expect(row.webhook_error).toBe('HTTP 500')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('exposes the tracked metric list', () => {
    expect(TRACKED_METRICS).toContain('data_health_score')
    expect(TRACKED_METRICS).toContain('coverage_pct')
  })
})
