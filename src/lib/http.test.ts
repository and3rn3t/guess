// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHttpClient, HttpError, httpClient } from "./http";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("httpClient (default)", () => {
  it("postJson serializes body, sets JSON content-type, parses response", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true, n: 7 }));

    const data = await httpClient.postJson<{ ok: boolean; n: number }>(
      "/api/test",
      { hello: "world" },
    );

    expect(data).toEqual({ ok: true, n: 7 });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ hello: "world" }),
      }),
    );
    const init = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("throws HttpError on non-OK status", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("nope", { status: 500, statusText: "Internal Server Error" }),
    );

    await expect(
      httpClient.postJson("/api/test", {}),
    ).rejects.toBeInstanceOf(HttpError);

    mockFetch.mockResolvedValueOnce(
      new Response("nope", { status: 404, statusText: "Not Found" }),
    );
    const err = await httpClient.postJson("/api/test", {}).catch((e) => e);
    expect((err as HttpError).status).toBe(404);
  });

  it("getJson sends GET", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ x: 1 }));
    await httpClient.getJson("/api/x");
    expect(mockFetch.mock.calls[0][1]).toMatchObject({ method: "GET" });
  });

  it("request() does NOT throw on non-OK — returns raw Response", async () => {
    mockFetch.mockResolvedValueOnce(new Response("", { status: 409 }));
    const res = await httpClient.request("/api/skip", { method: "POST" });
    expect(res.status).toBe(409);
  });
});

describe("createHttpClient", () => {
  it("applies defaultHeaders to every request", async () => {
    const client = createHttpClient({
      defaultHeaders: () => ({ "X-User-Id": "abc-123" }),
    });
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    await client.postJson("/api/test", {});

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("X-User-Id")).toBe("abc-123");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("request init headers override defaults on conflict", async () => {
    const client = createHttpClient({
      defaultHeaders: () => ({ "X-Trace": "default" }),
    });
    mockFetch.mockResolvedValueOnce(jsonResponse({}));

    await client.postJson(
      "/api/test",
      {},
      { headers: { "X-Trace": "override" } },
    );

    const init = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("X-Trace")).toBe("override");
  });

  it("uses custom parseError", async () => {
    class CustomError extends Error {
      constructor(public readonly status: number) {
        super(`Custom: ${status}`);
      }
    }
    const client = createHttpClient({
      parseError: async (res) => new CustomError(res.status),
    });
    mockFetch.mockResolvedValueOnce(new Response("", { status: 503 }));

    await expect(client.postJson("/api/test", {})).rejects.toBeInstanceOf(
      CustomError,
    );
  });
});

describe("retry policy", () => {
  it("retries retryable status and succeeds", async () => {
    vi.useFakeTimers();
    const client = createHttpClient({
      retry: { maxAttempts: 3, baseDelayMs: 10 },
    });

    mockFetch
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const promise = client.postJson<{ ok: boolean }>("/api/test", {});
    await vi.runAllTimersAsync();
    const data = await promise;

    expect(data).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxAttempts", async () => {
    vi.useFakeTimers();
    const client = createHttpClient({
      retry: { maxAttempts: 3, baseDelayMs: 5 },
    });

    mockFetch
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 503 }));

    const promise = client.postJson("/api/test", {}).catch((e) => e);
    await vi.runAllTimersAsync();
    const err = (await promise) as HttpError;

    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(503);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry non-retryable status (e.g. 400)", async () => {
    const client = createHttpClient({
      retry: { maxAttempts: 3, baseDelayMs: 5 },
    });
    mockFetch.mockResolvedValueOnce(new Response("", { status: 400 }));

    await expect(client.postJson("/api/test", {})).rejects.toBeInstanceOf(
      HttpError,
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on network error (TypeError) then succeeds", async () => {
    vi.useFakeTimers();
    const client = createHttpClient({
      retry: { maxAttempts: 3, baseDelayMs: 10 },
    });

    mockFetch
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const promise = client.postJson<{ ok: boolean }>("/api/test", {});
    await vi.runAllTimersAsync();
    const data = await promise;

    expect(data).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("custom isRetryable overrides default decision", async () => {
    const client = createHttpClient({
      retry: {
        maxAttempts: 3,
        baseDelayMs: 1,
        isRetryable: () => false,
      },
    });
    mockFetch
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await expect(client.postJson("/api/test", {})).rejects.toThrow("network");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
