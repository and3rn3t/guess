/**
 * TMDb (The Movie Database) source adapter.
 * API key required (free tier: 40 req/10s).
 * Fetches characters from popular movies and TV shows.
 */
import type { RawCharacter, IngestStats, Category } from '../types.js';
import { insertRawCharacters, logIngestRun } from '../db.js';
import { getConfig } from '../config.js';
import { RateLimiter, withRetry } from '../rate-limiter.js';
import { makeId, truncateDesc, normalizePopularity, ProgressLogger, formatElapsed } from '../utils.js';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

// TMDb rate limit: ~40 requests per 10 seconds
const limiter = new RateLimiter(260, 38, 10_000);

interface TmdbCredit {
  id: number;
  character: string;
  name: string;  // actor name
  profile_path: string | null;
  order: number;
}

interface TmdbMovieResult {
  id: number;
  title: string;
  popularity: number;
  genre_ids: number[];
  overview: string;
  release_date: string;
}

interface TmdbTvResult {
  id: number;
  name: string;
  popularity: number;
  genre_ids: number[];
  overview: string;
  first_air_date: string;
}

// TMDb genre IDs for animation
const ANIMATION_GENRE = 16;
const _SCIFI_GENRE = 878;

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const config = getConfig();
  if (!config.tmdbApiKey) throw new Error('TMDB_API_KEY not set in .env.local');

  await limiter.wait();

  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set('api_key', config.tmdbApiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  return withRetry(async () => {
    const res = await fetch(url.toString());
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '10');
      throw new Error(`Rate limited, retry after ${retryAfter}s`);
    }
    if (!res.ok) throw new Error(`TMDb ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  });
}

function categorizeFromGenres(genreIds: number[], mediaType: 'movie' | 'tv'): Category {
  if (genreIds.includes(ANIMATION_GENRE)) {
    return mediaType === 'tv' ? 'cartoons' : 'movies';
  }
  return mediaType === 'tv' ? 'tv-shows' : 'movies';
}

/**
 * Strategy: Fetch popular movies and TV shows, then extract their cast as "characters".
 * TMDb is really a people/movie database, but movie/TV characters are what we want.
 */
async function fetchMovieCharacters(page: number): Promise<RawCharacter[]> {
  const movies = await tmdbFetch<{ results: TmdbMovieResult[]; total_pages: number }>('/movie/popular', { page: String(page) });
  const characters: RawCharacter[] = [];

  for (const movie of movies.results) {
    try {
      const credits = await tmdbFetch<{ cast: TmdbCredit[] }>(`/movie/${movie.id}/credits`);
      const category = categorizeFromGenres(movie.genre_ids, 'movie');

      // Take top 5 credited characters per movie
      for (const cast of credits.cast.slice(0, 5)) {
        if (!cast.character || cast.character === 'Self' || cast.character.includes('(uncredited)')) continue;

        // Clean character name (remove "/ alternate name" patterns)
        const charName = cast.character.split('/')[0].trim();
        if (charName.length < 2) continue;

        characters.push({
          id: makeId('tmdb', `movie-${movie.id}-${cast.id}`),
          name: charName,
          category,
          source: 'tmdb',
          sourceId: `movie-${movie.id}-char-${cast.id}`,
          popularity: normalizePopularity(movie.popularity, 1000),
          imageUrl: cast.profile_path ? `${TMDB_IMG}/w185${cast.profile_path}` : null,
          description: truncateDesc(`${charName} from "${movie.title}" (${movie.release_date?.slice(0, 4) ?? 'N/A'})`),
          meta: {
            actorName: cast.name,
            movieTitle: movie.title,
            movieId: movie.id,
            creditOrder: cast.order,
            genreIds: movie.genre_ids,
            moviePopularity: movie.popularity,
            releaseYear: movie.release_date?.slice(0, 4),
          },
        });
      }
    } catch (err) {
      console.error(`  TMDb: Error fetching credits for movie ${movie.id}:`, (err as Error).message);
    }
  }

  return characters;
}

async function fetchTvCharacters(page: number): Promise<RawCharacter[]> {
  const shows = await tmdbFetch<{ results: TmdbTvResult[]; total_pages: number }>('/tv/popular', { page: String(page) });
  const characters: RawCharacter[] = [];

  for (const show of shows.results) {
    try {
      const credits = await tmdbFetch<{ cast: TmdbCredit[] }>(`/tv/${show.id}/credits`);
      const category = categorizeFromGenres(show.genre_ids, 'tv');

      for (const cast of credits.cast.slice(0, 5)) {
        if (!cast.character || cast.character === 'Self') continue;

        const charName = cast.character.split('/')[0].trim();
        if (charName.length < 2) continue;

        characters.push({
          id: makeId('tmdb', `tv-${show.id}-${cast.id}`),
          name: charName,
          category,
          source: 'tmdb',
          sourceId: `tv-${show.id}-char-${cast.id}`,
          popularity: normalizePopularity(show.popularity, 1000),
          imageUrl: cast.profile_path ? `${TMDB_IMG}/w185${cast.profile_path}` : null,
          description: truncateDesc(`${charName} from "${show.name}" (${show.first_air_date?.slice(0, 4) ?? 'N/A'})`),
          meta: {
            actorName: cast.name,
            showName: show.name,
            showId: show.id,
            creditOrder: cast.order,
            genreIds: show.genre_ids,
            showPopularity: show.popularity,
            firstAirYear: show.first_air_date?.slice(0, 4),
          },
        });
      }
    } catch (err) {
      console.error(`  TMDb: Error fetching credits for TV ${show.id}:`, (err as Error).message);
    }
  }

  return characters;
}

export async function ingestTmdb(options: { maxPages?: number } = {}): Promise<IngestStats> {
  const { maxPages = 100 } = options;
  const startTime = Date.now();
  const progress = new ProgressLogger('TMDb', 200);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalErrors = 0;

  console.log(`[TMDb] Fetching characters from top ${maxPages} pages of movies and TV shows...`);

  // Movies
  for (let page = 1; page <= maxPages; page++) {
    try {
      const chars = await fetchMovieCharacters(page);
      totalFetched += chars.length;
      const { inserted, skipped } = insertRawCharacters(chars);
      totalInserted += inserted;
      totalDuplicates += skipped;
      for (const _ of chars) progress.tick();
    } catch (err) {
      totalErrors++;
      console.error(`[TMDb] Movie page ${page} error:`, (err as Error).message);
    }
  }

  // TV shows
  for (let page = 1; page <= maxPages; page++) {
    try {
      const chars = await fetchTvCharacters(page);
      totalFetched += chars.length;
      const { inserted, skipped } = insertRawCharacters(chars);
      totalInserted += inserted;
      totalDuplicates += skipped;
      for (const _ of chars) progress.tick();
    } catch (err) {
      totalErrors++;
      console.error(`[TMDb] TV page ${page} error:`, (err as Error).message);
    }
  }

  const elapsed = Date.now() - startTime;
  progress.done();

  const stats: IngestStats = {
    source: 'tmdb',
    fetched: totalFetched,
    inserted: totalInserted,
    duplicates: totalDuplicates,
    errors: totalErrors,
    elapsed,
  };

  logIngestRun(stats);
  console.log(`[TMDb] Complete: ${totalInserted} inserted, ${totalDuplicates} skipped in ${formatElapsed(elapsed)}`);
  return stats;
}

// CLI entry point
if (process.argv[1]?.endsWith('tmdb.ts') || process.argv[1]?.endsWith('tmdb.js')) {
  const maxPages = parseInt(process.argv[2] ?? '100') || 100;
  console.log(`Running TMDb ingestion (maxPages=${maxPages})...`);
  ingestTmdb({ maxPages })
    .then(stats => {
      console.log('\nFinal stats:', JSON.stringify(stats, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
