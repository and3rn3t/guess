/**
 * Small JSON-over-HTTP client with opt-in retry and pluggable error parsing.
 *
 * Three usage tiers:
 *  - Simple: `httpClient.postJson<T>(path, body)` — default client, no retry.
 *  - Retry-capable: `createHttpClient({ retry: {...} })` — used by callers that
 *    need exponential-backoff on transient failures (e.g. LLM endpoints).
 *  - Raw: `client.request(path, init)` — returns the raw `Response` for callers
 *    that need to inspect status codes (e.g. 409 → no-op).
 *
 * Built on `globalThis.fetch` so test suites can stub it via `vi.stubGlobal`.
 */

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface RetryPolicy {
  /** Total attempts including the first. Must be ≥ 1. */
  maxAttempts: number;
  /** Initial backoff in ms; doubles each retry (full jitter not added). */
  baseDelayMs: number;
  /** Statuses that trigger a retry. Defaults to 408, 429, 500, 502, 503, 504. */
  retryableStatuses?: ReadonlySet<number>;
  /** Override the retry decision (e.g. inspect parsed error). */
  isRetryable?: (err: unknown) => boolean;
}

export interface HttpClientOptions {
  /** Called per-request; merged into request headers (request init wins on conflict). */
  defaultHeaders?: () => Record<string, string>;
  /** Optional retry policy applied to every call from this client. */
  retry?: RetryPolicy;
  /** Custom error parser. Default: throws `HttpError(status, statusText)`. */
  parseError?: (response: Response) => Promise<Error>;
}

export interface HttpClient {
  /** Raw request. Applies default headers + retry. Does NOT throw on !ok. */
  request(path: string, init?: RequestInit): Promise<Response>;
  /** Throws via `parseError` on !ok. */
  requestOrThrow(path: string, init?: RequestInit): Promise<Response>;
  getJson<T>(path: string, init?: RequestInit): Promise<T>;
  postJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T>;
}

const DEFAULT_RETRYABLE_STATUSES: ReadonlySet<number> = new Set([
  408, 429, 500, 502, 503, 504,
]);

const JSON_CONTENT_TYPE = { "Content-Type": "application/json" };

async function defaultParseError(response: Response): Promise<Error> {
  return new HttpError(
    response.status,
    `Request failed: ${response.status} ${response.statusText}`.trim(),
  );
}

function mergeHeaders(
  defaults: Record<string, string> | undefined,
  init?: HeadersInit,
): HeadersInit {
  if (!defaults) return init ?? {};
  const merged = new Headers(defaults);
  if (init) {
    new Headers(init).forEach((v, k) => merged.set(k, v));
  }
  return merged;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const parseError = options.parseError ?? defaultParseError;
  const retry = options.retry;
  const retryableStatuses =
    retry?.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;

  async function request(
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const headers = mergeHeaders(options.defaultHeaders?.(), init.headers);
    const finalInit: RequestInit = { ...init, headers };

    const maxAttempts = retry?.maxAttempts ?? 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0 && retry) {
        await delay(retry.baseDelayMs * 2 ** (attempt - 1));
      }

      try {
        const res = await fetch(path, finalInit);
        if (!res.ok && retry && attempt < maxAttempts - 1) {
          const customRetryable = retry.isRetryable;
          const shouldRetry = customRetryable
            ? customRetryable(await parseError(res.clone()))
            : retryableStatuses.has(res.status);
          if (shouldRetry) {
            lastError = res;
            continue;
          }
        }
        return res;
      } catch (err) {
        // Network error (TypeError from fetch) or AbortError
        lastError = err;
        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          throw err;
        }
        if (!retry || attempt >= maxAttempts - 1) {
          throw err;
        }
        const customRetryable = retry.isRetryable;
        if (customRetryable && !customRetryable(err)) {
          throw err;
        }
      }
    }

    // Exhausted retries on non-OK response
    if (lastError instanceof Response) {
      return lastError;
    }
    throw lastError ?? new Error("Request failed");
  }

  async function requestOrThrow(
    path: string,
    init?: RequestInit,
  ): Promise<Response> {
    const res = await request(path, init);
    if (!res.ok) throw await parseError(res);
    return res;
  }

  async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await requestOrThrow(path, { ...init, method: "GET" });
    return (await res.json()) as T;
  }

  async function postJson<T>(
    path: string,
    body: unknown,
    init?: RequestInit,
  ): Promise<T> {
    const headers = mergeHeaders(JSON_CONTENT_TYPE, init?.headers);
    const res = await requestOrThrow(path, {
      ...init,
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return (await res.json()) as T;
  }

  return { request, requestOrThrow, getJson, postJson };
}

/** Default client: no retry, default error parsing. */
export const httpClient: HttpClient = createHttpClient();
