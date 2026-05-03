import { describe, expect, it, vi } from 'vitest'
import { runScheduled } from './index'

describe('cron/runScheduled', () => {
  it('logs the cron tick with cron expression and ISO scheduled time', async () => {
    const log = vi.fn()
    const scheduledTime = Date.UTC(2026, 3, 30, 0, 5, 0) // 2026-04-30T00:05:00Z
    await runScheduled({ cron: '5 0 * * *', scheduledTime }, {}, log)

    expect(log).toHaveBeenCalledWith({
      event: 'cron.tick',
      cron: '5 0 * * *',
      scheduledTime: '2026-04-30T00:05:00.000Z',
    })
    // AN.33 — anomaly check also runs and reports; with no DB it skips and logs the summary.
    expect(log).toHaveBeenCalledWith({ event: 'anomaly.skip', reason: 'no_db' })
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'cron.anomaly_check', alerts: 0 }),
    )
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'cron.automation',
        cron: '5 0 * * *',
        snapshot: 'skipped',
        enrichmentKick: 'skipped',
      }),
    )
  })

  it('resolves without throwing when env is empty (no consumers wired yet)', async () => {
    await expect(
      runScheduled({ cron: '5 0 * * *', scheduledTime: Date.now() }, {}, () => {}),
    ).resolves.toBeUndefined()
  })
})
