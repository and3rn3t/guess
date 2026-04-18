import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RawCharacter } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'staging.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure data/ directory exists
  const dir = path.dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS raw_characters (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      source      TEXT NOT NULL,
      source_id   TEXT NOT NULL,
      popularity  REAL DEFAULT 0,
      image_url   TEXT,
      description TEXT,
      meta        TEXT DEFAULT '{}',
      created_at  INTEGER DEFAULT (unixepoch()),
      UNIQUE(source, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_raw_source ON raw_characters(source);
    CREATE INDEX IF NOT EXISTS idx_raw_category ON raw_characters(category);
    CREATE INDEX IF NOT EXISTS idx_raw_popularity ON raw_characters(popularity DESC);
    CREATE INDEX IF NOT EXISTS idx_raw_name ON raw_characters(name COLLATE NOCASE);

    -- Dedup results: maps duplicate IDs to a canonical ID
    CREATE TABLE IF NOT EXISTS dedup_map (
      raw_id       TEXT PRIMARY KEY REFERENCES raw_characters(id),
      canonical_id TEXT NOT NULL REFERENCES raw_characters(id)
    );

    -- Track ingestion runs
    CREATE TABLE IF NOT EXISTS ingest_log (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      source    TEXT NOT NULL,
      fetched   INTEGER DEFAULT 0,
      inserted  INTEGER DEFAULT 0,
      duplicates INTEGER DEFAULT 0,
      errors    INTEGER DEFAULT 0,
      elapsed   INTEGER DEFAULT 0,
      run_at    INTEGER DEFAULT (unixepoch())
    );
  `);
}

/** Insert a batch of raw characters, skipping duplicates on (source, source_id). */
export function insertRawCharacters(chars: RawCharacter[]): { inserted: number; skipped: number } {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO raw_characters (id, name, category, source, source_id, popularity, image_url, description, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  const insertMany = db.transaction((batch: RawCharacter[]) => {
    for (const c of batch) {
      const result = stmt.run(
        c.id,
        c.name,
        c.category,
        c.source,
        c.sourceId,
        c.popularity,
        c.imageUrl,
        c.description,
        JSON.stringify(c.meta)
      );
      if (result.changes > 0) inserted++;
    }
  });

  insertMany(chars);
  return { inserted, skipped: chars.length - inserted };
}

/** Log an ingestion run. */
export function logIngestRun(stats: { source: string; fetched: number; inserted: number; duplicates: number; errors: number; elapsed: number }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO ingest_log (source, fetched, inserted, duplicates, errors, elapsed)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(stats.source, stats.fetched, stats.inserted, stats.duplicates, stats.errors, stats.elapsed);
}

/** Get total counts from staging DB. */
export function getStagingStats(): Record<string, number> {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM raw_characters').get() as { c: number }).c;
  const bySource = db.prepare('SELECT source, COUNT(*) as c FROM raw_characters GROUP BY source').all() as { source: string; c: number }[];
  const byCategory = db.prepare('SELECT category, COUNT(*) as c FROM raw_characters GROUP BY category').all() as { source: string; c: number }[];

  const result: Record<string, number> = { total };
  for (const row of bySource) result[`source:${row.source}`] = row.c;
  for (const row of byCategory) result[`category:${(row as unknown as { category: string }).category}`] = row.c;
  return result;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
