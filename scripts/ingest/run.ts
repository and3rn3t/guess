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
import { writeFileSync } from 'fs';
import { closeDb } from './db.js';
import { showStats } from './upload.js';
import { runDedup } from './dedup.js';
import { generateUploadSQL, applyToD1 } from './upload.js';
import { formatElapsed } from './utils.js';
import { runEnrichment, showEnrichStats, generateEnrichUploadSQL, retryFailed, generateDisputeUploadSQL } from './enrich.js';
import { processImages, showImageStats, generateImageUrlSQL, retryFailedImages } from './images.js';
import { runSourceOverlap } from './source-overlap.js';
import { runDiscoverAttributes } from './discover-attributes.js';
import type { Category } from './types.js';

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

// ===== Arg-parsing helpers =====

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

function getFlagValue(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

function getIntFlag(argv: string[], flag: string): number | undefined {
  const val = getFlagValue(argv, flag);
  return val !== undefined ? parseInt(val, 10) : undefined;
}

function getFloatFlag(argv: string[], flag: string): number | undefined {
  const val = getFlagValue(argv, flag);
  return val !== undefined ? parseFloat(val) : undefined;
}

function getEnv(argv: string[]): 'production' | 'preview' {
  return (argv.find(a => a === 'production' || a === 'preview') ?? 'production') as 'production' | 'preview';
}

// ===== Action dispatch table =====

type ActionHandler = (argv: string[], param: number | undefined) => Promise<void> | void;

const ACTIONS: Record<string, ActionHandler> = {
  stats: () => showStats(),

  dedup: async () => {
    await runDedup();
    showStats();
  },

  upload: async (argv) => {
    const args = argv.slice(3).filter(a => !isNaN(parseFloat(a)));
    const minPop = parseFloat(args[0] ?? '0');
    const limit = parseInt(args[1] ?? '0');
    await generateUploadSQL({ minPopularity: minPop, limit, outputFile: 'migrations/0005_ingest_characters.sql' });
  },

  apply: async (argv) => {
    await applyToD1('migrations/0005_ingest_characters.sql', getEnv(argv), hasFlag(argv, '--remote'));
  },

  enrich: async (argv, param) => {
    await runEnrichment({
      batchSize: param ?? 5,
      concurrency: getIntFlag(argv, '--concurrency'),
      limit: getIntFlag(argv, '--limit'),
      category: getFlagValue(argv, '--category') as Category | undefined,
      minPopularity: getFloatFlag(argv, '--min-pop'),
      dryRun: hasFlag(argv, '--dry-run'),
      newAttrsOnly: hasFlag(argv, '--new-attrs-only'),
      model2: getFlagValue(argv, '--model2'),
      validate: hasFlag(argv, '--validate'),
    });
  },

  'enrich-stats': () => showEnrichStats(),

  'enrich-upload': async (argv) => {
    const outputFile = 'migrations/0006_character_attributes.sql';
    generateEnrichUploadSQL({ outputFile });
    if (hasFlag(argv, '--apply')) {
      await applyToD1(outputFile, getEnv(argv), hasFlag(argv, '--remote'));
    }
  },

  'disputes-upload': async (argv) => {
    const disputeLimit = getIntFlag(argv, '--limit') ?? 1000;
    const sql = generateDisputeUploadSQL(disputeLimit);
    const outputFile = 'migrations/0026b_dispute_upload.sql';
    writeFileSync(outputFile, sql);
    console.log(`Wrote ${outputFile}`);
    if (hasFlag(argv, '--apply')) {
      await applyToD1(outputFile, getEnv(argv), hasFlag(argv, '--remote'));
    }
  },

  'enrich-retry': async (argv, param) => {
    await retryFailed({ batchSize: param ?? 5, concurrency: getIntFlag(argv, '--concurrency') });
  },

  images: async (argv) => {
    await processImages({
      limit: getIntFlag(argv, '--limit'),
      concurrency: getIntFlag(argv, '--concurrency'),
      source: getFlagValue(argv, '--source'),
    });
  },

  'images-stats': () => showImageStats(),

  'images-update-urls': async (argv) => {
    generateImageUrlSQL({ r2PublicUrl: getFlagValue(argv, '--r2-url') });
    if (hasFlag(argv, '--apply')) {
      await applyToD1('migrations/0007_image_urls.sql', getEnv(argv), hasFlag(argv, '--remote'));
    }
  },

  'images-retry': () => retryFailedImages(),

  'source-overlap': async () => {
    await runSourceOverlap();
  },

  'discover-attrs': async (argv) => {
    await runDiscoverAttributes({
      sampleSize: getIntFlag(argv, '--sample') ?? 50,
      limit: getIntFlag(argv, '--limit') ?? 50,
      dryRun: hasFlag(argv, '--dry-run'),
      apply: hasFlag(argv, '--apply'),
    });
  },

  all: async (_argv, param) => {
    await runAll(param);
  },
};

function printUsage(): void {
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
  apply [env] [--remote]    Apply migration SQL to D1
  enrich [batchSize]        AI attribute enrichment (needs OPENAI_API_KEY)
  enrich-stats              Show enrichment progress
  enrich-upload [--apply]   Generate + optionally apply attribute SQL to D1
  disputes-upload [--apply] Upload staging disputes to D1 attribute_disputes table
  enrich-retry [batchSize]  Retry failed enrichments
  source-overlap            Generate source overlap heatmap (data/overlap.html)
  discover-attrs            AI-discover new attribute candidates (needs OPENAI_API_KEY)
  images                    Download, resize, upload images to R2
  images-stats              Show image pipeline progress
  images-update-urls        Generate SQL to update D1 image_url to R2
  images-retry              Reset failed images to pending
  stats                     Show staging DB statistics

Enrich options:
  --limit N                 Max characters to process
  --concurrency N           Parallel API calls (default: 10)
  --category <cat>          Only enrich specific category
  --min-pop <float>         Minimum popularity (0-1)
  --new-attrs-only          Only process chars missing attrs (new attribute scenario)
  --model2 <model>          Second model via OpenRouter for consensus voting (needs OPENROUTER_API_KEY)
  --validate                Run adversarial skeptic validation after enrichment
  --dry-run                 Preview without calling LLM

Discover-attrs options:
  --sample N                Characters to sample per call (default: 50)
  --limit N                 Max new candidates to propose (default: 50)
  --dry-run                 Print candidates without submitting
  --apply                   Submit to D1 via admin API (needs ADMIN_URL + ADMIN_BASIC_AUTH)

Image options:
  --limit N                 Max images to process
  --concurrency N           Parallel downloads (default: 5)
  --source <src>            Only process images from specific source
  --r2-url <url>            R2 public URL base (for images-update-urls)
  --apply [--remote]        Apply SQL to D1 (for images-update-urls)
  `);
}

async function main() {
  const argv = process.argv;
  const action = argv[2] ?? 'stats';
  const param = parseInt(argv[3] ?? '0') || undefined;

  try {
    if (action in ACTIONS) {
      await ACTIONS[action](argv, param);
    } else if (action in SOURCES) {
      await runSource(action as SourceName, param);
    } else {
      printUsage();
    }
  } finally {
    closeDb();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
