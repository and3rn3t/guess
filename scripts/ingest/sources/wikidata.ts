/**
 * Wikidata source adapter.
 * Uses SPARQL endpoint (free, no key, but strict rate limits).
 * Fetches fictional characters across all media types.
 */
import type { RawCharacter, IngestStats, Category } from '../types.js';
import { insertRawCharacters, logIngestRun } from '../db.js';
import { RateLimiter, withRetry } from '../rate-limiter.js';
import { makeId, truncateDesc, ProgressLogger, formatElapsed } from '../utils.js';

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

// Wikidata rate limit: be conservative — 1 req/2s for heavy queries
const limiter = new RateLimiter(2000);

// SPARQL queries: fetch fictional characters in batches
// Use separate focused queries per character type to avoid timeouts
const CHARACTER_TYPES = [
  { qid: 'Q95074', label: 'fictional character' },
  { qid: 'Q15632617', label: 'fictional human' },
  { qid: 'Q15773317', label: 'television character' },
  { qid: 'Q15773347', label: 'film character' },
  { qid: 'Q1114461', label: 'comic character' },
  { qid: 'Q14514600', label: 'anime character' },
  { qid: 'Q21070598', label: 'video game character' },
  { qid: 'Q3658341', label: 'literary character' },
];

function buildQueryForType(typeQid: string, offset: number, limit: number): string {
  return `
SELECT ?char ?charLabel ?charDesc ?image WHERE {
  ?char wdt:P31 wd:${typeQid} .
  OPTIONAL { ?char wdt:P18 ?image . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT ${limit}
OFFSET ${offset}
`;
}

interface WikidataResult {
  char: { value: string };       // e.g. http://www.wikidata.org/entity/Q2351
  charLabel: { value: string };
  charDesc?: { value: string };
  image?: { value: string };
}

async function sparqlQuery(query: string): Promise<WikidataResult[]> {
  await limiter.wait();

  return withRetry(async () => {
    const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/sparql-results+json', 'User-Agent': 'GuessGame/1.0 (character-ingestion)' },
    });

    if (res.status === 429 || res.status === 503) {
      throw new Error(`Wikidata ${res.status}: rate limited or overloaded`);
    }
    if (!res.ok) throw new Error(`Wikidata ${res.status}: ${(await res.text()).slice(0, 200)}`);

    const text = await res.text();
    try {
      const data = JSON.parse(text) as { results: { bindings: WikidataResult[] } };
      return data.results.bindings;
    } catch {
      throw new Error(`JSON parse error at position ${text.length} chars`);
    }
  }, 5, 5000); // more retries with longer backoff for Wikidata
}

function inferCategory(desc: string | undefined): Category {
  if (!desc) return 'pop-culture';
  const d = desc.toLowerCase();

  if (d.includes('anime') || d.includes('manga')) return 'anime';
  if (d.includes('video game') || d.includes('game character')) return 'video-games';
  if (d.includes('comic') || d.includes('superhero') || d.includes('dc comics') || d.includes('marvel')) return 'comics';
  if (d.includes('cartoon') || d.includes('animated')) return 'cartoons';
  if (d.includes('novel') || d.includes('literary') || d.includes('book')) return 'books';
  if (d.includes('television') || d.includes('tv series') || d.includes('sitcom')) return 'tv-shows';
  if (d.includes('film') || d.includes('movie')) return 'movies';

  return 'pop-culture';
}

function getWikidataId(uri: string): string {
  // http://www.wikidata.org/entity/Q2351 → Q2351
  return uri.split('/').pop() ?? uri;
}

function getCommonsThumbUrl(imageUrl: string, width = 200): string {
  // Convert Wikimedia Commons URL to thumbnail
  // From: http://commons.wikimedia.org/wiki/Special:FilePath/Batman_DC_Comics.png
  // To: https://commons.wikimedia.org/w/thumb.php?f=Batman_DC_Comics.png&w=200
  try {
    const fileName = decodeURIComponent(imageUrl.split('/').pop() ?? '');
    if (!fileName) return imageUrl;
    return `https://commons.wikimedia.org/w/thumb.php?f=${encodeURIComponent(fileName)}&w=${width}`;
  } catch {
    return imageUrl;
  }
}

function toRawCharacter(result: WikidataResult, typeLabel: string): RawCharacter | null {
  const name = result.charLabel.value;
  if (!name || name.startsWith('Q')) return null; // Skip unlabeled entities

  const wdId = getWikidataId(result.char.value);

  // Infer category from the Wikidata type that matched, then fallback to description
  let category = inferCategoryFromType(typeLabel);
  if (category === 'pop-culture') {
    category = inferCategory(result.charDesc?.value);
  }

  return {
    id: makeId('wikidata', wdId),
    name,
    category,
    source: 'wikidata',
    sourceId: wdId,
    popularity: 0.1, // Will be enriched later via sitelinks or cross-source matching
    imageUrl: result.image ? getCommonsThumbUrl(result.image.value) : null,
    description: truncateDesc(result.charDesc?.value),
    meta: {
      wikidataId: wdId,
      wikidataType: typeLabel,
    },
  };
}

function inferCategoryFromType(typeLabel: string): Category {
  const t = typeLabel.toLowerCase();
  if (t.includes('anime')) return 'anime';
  if (t.includes('video game')) return 'video-games';
  if (t.includes('comic')) return 'comics';
  if (t.includes('television')) return 'tv-shows';
  if (t.includes('film')) return 'movies';
  if (t.includes('literary')) return 'books';
  return 'pop-culture';
}

