/** Raw character scraped from an external source, before dedup/enrichment */
export interface RawCharacter {
  /** Normalized slug ID, e.g. "mario" or "tmdb-12345" */
  id: string;
  /** Display name */
  name: string;
  /** Category for the guessing game */
  category: Category;
  /** Which external API this came from */
  source: Source;
  /** ID in the external API (string or numeric-as-string) */
  sourceId: string;
  /** Normalized popularity 0–1 */
  popularity: number;
  /** Thumbnail URL from the source (will be downloaded later) */
  imageUrl: string | null;
  /** Short description / tagline */
  description: string | null;
  /** Additional metadata for dedup / enrichment */
  meta: Record<string, unknown>;
}

export type Source = 'tmdb' | 'anilist' | 'igdb' | 'comicvine' | 'wikidata';

export type Category =
  | 'video-games'
  | 'movies'
  | 'anime'
  | 'comics'
  | 'books'
  | 'cartoons'
  | 'tv-shows'
  | 'pop-culture';

export interface IngestStats {
  source: Source;
  fetched: number;
  inserted: number;
  duplicates: number;
  errors: number;
  elapsed: number; // ms
}
