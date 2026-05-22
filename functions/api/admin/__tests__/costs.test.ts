import { describe, expect, it } from "vitest";
import { onRequestGet } from "../costs";
import { buildEnv, invokeHandler } from "./harness";

describe("GET /api/admin/costs", () => {
  it("returns 200 with empty cost data (KV superseded by Analytics Engine)", async () => {
    const res = await invokeHandler<{
      source: string;
      windowDays: number;
      today: { promptTokens: number; completionTokens: number; calls: number };
      totals: { promptTokens: number; completionTokens: number; calls: number };
      history: unknown[];
    }>(onRequestGet, {
      method: "GET",
      env: buildEnv(),
    });

    expect(res.status).toBe(200);
    expect(res.body.source).toBe("analytics-engine");
    expect(res.body.today.promptTokens).toBe(0);
    expect(res.body.totals.promptTokens).toBe(0);
    expect(res.body.history).toEqual([]);
  });

  it("clamps days query to valid range", async () => {
    const res = await invokeHandler<{ windowDays: number }>(onRequestGet, {
      method: "GET",
      url: "https://example.com/api/admin/costs?days=999",
      env: buildEnv(),
    });

    expect(res.status).toBe(200);
    expect(res.body.windowDays).toBe(90);
  });
});
