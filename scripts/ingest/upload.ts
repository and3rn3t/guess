/**
 * Upload canonical characters from staging DB to D1 via wrangler.
 * Generates SQL migration files in batches, then applies them.
 */
import { getDb, closeDb } from './db.js';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { formatElapsed } from './utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

interface CanonicalCharacter {
  id: string;
  name: string;
  category: string;
  source: string;
  source_id: string;
  popularity: number;
  image_url: string | null;
  description: string | null;
}

function escapeSQL(s: string | null): string {
  if (s === null) return 'NULL';
  return `'${s.replace(/'/g, "''")}'`;
}

export async function generateUploadSQL(options: { minPopularity?: number; limit?: number; outputFile?: string } = {}): Promise<string> {
  const { minPopularity = 0, limit = 0, outputFile } = options;
  const db = getDb();

  console.log('[Upload] Reading canonical characters from staging DB...');

  // Get canonical characters (deduped) joined with full data
  let query = `
    SELECT DISTINCT
      r.id, r.name, r.category, r.source, r.source_id, r.popularity, r.image_url, r.description
    FROM raw_characters r
    INNER JOIN dedup_map d ON d.raw_id = r.id AND d.canonical_id = r.id
    WHERE r.popularity >= ?
    ORDER BY r.popularity DESC
  `;

  if (limit > 0) query += ` LIMIT ${limit}`;

  const chars = db.prepare(query).all(minPopularity) as CanonicalCharacter[];
  console.log(`[Upload] ${chars.length} canonical characters to upload`);

  // Generate SQL
  const lines: string[] = [
    '-- Auto-generated: upload canonical characters from staging DB',
    `-- Generated at: ${new Date().toISOString()}`,
    `-- Characters: ${chars.length}`,
    '',
  ];

  // Batch into groups of 500 (D1 has SQL size limits)
  const BATCH_SIZE = 500;
  for (let i = 0; i < chars.length; i += BATCH_SIZE) {
    const batch = chars.slice(i, i + BATCH_SIZE);
    lines.push(`-- Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} characters)`);

    for (const c of batch) {
      lines.push(
        `INSERT OR IGNORE INTO characters (id, name, category, source, source_id, popularity, image_url, description) VALUES (${escapeSQL(c.id)}, ${escapeSQL(c.name)}, ${escapeSQL(c.category)}, ${escapeSQL(c.source)}, ${escapeSQL(c.source_id)}, ${c.popularity}, ${escapeSQL(c.image_url)}, ${escapeSQL(c.description)});`
      );
    }
    lines.push('');
  }

  const sql = lines.join('\n');

  if (outputFile) {
    const outPath = join(PROJECT_ROOT, outputFile);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, sql, 'utf-8');
    console.log(`[Upload] SQL written to ${outputFile} (${(sql.length / 1024).toFixed(0)} KB)`);
  }

  return sql;
}

export async function applyToD1(sqlFile: string, env: 'production' | 'preview' = 'production', remote = false): Promise<void> {
  const startTime = Date.now();
  const filePath = join(PROJECT_ROOT, sqlFile);
  const fullSql = readFileSync(filePath, 'utf-8');

  // D1 has a limit per batch — split into chunks of ~1000 statements
  const CHUNK_SIZE = 1000;
  const statements = fullSql.split('\n').filter(l => l.startsWith('INSERT'));
  const totalChunks = Math.ceil(statements.length / CHUNK_SIZE);

  const remoteFlag = remote ? ' --remote' : '';
  console.log(`[Upload] Applying ${statements.length} INSERTs to D1 (env=${env}, remote=${remote}) in ${totalChunks} chunks...`);

  const chunkDir = join(PROJECT_ROOT, 'migrations', 'chunks');
  mkdirSync(chunkDir, { recursive: true });

  for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    const chunk = statements.slice(i, i + CHUNK_SIZE);
    const chunkFile = join(chunkDir, `chunk_${String(chunkNum).padStart(3, '0')}.sql`);
    writeFileSync(chunkFile, chunk.join('\n'), 'utf-8');

    console.log(`[Upload] Chunk ${chunkNum}/${totalChunks} (${chunk.length} statements)...`);

    try {
      const cmd = `npx wrangler d1 execute GUESS_DB --env ${env}${remoteFlag} --file="${chunkFile}" --yes`;
      execSync(cmd, {
        cwd: PROJECT_ROOT,
        stdio: 'pipe',
        timeout: 120_000,
      });
    } catch (err) {
      console.error(`[Upload] Chunk ${chunkNum} failed:`, (err as Error).message?.slice(0, 200));
      throw err;
    }
  }

  console.log(`[Upload] Applied ${statements.length} to D1 ${env} in ${formatElapsed(Date.now() - startTime)}`);
}

