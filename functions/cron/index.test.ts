import { describe, expect, it, vi } from 'vitest'
import { runScheduled } from './index'

describe('cron/runScheduled', () => {
  it('logs the cron tick with cron expression and ISO scheduled time', async () => {
    const log = vi.fn()
    const scheduledTime = Date.UTC(2026, 3, 30, 0, 5, 0) // 2026-04-30T00:05:00Z
    await runScheduled({ cron: '5 0 * * *', scheduledTime }, {}, log)

    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith({
      event: 'cron.tick',
      cron: '5 0 * * *',
      scheduledTime: '2026-04-30T00:05:00.000Z',
    })
  })

  it('resolves without throwing when env is empty (no consumers wired yet)', async () => {
    await expect(
      runScheduled({ cron: '5 0 * * *', scheduledTime: Date.now() }, {}, () => {}),
    ).resolves.toBeUndefined()
  })
})
