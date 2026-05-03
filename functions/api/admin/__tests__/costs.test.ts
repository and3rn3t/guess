import { describe, expect, it } from "vitest";
import { buildEnv, createTestKv, invokeHandler } from "./harness";
import { onRequestGet } from "../costs";

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

describe("GET /api/admin/costs", () => {
  it("returns 503 when KV is missing", async () => {
    const res = await invokeHandler(onRequestGet, {
      method: "GET",
      env: buildEnv(),
    });

    expect(res.status).toBe(503);
  });

  it("aggregates per-day token usage across users", async () => {
    const kv = createTestKv();
    const today = daysAgo(0);
    const yesterday = daysAgo(1);
    await kv.put(
      `costs:user-a:${today}`,
      JSON.stringify({ promptTokens: 100, completionTokens: 50, calls: 2 }),
    );
    await kv.put(
      `costs:user-b:${today}`,
      JSON.stringify({ promptTokens: 40, completionTokens: 10, calls: 1 }),
    );
    await kv.put(
      `costs:user-a:${yesterday}`,
      JSON.stringify({ promptTokens: 10, completionTokens: 5, calls: 1 }),
    );
    await kv.put(
      "not-a-cost-key",
      JSON.stringify({ promptTokens: 999, completionTokens: 999, calls: 99 }),
    );

    const res = await invokeHandler<{
      today: { promptTokens: number; completionTokens: number; calls: number };
      history: Array<{
        date: string;
        promptTokens: number;
        completionTokens: number;
        calls: number;
      }>;
      totals: { promptTokens: number; completionTokens: number; calls: number };
    }>(onRequestGet, {
      method: "GET",
      url: "https://example.com/api/admin/costs?days=30",
      env: buildEnv({ kv }),
    });

    expect(res.status).toBe(200);
    expect(res.body.today.promptTokens).toBe(140);
    expect(res.body.today.completionTokens).toBe(60);
    expect(res.body.today.calls).toBe(3);
    expect(res.body.history.some((row) => row.date === yesterday)).toBe(true);
    expect(res.body.totals.promptTokens).toBe(150);
    expect(res.body.totals.completionTokens).toBe(65);
    expect(res.body.totals.calls).toBe(4);
  });

  it("clamps days query to valid range", async () => {
    const kv = createTestKv();
    const res = await invokeHandler<{ windowDays: number }>(onRequestGet, {
      method: "GET",
      url: "https://example.com/api/admin/costs?days=999",
      env: buildEnv({ kv }),
    });

    expect(res.status).toBe(200);
    expect(res.body.windowDays).toBe(90);
  });

  it("walks paginated KV list results", async () => {
    const today = daysAgo(0);
    const store = new Map<string, { value: string }>();
    const kv = {
      _store: store,
      async get(
        key: string,
        type?: "json" | "text" | { type: "json" } | { type: "text" },
      ) {
        if (key === `costs:user-a:${today}`)
          return { promptTokens: 10, completionTokens: 5, calls: 1 };
        if (key === `costs:user-b:${today}`)
          return { promptTokens: 20, completionTokens: 8, calls: 2 };
        if (
          type === "json" ||
          (typeof type === "object" && type?.type === "json")
        )
          return null;
        return null;
      },
      async put() {},
      async delete() {},
      async list(options?: { prefix?: string; cursor?: string }) {
        if (options?.cursor === undefined) {
          return {
            keys: [{ name: `costs:user-a:${today}` }],
            list_complete: false,
            cursor: "page-2",
          };
        }
        return {
          keys: [{ name: `costs:user-b:${today}` }],
          list_complete: true,
        };
      },
    };

    const res = await invokeHandler<{
      today: { promptTokens: number; completionTokens: number; calls: number };
      totals: { promptTokens: number; completionTokens: number; calls: number };
    }>(onRequestGet, {
      method: "GET",
      env: buildEnv({ kv }),
    });

    expect(res.status).toBe(200);
    expect(res.body.today.promptTokens).toBe(30);
    expect(res.body.today.completionTokens).toBe(13);
    expect(res.body.today.calls).toBe(3);
    expect(res.body.totals.promptTokens).toBe(30);
    expect(res.body.totals.completionTokens).toBe(13);
    expect(res.body.totals.calls).toBe(3);
  });
});
