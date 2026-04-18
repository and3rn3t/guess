/**
 * IGDB (Internet Game Database) source adapter.
 * Requires Twitch OAuth client credentials for API access.
 * Rate limit: 4 requests/second.
 */
import type { RawCharacter, IngestStats } from '../types.js';
import { insertRawCharacters, logIngestRun } from '../db.js';
import { getConfig } from '../config.js';
import { RateLimiter, withRetry } from '../rate-limiter.js';
import { makeId, truncateDesc, normalizePopularity, ProgressLogger, formatElapsed } from '../utils.js';

const IGDB_API = 'https://api.igdb.com/v4';

// IGDB rate limit: 4 req/s
const limiter = new RateLimiter(260);

let _accessToken: string | null = null;

async function getAccessToken(): Promise<string> {
  if (_accessToken) return _accessToken;

  const config = getConfig();
  if (!config.igdbClientId || !config.igdbClientSecret) {
    throw new Error('IGDB_CLIENT_ID and IGDB_CLIENT_SECRET must be set in .env.local');
  }

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${config.igdbClientId}&client_secret=${config.igdbClientSecret}&grant_type=client_credentials`,
    { method: 'POST' }
  );

  if (!res.ok) throw new Error(`Twitch OAuth failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  _accessToken = data.access_token;
  return _accessToken;
}

interface IgdbCharacter {
  id: number;
  name: string;
  slug: string;
  description?: string;
  mug_shot?: { image_id: string };
  games?: Array<{ id: number; name: string; popularity?: number }>;
}

async function igdbQuery<T>(endpoint: string, body: string): Promise<T[]> {
  const config = getConfig();
  const token = await getAccessToken();

  await limiter.wait();

  return withRetry(async () => {
    const res = await fetch(`${IGDB_API}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': config.igdbClientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body,
    });

    if (res.status === 429) throw new Error('IGDB rate limited');
    if (!res.ok) throw new Error(`IGDB ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T[]>;
  });
}

function toRawCharacter(char: IgdbCharacter): RawCharacter {
  const topGame = char.games?.[0];
  const gamePopularity = topGame?.popularity ?? 0;

  return {
    id: makeId('igdb', String(char.id)),
    name: char.name,
    category: 'video-games',
    source: 'igdb',
    sourceId: String(char.id),
    popularity: normalizePopularity(gamePopularity, 500),
    imageUrl: char.mug_shot ? `https://images.igdb.com/igdb/image/upload/t_thumb/${char.mug_shot.image_id}.jpg` : null,
    description: truncateDesc(char.description),
    meta: {
      slug: char.slug,
      topGame: topGame?.name,
      gameIds: char.games?.map(g => g.id) ?? [],
    },
  };
}

export async function ingestIgdb(options: { limit?: number } = {}): Promise<IngestStats> {
  const { limit = 10000 } = options;
  const startTime = Date.now();
  const progress = new ProgressLogger('IGDB', 200);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalErrors = 0;
  let offset = 0;
  const batchSize = 500; // IGDB max per request

  console.log(`[IGDB] Fetching up to ${limit} video game characters...`);

  while (offset < limit) {
    try {
      const chars = await igdbQuery<IgdbCharacter>(
        'characters',
        `fields name,slug,description,mug_shot.image_id,games.name,games.popularity;
         sort id asc;
         limit ${batchSize};
         offset ${offset};`
      );

      if (chars.length === 0) {
        console.log(`[IGDB] No more characters at offset ${offset}`);
        break;
      }

      const raw = chars.map(toRawCharacter);
      totalFetched += chars.length;

      const { inserted, skipped } = insertRawCharacters(raw);
      totalInserted += inserted;
      totalDuplicates += skipped;

      for (const _ of raw) progress.tick();
      offset += batchSize;
    } catch (err) {
      totalErrors++;
      console.error(`[IGDB] Error at offset ${offset}:`, (err as Error).message);
      offset += batchSize; // skip this batch
    }
  }

  const elapsed = Date.now() - startTime;
  progress.done();

  const stats: IngestStats = {
    source: 'igdb',
    fetched: totalFetched,
    inserted: totalInserted,
    duplicates: totalDuplicates,
    errors: totalErrors,
    elapsed,
  };

  logIngestRun(stats);
  console.log(`[IGDB] Complete: ${totalInserted} inserted, ${totalDuplicates} skipped in ${formatElapsed(elapsed)}`);
  return stats;
}

// CLI entry point
if (process.argv[1]?.endsWith('igdb.ts') || process.argv[1]?.endsWith('igdb.js')) {
  const limit = parseInt(process.argv[2] ?? '10000') || 10000;
  console.log(`Running IGDB ingestion (limit=${limit})...`);
  ingestIgdb({ limit })
    .then(stats => {
      console.log('\nFinal stats:', JSON.stringify(stats, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