/** Show stats from the staging DB. */
export function showStats(): void {
  const db = getDb();

  const total = (db.prepare('SELECT COUNT(*) as c FROM raw_characters').get() as { c: number }).c;
  const bySource = db.prepare('SELECT source, COUNT(*) as c FROM raw_characters GROUP BY source ORDER BY c DESC').all() as { source: string; c: number }[];
  const byCategory = db.prepare('SELECT category, COUNT(*) as c FROM raw_characters GROUP BY category ORDER BY c DESC').all() as { category: string; c: number }[];
  const dedupCount = (db.prepare('SELECT COUNT(DISTINCT canonical_id) as c FROM dedup_map').get() as { c: number }).c;
  const withImage = (db.prepare('SELECT COUNT(*) as c FROM raw_characters WHERE image_url IS NOT NULL').get() as { c: number }).c;
  const withDesc = (db.prepare('SELECT COUNT(*) as c FROM raw_characters WHERE description IS NOT NULL').get() as { c: number }).c;

  console.log('\n=== Staging DB Stats ===');
  console.log(`Total raw characters: ${total.toLocaleString()}`);
  console.log(`Canonical (deduped):  ${dedupCount.toLocaleString()}`);
  console.log(`With image:           ${withImage.toLocaleString()} (${((withImage / total) * 100).toFixed(1)}%)`);
  console.log(`With description:     ${withDesc.toLocaleString()} (${((withDesc / total) * 100).toFixed(1)}%)`);
  console.log('\nBy source:');
  for (const row of bySource) console.log(`  ${row.source.padEnd(12)} ${row.c.toLocaleString()}`);
  console.log('\nBy category:');
  for (const row of byCategory) console.log(`  ${row.category.padEnd(15)} ${row.c.toLocaleString()}`);
}

// CLI entry point
if (process.argv[1]?.endsWith('upload.ts') || process.argv[1]?.endsWith('upload.js')) {
  const action = process.argv[2] ?? 'stats';

  if (action === 'stats') {
    showStats();
    closeDb();
  } else if (action === 'generate') {
    const minPop = parseFloat(process.argv[3] ?? '0');
    const limit = parseInt(process.argv[4] ?? '0');
    generateUploadSQL({ minPopularity: minPop, limit, outputFile: 'migrations/0005_ingest_characters.sql' })
      .then(() => closeDb())
      .catch(err => { console.error(err); process.exit(1); });
  } else if (action === 'apply') {
    const env = (process.argv[3] ?? 'production') as 'production' | 'preview';
    applyToD1('migrations/0005_ingest_characters.sql', env)
      .then(() => closeDb())
      .catch(err => { console.error(err); process.exit(1); });
  } else {
    console.log('Usage: npx tsx scripts/ingest/upload.ts [stats|generate|apply] [options]');
    console.log('  stats              - Show staging DB statistics');
    console.log('  generate [minPop] [limit] - Generate SQL migration');
    console.log('  apply [production|preview] - Apply migration to D1');
  }
}
