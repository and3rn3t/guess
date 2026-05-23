/**
 * Storage + parsing helpers for the enrichment pipeline.
 *
 * Owns:
 * - Staging-DB schema init (idempotent ALTERs included).
 * - Attribute-definition cache (load/cache from D1 JSON exports).
 * - Category filter for attribute definitions.
 * - Pending-character query.
 * - Result store with constraint-violation dispute-filing side effect.
 * - mark-failed status updates.
 * - LLM JSON response parser.
 *
 * Extracted from scripts/ingest/enrich.ts (RF.1) without behavior change.
 */
import type Database from 'better-sqlite3';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db.js';
import type { Category } from '../types.js';
import {
  validateAttributes,
  violationToDisputeReason,
  type AttributeMap,
  type ConstraintSet,
} from '../../../functions/api/_constraints.js';
import { MODEL } from './llm-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '..', '..', '..', 'data', 'enrich-cache');
const CONSTRAINTS_PATH = path.join(__dirname, '..', '..', '..', 'data', 'attribute-constraints.json');
const ATTR_CACHE_FILE = path.join(CACHE_DIR, 'attribute_definitions.json');

export interface AttributeDef {
  key: string;
  displayText: string;
  categories: string | null; // JSON array or null (= all)
}

export interface EnrichResult {
  characterId: string;
  attributes: Record<string, boolean | null>;
  confidence?: Record<string, number>;
  contested?: Record<string, boolean>;
  evidence?: string;
  tokensUsed: { prompt: number; completion: number };
}

export interface EnrichOptions {
  batchSize?: number;
  concurrency?: number;
  limit?: number;
  category?: Category;
  minPopularity?: number;
  dryRun?: boolean;
  newAttrsOnly?: boolean;
  model2?: string;
  validate?: boolean;
}

// DQ.4: lazy-loaded constraint set, cached for the life of the process.
let _constraintSetCache: ConstraintSet | null | undefined;
export function loadConstraintSet(): ConstraintSet | null {
  if (_constraintSetCache !== undefined) return _constraintSetCache;
  try {
    if (!existsSync(CONSTRAINTS_PATH)) {
      _constraintSetCache = null;
      return null;
    }
    const raw = readFileSync(CONSTRAINTS_PATH, 'utf8');
    _constraintSetCache = JSON.parse(raw) as ConstraintSet;
    console.log(
      `[constraints] loaded ${_constraintSetCache.constraints.length} rules from ${path.relative(process.cwd(), CONSTRAINTS_PATH)}`,
    );
    return _constraintSetCache;
  } catch (err) {
    console.warn(
      `[constraints] failed to load ${CONSTRAINTS_PATH}: ${(err as Error).message} — DQ.4 validation disabled for this run`,
    );
    _constraintSetCache = null;
    return null;
  }
}

