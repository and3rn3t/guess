/**
 * Upload SQL generators and the enrichment changelog appender.
 *
 * Owns:
 * - `enrich-log.md` changelog row appender (with header-on-create).
 * - `character_attributes` upload SQL generator (chunked INSERTs).
 *
 * Extracted from scripts/ingest/enrich.ts (RF.1) without behavior change.
 */
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db.js';
import { MODEL } from './llm-client.js';
import { initEnrichSchema } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHANGELOG_FILE = path.join(__dirname, '..', '..', '..', 'data', 'enrich-log.md');

export interface ChangelogEntry {
  enriched: number;
  failed: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  elapsedMs: number;
  mode: string;
}

export function appendEnrichChangelog(entry: ChangelogEntry): void {
  const date = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
  const elapsed = Math.round(entry.elapsedMs / 1000);
  const row =
    `| ${date} | ${entry.mode} | ${entry.enriched.toLocaleString()} | ` +
    `${entry.failed} | ${entry.promptTokens.toLocaleString()} | ` +
    `${entry.completionTokens.toLocaleString()} | $${entry.cost.toFixed(4)} | ${elapsed}s |\n`;

  // Use appendFileSync with try/create-on-ENOENT to avoid TOCTOU between
  // existsSync and the subsequent write. (CodeQL: js/file-system-race)
  try {
    appendFileSync(CHANGELOG_FILE, row);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      const header =
        `# Enrichment Run Log\n\n` +
        `| Date (UTC) | Mode | Enriched | Failed | Prompt Tokens | Completion Tokens | Cost | Elapsed |\n` +
        `|---|---|---|---|---|---|---|---|\n`;
      writeFileSync(CHANGELOG_FILE, header + row);
    } else {
      throw err;
    }
  }
}

export interface UploadOptions {
  outputFile?: string;
  minConfidence?: number;
}

export function generateEnrichUploadSQL(opts: UploadOptions = {}): string {
  const outputFile = opts.outputFile ?? 'migrations/0006_character_attributes.sql';
  initEnrichSchema();
  const db = getDb();

  const rows = db
    .prepare(`
      SELECT ea.character_id, ea.attribute_key, ea.value, ea.confidence, ea.evidence
      FROM enrichment_attributes ea
      INNER JOIN enrichment_status es ON ea.character_id = es.character_id AND es.status = 'done'
      WHERE ea.value IS NOT NULL
      ORDER BY ea.character_id, ea.attribute_key
    `)
    .all() as {
    character_id: string;
    attribute_key: string;
    value: number;
    confidence: number;
    evidence: string | null;
  }[];

  console.log(`Generating SQL for ${rows.length.toLocaleString()} attribute values...`);

  const fallbackEvidence = `enrichment:openai:${MODEL}:run=${new Date().toISOString()}`;
  const lines: string[] = [];
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    lines.push(
      'INSERT OR REPLACE INTO character_attributes (character_id, attribute_key, value, confidence, evidence) VALUES',
    );
    const values = chunk.map(r => {
      const charId = r.character_id.replace(/'/g, "''");
      const attrKey = r.attribute_key.replace(/'/g, "''");
      const evidence = (r.evidence ?? fallbackEvidence).replace(/'/g, "''");
      return `  ('${charId}', '${attrKey}', ${r.value}, ${r.confidence}, '${evidence}')`;
    });
    lines.push(values.join(',\n') + ';\n');
  }

  const sql = lines.join('\n');

  const dir = path.dirname(path.resolve(outputFile));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(outputFile, sql);
  console.log(
    `Written to ${outputFile} (${(sql.length / 1024 / 1024).toFixed(1)} MB, ${rows.length.toLocaleString()} rows)`,
  );

  return outputFile;
}
