/**
 * DQ.21 — Schema drift detector.
 *
 * Catches the "I added an attribute but forgot to update the other half of the
 * pipeline" failure mode. The canonical attribute schema is
 * `data/enrich-cache/attribute_definitions.json` (mirror of the D1
 * `attribute_definitions` table). This script asserts that everywhere else
 * that names attributes stays in lockstep:
 *
 *   1. Schema file shape: every entry has `key` (camelCase), non-empty
 *      `displayText`, and `categories` is null or an array of valid Category
 *      union members.
 *   2. No duplicate keys in the schema.
 *   3. Every key declared by `INSERT INTO attribute_definitions` in
 *      `migrations/*.sql` exists in the schema, and every schema key has at
 *      least one migration that declares it.
 *   4. Every key asserted in `data/data-quality-golden.json` `expected` blocks
 *      exists in the schema.
 *   5. Every key in the `VISION_TARGET_ATTRS` literal array of
 *      `scripts/vision-validate.ts` exists in the schema.
 *
 * No network. Safe to run on every PR.
 *
 * Exit codes:
 *   0 — no drift
 *   1 — drift detected (details printed to stderr)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const SCHEMA_PATH = path.join(REPO_ROOT, 'data', 'enrich-cache', 'attribute_definitions.json');
const GOLDEN_PATH = path.join(REPO_ROOT, 'data', 'data-quality-golden.json');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'migrations');
const VISION_SCRIPT = path.join(REPO_ROOT, 'scripts', 'vision-validate.ts');

/** Keep in sync with `Category` in `scripts/ingest/types.ts`. */
const VALID_CATEGORIES = new Set([
  'video-games',
  'movies',
  'anime',
  'comics',
  'books',
  'cartoons',
  'tv-shows',
  'pop-culture',
]);

interface AttrDef {
  key: string;
  displayText: string;
  /** Mirror of the D1 `categories` TEXT column: a JSON-encoded string array, null, or (rare) a parsed array. */
  categories: string | string[] | null;
}

interface GoldenSet {
  characters: Array<{ id: string; expected: Record<string, boolean> }>;
}

const errors: string[] = [];
const warnings: string[] = [];

function err(msg: string): void {
  errors.push(msg);
}
function warn(msg: string): void {
  warnings.push(msg);
}

function loadSchema(): AttrDef[] {
  if (!existsSync(SCHEMA_PATH)) {
    err(`Schema file missing: ${SCHEMA_PATH}`);
    return [];
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
  } catch (e) {
    err(`Schema file is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
  if (!Array.isArray(raw)) {
    err(`Schema file root must be an array; got ${typeof raw}`);
    return [];
  }
  return raw as AttrDef[];
}

const CAMEL_KEY = /^[a-z][a-zA-Z0-9]*$/;

function checkSchemaShape(schema: AttrDef[]): { keys: Set<string> } {
  const keys = new Set<string>();
  const dupes = new Set<string>();
  for (const [i, def] of schema.entries()) {
    if (typeof def.key !== 'string' || !CAMEL_KEY.test(def.key)) {
      err(`Schema entry #${i}: invalid key ${JSON.stringify(def.key)} (must be camelCase)`);
      continue;
    }
    if (keys.has(def.key)) dupes.add(def.key);
    keys.add(def.key);
    if (typeof def.displayText !== 'string' || def.displayText.trim().length === 0) {
      err(`Schema entry "${def.key}": displayText is empty or non-string`);
    }
    if (def.categories === null || def.categories === undefined) {
      // null = applies to all categories — OK
    } else {
      let cats: unknown = def.categories;
      if (typeof cats === 'string') {
        try {
          cats = JSON.parse(cats);
        } catch {
          err(`Schema entry "${def.key}": categories is a string but not valid JSON: ${JSON.stringify(def.categories)}`);
          continue;
        }
      }
      if (!Array.isArray(cats)) {
        err(`Schema entry "${def.key}": categories must be null, a JSON array string, or an array (got ${typeof cats})`);
        continue;
      }
      for (const c of cats) {
        if (typeof c !== 'string' || !VALID_CATEGORIES.has(c)) {
          err(`Schema entry "${def.key}": unknown category ${JSON.stringify(c)}`);
        }
      }
    }
  }
  for (const d of dupes) err(`Duplicate schema key: "${d}"`);
  return { keys };
}

