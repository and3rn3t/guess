/**
 * Main ingestion orchestrator.
 * Run: npx tsx scripts/ingest/run.ts [source|all|stats]
 *
 * Examples:
 *   npx tsx scripts/ingest/run.ts anilist       # Ingest from AniList only
 *   npx tsx scripts/ingest/run.ts anilist 5     # AniList, max 5 pages
 *   npx tsx scripts/ingest/run.ts all           # All sources sequentially
 *   npx tsx scripts/ingest/run.ts stats         # Show staging DB stats
 *   npx tsx scripts/ingest/run.ts dedup         # Run deduplication
 *   npx tsx scripts/ingest/run.ts upload        # Generate D1 migration SQL
 */
import { closeDb } from './db.js';
import { showStats } from './upload.js';
import { runDedup } from './dedup.js';
import { generateUploadSQL, applyToD1 } from './upload.js';
import { formatElapsed } from './utils.js';

import { ingestAniList } from './sources/anilist.js';
import { ingestTmdb } from './sources/tmdb.js';
import { ingestIgdb } from './sources/igdb.js';
import { ingestComicVine } from './sources/comicvine.js';
import { ingestWikidata, ingestWikidataVideoGames } from './sources/wikidata.js';

const SOURCES = {
  anilist: (max?: number) => ingestAniList({ maxPages: max, minFavourites: 10 }),
  tmdb: (max?: number) => ingestTmdb({ maxPages: max || 100 }),
  igdb: (max?: number) => ingestIgdb({ limit: max || 10000 }),
  comicvine: (max?: number) => ingestComicVine({ limit: max || 20000 }),
  wikidata: (max?: number) => ingestWikidata({ maxPerType: max || 5000 }),
  'wikidata-vg': (max?: number) => ingestWikidataVideoGames({ max: max || 10000 }),
} as const;

type SourceName = keyof typeof SOURCES;

async function runSource(name: SourceName, maxParam?: number) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Starting ${name} ingestion...`);
  console.log('='.repeat(60));
  const stats = await SOURCES[name](maxParam);
  console.log(`\n${name} result:`, JSON.stringify(stats, null, 2));
  return stats;
}

async function runAll(maxParam?: number) {
  const startTime = Date.now();
  const results: Record<string, unknown> = {};

  // Run in order: AniList (free) → TMDb → IGDB → Comic Vine → Wikidata
  for (const name of ['anilist', 'tmdb', 'igdb', 'comicvine', 'wikidata'] as SourceName[]) {
    try {
      results[name] = await runSource(name, maxParam);
    } catch (err) {
      console.error(`[${name}] FAILED:`, (err as Error).message);
      results[name] = { error: (err as Error).message };
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`All sources complete in ${formatElapsed(Date.now() - startTime)}`);
  console.log('='.repeat(60));
  showStats();
  return results;
}

async function main() {
  const action = process.argv[2] ?? 'stats';
  const param = parseInt(process.argv[3] ?? '0') || undefined;

  try {
    if (action === 'stats') {
      showStats();
    } else if (action === 'dedup') {
      await runDedup();
      showStats();
    } else if (action === 'upload') {
      // Skip non-numeric args (e.g. 'generate')
      const args = process.argv.slice(3).filter(a => !isNaN(parseFloat(a)));
      const minPop = parseFloat(args[0] ?? '0');
      const limit = parseInt(args[1] ?? '0');
      await generateUploadSQL({ minPopularity: minPop, limit, outputFile: 'migrations/0005_ingest_characters.sql' });
    } else if (action === 'apply') {
      const remote = process.argv.includes('--remote');
      const envArg = process.argv.find(a => a === 'production' || a === 'preview');
      const env = (envArg ?? 'production') as 'production' | 'preview';
      await applyToD1('migrations/0005_ingest_characters.sql', env, remote);
    } else if (action === 'all') {
      await runAll(param);
    } else if (action in SOURCES) {
      await runSource(action as SourceName, param);
    } else {
      console.log(`
Usage: npx tsx scripts/ingest/run.ts <command> [options]

Commands:
  anilist [maxPages]        Ingest from AniList (free, no key needed)
  tmdb [maxPages]           Ingest from TMDb (needs TMDB_API_KEY)
  igdb [limit]              Ingest from IGDB (needs IGDB_CLIENT_ID + SECRET)
  comicvine [limit]         Ingest from Comic Vine (needs COMIC_VINE_API_KEY)
  wikidata [maxResults]     Ingest from Wikidata (free, no key needed)
  all [maxParam]            Run all sources sequentially
  dedup                     Run cross-source deduplication
  upload [minPop] [limit]   Generate D1 migration SQL from staging DB
  stats                     Show staging DB statistics
      `);
    }
  } finally {
    closeDb();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
