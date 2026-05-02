/**
 * Tests for the server-side enrichment batch runner (enrich/run.ts).
 *
 * Covers:
 *  - Pure helper functions (buildSystemPrompt, buildUserPrompt, parseOpenAIContent)
 *  - runServerEnrichBatch: no-op paths, happy path, LLM error path
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  buildUserPrompt,
  parseOpenAIContent,
  runServerEnrichBatch,
} from "../enrich/run";
import {
  buildEnv,
  createTestDb,
  createTestKv,
  mockOpenAi,
  seedAttributeDefinition,
  seedCharacter,
  type TestDb,
  type TestKv,
} from "./harness";

let db: TestDb;
let kv: TestKv;

beforeEach(() => {
  db = createTestDb();
  kv = createTestKv();
});

afterEach(() => {
  db.close();
});

// ─── pure helpers ──────────────────────────────────────────────────────────────

describe("buildSystemPrompt", () => {
  it("includes all attribute keys", () => {
    const prompt = buildSystemPrompt([
      { key: "isHero", questionText: null },
      { key: "isVillain", questionText: null },
      { key: "hasMagic", questionText: null },
    ]);
    expect(prompt).toContain("isHero, isVillain, hasMagic");
    expect(prompt).toContain("3 total");
  });

  it("includes JSON response format example", () => {
    const prompt = buildSystemPrompt([{ key: "isHero", questionText: null }]);
    expect(prompt).toContain('"char_id_1"');
    expect(prompt).toContain('"attr1"');
  });

  it("includes question text section when provided", () => {
    const prompt = buildSystemPrompt([
      { key: "isHero", questionText: "Is this character a hero?" },
    ]);
    expect(prompt).toContain("WHAT EACH KEY MEANS");
    expect(prompt).toContain("isHero: Is this character a hero?");
  });

  it("omits question text section when all questionText is null", () => {
    const prompt = buildSystemPrompt([{ key: "isHero", questionText: null }]);
    expect(prompt).not.toContain("WHAT EACH KEY MEANS");
  });
});

describe("buildUserPrompt", () => {
  it("lists characters with name and category", () => {
    const prompt = buildUserPrompt([
      {
        id: "mario",
        name: "Mario",
        category: "video-games",
        description: null,
      },
      {
        id: "gandalf",
        name: "Gandalf",
        category: "fantasy",
        description: "A wizard",
      },
    ]);
    expect(prompt).toContain('"Mario" (video-games)');
    expect(prompt).toContain('"Gandalf" (fantasy)');
    expect(prompt).toContain("A wizard");
  });

  it("truncates long descriptions at 200 chars", () => {
    const longDesc = "x".repeat(300);
    const prompt = buildUserPrompt([
      { id: "a", name: "A", category: "anime", description: longDesc },
    ]);
    expect(prompt).toContain("x".repeat(200));
    expect(prompt).not.toContain("x".repeat(201));
  });
});

describe("parseOpenAIContent", () => {
  it("extracts valid true/false/null values for known keys", () => {
    const content = JSON.stringify({
      mario: { isHero: true, isVillain: false, hasMagic: null },
    });
    const result = parseOpenAIContent(
      content,
      ["mario"],
      new Set(["isHero", "isVillain", "hasMagic"]),
    );
    expect(result).toEqual({
      mario: { isHero: true, isVillain: false, hasMagic: null },
    });
  });

  it("filters out keys not in validKeys", () => {
    const content = JSON.stringify({ mario: { isHero: true, unknown: true } });
    const result = parseOpenAIContent(content, ["mario"], new Set(["isHero"]));
    expect(result.mario).not.toHaveProperty("unknown");
    expect(result.mario.isHero).toBe(true);
  });

  it("returns empty object on invalid JSON", () => {
    const result = parseOpenAIContent(
      "{bad json",
      ["mario"],
      new Set(["isHero"]),
    );
    expect(result).toEqual({});
  });

  it("skips characters missing from the response", () => {
    const content = JSON.stringify({ mario: { isHero: true } });
    const result = parseOpenAIContent(
      content,
      ["mario", "luigi"],
      new Set(["isHero"]),
    );
    expect(result).toHaveProperty("mario");
    expect(result).not.toHaveProperty("luigi");
  });
});

// ─── runServerEnrichBatch ──────────────────────────────────────────────────────

describe("runServerEnrichBatch", () => {
  it("exits early and clears KV when no attribute definitions exist", async () => {
    // Migration 0003 seeds attribute_definitions — deactivate them all so this
    // test can exercise the "no active attrs" early-exit path without touching
    // FK-referenced rows.
    db.raw.prepare("UPDATE attribute_definitions SET is_active = 0").run();
    await kv.put("admin:enrich-start", "active");
    seedCharacter(db, "mario");
    const env = buildEnv({ db, kv, openaiKey: "sk-test" }) as Parameters<
      typeof runServerEnrichBatch
    >[0];

    await runServerEnrichBatch(env, "batch-1");

    expect(await kv.get("admin:enrich-start")).toBeNull();
    const runs = db.raw
      .prepare("SELECT COUNT(*) AS n FROM pipeline_runs")
      .get() as { n: number };
    expect(runs.n).toBe(0);
  });

  it("exits early and clears KV when no characters need enrichment", async () => {
    await kv.put("admin:enrich-start", "active");
    seedAttributeDefinition(db, "isHero");
    // seed mario with an attribute so he is already enriched
    seedCharacter(db, "mario");
    db.raw
      .prepare(
        `INSERT INTO character_attributes (character_id, attribute_key, value, confidence) VALUES ('mario', 'isHero', 1, 0.85)`,
      )
      .run();

    const env = buildEnv({ db, kv, openaiKey: "sk-test" }) as Parameters<
      typeof runServerEnrichBatch
    >[0];
    await runServerEnrichBatch(env, "batch-2");

    expect(await kv.get("admin:enrich-start")).toBeNull();
    const runs = db.raw
      .prepare("SELECT COUNT(*) AS n FROM pipeline_runs")
      .get() as { n: number };
    expect(runs.n).toBe(0);
  });

  it("marks stale running rows as error before starting a new batch", async () => {
    seedAttributeDefinition(db, "isHero");
    seedCharacter(db, "mario");
    // Simulate a stuck 'running' row from 6 min ago (previous Worker crash)
    db.raw
      .prepare(
        `INSERT INTO pipeline_runs (run_batch, character_id, step, status, created_at)
       VALUES ('old-batch', 'mario', 'enrich', 'running', unixepoch() - 360)`,
      )
      .run();

    const llmContent = JSON.stringify({ mario: { isHero: true } });
    const { restore } = mockOpenAi({ content: llmContent });
    try {
      const env = buildEnv({ db, kv, openaiKey: "sk-test" }) as Parameters<
        typeof runServerEnrichBatch
      >[0];
      await runServerEnrichBatch(env, "new-batch");
    } finally {
      restore();
    }

    const oldRun = db.raw
      .prepare(
        `SELECT status, error FROM pipeline_runs WHERE run_batch = 'old-batch'`,
      )
      .get() as { status: string; error: string } | undefined;
    expect(oldRun?.status).toBe("error");
    expect(oldRun?.error).toContain("Stale");
  });

  it("writes character_attributes and marks pipeline_runs success on valid LLM response", async () => {
    seedAttributeDefinition(db, "isHero");
    seedAttributeDefinition(db, "isVillain");
    seedCharacter(db, "mario");

    const llmContent = JSON.stringify({
      mario: { isHero: true, isVillain: false },
    });
    const { restore } = mockOpenAi({ content: llmContent });

    try {
      const env = buildEnv({ db, kv, openaiKey: "sk-test" }) as Parameters<
        typeof runServerEnrichBatch
      >[0];
      await runServerEnrichBatch(env, "batch-3");
    } finally {
      restore();
    }

    // character_attributes rows written
    const attrs = db.raw
      .prepare(
        `SELECT attribute_key, value FROM character_attributes WHERE character_id = 'mario' ORDER BY attribute_key`,
      )
      .all() as { attribute_key: string; value: number | null }[];
    expect(attrs).toHaveLength(2);
    expect(attrs.find((a) => a.attribute_key === "isHero")?.value).toBe(1);
    expect(attrs.find((a) => a.attribute_key === "isVillain")?.value).toBe(0);

    // pipeline_run marked success
    const run = db.raw
      .prepare(
        `SELECT status FROM pipeline_runs WHERE character_id = 'mario' AND step = 'enrich'`,
      )
      .get() as { status: string } | undefined;
    expect(run?.status).toBe("success");

    // KV cleared
    expect(await kv.get("admin:enrich-start")).toBeNull();
    // Token stats written
    expect(await kv.get("enrich:last-batch-stats")).toBeTruthy();
  });

  it("writes evidence tag on character_attributes rows", async () => {
    seedAttributeDefinition(db, "isHero");
    seedCharacter(db, "mario");

    const llmContent = JSON.stringify({ mario: { isHero: true } });
    const { restore } = mockOpenAi({ content: llmContent });

    try {
      const env = buildEnv({ db, kv, openaiKey: "sk-test" }) as Parameters<
        typeof runServerEnrichBatch
      >[0];
      await runServerEnrichBatch(env, "batch-4");
    } finally {
      restore();
    }

    const row = db.raw
      .prepare(
        `SELECT evidence FROM character_attributes WHERE character_id = 'mario' AND attribute_key = 'isHero'`,
      )
      .get() as { evidence: string | null } | undefined;
    expect(row?.evidence).toMatch(/^enrichment:openai:gpt-4o-mini:run=/);
  });

  it("marks pipeline_runs as error and clears KV on LLM fetch failure", async () => {
    seedAttributeDefinition(db, "isHero");
    seedCharacter(db, "luigi");

    const { restore } = mockOpenAi({
      status: 500,
      body: "Internal Server Error",
    });

    try {
      const env = buildEnv({ db, kv, openaiKey: "sk-test" }) as Parameters<
        typeof runServerEnrichBatch
      >[0];
      await runServerEnrichBatch(env, "batch-5");
    } finally {
      restore();
    }

    const run = db.raw
      .prepare(
        `SELECT status, error FROM pipeline_runs WHERE character_id = 'luigi' AND step = 'enrich'`,
      )
      .get() as { status: string; error: string | null } | undefined;
    expect(run?.status).toBe("error");
    expect(run?.error).toContain("500");

    // KV cleared even on error
    expect(await kv.get("admin:enrich-start")).toBeNull();

    // No character_attributes written
    const attrs = db.raw
      .prepare(
        `SELECT COUNT(*) AS n FROM character_attributes WHERE character_id = 'luigi'`,
      )
      .get() as { n: number };
    expect(attrs.n).toBe(0);
  });

  it("marks pipeline_runs as error when character is missing from LLM response", async () => {
    seedAttributeDefinition(db, "isHero");
    seedCharacter(db, "wario");

    // LLM returns an empty object — wario not included
    const { restore } = mockOpenAi({ content: "{}" });

    try {
      const env = buildEnv({ db, kv, openaiKey: "sk-test" }) as Parameters<
        typeof runServerEnrichBatch
      >[0];
      await runServerEnrichBatch(env, "batch-6");
    } finally {
      restore();
    }

    const run = db.raw
      .prepare(
        `SELECT status FROM pipeline_runs WHERE character_id = 'wario' AND step = 'enrich'`,
      )
      .get() as { status: string } | undefined;
    expect(run?.status).toBe("error");
  });

  it("skips characters with 3+ recent errors and processes the next eligible one", async () => {
    seedAttributeDefinition(db, "isHero");
    // 'stuck' has higher popularity so it would normally be picked first
    db.raw
      .prepare(
        `INSERT OR IGNORE INTO characters (id, name, category, source, popularity) VALUES ('stuck', 'Stuck', 'video-games', 'default', 0.9)`,
      )
      .run();
    seedCharacter(db, "fresh"); // popularity=0, picked after 'stuck' is skipped

    // Simulate 3 recent errors for 'stuck'
    for (let i = 1; i <= 3; i++) {
      db.raw
        .prepare(
          `INSERT INTO pipeline_runs (run_batch, character_id, step, status, created_at)
           VALUES ('old-batch-${i}', 'stuck', 'enrich', 'error', unixepoch() - ${i * 60})`,
        )
        .run();
    }

    const llmContent = JSON.stringify({ fresh: { isHero: false } });
    const { restore } = mockOpenAi({ content: llmContent });
    try {
      const env = buildEnv({ db, kv, openaiKey: "sk-test" }) as Parameters<typeof runServerEnrichBatch>[0];
      await runServerEnrichBatch(env, "batch-skip");
    } finally {
      restore();
    }

    // 'stuck' was not picked — no new pipeline_run row for it in this batch
    const stuckRun = db.raw
      .prepare(`SELECT COUNT(*) AS n FROM pipeline_runs WHERE character_id = 'stuck' AND run_batch = 'batch-skip'`)
      .get() as { n: number };
    expect(stuckRun.n).toBe(0);

    // 'fresh' was processed successfully
    const freshAttr = db.raw
      .prepare(`SELECT value FROM character_attributes WHERE character_id = 'fresh' AND attribute_key = 'isHero'`)
      .get() as { value: number } | undefined;
    expect(freshAttr?.value).toBe(0); // isHero: false → 0
  });

  it("respects the limit parameter", async () => {
    seedAttributeDefinition(db, "isHero");
    seedCharacter(db, "a");
    seedCharacter(db, "b");
    seedCharacter(db, "c");

    const llmContent = JSON.stringify({ a: { isHero: true } });
    const { restore, calls } = mockOpenAi({ content: llmContent });

    try {
      const env = buildEnv({ db, kv, openaiKey: "sk-test" }) as Parameters<
        typeof runServerEnrichBatch
      >[0];
      await runServerEnrichBatch(env, "batch-7"); // always processes 1 character per invocation
    } finally {
      restore();
    }

    // Only 1 pipeline_run row
    const runs = db.raw
      .prepare("SELECT COUNT(*) AS n FROM pipeline_runs")
      .get() as { n: number };
    expect(runs.n).toBe(1);
    // 2 parallel chunk calls per character (attrs split in half to stay under 30 s wall-clock)
    expect(calls).toHaveLength(2);
  });
});
