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
    } else if (action === 'enrich') {
      const batchSize = param ?? 5;
      const limit = process.argv.includes('--limit')
        ? parseInt(process.argv[process.argv.indexOf('--limit') + 1])
        : undefined;
      const concurrency = process.argv.includes('--concurrency')
        ? parseInt(process.argv[process.argv.indexOf('--concurrency') + 1])
        : undefined;
      const catIdx = process.argv.indexOf('--category');
      const category = catIdx >= 0 ? process.argv[catIdx + 1] as Category : undefined;
      const minPop = process.argv.includes('--min-pop')
        ? parseFloat(process.argv[process.argv.indexOf('--min-pop') + 1])
        : undefined;
      const dryRun = process.argv.includes('--dry-run');
      const newAttrsOnly = process.argv.includes('--new-attrs-only');
      const validate = process.argv.includes('--validate');
      const model2Idx = process.argv.indexOf('--model2');
      const model2 = model2Idx >= 0 ? process.argv[model2Idx + 1] : undefined;
      await runEnrichment({ batchSize, concurrency, limit, category, minPopularity: minPop, dryRun, newAttrsOnly, model2, validate });
    } else if (action === 'enrich-stats') {
      showEnrichStats();
    } else if (action === 'enrich-upload') {
      const outputFile = 'migrations/0006_character_attributes.sql';
      generateEnrichUploadSQL({ outputFile });
      if (process.argv.includes('--apply')) {
        const remote = process.argv.includes('--remote');
        const envArg = process.argv.find(a => a === 'production' || a === 'preview');
        const env = (envArg ?? 'production') as 'production' | 'preview';
        await applyToD1(outputFile, env, remote);
      }
    } else if (action === 'disputes-upload') {
      const disputeLimit = process.argv.includes('--limit')
        ? parseInt(process.argv[process.argv.indexOf('--limit') + 1], 10)
        : 1000;
      const sql = generateDisputeUploadSQL(disputeLimit);
      const outputFile = 'migrations/0026b_dispute_upload.sql';
      writeFileSync(outputFile, sql);
      console.log(`Wrote ${outputFile}`);
      if (process.argv.includes('--apply')) {
        const remote = process.argv.includes('--remote');
        const envArg = process.argv.find(a => a === 'production' || a === 'preview');
        const env = (envArg ?? 'production') as 'production' | 'preview';
        await applyToD1(outputFile, env, remote);
      }
    } else if (action === 'enrich-retry') {
      const batchSize = param ?? 5;
      const concurrency = process.argv.includes('--concurrency')
        ? parseInt(process.argv[process.argv.indexOf('--concurrency') + 1])
        : undefined;
      await retryFailed({ batchSize, concurrency });
    } else if (action === 'images') {
      const limit = process.argv.includes('--limit')
        ? parseInt(process.argv[process.argv.indexOf('--limit') + 1])
        : undefined;
      const concurrency = process.argv.includes('--concurrency')
        ? parseInt(process.argv[process.argv.indexOf('--concurrency') + 1])
        : undefined;
      const sourceIdx = process.argv.indexOf('--source');
      const source = sourceIdx >= 0 ? process.argv[sourceIdx + 1] : undefined;
      await processImages({ limit, concurrency, source });
    } else if (action === 'images-stats') {
      showImageStats();
    } else if (action === 'images-update-urls') {
      const r2Url = process.argv.includes('--r2-url')
        ? process.argv[process.argv.indexOf('--r2-url') + 1]
        : undefined;
      generateImageUrlSQL({ r2PublicUrl: r2Url });
      if (process.argv.includes('--apply')) {
        const remote = process.argv.includes('--remote');
        const envArg = process.argv.find(a => a === 'production' || a === 'preview');
        const env = (envArg ?? 'production') as 'production' | 'preview';
        await applyToD1('migrations/0007_image_urls.sql', env, remote);
      }
    } else if (action === 'images-retry') {
      retryFailedImages();
    } else if (action === 'source-overlap') {
      await runSourceOverlap();
    } else if (action === 'discover-attrs') {
      const sampleIdx = process.argv.indexOf('--sample');
      const sampleSize = sampleIdx >= 0 ? parseInt(process.argv[sampleIdx + 1], 10) : 50;
      const limitIdx = process.argv.indexOf('--limit');
      const discoverLimit = limitIdx >= 0 ? parseInt(process.argv[limitIdx + 1], 10) : 50;
      const dryRun = process.argv.includes('--dry-run');
      const apply = process.argv.includes('--apply');
      await runDiscoverAttributes({ sampleSize, limit: discoverLimit, dryRun, apply });
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
  } finally {
    closeDb();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