export function initEnrichSchema(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS enrichment_attributes (
      character_id  TEXT NOT NULL,
      attribute_key TEXT NOT NULL,
      value         INTEGER,  -- 1=true, 0=false, NULL=unknown
      confidence    REAL DEFAULT 1.0,
      contested     INTEGER DEFAULT 0,  -- 1 if model2 disagreed
      evidence      TEXT,               -- DQ.28: provenance string for this row
      PRIMARY KEY (character_id, attribute_key)
    );

    CREATE TABLE IF NOT EXISTS enrichment_status (
      character_id   TEXT PRIMARY KEY,
      status         TEXT NOT NULL DEFAULT 'pending',  -- pending, done, failed
      prompt_tokens  INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      error          TEXT,
      updated_at     INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_enrich_status ON enrichment_status(status);
  `);

  // EN.2: add contested column to existing staging DBs (ALTER TABLE is idempotent via try/catch)
  try {
    db.exec(`ALTER TABLE enrichment_attributes ADD COLUMN contested INTEGER DEFAULT 0`);
  } catch {
    // Column already exists — safe to ignore
  }

  // DQ.28: backfill evidence column on pre-existing staging DBs.
  try {
    db.exec(`ALTER TABLE enrichment_attributes ADD COLUMN evidence TEXT`);
  } catch {
    // Column already exists — safe to ignore
  }
}

export function loadAttributeDefinitions(): AttributeDef[] {
  if (existsSync(ATTR_CACHE_FILE)) {
    return JSON.parse(readFileSync(ATTR_CACHE_FILE, 'utf-8'));
  }
  throw new Error(
    `Attribute definitions not cached. Run:\n` +
      `  npx wrangler d1 execute GUESS_DB --env production --remote ` +
      `--command "SELECT key, display_text, categories FROM attribute_definitions ORDER BY key" ` +
      `--json > data/enrich-cache/attribute_definitions_raw.json\n` +
      `Then run: npx tsx scripts/ingest/enrich.ts cache-attrs`,
  );
}

/** Cache attribute definitions from a wrangler JSON export. */
export function cacheAttributeDefinitions(): void {
  const rawPath = path.join(CACHE_DIR, 'attribute_definitions_raw.json');
  if (!existsSync(rawPath)) {
    throw new Error(`Missing ${rawPath}. Run the wrangler command first.`);
  }
  const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
  const attrs: AttributeDef[] = raw[0].results.map((r: Record<string, string>) => ({
    key: r.key,
    displayText: r.display_text,
    categories: r.categories ?? null,
  }));
  writeFileSync(ATTR_CACHE_FILE, JSON.stringify(attrs, null, 2));
  console.log(`Cached ${attrs.length} attribute definitions to ${ATTR_CACHE_FILE}`);
}

/** Get attributes relevant to a category. */
export function getAttributesForCategory(
  allAttrs: AttributeDef[],
  category: Category,
): AttributeDef[] {
  return allAttrs.filter(a => {
    if (!a.categories) return true; // null = applies to all
    try {
      const cats: string[] = JSON.parse(a.categories);
      return cats.includes(category);
    } catch {
      return true;
    }
  });
}

export function getPendingCharacters(
  db: Database.Database,
  opts: EnrichOptions,
  allAttrs?: AttributeDef[],
): { id: string; name: string; category: string; description: string | null; popularity: number }[] {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Only canonical characters (from dedup_map)
  conditions.push(`rc.id IN (SELECT canonical_id FROM dedup_map)`);

  if (opts.newAttrsOnly && allAttrs) {
    conditions.push(`rc.id NOT IN (SELECT character_id FROM enrichment_status WHERE status = 'failed')`);
    conditions.push(
      `(SELECT COUNT(*) FROM enrichment_attributes ea WHERE ea.character_id = rc.id) < ?`,
    );
    params.push(allAttrs.length);
  } else {
    conditions.push(`rc.id NOT IN (SELECT character_id FROM enrichment_status WHERE status = 'done')`);
  }

  if (opts.category) {
    conditions.push(`rc.category = ?`);
    params.push(opts.category);
  }

  if (opts.minPopularity !== undefined) {
    conditions.push(`rc.popularity >= ?`);
    params.push(opts.minPopularity);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limitClause = opts.limit ? `LIMIT ?` : '';
  if (opts.limit) params.push(opts.limit);

  const sql = `
    SELECT rc.id, rc.name, rc.category, rc.description, rc.popularity
    FROM raw_characters rc
    ${where}
    ORDER BY rc.popularity DESC
    ${limitClause}
  `;

  return db.prepare(sql).all(...params) as {
    id: string;
    name: string;
    category: string;
    description: string | null;
    popularity: number;
  }[];
}

export function storeEnrichmentResults(db: Database.Database, results: EnrichResult[]): void {
  const insertAttr = db.prepare(`
    INSERT OR REPLACE INTO enrichment_attributes (character_id, attribute_key, value, confidence, contested, evidence)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const upsertStatus = db.prepare(`
    INSERT INTO enrichment_status (character_id, status, prompt_tokens, completion_tokens, updated_at)
    VALUES (?, 'done', ?, ?, unixepoch())
    ON CONFLICT(character_id) DO UPDATE SET
      status = 'done',
      prompt_tokens = excluded.prompt_tokens,
      completion_tokens = excluded.completion_tokens,
      error = NULL,
      updated_at = unixepoch()
  `);

  const constraintSet = loadConstraintSet();
  const insertDispute = db.prepare(`
    INSERT OR IGNORE INTO enrichment_disputes
      (character_id, attribute_key, current_value, dispute_reason, confidence)
    VALUES (?, ?, ?, ?, ?)
  `);

  let constraintViolations = 0;

  const storeBatch = db.transaction((batch: EnrichResult[]) => {
    for (const result of batch) {
      const evidence = result.evidence ?? `enrichment:openai:${MODEL}:run=${new Date().toISOString()}`;
      for (const [key, value] of Object.entries(result.attributes)) {
        const intVal = value === true ? 1 : value === false ? 0 : null;
        const confidence = result.confidence?.[key] ?? (value === null ? 0.65 : 0.85);
        const isContested = result.contested?.[key] ? 1 : 0;
        insertAttr.run(result.characterId, key, intVal, confidence, isContested, evidence);
      }

      if (constraintSet) {
        const attrMap: AttributeMap = {};
        for (const [k, v] of Object.entries(result.attributes)) {
          attrMap[k] = v;
        }
        const violations = validateAttributes(attrMap, constraintSet);
        for (const violation of violations) {
          let intVal: number | null;
          if (violation.currentValue === null) intVal = null;
          else if (violation.currentValue) intVal = 1;
          else intVal = 0;
          insertDispute.run(
            result.characterId,
            violation.attributeKey,
            intVal,
            violationToDisputeReason(violation),
            0.95,
          );
          constraintViolations++;
        }
      }

      upsertStatus.run(
        result.characterId,
        result.tokensUsed.prompt,
        result.tokensUsed.completion,
      );
    }
  });

  storeBatch(results);

  if (constraintViolations > 0) {
    console.log(
      `[constraints] DQ.4: filed ${constraintViolations} dispute(s) from ${results.length} characters`,
    );
  }
}

export function markFailed(db: Database.Database, characterIds: string[], error: string): void {
  const stmt = db.prepare(`
    INSERT INTO enrichment_status (character_id, status, error, updated_at)
    VALUES (?, 'failed', ?, unixepoch())
    ON CONFLICT(character_id) DO UPDATE SET
      status = 'failed',
      error = excluded.error,
      updated_at = unixepoch()
  `);

  const markBatch = db.transaction((ids: string[]) => {
    for (const id of ids) {
      stmt.run(id, error);
    }
  });

  markBatch(characterIds);
}

export function parseResponse(
  raw: string,
  characterIds: string[],
  validKeys: Set<string>,
): Record<string, Record<string, boolean | null>> {
  const parsed = JSON.parse(raw);
  const result: Record<string, Record<string, boolean | null>> = {};

  for (const charId of characterIds) {
    const charData = parsed[charId];
    if (!charData || typeof charData !== 'object') continue;

    result[charId] = {};
    for (const [key, val] of Object.entries(charData)) {
      if (!validKeys.has(key)) continue;
      if (val === true) result[charId][key] = true;
      else if (val === false) result[charId][key] = false;
      else result[charId][key] = null;
    }
  }

  return result;
}

export { CACHE_DIR };
