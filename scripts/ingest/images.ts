/**
 * Image pipeline: download source images → resize to WebP → upload to R2.
 *
 * Creates two sizes per character:
 *   - thumb.webp  (64×64)
 *   - profile.webp (256×256)
 *
 * Usage:
 *   npx tsx scripts/ingest/run.ts images [--limit N] [--concurrency N] [--source anilist|wikidata]
 *   npx tsx scripts/ingest/run.ts images-stats
 *   npx tsx scripts/ingest/run.ts images-update-urls [--apply] [--remote]
 */
import sharp from 'sharp';
import { readFileSync } from 'fs';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getDb } from './db.js';
import { RateLimiter } from './rate-limiter.js';
import { formatElapsed } from './utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const ACCOUNT_ID = '362c458c58efc6b65b7005148383403d';
const BUCKET_NAME = 'guess-images';

// ── Schema ──────────────────────────────────────────────────

export function initImageSchema(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS image_status (
      character_id TEXT PRIMARY KEY,
      source_url   TEXT,
      r2_thumb     TEXT,
      r2_profile   TEXT,
      status       TEXT DEFAULT 'pending' CHECK(status IN ('pending','done','failed','no-source')),
      error        TEXT,
      bytes_thumb  INTEGER DEFAULT 0,
      bytes_profile INTEGER DEFAULT 0,
      created_at   INTEGER DEFAULT (unixepoch()),
      updated_at   INTEGER DEFAULT (unixepoch())
    );
  `);
}

// ── Image sizes ─────────────────────────────────────────────

const SIZES = {
  thumb:   { width: 64,  height: 64,  quality: 75 },
  profile: { width: 256, height: 256, quality: 80 },
} as const;

type SizeName = keyof typeof SIZES;

// ── Helpers ─────────────────────────────────────────────────

async function downloadImage(url: string): Promise<Buffer> {
  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'GuessGame/1.0 (image pipeline)',
      'Accept': 'image/*',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return Buffer.from(await resp.arrayBuffer());
}

async function processImage(
  input: Buffer,
  size: SizeName,
): Promise<Buffer> {
  const { width, height, quality } = SIZES[size];
  return sharp(input)
    .resize(width, height, { fit: 'cover', position: 'top' })
    .webp({ quality })
    .toBuffer();
}

function r2Key(characterId: string, size: SizeName): string {
  return `characters/${characterId}/${size}.webp`;
}

/** Get R2 S3 credentials from environment or .env file */
function getR2Credentials(): { accessKeyId: string; secretAccessKey: string } {
  let accessKeyId = process.env.R2_ACCESS_KEY_ID ?? '';
  let secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? '';

  // Try reading from .env if not in environment
  if (!accessKeyId || !secretAccessKey) {
    try {
      const envFile = readFileSync(join(PROJECT_ROOT, '.env'), 'utf-8');
      const keyMatch = envFile.match(/R2_ACCESS_KEY_ID\s*=\s*(.+)/);
      const secretMatch = envFile.match(/R2_SECRET_ACCESS_KEY\s*=\s*(.+)/);
      if (keyMatch) accessKeyId = keyMatch[1].trim();
      if (secretMatch) secretAccessKey = secretMatch[1].trim();
    } catch {
      // .env doesn't exist
    }
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 S3 credentials not found. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in environment or .env file.\n' +
      'Create at: Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create API Token',
    );
  }
  return { accessKeyId, secretAccessKey };
}

let _s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!_s3Client) {
    const creds = getR2Credentials();
    _s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
    });
  }
  return _s3Client;
}

/** Upload a buffer to R2 via S3-compatible API (10,000 req/s limit) */
async function uploadToR2(
  key: string,
  data: Buffer,
  contentType: string = 'image/webp',
): Promise<void> {
  const client = getS3Client();
  await client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: data,
    ContentType: contentType,
  }));
}

// ── Seed image_status from raw_characters ───────────────────

export function seedImageStatus(): number {
  const db = getDb();
  initImageSchema();

  // Insert canonical characters that aren't already tracked
  const result = db.prepare(`
    INSERT OR IGNORE INTO image_status (character_id, source_url, status)
    SELECT
      r.id,
      r.image_url,
      CASE WHEN r.image_url IS NOT NULL AND r.image_url != '' THEN 'pending' ELSE 'no-source' END
    FROM raw_characters r
    INNER JOIN dedup_map d ON d.raw_id = r.id AND d.canonical_id = r.id
  `).run();

  console.log(`[Images] Seeded ${result.changes} new entries into image_status`);
  return result.changes;
}

// ── Main pipeline ───────────────────────────────────────────

interface ProcessOpts {
  limit?: number;
  concurrency?: number;
  source?: string;
}

interface CharRow {
  character_id: string;
  source_url: string;
}

export async function processImages(opts: ProcessOpts = {}): Promise<void> {
  const { limit, concurrency = 10, source } = opts;
  const db = getDb();
  initImageSchema();
  seedImageStatus();

  // Get pending characters with source URLs
  let query = `
    SELECT s.character_id, s.source_url
    FROM image_status s
    WHERE s.status = 'pending' AND s.source_url IS NOT NULL AND s.source_url != ''
  `;
  if (source) {
    query += ` AND s.character_id IN (SELECT id FROM raw_characters WHERE source = '${source}')`;
  }
  query += ` ORDER BY (SELECT popularity FROM raw_characters WHERE id = s.character_id) DESC`;
  if (limit) query += ` LIMIT ${limit}`;

  const pending = db.prepare(query).all() as CharRow[];
  console.log(`[Images] ${pending.length} images to process (concurrency=${concurrency})`);

  if (pending.length === 0) return;

  // Per-domain rate limiters — Wikimedia is very strict
  const limiters: Record<string, RateLimiter> = {
    'anilist':   new RateLimiter(50, 80, 10_000),   // 80 req/10s
    'wikimedia': new RateLimiter(200, 10, 10_000),  // 10 req/10s (very strict)
    'default':   new RateLimiter(100, 50, 10_000),  // 50 req/10s
  };

  function getLimiter(url: string): RateLimiter {
    if (url.includes('anilist.co')) return limiters['anilist'];
    if (url.includes('wikimedia.org') || url.includes('wikipedia.org')) return limiters['wikimedia'];
    return limiters['default'];
  }

  const startTime = Date.now();

  const markDone = db.prepare(`
    UPDATE image_status
    SET status = 'done', r2_thumb = ?, r2_profile = ?, bytes_thumb = ?, bytes_profile = ?, updated_at = unixepoch()
    WHERE character_id = ?
  `);
  const markFailed = db.prepare(`
    UPDATE image_status
    SET status = 'failed', error = ?, updated_at = unixepoch()
    WHERE character_id = ?
  `);

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let totalBytes = 0;

  // Pool-based concurrency
  let idx = 0;

  async function processOne(row: CharRow): Promise<void> {
    const { character_id, source_url } = row;
    try {
      await getLimiter(source_url).wait();

      // Download source image
      const raw = await downloadImage(source_url);

      // Process both sizes
      const [thumbBuf, profileBuf] = await Promise.all([
        processImage(raw, 'thumb'),
        processImage(raw, 'profile'),
      ]);

      // Upload directly to R2
      const thumbKey = r2Key(character_id, 'thumb');
      const profileKey = r2Key(character_id, 'profile');
      await Promise.all([
        uploadToR2(thumbKey, thumbBuf),
        uploadToR2(profileKey, profileBuf),
      ]);

      // Record success
      markDone.run(thumbKey, profileKey, thumbBuf.length, profileBuf.length, character_id);
      succeeded++;
      totalBytes += thumbBuf.length + profileBuf.length;
    } catch (err) {
      markFailed.run((err as Error).message.slice(0, 200), character_id);
      failed++;
    }

    processed++;
    if (processed % 50 === 0 || processed === pending.length) {
      const elapsed = formatElapsed(Date.now() - startTime);
      const rate = (processed / ((Date.now() - startTime) / 1000)).toFixed(1);
      const mb = (totalBytes / 1024 / 1024).toFixed(1);
      console.log(
        `[Images] ${processed}/${pending.length} (${succeeded} ok, ${failed} fail) | ${rate}/s | ${mb}MB | ${elapsed}`,
      );
    }
  }

  // Run with concurrency pool
  const pool: Promise<void>[] = [];

  function scheduleNext(): void {
    while (pool.length < concurrency && idx < pending.length) {
      const row = pending[idx++];
      const p = processOne(row).then(() => {
        pool.splice(pool.indexOf(p), 1);
        scheduleNext();
      });
      pool.push(p);
    }
  }

  scheduleNext();
  // Wait for all to finish
  while (pool.length > 0) {
    await Promise.race(pool);
  }

  const elapsed = formatElapsed(Date.now() - startTime);
  const mb = (totalBytes / 1024 / 1024).toFixed(1);
  console.log(`\n[Images] Done: ${succeeded} uploaded, ${failed} failed, ${mb}MB total in ${elapsed}`);
}

// ── Stats ───────────────────────────────────────────────────

export function showImageStats(): void {
  const db = getDb();
  initImageSchema();
  seedImageStatus();

  const stats = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM image_status
    GROUP BY status
    ORDER BY count DESC
  `).all() as { status: string; count: number }[];

  const total = stats.reduce((s, r) => s + r.count, 0);
  const bytes = db.prepare(`
    SELECT COALESCE(SUM(bytes_thumb + bytes_profile), 0) as total_bytes
    FROM image_status WHERE status = 'done'
  `).get() as { total_bytes: number };

  console.log('\n=== Image Stats ===');
  console.log(`  Total characters: ${total.toLocaleString()}`);
  for (const { status, count } of stats) {
    const pct = ((count / total) * 100).toFixed(1);
    console.log(`  ${status.padEnd(12)} ${count.toLocaleString().padStart(8)} (${pct}%)`);
  }
  console.log(`  Storage:      ${(bytes.total_bytes / 1024 / 1024).toFixed(1)}MB`);
}

