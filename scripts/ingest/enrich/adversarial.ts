/**
 * Adversarial attribute validation (skeptic LLM) + dispute SQL upload generator.
 *
 * Owns:
 * - `enrichment_disputes` schema init.
 * - Skeptic-pass orchestrator: sample enriched characters, build prompt, parse
 *   LLM disputes, filter to valid rows, insert into staging.
 * - SQL generator for promoting staging disputes to D1 `attribute_disputes`.
 *
 * Extracted from scripts/ingest/enrich.ts (RF.1) without behavior change.
 */
import type Database from 'better-sqlite3';
import { getDb } from '../db.js';
import { withRetry } from '../rate-limiter.js';
import { callLLM } from './llm-client.js';
import { buildSkepticPrompt } from './prompts.js';
import type { AttributeDef } from './storage.js';

export interface StagingDispute {
  character_id: string;
  attribute_key: string;
  current_value: number | null;
  dispute_reason: string;
  confidence: number;
}

export function initDisputeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS enrichment_disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      character_id TEXT NOT NULL,
      attribute_key TEXT NOT NULL,
      current_value INTEGER,
      dispute_reason TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.5,
      disputed_by TEXT NOT NULL DEFAULT 'skeptic-llm',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      status TEXT NOT NULL DEFAULT 'open'
        CHECK(status IN ('open', 'resolved', 'dismissed')),
      UNIQUE(character_id, attribute_key, status)
    )
  `);
}

export async function runAdversarialValidation(
  db: Database.Database,
  allAttrs: AttributeDef[],
  config: { openaiApiKey: string },
  limit: number,
  dryRun: boolean,
): Promise<number> {
  initDisputeSchema(db);

  // Sample already-enriched characters
  const candidates = db
    .prepare(`
      SELECT DISTINCT rc.id, rc.name, rc.category
      FROM enrichment_attributes ea
      JOIN raw_characters rc ON rc.id = ea.character_id
      WHERE ea.status = 'done'
      ORDER BY RANDOM()
      LIMIT ?
    `)
    .all(limit) as { id: string; name: string; category: string }[];

  if (candidates.length === 0) {
    console.log('[skeptic] No enriched characters found — run enrich first');
    return 0;
  }

  // Load their current attribute values
  const attrValues: Record<string, Record<string, boolean | null>> = {};
  for (const c of candidates) {
    const rows = db
      .prepare(
        `SELECT attribute_key, value FROM enrichment_attributes WHERE character_id = ? AND status = 'done'`,
      )
      .all(c.id) as { attribute_key: string; value: number | null }[];

    attrValues[c.id] = Object.fromEntries(
      rows.map(r => [r.attribute_key, r.value === null ? null : r.value === 1]),
    );
  }

  const prompt = buildSkepticPrompt(candidates, attrValues);

  console.log(`[skeptic] Challenging ${candidates.length} characters' attributes...`);
  if (dryRun) {
    console.log('[skeptic] Dry run — skipping LLM call');
    return 0;
  }

  let rawDisputes: StagingDispute[];
  try {
    const response = await withRetry(
      () => callLLM([{ role: 'user', content: prompt }], config.openaiApiKey, 'gpt-4o'),
      3,
      2000,
    );
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty skeptic response');

    const parsed = JSON.parse(content) as { disputes: StagingDispute[] };
    rawDisputes = parsed.disputes ?? [];
  } catch (err) {
    console.error(`[skeptic] LLM call failed: ${(err as Error).message}`);
    return 0;
  }

  // Filter to valid disputes
  const charIds = new Set(candidates.map(c => c.id));
  const attrKeySet = new Set(allAttrs.map(a => a.key));

  const valid = rawDisputes.filter(
    d =>
      charIds.has(d.character_id) &&
      attrKeySet.has(d.attribute_key) &&
      typeof d.dispute_reason === 'string' &&
      d.dispute_reason.length > 0,
  );

  if (valid.length === 0) {
    console.log('[skeptic] No disputes flagged');
    return 0;
  }

  // Store in staging DB
  const insert = db.prepare(`
    INSERT OR IGNORE INTO enrichment_disputes
      (character_id, attribute_key, current_value, dispute_reason, confidence)
    VALUES (?, ?, ?, ?, ?)
  `);
  let stored = 0;
  for (const d of valid) {
    const currentVal = d.current_value === null ? null : (d.current_value ? 1 : 0);
    const result = insert.run(
      d.character_id,
      d.attribute_key,
      currentVal,
      d.dispute_reason,
      Math.min(1, Math.max(0, d.confidence ?? 0.5)),
    );
    if (result.changes > 0) stored++;
  }

  console.log(
    `[skeptic] Stored ${stored} new disputes (${valid.length} flagged, ${rawDisputes.length - valid.length} invalid)`,
  );
  return stored;
}

/** Generate SQL to upload staging disputes to D1 */
export function generateDisputeUploadSQL(limit = 1000): string {
  const db = getDb();
  const disputes = db
    .prepare(
      `SELECT character_id, attribute_key, current_value, dispute_reason, confidence
       FROM enrichment_disputes
       WHERE status = 'open'
       LIMIT ?`,
    )
    .all(limit) as StagingDispute[];

  if (disputes.length === 0) return '-- No disputes to upload\n';

  const lines = disputes.map(d => {
    const val = d.current_value === null ? 'NULL' : d.current_value;
    const reason = d.dispute_reason.replace(/'/g, "''");
    return `INSERT OR IGNORE INTO attribute_disputes (character_id, attribute_key, current_value, dispute_reason, confidence) VALUES ('${d.character_id}', '${d.attribute_key}', ${val}, '${reason}', ${d.confidence});`;
  });
  return `-- Attribute disputes upload (${disputes.length} rows)\n${lines.join('\n')}\n`;
}
