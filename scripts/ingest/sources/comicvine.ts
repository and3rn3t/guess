/**
 * Comic Vine source adapter.
 * API key required (free tier: 200 req/15min, but effectively ~1/s).
 * Fetches comic book characters.
 */
import type { RawCharacter, IngestStats } from '../types.js';
import { insertRawCharacters, logIngestRun } from '../db.js';
import { getConfig } from '../config.js';
import { RateLimiter, withRetry } from '../rate-limiter.js';
import { makeId, truncateDesc, normalizePopularity, ProgressLogger, formatElapsed } from '../utils.js';

const CV_BASE = 'https://comicvine.gamespot.com/api';

// Comic Vine: ~200 req per 15 min ≈ ~1 req/4.5s (be conservative)
const limiter = new RateLimiter(5000);

interface CvCharacter {
  id: number;
  name: string;
  real_name: string | null;
  deck: string | null;
  description: string | null;
  image: { small_url: string; medium_url: string } | null;
  publisher: { name: string } | null;
  count_of_issue_appearances: number;
  aliases: string | null;
  gender: number; // 1=male, 2=female, 0=other
}

async function cvFetch<T>(resource: string, params: Record<string, string> = {}): Promise<T> {
  const config = getConfig();
  if (!config.comicVineApiKey) throw new Error('COMIC_VINE_API_KEY not set in .env.local');

  await limiter.wait();

  const url = new URL(`${CV_BASE}/${resource}/`);
  url.searchParams.set('api_key', config.comicVineApiKey);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  return withRetry(async () => {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'GuessGame/1.0 (character-ingestion)' },
    });

    if (res.status === 429) {
      throw new Error('Comic Vine rate limited');
    }
    if (!res.ok) throw new Error(`Comic Vine ${res.status}: ${await res.text()}`);

    const data = await res.json() as { status_code: number; results: T; error: string };
    if (data.status_code !== 1) throw new Error(`Comic Vine error: ${data.error}`);
    return data.results;
  }, 3, 10_000);
}

function toRawCharacter(char: CvCharacter, maxAppearances: number): RawCharacter {
  // Clean HTML from description
  const cleanDesc = char.deck || (char.description
    ? char.description.replace(/<[^>]+>/g, '').slice(0, 500)
    : null);

  return {
    id: makeId('comicvine', String(char.id)),
    name: char.name,
    category: 'comics',
    source: 'comicvine',
    sourceId: String(char.id),
    popularity: normalizePopularity(char.count_of_issue_appearances, maxAppearances),
    imageUrl: char.image?.small_url ?? null,
    description: truncateDesc(cleanDesc),
    meta: {
      realName: char.real_name,
      publisher: char.publisher?.name,
      issueAppearances: char.count_of_issue_appearances,
      aliases: char.aliases?.split('\n').filter(Boolean) ?? [],
      gender: char.gender,
    },
  };
}

export async function ingestComicVine(options: { limit?: number } = {}): Promise<IngestStats> {
  const { limit = 20000 } = options;
  const startTime = Date.now();
  const progress = new ProgressLogger('ComicVine', 100);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalErrors = 0;
  let offset = 0;
  const batchSize = 100; // Comic Vine max per request

  // Rough max for normalization (Batman has ~13K appearances)
  const maxAppearances = 13000;

  console.log(`[ComicVine] Fetching up to ${limit} comic characters...`);

  while (offset < limit) {
    try {
      const chars = await cvFetch<CvCharacter[]>('characters', {
        sort: 'count_of_issue_appearances:desc',
        limit: String(batchSize),
        offset: String(offset),
        field_list: 'id,name,real_name,deck,description,image,publisher,count_of_issue_appearances,aliases,gender',
      });

      if (chars.length === 0) {
        console.log(`[ComicVine] No more characters at offset ${offset}`);
        break;
      }

      const raw = chars.map(c => toRawCharacter(c, maxAppearances));
      totalFetched += chars.length;

      const { inserted, skipped } = insertRawCharacters(raw);
      totalInserted += inserted;
      totalDuplicates += skipped;

      for (const _ of raw) progress.tick();
      offset += batchSize;
    } catch (err) {
      totalErrors++;
      console.error(`[ComicVine] Error at offset ${offset}:`, (err as Error).message);
      offset += batchSize;
    }
  }

  const elapsed = Date.now() - startTime;
  progress.done();

  const stats: IngestStats = {
    source: 'comicvine',
    fetched: totalFetched,
    inserted: totalInserted,
    duplicates: totalDuplicates,
    errors: totalErrors,
    elapsed,
  };

  logIngestRun(stats);
  console.log(`[ComicVine] Complete: ${totalInserted} inserted, ${totalDuplicates} skipped in ${formatElapsed(elapsed)}`);
  return stats;
}

// CLI entry point
if (process.argv[1]?.endsWith('comicvine.ts') || process.argv[1]?.endsWith('comicvine.js')) {
  const limit = parseInt(process.argv[2] ?? '20000') || 20000;
  console.log(`Running Comic Vine ingestion (limit=${limit})...`);
  ingestComicVine({ limit })
    .then(stats => {
      console.log('\nFinal stats:', JSON.stringify(stats, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
