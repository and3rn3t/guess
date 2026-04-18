/**
 * AniList source adapter.
 * Uses AniList GraphQL API (free, no key required, rate limit: 90 req/min).
 * Fetches anime/manga characters with popularity data.
 */
import type { RawCharacter, IngestStats } from '../types.js';
import { insertRawCharacters, logIngestRun } from '../db.js';
import { RateLimiter, withRetry } from '../rate-limiter.js';
import { makeId, truncateDesc, normalizePopularity, ProgressLogger, formatElapsed } from '../utils.js';

const ANILIST_API = 'https://graphql.anilist.co';

// AniList rate limit: 90 requests per minute — use ~1.2s interval to stay safe
const limiter = new RateLimiter(1200, 80, 60_000);

const CHARACTER_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
    }
    characters(sort: FAVOURITES_DESC) {
      id
      name {
        full
        native
      }
      image {
        medium
        large
      }
      description
      favourites
      media(perPage: 3, sort: POPULARITY_DESC) {
        nodes {
          type
          format
          title {
            romaji
            english
          }
          genres
        }
      }
    }
  }
}
`;

interface AniListCharacter {
  id: number;
  name: { full: string; native: string | null };
  image: { medium: string | null; large: string | null };
  description: string | null;
  favourites: number;
  media: {
    nodes: Array<{
      type: 'ANIME' | 'MANGA';
      format: string | null;
      title: { romaji: string | null; english: string | null };
      genres: string[];
    }>;
  };
}

interface AniListPageInfo {
  total: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
}

async function fetchPage(page: number, perPage = 50): Promise<{ characters: AniListCharacter[]; pageInfo: AniListPageInfo }> {
  await limiter.wait();

  const response = await withRetry(async () => {
    const res = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ query: CHARACTER_QUERY, variables: { page, perPage } }),
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60');
      console.log(`  AniList 429: waiting ${retryAfter}s before retry...`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      throw new Error(`Rate limited, retry after ${retryAfter}s`);
    }
    if (!res.ok) throw new Error(`AniList API ${res.status}: ${await res.text()}`);

    return res.json() as Promise<{ data: { Page: { pageInfo: AniListPageInfo; characters: AniListCharacter[] } } }>;
  }, 5, 2000);

  return {
    characters: response.data.Page.characters,
    pageInfo: response.data.Page.pageInfo,
  };
}

function toRawCharacter(char: AniListCharacter, maxFavourites: number): RawCharacter {
  const name = char.name.full || char.name.native || `AniList-${char.id}`;
  const topMedia = char.media.nodes[0];

  // Determine category from media type/format
  let category: RawCharacter['category'] = 'anime';
  if (topMedia) {
    if (topMedia.type === 'MANGA' && !topMedia.format?.includes('NOVEL')) {
      // Manga characters could be comics or anime depending on adaptation
      category = 'anime'; // most manga characters are known through anime
    }
  }

  // Clean AniList HTML description
  const cleanDesc = char.description
    ? char.description.replace(/<[^>]+>/g, '').replace(/~!.*?!~/gs, '').trim()
    : null;

  return {
    id: makeId('anilist', String(char.id)),
    name,
    category,
    source: 'anilist',
    sourceId: String(char.id),
    popularity: normalizePopularity(char.favourites, maxFavourites),
    imageUrl: char.image.large || char.image.medium,
    description: truncateDesc(cleanDesc),
    meta: {
      nativeName: char.name.native,
      favourites: char.favourites,
      topMedia: topMedia ? (topMedia.title.english || topMedia.title.romaji) : null,
      genres: topMedia?.genres ?? [],
      mediaType: topMedia?.type,
      mediaFormat: topMedia?.format,
    },
  };
}

export async function ingestAniList(options: { maxPages?: number; minFavourites?: number } = {}): Promise<IngestStats> {
  const { maxPages = 0, minFavourites = 10 } = options;
  const startTime = Date.now();
  const progress = new ProgressLogger('AniList', 500);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalErrors = 0;

  // First page to get total count and max favourites for normalization
  console.log('[AniList] Fetching first page to get totals...');
  const firstPage = await fetchPage(1, 50);
  const maxFavourites = firstPage.characters[0]?.favourites ?? 1;
  console.log(`[AniList] Total characters: ${firstPage.pageInfo.total}, Max favourites: ${maxFavourites}`);

  const lastPage = maxPages > 0
    ? Math.min(firstPage.pageInfo.lastPage, maxPages)
    : firstPage.pageInfo.lastPage;

  console.log(`[AniList] Will fetch ${lastPage} pages...`);

  for (let page = 1; page <= lastPage; page++) {
    try {
      const data = page === 1 ? firstPage : await fetchPage(page, 50);

      // Filter by minimum favourites
      const filtered = data.characters.filter(c => c.favourites >= minFavourites);

      if (filtered.length === 0 && minFavourites > 0) {
        console.log(`[AniList] Page ${page}: all characters below ${minFavourites} favourites, stopping.`);
        break;
      }

      const raw = filtered.map(c => toRawCharacter(c, maxFavourites));
      totalFetched += data.characters.length;

      const { inserted, skipped } = insertRawCharacters(raw);
      totalInserted += inserted;
      totalDuplicates += skipped;

      for (const _ of raw) progress.tick();

      if (!data.pageInfo.hasNextPage) break;
    } catch (err) {
      totalErrors++;
      console.error(`[AniList] Error on page ${page}:`, (err as Error).message);
    }
  }

  const elapsed = Date.now() - startTime;
  progress.done();

  const stats: IngestStats = {
    source: 'anilist',
    fetched: totalFetched,
    inserted: totalInserted,
    duplicates: totalDuplicates,
    errors: totalErrors,
    elapsed,
  };

  logIngestRun(stats);
  console.log(`[AniList] Complete: ${totalInserted} inserted, ${totalDuplicates} skipped, ${totalErrors} errors in ${formatElapsed(elapsed)}`);
  return stats;
}

// CLI entry point
if (process.argv[1]?.endsWith('anilist.ts') || process.argv[1]?.endsWith('anilist.js')) {
  const maxPages = parseInt(process.argv[2] ?? '0') || 0;
  const minFavourites = parseInt(process.argv[3] ?? '10') || 10;
  console.log(`Running AniList ingestion (maxPages=${maxPages || 'all'}, minFavourites=${minFavourites})...`);
  ingestAniList({ maxPages, minFavourites })
    .then(stats => {
      console.log('\nFinal stats:', JSON.stringify(stats, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
