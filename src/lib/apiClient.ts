/**
 * Typed API client surface (DX.v2.1).
 *
 * Thin wrapper around openapi-fetch using the generated `paths` shape from
 * docs/openapi.yaml. Consumer migrations land under RF.v2.1 (useServerGame)
 * and RF.v2.5 (adminApi) — this module just exposes the typed entry point.
 *
 * The wrapper deliberately stays minimal: callers still own retry / 429 / SSE
 * concerns via src/lib/http.ts; openapi-fetch only provides path + body +
 * response type-safety against the OpenAPI contract.
 */
import createClient, { type Client } from 'openapi-fetch'
import type { paths } from './api.generated'

export type ApiPaths = paths

export type ApiClient = Client<paths>

export interface CreateApiClientOptions {
  /** Base URL prepended to every request path. Defaults to same-origin. */
  baseUrl?: string
  /** Custom fetch implementation. Defaults to global fetch. */
  fetch?: typeof fetch
  /** Extra default headers (merged per-request). */
  headers?: Record<string, string>
}

export function createApiClient(options: CreateApiClientOptions = {}): ApiClient {
  return createClient<paths>({
    baseUrl: options.baseUrl ?? '',
    fetch: options.fetch,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

/** Default same-origin client for app code. */
export const apiClient: ApiClient = createApiClient()
