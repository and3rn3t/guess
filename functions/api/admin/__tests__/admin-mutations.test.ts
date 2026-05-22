/**
 * AP.2 — round-trip integration tests for every admin POST/PATCH/DELETE.
 *
 * Each test:
 *   1. Seeds the minimum D1/KV state the handler needs.
 *   2. Invokes the handler against a real in-memory better-sqlite3 D1 facade.
 *   3. Asserts both the HTTP response and the resulting persisted state.
 *
 * Handlers that call OpenAI directly (validate, score, insights, AI dispute
 * arbitration) run against a stubbed fetch so we exercise the full request/
 * response/parse path without network egress.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildEnv,
  createTestDb,
  createTestR2,
  invokeHandler,
  mockOpenAi,
  seedAttributeDefinition,
  seedCharacter,
  type TestDb,
} from "./harness";

import { onRequestPost as analyticsInsightsPost } from "../analytics/insights";
import { onRequestPatch as disputesPatch } from "../attribute-disputes";
import { onRequestPost as disputesAi } from "../attribute-disputes-ai";
import {
  onRequestDelete as charactersDelete,
  onRequestPatch as charactersPatch,
} from "../characters/[id]/index";
import { onRequestPost as charactersValidate } from "../characters/[id]/validate";
import { onRequestPost as communityPost } from "../community";
import { onRequestPost as coveragePriorityPost } from "../coverage-priority";
import { onRequestPost as enrichStartPost } from "../enrich/start";
import { onRequestPost as enrichmentPost } from "../enrichment";
import { onRequestDelete as errorLogsDelete } from "../error-logs";
import { onRequestPost as experimentsPost } from "../experiments";
import { onRequestPost as pipelinePost } from "../pipeline";
import {
  onRequestPatch as proposedPatch,
  onRequestPost as proposedPost,
} from "../proposed-attributes";
import { onRequestPost as proposedReview } from "../proposed-attributes/[id]/index";
import { onRequestPost as proposedScore } from "../proposed-attributes/[id]/score";
import { onRequestPatch as questionsPatch } from "../questions/[key]/index";
import { onRequestPost as questionsScore } from "../questions/[key]/score";
import { onRequestPost as resolveStackPost } from "../resolve-stack";
import { onRequestPost as uploadAttrsPost } from "../upload-attrs";

let db: TestDb;

beforeEach(() => {
  db = createTestDb();
});

afterEach(() => {
  db.close();
});

// ─── error-logs ────────────────────────────────────────────────────────────────

describe("DELETE /api/admin/error-logs", () => {
  it("clears all rows when no `before` param is supplied", async () => {
    db.raw
      .prepare(
        `INSERT INTO error_logs (level, source, message) VALUES (?, ?, ?)`,
      )
      .run("error", "test", "boom");
    db.raw
      .prepare(
        `INSERT INTO error_logs (level, source, message) VALUES (?, ?, ?)`,
      )
      .run("warn", "test", "meh");
    expect(rowCount("error_logs")).toBe(2);

    const res = await invokeHandler(errorLogsDelete, {
      method: "DELETE",
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(rowCount("error_logs")).toBe(0);
  });

  it("rejects an invalid `before` timestamp", async () => {
    const res = await invokeHandler(errorLogsDelete, {
      method: "DELETE",
      url: "https://x/api/admin/error-logs?before=notanumber",
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── characters/:id ────────────────────────────────────────────────────────────

describe("PATCH /api/admin/characters/:id", () => {
  it("upserts a new attribute value and bumps attribute_count", async () => {
    seedCharacter(db, "mario");
    seedAttributeDefinition(db, "wearsHat");

    const res = await invokeHandler(charactersPatch, {
      method: "PATCH",
      params: { id: "mario" },
      body: { attributeKey: "wearsHat", value: 1 },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
    const row = db.raw
      .prepare(
        `SELECT value, evidence FROM character_attributes WHERE character_id = ? AND attribute_key = ?`,
      )
      .get("mario", "wearsHat") as { value: number; evidence: string };
    expect(row.value).toBe(1);
    expect(row.evidence).toMatch(/^admin:manual:/);
    const char = db.raw
      .prepare(`SELECT attribute_count FROM characters WHERE id = ?`)
      .get("mario") as { attribute_count: number };
    expect(char.attribute_count).toBe(1);
  });

  it("deletes the row when value is null", async () => {
    seedCharacter(db, "mario");
    seedAttributeDefinition(db, "wearsHat");
    db.raw
      .prepare(
        `INSERT INTO character_attributes (character_id, attribute_key, value, confidence) VALUES (?, ?, ?, ?)`,
      )
      .run("mario", "wearsHat", 1, 1);

    const res = await invokeHandler(charactersPatch, {
      method: "PATCH",
      params: { id: "mario" },
      body: { attributeKey: "wearsHat", value: null },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
    expect(
      db.raw
        .prepare(
          `SELECT COUNT(*) as n FROM character_attributes WHERE character_id = ? AND attribute_key = ?`,
        )
        .get("mario", "wearsHat"),
    ).toEqual({ n: 0 });
  });

  it("returns 404 when the character does not exist", async () => {
    const res = await invokeHandler(charactersPatch, {
      method: "PATCH",
      params: { id: "nope" },
      body: { attributeKey: "wearsHat", value: 1 },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects an out-of-range value", async () => {
    seedCharacter(db, "mario");
    const res = await invokeHandler(charactersPatch, {
      method: "PATCH",
      params: { id: "mario" },
      body: { attributeKey: "wearsHat", value: 7 },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/admin/characters/:id", () => {
  it("removes the character and cascades to attributes", async () => {
    seedCharacter(db, "mario", { name: "Mario" });
    seedAttributeDefinition(db, "wearsHat");
    db.raw
      .prepare(
        `INSERT INTO character_attributes (character_id, attribute_key, value, confidence) VALUES (?, ?, ?, ?)`,
      )
      .run("mario", "wearsHat", 1, 1);

    const res = await invokeHandler(charactersDelete, {
      method: "DELETE",
      params: { id: "mario" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, deleted: "Mario" });
    expect(rowCount("characters", `id='mario'`)).toBe(0);
    expect(rowCount("character_attributes", `character_id='mario'`)).toBe(0);
  });

  it("returns 404 when missing", async () => {
    const res = await invokeHandler(charactersDelete, {
      method: "DELETE",
      params: { id: "ghost" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/characters/:id/validate", () => {
  it("returns parsed LLM issues when OpenAI is configured", async () => {
    const stub = mockOpenAi({
      content: JSON.stringify({
        issues: [
          {
            attributeKey: "wearsHat",
            type: "recommended-fill",
            currentValue: null,
            suggestedValue: true,
            reason: "famous for it",
          },
        ],
      }),
    });
    try {
      const res = await invokeHandler<{
        issues: Array<{ attributeKey: string }>;
      }>(charactersValidate, {
        params: { id: "mario" },
        body: { name: "Mario", attributes: { wearsHat: null } },
        env: buildEnv({ db, openaiKey: "test-key" }),
      });
      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(1);
      expect(res.body.issues[0].attributeKey).toBe("wearsHat");
      expect(stub.calls).toHaveLength(1);
    } finally {
      stub.restore();
    }
  });

  it("returns 503 when OpenAI is not configured", async () => {
    const res = await invokeHandler(charactersValidate, {
      params: { id: "mario" },
      body: { name: "Mario", attributes: {} },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(503);
  });
});

// ─── proposed-attributes ───────────────────────────────────────────────────────

describe("POST /api/admin/proposed-attributes", () => {
  it("inserts a single proposal", async () => {
    const res = await invokeHandler<{ inserted: number }>(proposedPost, {
      body: {
        key: "isLeftHanded",
        display_text: "Left handed",
        question_text: "Is this character left handed?",
        proposed_by: "test",
      },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
    expect(res.body.inserted).toBe(1);
    expect(rowCount("proposed_attributes")).toBe(1);
  });

  it("skips entries missing required fields", async () => {
    const res = await invokeHandler<{ inserted: number; submitted: number }>(
      proposedPost,
      {
        body: {
          proposals: [
            { key: "a", display_text: "A", question_text: "a?" },
            { key: "", display_text: "", question_text: "" },
          ],
        },
        env: buildEnv({ db }),
      },
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inserted: 1, submitted: 2 });
  });

  it("rejects empty proposal arrays", async () => {
    const res = await invokeHandler(proposedPost, {
      body: { proposals: [] },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/proposed-attributes", () => {
  it("updates status + reviewed_by/reviewed_at", async () => {
    const id = Number(
      (
        db.raw
          .prepare(
            `INSERT INTO proposed_attributes (key, display_text, question_text) VALUES (?, ?, ?) RETURNING id`,
          )
          .get("p1", "P1", "p1?") as { id: number }
      ).id,
    );

    const res = await invokeHandler(proposedPatch, {
      method: "PATCH",
      body: { id, status: "approved", reviewed_by: "tester" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
    const row = db.raw
      .prepare(
        `SELECT status, reviewed_by, reviewed_at FROM proposed_attributes WHERE id = ?`,
      )
      .get(id) as { status: string; reviewed_by: string; reviewed_at: number };
    expect(row.status).toBe("approved");
    expect(row.reviewed_by).toBe("tester");
    expect(row.reviewed_at).toBeGreaterThan(0);
  });

  it("rejects an unknown status", async () => {
    const res = await invokeHandler(proposedPatch, {
      method: "PATCH",
      body: { id: 1, status: "maybe" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/proposed-attributes/:id", () => {
  it("approves a pending proposal and creates an attribute_definitions row", async () => {
    const id = (
      db.raw
        .prepare(
          `INSERT INTO proposed_attributes (key, display_text, question_text) VALUES (?, ?, ?) RETURNING id`,
        )
        .get("isHero", "Hero", "is hero?") as { id: number }
    ).id;

    const res = await invokeHandler<{
      ok: boolean;
      action: string;
      key: string;
    }>(proposedReview, {
      params: { id: String(id) },
      body: { action: "approve" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      action: "approved",
      key: "isHero",
    });
    expect(rowCount("attribute_definitions", `key='isHero'`)).toBe(1);
    expect(
      (
        db.raw
          .prepare(`SELECT status FROM proposed_attributes WHERE id = ?`)
          .get(id) as { status: string }
      ).status,
    ).toBe("approved");
  });

  it("rejects a pending proposal without touching attribute_definitions", async () => {
    const id = (
      db.raw
        .prepare(
          `INSERT INTO proposed_attributes (key, display_text, question_text) VALUES (?, ?, ?) RETURNING id`,
        )
        .get("isVillain", "Villain", "is villain?") as { id: number }
    ).id;

    const res = await invokeHandler(proposedReview, {
      params: { id: String(id) },
      body: { action: "reject" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
    expect(rowCount("attribute_definitions", `key='isVillain'`)).toBe(0);
  });

  it("returns 409 when already reviewed", async () => {
    const id = (
      db.raw
        .prepare(
          `INSERT INTO proposed_attributes (key, display_text, question_text, status) VALUES (?, ?, ?, 'rejected') RETURNING id`,
        )
        .get("p", "P", "p?") as { id: number }
    ).id;
    const res = await invokeHandler(proposedReview, {
      params: { id: String(id) },
      body: { action: "approve" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/admin/proposed-attributes/:id/score", () => {
  it("returns clamped LLM score", async () => {
    const stub = mockOpenAi({
      content: JSON.stringify({ score: 250, concerns: ["x"], strengths: [] }),
    });
    try {
      const res = await invokeHandler<{ score: number; concerns: string[] }>(
        proposedScore,
        {
          params: { id: "1" },
          body: { key: "k", displayText: "D", questionText: "Q?" },
          env: buildEnv({ db, openaiKey: "k" }),
        },
      );
      expect(res.status).toBe(200);
      expect(res.body.score).toBe(100); // clamped
      expect(res.body.concerns).toEqual(["x"]);
    } finally {
      stub.restore();
    }
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await invokeHandler(proposedScore, {
      params: { id: "1" },
      body: { key: "k" },
      env: buildEnv({ db, openaiKey: "k" }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── attribute-disputes ────────────────────────────────────────────────────────

describe("PATCH /api/admin/attribute-disputes", () => {
  it("marks a dispute resolved", async () => {
    seedCharacter(db, "mario");
    const id = (
      db.raw
        .prepare(
          `INSERT INTO attribute_disputes (character_id, attribute_key, current_value, dispute_reason, confidence)
           VALUES (?, ?, ?, ?, ?) RETURNING id`,
        )
        .get("mario", "wearsHat", 1, "because", 0.9) as { id: number }
    ).id;

    const res = await invokeHandler(disputesPatch, {
      method: "PATCH",
      body: { id, status: "resolved", resolved_by: "me" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
    const row = db.raw
      .prepare(
        `SELECT status, resolved_by FROM attribute_disputes WHERE id = ?`,
      )
      .get(id) as { status: string; resolved_by: string };
    expect(row).toEqual({ status: "resolved", resolved_by: "me" });
  });

  it("rejects unknown status", async () => {
    const res = await invokeHandler(disputesPatch, {
      method: "PATCH",
      body: { id: 1, status: "meh" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/admin/attribute-disputes-ai", () => {
  it("returns parsed verdict from LLM", async () => {
    const stub = mockOpenAi({
      content: JSON.stringify({
        correct: "flagged",
        confidence: 0.8,
        reason: "because",
      }),
    });
    try {
      const res = await invokeHandler<{ correct: string; confidence: number }>(
        disputesAi,
        {
          body: {
            characterName: "Mario",
            attributeKey: "wearsHat",
            currentValue: false,
            disputeReason: "he wears one",
          },
          env: buildEnv({ db, openaiKey: "k" }),
        },
      );
      expect(res.status).toBe(200);
      expect(res.body.correct).toBe("flagged");
      expect(res.body.confidence).toBeCloseTo(0.8);
    } finally {
      stub.restore();
    }
  });

  it("rejects body missing required fields", async () => {
    const res = await invokeHandler(disputesAi, {
      body: { characterName: "x" },
      env: buildEnv({ db, openaiKey: "k" }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── community ────────────────────────────────────────────────────────────────

describe("POST /api/admin/community", () => {
  it("returns ok for dismiss (corrections feature deprecated)", async () => {
    const res = await invokeHandler(communityPost, {
      body: { action: "dismiss", characterId: "mario" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
  });

  it("returns ok for any action (corrections feature deprecated)", async () => {
    const res = await invokeHandler(communityPost, {
      body: { action: "shrug", characterId: "x" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
  });
});

// ─── coverage-priority (LLM) ──────────────────────────────────────────────────

describe("POST /api/admin/coverage-priority", () => {
  it("returns empty list when no sparse attributes exist (skips LLM)", async () => {
    const stub = mockOpenAi({ content: '{"items":[]}' });
    try {
      const res = await invokeHandler<{ items: unknown[] }>(
        coveragePriorityPost,
        {
          env: buildEnv({ db, openaiKey: "k" }),
        },
      );
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(stub.calls).toHaveLength(0);
    } finally {
      stub.restore();
    }
  });

  it("returns 503 when OpenAI is not configured", async () => {
    const res = await invokeHandler(coveragePriorityPost, {
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(503);
  });
});

// ─── enrich/start ─────────────────────────────────────────────────────────────

describe("POST /api/admin/enrich/start", () => {
  it("returns 503 when OPENAI_API_KEY is missing", async () => {
    const res = await invokeHandler(enrichStartPost, {
      body: { action: "start" },
      env: buildEnv({ db }), // no openaiKey
    });
    expect(res.status).toBe(503);
  });

  it("returns 202 with a batchId on start", async () => {
    const res = await invokeHandler<{ ok: boolean; batchId: string }>(
      enrichStartPost,
      {
        body: { action: "start" },
        env: buildEnv({ db, openaiKey: "sk-test" }),
      },
    );
    expect(res.status).toBe(202);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.batchId).toBe("string");
  });

  it("clears the signal on stop", async () => {
    const res = await invokeHandler(enrichStartPost, {
      body: { action: "stop" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
  });
});

// ─── enrichment ───────────────────────────────────────────────────────────────

describe("POST /api/admin/enrichment", () => {
  it("queues a full retry when no IDs are supplied", async () => {
    seedCharacter(db, "a");
    seedCharacter(db, "b");
    const res = await invokeHandler<{ queued: number }>(enrichmentPost, {
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
    expect(res.body.queued).toBe(2);
  });

  it("queues specific IDs when provided", async () => {
    const res = await invokeHandler<{ queued: number }>(enrichmentPost, {
      body: { characterIds: ["a", "b", "c"] },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
    expect(res.body.queued).toBe(3);
  });
});

// ─── experiments ──────────────────────────────────────────────────────────────

describe("POST /api/admin/experiments", () => {
  it("updates pct, selector, and autoTuneEnabled", async () => {
    const res = await invokeHandler<{ updated: string[] }>(experimentsPost, {
      body: { pct: 25, selector: "mcts", autoTuneEnabled: true },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
    const updated = [...res.body.updated].sort((a, b) => a.localeCompare(b));
    expect(updated).toEqual(["autoTuneEnabled", "pct", "selector"]);
    // Values are stored in D1 engine_config table
    const pctRow = db.raw
      .prepare(`SELECT value FROM engine_config WHERE key = ?`)
      .get("ab:experiment-pct") as { value: string } | undefined;
    expect(pctRow?.value).toBe("25");
  });

  it("rejects an out-of-range pct", async () => {
    const res = await invokeHandler(experimentsPost, {
      body: { pct: 999 },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown selector", async () => {
    const res = await invokeHandler(experimentsPost, {
      body: { selector: "random" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── analytics/insights ───────────────────────────────────────────────────────

describe("POST /api/admin/analytics/insights", () => {
  it("caches LLM result in D1", async () => {
    const stub = mockOpenAi({ content: "three insights here" });
    try {
      const res = await invokeHandler<{ insights: string }>(
        analyticsInsightsPost,
        {
          body: {
            summary: [{ event_type: "play", count: 5 }],
            totalGames7d: 5,
          },
          env: buildEnv({ db, openaiKey: "k" }),
        },
      );
      expect(res.status).toBe(200);
      expect(res.body.insights).toContain("three insights");
      expect(stub.calls).toHaveLength(1);
    } finally {
      stub.restore();
    }
  });

  it("serves from cache on second call", async () => {
    // Seed D1 cache directly
    db.raw
      .prepare(`INSERT OR REPLACE INTO kv_cache (key, value) VALUES (?, ?)`)
      .run(
        "admin:analytics-insights",
        JSON.stringify({ insights: "cached", generated_at: Date.now() - 100 }),
      );
    const stub = mockOpenAi({ content: "fresh" });
    try {
      const res = await invokeHandler<{ insights: string }>(
        analyticsInsightsPost,
        {
          body: {},
          env: buildEnv({ db, openaiKey: "k" }),
        },
      );
      expect(res.status).toBe(200);
      expect(res.body.insights).toBe("cached");
      expect(stub.calls).toHaveLength(0);
    } finally {
      stub.restore();
    }
  });
});

// ─── pipeline ─────────────────────────────────────────────────────────────────

describe("POST /api/admin/pipeline", () => {
  it("inserts a pipeline_runs row", async () => {
    seedCharacter(db, "mario");
    const res = await invokeHandler<{ id: number }>(pipelinePost, {
      body: {
        runBatch: "b1",
        characterId: "mario",
        step: "enrich",
        status: "success",
        durationMs: 123,
      },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeGreaterThan(0);
    expect(rowCount("pipeline_runs")).toBe(1);
  });

  it("rejects an invalid step", async () => {
    const res = await invokeHandler(pipelinePost, {
      body: {
        runBatch: "b1",
        characterId: "m",
        step: "nope",
        status: "success",
      },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── questions/:key ───────────────────────────────────────────────────────────

describe("PATCH /api/admin/questions/:key", () => {
  it("updates question_text and is_active", async () => {
    seedAttributeDefinition(db, "wearsHat", { question_text: "Old?" });
    const res = await invokeHandler(questionsPatch, {
      method: "PATCH",
      params: { key: "wearsHat" },
      body: { questionText: "Does the character wear a hat?", isActive: false },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(200);
    const row = db.raw
      .prepare(
        `SELECT question_text, is_active FROM attribute_definitions WHERE key = ?`,
      )
      .get("wearsHat") as { question_text: string; is_active: number };
    expect(row.question_text).toBe("Does the character wear a hat?");
    expect(row.is_active).toBe(0);
  });

  it("rejects question_text that is too short", async () => {
    seedAttributeDefinition(db, "wearsHat");
    const res = await invokeHandler(questionsPatch, {
      method: "PATCH",
      params: { key: "wearsHat" },
      body: { questionText: "too short" },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the key is unknown", async () => {
    const res = await invokeHandler(questionsPatch, {
      method: "PATCH",
      params: { key: "nonexistent" },
      body: { isActive: true },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/admin/questions/:key/score", () => {
  it("returns clamped LLM score", async () => {
    const stub = mockOpenAi({
      content: JSON.stringify({
        clarity: 9,
        power: 0,
        grammar: 4,
        rewrite: "Better?",
      }),
    });
    try {
      const res = await invokeHandler<{
        clarity: number;
        power: number;
        grammar: number;
      }>(questionsScore, {
        params: { key: "k" },
        body: { displayText: "D", questionText: "Q?" },
        env: buildEnv({ db, openaiKey: "k" }),
      });
      expect(res.status).toBe(200);
      expect(res.body.clarity).toBe(5); // clamped
      expect(res.body.power).toBe(1); // clamped
      expect(res.body.grammar).toBe(4);
    } finally {
      stub.restore();
    }
  });

  it("rejects empty body", async () => {
    const res = await invokeHandler(questionsScore, {
      params: { key: "k" },
      body: {},
      env: buildEnv({ db, openaiKey: "k" }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── resolve-stack ────────────────────────────────────────────────────────────

describe("POST /api/admin/resolve-stack", () => {
  it("returns 400 when no SHA is supplied", async () => {
    const r2 = createTestR2();
    const res = await invokeHandler(resolveStackPost, {
      body: { stack: "at https://x/assets/index-abc.js:1:1" },
      env: buildEnv({ db, r2 }),
    });
    expect(res.status).toBe(400);
  });

  it("returns frames with `null` resolution when the map is missing", async () => {
    const r2 = createTestR2();
    const res = await invokeHandler<{
      frames: Array<{ resolved: unknown; reason?: string }>;
    }>(resolveStackPost, {
      body: {
        stack: "at fn (https://x/assets/index-abc.js:42:13)",
        sha: "abc1234",
      },
      env: buildEnv({ db, r2 }),
    });
    expect(res.status).toBe(200);
    expect(res.body.frames).toHaveLength(1);
    expect(res.body.frames[0].resolved).toBeNull();
  });

  it("rejects an oversized stack", async () => {
    const r2 = createTestR2();
    const res = await invokeHandler(resolveStackPost, {
      body: { stack: "a".repeat(70_000) },
      env: buildEnv({ db, r2 }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── upload-attrs ─────────────────────────────────────────────────────────────

describe("POST /api/admin/upload-attrs", () => {
  it("returns 401 when no secret supplied", async () => {
    const res = await invokeHandler(uploadAttrsPost, {
      body: { attributes: [] },
      env: buildEnv({ db }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when secret is wrong", async () => {
    const res = await invokeHandler(uploadAttrsPost, {
      body: { secret: "wrong" },
      env: buildEnv({ db, adminSecret: "right" }),
    });
    expect(res.status).toBe(403);
  });

  it("inserts attribute rows when authenticated", async () => {
    seedCharacter(db, "mario");
    seedAttributeDefinition(db, "wearsHat");
    seedAttributeDefinition(db, "isHero");
    const res = await invokeHandler<{ attributes: number }>(uploadAttrsPost, {
      body: {
        secret: "right",
        attributes: [
          { c: "mario", k: "wearsHat", v: 1 },
          { c: "mario", k: "isHero", v: 1 },
        ],
      },
      env: buildEnv({ db, adminSecret: "right" }),
    });
    expect(res.status).toBe(200);
    expect(res.body.attributes).toBe(2);
    expect(rowCount("character_attributes", `character_id='mario'`)).toBe(2);
  });

  it("rejects oversized batches", async () => {
    const huge = Array.from({ length: 501 }, (_, i) => ({
      c: `c${i}`,
      k: "k",
      v: 1,
    }));
    const res = await invokeHandler(uploadAttrsPost, {
      body: { secret: "right", attributes: huge },
      env: buildEnv({ db, adminSecret: "right" }),
    });
    expect(res.status).toBe(400);
  });
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function rowCount(table: string, where = "1=1"): number {
  const row = db.raw
    .prepare(`SELECT COUNT(*) as n FROM ${table} WHERE ${where}`)
    .get() as {
    n: number;
  };
  return row.n;
}