// ── Generate URL update SQL ─────────────────────────────────

function escapeSQL(s: string | null): string {
  if (s === null) return 'NULL';
  return `'${s.replace(/'/g, "''")}'`;
}

export function generateImageUrlSQL(opts: {
  outputFile?: string;
  r2PublicUrl?: string;
} = {}): string {
  const {
    outputFile = 'migrations/0007_image_urls.sql',
    r2PublicUrl = '/api/images',
  } = opts;
  const db = getDb();

  const rows = db.prepare(`
    SELECT character_id, r2_profile
    FROM image_status
    WHERE status = 'done' AND r2_profile IS NOT NULL
  `).all() as { character_id: string; r2_profile: string }[];

  console.log(`[Images] Generating URL update SQL for ${rows.length} characters...`);

  const lines: string[] = [
    '-- Auto-generated: update character image_url to R2-hosted images',
    `-- Generated at ${new Date().toISOString()}`,
    '',
  ];

  // D1 doesn't support BEGIN/COMMIT — just emit flat UPDATE statements
  for (const { character_id, r2_profile } of rows) {
    // r2_profile is like "characters/anilist-1234/profile.webp"
    // The Pages endpoint serves at /api/images/{characterId}/{size}.webp
    const path = r2_profile.replace(/^characters\//, '');
    const url = `${r2PublicUrl}/${path}`;
    lines.push(
      `UPDATE characters SET image_url = ${escapeSQL(url)} WHERE id = ${escapeSQL(character_id)};`,
    );
  }

  const sql = lines.join('\n');
  const fullPath = join(PROJECT_ROOT, outputFile);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, sql);
  console.log(`[Images] Wrote ${fullPath} (${rows.length} updates, ${(sql.length / 1024).toFixed(0)}KB)`);
  return sql;
}

// ── Retry failed ────────────────────────────────────────────

export function retryFailedImages(): void {
  const db = getDb();
  const result = db.prepare(`
    UPDATE image_status SET status = 'pending', error = NULL, updated_at = unixepoch()
    WHERE status = 'failed'
  `).run();
  console.log(`[Images] Reset ${result.changes} failed entries to pending`);
}
