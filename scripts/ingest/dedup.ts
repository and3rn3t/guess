/**
 * Deduplication pipeline for cross-source character merging.
 *
 * Strategy:
 * 1. Exact name match (case-insensitive, normalized)
 * 2. Within same category, fuzzy match (Levenshtein distance ≤ 2)
 * 3. Source priority: tmdb > anilist > igdb > wikidata (richer data wins)
 * 4. Merge metadata; keep highest popularity score
 */
import { getDb } from './db.js';
import { formatElapsed, ProgressLogger } from './utils.js';

const SOURCE_PRIORITY: Record<string, number> = {
  tmdb: 1,
  anilist: 2,
  igdb: 3,
  comicvine: 4,
  wikidata: 5,
};

/** Normalize a name for exact-match comparison. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/^(the|a|an)\s+/i, '') // strip leading articles
    .replace(/\s*\(.*?\)\s*/g, '')  // strip parenthetical info
    .replace(/[^a-z0-9\s]/g, '')    // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Optimization: skip if length difference is too big
  if (Math.abs(a.length - b.length) > 3) return Math.abs(a.length - b.length);

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

interface RawRow {
  id: string;
  name: string;
  category: string;
  source: string;
  popularity: number;
}

export async function runDedup(): Promise<{ groups: number; merged: number; elapsed: number }> {
  const startTime = Date.now();
  const db = getDb();

  console.log('[Dedup] Loading all characters from staging DB...');
  const allChars = db.prepare(
    'SELECT id, name, category, source, popularity FROM raw_characters ORDER BY popularity DESC'
  ).all() as RawRow[];

  console.log(`[Dedup] ${allChars.length} characters to deduplicate`);

  // Step 1: Group by normalized name + category (exact match)
  const groups = new Map<string, RawRow[]>();
  for (const char of allChars) {
    const key = `${normalizeName(char.name)}::${char.category}`;
    const group = groups.get(key);
    if (group) {
      group.push(char);
    } else {
      groups.set(key, [char]);
    }
  }

  const exactDupes = [...groups.values()].filter(g => g.length > 1).length;
  console.log(`[Dedup] Exact-match groups with duplicates: ${exactDupes}`);

  // Step 2: Within each category, fuzzy match across groups
  const progress = new ProgressLogger('Dedup-fuzzy', 1000);
  const categoryGroups = new Map<string, Map<string, RawRow[]>>();

  for (const [key, rows] of groups) {
    const cat = key.split('::')[1];
    if (!categoryGroups.has(cat)) categoryGroups.set(cat, new Map());
    categoryGroups.get(cat)!.set(key, rows);
  }

  // Merge groups that are fuzzy-similar using blocking (first 3 chars)
  let fuzzyMerges = 0;
  for (const [_cat, catMap] of categoryGroups) {
    // Build blocks: group keys by first 3 chars of normalized name
    const blocks = new Map<string, string[]>();
    for (const key of catMap.keys()) {
      const name = key.split('::')[0];
      if (name.length <= 3 || name.length > 20) continue;
      const prefix = name.slice(0, 3);
      const block = blocks.get(prefix);
      if (block) block.push(key);
      else blocks.set(prefix, [key]);
    }

    // Only compare within each block (O(n²) per block, but blocks are small)
    for (const blockKeys of blocks.values()) {
      if (blockKeys.length < 2) continue;
      for (let i = 0; i < blockKeys.length; i++) {
        if (!catMap.has(blockKeys[i])) continue;
        const nameA = blockKeys[i].split('::')[0];

        for (let j = i + 1; j < blockKeys.length; j++) {
          if (!catMap.has(blockKeys[j])) continue;
          const nameB = blockKeys[j].split('::')[0];

          if (levenshtein(nameA, nameB) <= 2) {
            const groupA = catMap.get(blockKeys[i])!;
            const groupB = catMap.get(blockKeys[j]);
            if (groupB) {
              groupA.push(...groupB);
              catMap.delete(blockKeys[j]);
              fuzzyMerges++;
            }
          }
        }
      }
      progress.tick();
    }
  }

  console.log(`[Dedup] Fuzzy merges: ${fuzzyMerges}`);

  // Step 3: For each group, select canonical (highest priority source + popularity)
  const insertStmt = db.prepare(
    'INSERT OR REPLACE INTO dedup_map (raw_id, canonical_id) VALUES (?, ?)'
  );

  db.exec('DELETE FROM dedup_map'); // reset

  let totalGroups = 0;
  let totalMerged = 0;

  const writeMerges = db.transaction(() => {
    for (const catMap of categoryGroups.values()) {
      for (const group of catMap.values()) {
        if (group.length <= 1) {
          // No duplicates — map to self
          insertStmt.run(group[0].id, group[0].id);
          totalGroups++;
          continue;
        }

        // Pick canonical: best source priority, then highest popularity
        group.sort((a, b) => {
          const pa = SOURCE_PRIORITY[a.source] ?? 99;
          const pb = SOURCE_PRIORITY[b.source] ?? 99;
          if (pa !== pb) return pa - pb;
          return b.popularity - a.popularity;
        });

        const canonical = group[0];
        for (const char of group) {
          insertStmt.run(char.id, canonical.id);
        }

        totalGroups++;
        totalMerged += group.length - 1;
      }
    }
  });

  writeMerges();

  const elapsed = Date.now() - startTime;
  console.log(`[Dedup] Complete: ${totalGroups} unique characters, ${totalMerged} duplicates merged in ${formatElapsed(elapsed)}`);

  return { groups: totalGroups, merged: totalMerged, elapsed };
}

// CLI entry point
if (process.argv[1]?.endsWith('dedup.ts') || process.argv[1]?.endsWith('dedup.js')) {
  runDedup()
    .then(result => {
      console.log('\nDedup result:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