export async function ingestWikidata(options: { maxPerType?: number } = {}): Promise<IngestStats> {
  const { maxPerType = 5000 } = options;
  const startTime = Date.now();
  const progress = new ProgressLogger('Wikidata', 500);

  let totalFetched = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalErrors = 0;
  const batchSize = 500;

  console.log(`[Wikidata] Fetching characters across ${CHARACTER_TYPES.length} types (max ${maxPerType} per type)...`);

  for (const charType of CHARACTER_TYPES) {
    let offset = 0;
    let typeCount = 0;

    console.log(`[Wikidata] Querying type: ${charType.label} (${charType.qid})...`);

    while (offset < maxPerType) {
      try {
        const query = buildQueryForType(charType.qid, offset, Math.min(batchSize, maxPerType - offset));
        const results = await sparqlQuery(query);

        if (results.length === 0) {
          console.log(`[Wikidata] ${charType.label}: no more results at offset ${offset}`);
          break;
        }

        // Deduplicate within batch
        const seen = new Set<string>();
        const unique: RawCharacter[] = [];
        for (const result of results) {
          const raw = toRawCharacter(result, charType.label);
          if (!raw || seen.has(raw.id)) continue;
          seen.add(raw.id);
          unique.push(raw);
        }

        totalFetched += results.length;
        typeCount += unique.length;
        const { inserted, skipped } = insertRawCharacters(unique);
        totalInserted += inserted;
        totalDuplicates += skipped;

        for (const _ of unique) progress.tick();
        offset += batchSize;
      } catch (err) {
        totalErrors++;
        console.error(`[Wikidata] Error for ${charType.label} at offset ${offset}:`, (err as Error).message);
        // Wait longer before retrying on error
        await new Promise(r => setTimeout(r, 10_000));
        offset += batchSize;
      }
    }

    console.log(`[Wikidata] ${charType.label}: ${typeCount} characters fetched`);
  }

  const elapsed = Date.now() - startTime;
  progress.done();

  const stats: IngestStats = {
    source: 'wikidata',
    fetched: totalFetched,
    inserted: totalInserted,
    duplicates: totalDuplicates,
    errors: totalErrors,
    elapsed,
  };

  logIngestRun(stats);
  console.log(`[Wikidata] Complete: ${totalInserted} inserted, ${totalDuplicates} skipped in ${formatElapsed(elapsed)}`);
  return stats;
}

/**
 * Dedicated video game character ingestion.
 * Finds characters (fictional char / fictional human / vg char) that appear in a video game.
 * Forces category to 'video-games' regardless of type label.
 */
function buildVideoGameQuery(offset: number, limit: number): string {
  return `
SELECT DISTINCT ?char ?charLabel ?charDesc ?image WHERE {
  { ?char wdt:P31 wd:Q95074 }
  UNION { ?char wdt:P31 wd:Q15632617 }
  UNION { ?char wdt:P31 wd:Q21070598 }
  .
  ?char wdt:P1441 ?work .
  ?work wdt:P31 wd:Q7889 .
  OPTIONAL { ?char wdt:P18 ?image . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT ${limit}
OFFSET ${offset}
`;
}

export async function ingestWikidataVideoGames(options: { max?: number } = {}): Promise<IngestStats> {
  const { max = 10000 } = options;
  const startTime = Date.now();
  const progress = new ProgressLogger('Wikidata-VG', 500);
  const batchSize = 500;

  let totalFetched = 0;
  let totalInserted = 0;
  let totalDuplicates = 0;
  let totalErrors = 0;
  let offset = 0;

  console.log(`[Wikidata-VG] Fetching video game characters (max ${max})...`);

  while (offset < max) {
    try {
      const query = buildVideoGameQuery(offset, Math.min(batchSize, max - offset));
      const results = await sparqlQuery(query);

      if (results.length === 0) {
        console.log(`[Wikidata-VG] No more results at offset ${offset}`);
        break;
      }

      const seen = new Set<string>();
      const unique: RawCharacter[] = [];
      for (const result of results) {
        const raw = toRawCharacter(result, 'video game character');
        if (!raw || seen.has(raw.id)) continue;
        // Force video-games category
        raw.category = 'video-games';
        seen.add(raw.id);
        unique.push(raw);
      }

      totalFetched += results.length;
      const { inserted, skipped } = insertRawCharacters(unique);
      totalInserted += inserted;
      totalDuplicates += skipped;

      for (const _ of unique) progress.tick();
      offset += batchSize;
    } catch (err) {
      totalErrors++;
      console.error(`[Wikidata-VG] Error at offset ${offset}:`, (err as Error).message);
      await new Promise(r => setTimeout(r, 10_000));
      offset += batchSize;
    }
  }

  const elapsed = Date.now() - startTime;
  progress.done();

  const stats: IngestStats = {
    source: 'wikidata',
    fetched: totalFetched,
    inserted: totalInserted,
    duplicates: totalDuplicates,
    errors: totalErrors,
    elapsed,
  };

  logIngestRun(stats);
  console.log(`[Wikidata-VG] Complete: ${totalInserted} inserted, ${totalDuplicates} skipped in ${formatElapsed(elapsed)}`);
  return stats;
}

// CLI entry point
if (process.argv[1]?.endsWith('wikidata.ts') || process.argv[1]?.endsWith('wikidata.js')) {
  const maxPerType = parseInt(process.argv[2] ?? '5000') || 5000;
  console.log(`Running Wikidata ingestion (maxPerType=${maxPerType})...`);
  ingestWikidata({ maxPerType })
    .then(stats => {
      console.log('\nFinal stats:', JSON.stringify(stats, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