function readMigrationKeys(): { keys: Set<string>; perFile: Map<string, Set<string>> } {
  const keys = new Set<string>();
  const perFile = new Map<string, Set<string>>();
  if (!existsSync(MIGRATIONS_DIR)) {
    err(`Migrations directory missing: ${MIGRATIONS_DIR}`);
    return { keys, perFile };
  }
  // Match: INSERT INTO attribute_definitions (key, ...) VALUES ('someKey', ...
  // Be permissive about whitespace and column count.
  const insertRe = /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+attribute_definitions[^;]*?VALUES\s*\(\s*'([a-zA-Z0-9_]+)'/gi;
  for (const file of readdirSync(MIGRATIONS_DIR)) {
    if (!file.endsWith('.sql')) continue;
    const full = path.join(MIGRATIONS_DIR, file);
    const text = readFileSync(full, 'utf-8');
    const fileKeys = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = insertRe.exec(text)) !== null) {
      fileKeys.add(m[1]);
      keys.add(m[1]);
    }
    if (fileKeys.size > 0) perFile.set(file, fileKeys);
  }
  return { keys, perFile };
}

function loadGoldenKeys(): Set<string> {
  const keys = new Set<string>();
  if (!existsSync(GOLDEN_PATH)) {
    warn(`Golden set missing — skipping golden-vs-schema check: ${GOLDEN_PATH}`);
    return keys;
  }
  const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf-8')) as GoldenSet;
  if (!Array.isArray(golden.characters)) return keys;
  for (const c of golden.characters) {
    if (!c.expected || typeof c.expected !== 'object') continue;
    for (const k of Object.keys(c.expected)) keys.add(k);
  }
  return keys;
}

function loadVisionTargetKeys(): Set<string> {
  const keys = new Set<string>();
  if (!existsSync(VISION_SCRIPT)) {
    warn(`Vision script missing — skipping vision-vs-schema check: ${VISION_SCRIPT}`);
    return keys;
  }
  const text = readFileSync(VISION_SCRIPT, 'utf-8');
  const m = text.match(/VISION_TARGET_ATTRS\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
  if (!m) {
    warn('Could not locate VISION_TARGET_ATTRS literal in scripts/vision-validate.ts');
    return keys;
  }
  for (const lit of m[1].matchAll(/'([a-zA-Z0-9_]+)'/g)) keys.add(lit[1]);
  return keys;
}

function diff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => !b.has(x)).sort();
}

function main(): void {
  const schema = loadSchema();
  const { keys: schemaKeys } = checkSchemaShape(schema);

  const { keys: migrationKeys, perFile } = readMigrationKeys();
  const golden = loadGoldenKeys();
  const vision = loadVisionTargetKeys();

  // Migration vs schema
  const inMigNotSchema = diff(migrationKeys, schemaKeys);
  for (const k of inMigNotSchema) {
    const declaredIn = [...perFile.entries()].filter(([, ks]) => ks.has(k)).map(([f]) => f).join(', ');
    err(`Migration declares attribute "${k}" but it is not in the schema cache (declared in: ${declaredIn})`);
  }
  const inSchemaNotMig = diff(schemaKeys, migrationKeys);
  for (const k of inSchemaNotMig) {
    err(`Schema has attribute "${k}" but no migration declares it via INSERT INTO attribute_definitions`);
  }

  // Golden vs schema
  for (const k of diff(golden, schemaKeys)) {
    err(`Golden set asserts attribute "${k}" but it is not in the schema cache`);
  }

  // Vision targets vs schema
  for (const k of diff(vision, schemaKeys)) {
    err(`Vision target attribute "${k}" is not in the schema cache`);
  }

  // Summary
  console.log('Schema drift report');
  console.log('───────────────────');
  console.log(`Schema attributes      : ${schemaKeys.size}`);
  console.log(`Migration declarations : ${migrationKeys.size}  (across ${perFile.size} migration files)`);
  console.log(`Golden expected keys   : ${golden.size}`);
  console.log(`Vision target keys     : ${vision.size}`);

  if (warnings.length > 0) {
    console.log('');
    console.log(`⚠ ${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (errors.length > 0) {
    console.error('');
    console.error(`✗ ${errors.length} drift error(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log('');
  console.log('✓ No schema drift.');
}

main();
