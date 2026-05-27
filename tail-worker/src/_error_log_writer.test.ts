import { describe, expect, it, vi } from 'vitest'

import {
  extractEnvelopes,
  extractEnvelopesFromBatch,
  parseEnvelope,
  writeErrorLogs,
  type ErrorLogDb,
} from './_error_log_writer'
import type { TailTraceItem } from './_tail_metrics'

const validEnvelope = JSON.stringify({
  kind: 'guess_error_event',
  source: 'llm',
  level: 'error',
  message: 'OpenAI 500',
  detail: JSON.stringify({ requestId: 'abc' }),
})

describe('parseEnvelope', () => {
  it('returns the envelope when shape matches', () => {
    const env = parseEnvelope(validEnvelope)
    expect(env).toEqual({
      kind: 'guess_error_event',
      source: 'llm',
      level: 'error',
      message: 'OpenAI 500',
      detail: '{"requestId":"abc"}',
    })
  })

  it('returns null for non-envelope strings without paying for JSON.parse', () => {
    expect(parseEnvelope('plain log line')).toBeNull()
    expect(parseEnvelope('{"kind":"other_event","source":"x"}')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseEnvelope('guess_error_event {not json}')).toBeNull()
  })

  it('rejects envelopes missing required fields', () => {
    expect(
      parseEnvelope(
        JSON.stringify({ kind: 'guess_error_event', level: 'error', message: 'x' })
      )
    ).toBeNull()
    expect(
      parseEnvelope(
        JSON.stringify({ kind: 'guess_error_event', source: 'llm', level: 'fatal', message: 'x' })
      )
    ).toBeNull()
    expect(
      parseEnvelope(JSON.stringify({ kind: 'guess_error_event', source: '', level: 'error', message: 'x' }))
    ).toBeNull()
  })

  it('truncates message to 500 chars', () => {
    const long = 'x'.repeat(900)
    const env = parseEnvelope(
      JSON.stringify({ kind: 'guess_error_event', source: 's', level: 'warn', message: long })
    )
    expect(env?.message.length).toBe(500)
  })

  it('coerces missing/null detail to null', () => {
    const env = parseEnvelope(
      JSON.stringify({ kind: 'guess_error_event', source: 's', level: 'warn', message: 'm' })
    )
    expect(env?.detail).toBeNull()
  })
})

describe('extractEnvelopes', () => {
  const baseItem: TailTraceItem = {
    scriptName: 'guess',
    outcome: 'ok',
    cpuTime: 1,
    wallTime: 2,
    logs: [],
    exceptions: [],
    event: { request: { url: 'https://x/test', method: 'GET' }, response: { status: 200 } },
  }

  it('finds envelopes embedded in string log messages', () => {
    const envs = extractEnvelopes({
      ...baseItem,
      logs: [
        { level: 'log', message: 'unrelated' },
        { level: 'error', message: validEnvelope },
      ],
    })
    expect(envs).toHaveLength(1)
    expect(envs[0].source).toBe('llm')
  })

  it('finds envelopes when the runtime delivers message as array', () => {
    const envs = extractEnvelopes({
      ...baseItem,
      logs: [{ level: 'error', message: [validEnvelope] }],
    })
    expect(envs).toHaveLength(1)
  })

  it('finds envelopes when the runtime pre-parses message to an object', () => {
    const envs = extractEnvelopes({
      ...baseItem,
      logs: [{ level: 'error', message: JSON.parse(validEnvelope) }],
    })
    expect(envs).toHaveLength(1)
  })

  it('returns empty when no envelopes match', () => {
    expect(
      extractEnvelopes({ ...baseItem, logs: [{ level: 'log', message: 'hi' }] })
    ).toEqual([])
    expect(extractEnvelopes({ ...baseItem, logs: [] })).toEqual([])
    expect(extractEnvelopes({ ...baseItem, logs: undefined })).toEqual([])
  })

  it('extractEnvelopesFromBatch aggregates across items', () => {
    const envs = extractEnvelopesFromBatch([
      { ...baseItem, logs: [{ level: 'error', message: validEnvelope }] },
      { ...baseItem, logs: [{ level: 'log', message: 'nothing' }] },
      { ...baseItem, logs: [{ level: 'error', message: validEnvelope }] },
    ])
    expect(envs).toHaveLength(2)
  })
})

describe('writeErrorLogs', () => {
  function mockDb() {
    const batch = vi.fn().mockResolvedValue(undefined)
    const bind = vi.fn().mockReturnValue({ __bound: true })
    const prepare = vi.fn().mockReturnValue({ bind })
    const db: ErrorLogDb = { prepare, batch }
    return { db, batch, prepare, bind }
  }

  it('no-ops when db binding is missing', async () => {
    expect(await writeErrorLogs(undefined, [{ kind: 'guess_error_event', source: 's', level: 'error', message: 'm', detail: null }])).toBe(0)
    expect(await writeErrorLogs(null, [{ kind: 'guess_error_event', source: 's', level: 'error', message: 'm', detail: null }])).toBe(0)
  })

  it('no-ops on empty envelope batch', async () => {
    const { db, batch } = mockDb()
    expect(await writeErrorLogs(db, [])).toBe(0)
    expect(batch).not.toHaveBeenCalled()
  })

  it('issues one INSERT per envelope + one trim DELETE per batch', async () => {
    const { db, prepare, batch } = mockDb()
    const n = await writeErrorLogs(db, [
      { kind: 'guess_error_event', source: 'a', level: 'error', message: 'm1', detail: null },
      { kind: 'guess_error_event', source: 'b', level: 'warn', message: 'm2', detail: '{"x":1}' },
    ])
    expect(n).toBe(2)
    expect(batch).toHaveBeenCalledTimes(1)
    // 2 inserts + 1 trim = 3 prepare calls.
    expect(prepare).toHaveBeenCalledTimes(3)
    expect(prepare.mock.calls[0][0]).toContain('INSERT INTO error_logs')
    expect(prepare.mock.calls[2][0]).toContain('DELETE FROM error_logs')
  })

  it('swallows D1 errors instead of throwing onto the tail handler', async () => {
    const db: ErrorLogDb = {
      prepare: () => ({ bind: () => ({}) }),
      batch: () => Promise.reject(new Error('D1 down')),
    }
    await expect(
      writeErrorLogs(db, [
        { kind: 'guess_error_event', source: 's', level: 'error', message: 'm', detail: null },
      ])
    ).resolves.toBe(0)
  })
})
