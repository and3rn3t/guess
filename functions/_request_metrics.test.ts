import { describe, expect, it, vi } from 'vitest'

import {
  buildRequestDataPoint,
  recordRequest,
  type AnalyticsEngineDataset,
} from './_request_metrics'

describe('buildRequestDataPoint', () => {
  it('packs a successful fetch into the documented schema', () => {
    const point = buildRequestDataPoint({
      path: '/api/llm',
      method: 'POST',
      status: 200,
      wallMs: 42.7,
    })
    expect(point.blobs).toEqual(['guess-pages', '/api/llm', 'POST', 'ok', '', 'fetch'])
    expect(point.doubles).toEqual([200, 0, 43, 0, 0])
    expect(point.indexes).toEqual(['/api/llm'])
  })

  it('classifies 4xx as client_error and 5xx as server_error', () => {
    expect(
      buildRequestDataPoint({ path: '/x', method: 'GET', status: 404, wallMs: 1 }).blobs?.[3]
    ).toBe('client_error')
    expect(
      buildRequestDataPoint({ path: '/x', method: 'GET', status: 500, wallMs: 1 }).blobs?.[3]
    ).toBe('server_error')
  })

  it('marks exception outcome when errorMessage is present', () => {
    const point = buildRequestDataPoint({
      path: '/x',
      method: 'GET',
      status: 500,
      wallMs: 1,
      errorMessage: 'boom',
    })
    expect(point.blobs?.[3]).toBe('exception')
    expect(point.blobs?.[4]).toBe('boom')
    expect(point.doubles?.[4]).toBe(1)
  })

  it('truncates long error messages', () => {
    const point = buildRequestDataPoint({
      path: '/x',
      method: 'GET',
      status: 500,
      wallMs: 1,
      errorMessage: 'x'.repeat(500),
    })
    expect(point.blobs?.[4].length).toBe(200)
  })

  it('falls back to "unknown" when path is empty', () => {
    const point = buildRequestDataPoint({ path: '', method: 'GET', status: 200, wallMs: 1 })
    expect(point.indexes).toEqual(['unknown'])
  })

  it('floors negative wall time to 0', () => {
    const point = buildRequestDataPoint({ path: '/x', method: 'GET', status: 200, wallMs: -5 })
    expect(point.doubles?.[2]).toBe(0)
  })
})

describe('recordRequest', () => {
  it('no-ops when dataset is undefined', () => {
    expect(() =>
      recordRequest(undefined, { path: '/x', method: 'GET', status: 200, wallMs: 1 })
    ).not.toThrow()
  })

  it('writes one data point', () => {
    const writeDataPoint = vi.fn()
    const dataset: AnalyticsEngineDataset = { writeDataPoint }
    recordRequest(dataset, { path: '/x', method: 'GET', status: 200, wallMs: 1 })
    expect(writeDataPoint).toHaveBeenCalledTimes(1)
  })

  it('swallows AE write errors', () => {
    const dataset: AnalyticsEngineDataset = {
      writeDataPoint: () => {
        throw new Error('quota')
      },
    }
    expect(() =>
      recordRequest(dataset, { path: '/x', method: 'GET', status: 200, wallMs: 1 })
    ).not.toThrow()
  })
})
