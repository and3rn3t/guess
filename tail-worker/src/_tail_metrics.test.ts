import { describe, expect, it, vi } from 'vitest'

import {
  buildTailDataPoint,
  writeTailEvents,
  type AnalyticsEngineDataset,
  type TailTraceItem,
} from './_tail_metrics'

const fetchTrace: TailTraceItem = {
  scriptName: 'guess',
  outcome: 'ok',
  cpuTime: 12.5,
  wallTime: 84.2,
  logs: [{ level: 'log', message: 'hi' }],
  exceptions: [],
  event: {
    request: { url: 'https://example.com/api/llm?x=1', method: 'POST' },
    response: { status: 200 },
  },
  eventTimestamp: 1_700_000_000_000,
}

describe('buildTailDataPoint', () => {
  it('packs a successful fetch trace into the documented schema', () => {
    const point = buildTailDataPoint(fetchTrace)
    expect(point.blobs).toEqual(['guess', '/api/llm', 'POST', 'ok', '', 'fetch'])
    expect(point.doubles).toEqual([200, 12.5, 84.2, 1, 0])
    expect(point.indexes).toEqual(['/api/llm'])
  })

  it('captures the first exception message and counts', () => {
    const point = buildTailDataPoint({
      ...fetchTrace,
      outcome: 'exception',
      exceptions: [
        { name: 'Error', message: 'boom' },
        { name: 'Error', message: 'second' },
      ],
    })
    expect(point.blobs?.[3]).toBe('exception')
    expect(point.blobs?.[4]).toBe('boom')
    expect(point.doubles?.[4]).toBe(2)
  })

  it('truncates long exception messages', () => {
    const long = 'x'.repeat(500)
    const point = buildTailDataPoint({
      ...fetchTrace,
      exceptions: [{ message: long }],
    })
    expect(point.blobs?.[4].length).toBe(200)
  })

  it('handles scheduled (cron) triggers', () => {
    const point = buildTailDataPoint({
      scriptName: 'guess',
      outcome: 'ok',
      cpuTime: 5,
      wallTime: 10,
      logs: [],
      exceptions: [],
      event: { cron: '0 * * * *', scheduledTime: 123 },
    })
    expect(point.blobs?.[5]).toBe('scheduled')
    expect(point.blobs?.[1]).toBe('')
    expect(point.doubles?.[0]).toBe(0)
    expect(point.indexes).toEqual(['guess'])
  })

  it('classifies unknown event shapes as "unknown" without throwing', () => {
    const point = buildTailDataPoint({
      scriptName: 'guess',
      outcome: 'ok',
      cpuTime: 0,
      wallTime: 0,
      event: null,
    })
    expect(point.blobs?.[5]).toBe('unknown')
    expect(point.indexes).toEqual(['guess'])
  })

  it('survives a malformed URL', () => {
    const point = buildTailDataPoint({
      ...fetchTrace,
      event: { request: { url: 'not-a-url', method: 'GET' }, response: { status: 500 } },
    })
    expect(point.blobs?.[1]).toBe('')
    expect(point.doubles?.[0]).toBe(500)
  })

  it('falls back to trigger as sampling key when no script + path', () => {
    const point = buildTailDataPoint({
      outcome: 'ok',
      event: { queue: 'q1' },
    })
    expect(point.indexes).toEqual(['queue'])
  })
})

describe('writeTailEvents', () => {
  it('no-ops when dataset is undefined', () => {
    expect(writeTailEvents(undefined, [fetchTrace])).toBe(0)
  })

  it('writes one data point per trace and returns the count', () => {
    const writeDataPoint = vi.fn()
    const dataset: AnalyticsEngineDataset = { writeDataPoint }
    const n = writeTailEvents(dataset, [fetchTrace, fetchTrace, fetchTrace])
    expect(n).toBe(3)
    expect(writeDataPoint).toHaveBeenCalledTimes(3)
  })

  it('keeps writing after a per-item failure', () => {
    let calls = 0
    const dataset: AnalyticsEngineDataset = {
      writeDataPoint: () => {
        calls++
        if (calls === 2) throw new Error('AE quota')
      },
    }
    const n = writeTailEvents(dataset, [fetchTrace, fetchTrace, fetchTrace])
    expect(calls).toBe(3)
    expect(n).toBe(2)
  })
})
