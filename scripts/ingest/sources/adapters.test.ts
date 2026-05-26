/**
 * Per-adapter focused unit tests (DQ.v2.3).
 *
 * Each adapter gets a happy-path test + one failure-mode test that exercises
 * the source-specific normalization logic. The shared rate-limit/retry
 * concerns are covered separately in `_base.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { toRawCharacter as anilistToRaw } from './anilist';
import { toRawCharacter as comicvineToRaw } from './comicvine';
import { toRawCharacter as igdbToRaw } from './igdb';
import { categorizeFromGenres } from './tmdb';
import { toRawCharacter as wikidataToRaw } from './wikidata';

describe('comicvine adapter', () => {
  it('happy path: maps a Comic Vine character to RawCharacter', () => {
    const result = comicvineToRaw(
      {
        id: 1699,
        name: 'Batman',
        real_name: 'Bruce Wayne',
        deck: 'A dark vigilante.',
        description: null,
        image: { small_url: 'https://img/batman_small.jpg', medium_url: 'https://img/batman.jpg' },
        publisher: { name: 'DC Comics' },
        count_of_issue_appearances: 13000,
        aliases: 'Bats\nThe Dark Knight',
        gender: 1,
      } as Parameters<typeof comicvineToRaw>[0],
      13000
    );
    expect(result.id).toMatch(/^comicvine-/);
    expect(result.name).toBe('Batman');
    expect(result.category).toBe('comics');
    expect(result.source).toBe('comicvine');
    expect(result.popularity).toBeGreaterThan(0.9);
    expect(result.imageUrl).toBe('https://img/batman_small.jpg');
    expect(result.meta?.aliases).toEqual(['Bats', 'The Dark Knight']);
  });

  it('failure mode: HTML in description is sanitized; missing image yields null', () => {
    const result = comicvineToRaw(
      {
        id: 42,
        name: 'Test',
        real_name: null,
        deck: null,
        description: '<p>Hero <b>with</b> tags</p>',
        image: null,
        publisher: null,
        count_of_issue_appearances: 0,
        aliases: null,
        gender: 0,
      } as Parameters<typeof comicvineToRaw>[0],
      13000
    );
    expect(result.imageUrl).toBeNull();
    expect(result.description).not.toContain('<');
    expect(result.description).not.toContain('>');
    expect(result.description).toContain('Hero with tags');
  });
});

describe('anilist adapter', () => {
  it('happy path: maps AniList character with anime media', () => {
    const result = anilistToRaw(
      {
        id: 100,
        name: { full: 'Edward Elric', native: 'エドワード・エルリック' },
        image: { medium: null, large: 'https://img/ed.jpg' },
        description: '<i>Alchemist</i> from FMA.',
        favourites: 50000,
        media: {
          nodes: [
            {
              type: 'ANIME',
              format: 'TV',
              title: { romaji: 'Hagane no Renkinjutsushi', english: 'Fullmetal Alchemist' },
              genres: ['Action', 'Adventure'],
            },
          ],
        },
      } as Parameters<typeof anilistToRaw>[0],
      100000
    );
    expect(result.name).toBe('Edward Elric');
    expect(result.category).toBe('anime');
    expect(result.imageUrl).toBe('https://img/ed.jpg');
    expect(result.description).not.toContain('<');
    expect(result.meta?.topMedia).toBe('Fullmetal Alchemist');
  });

  it('failure mode: missing full name falls back to native, then to placeholder id', () => {
    const withNative = anilistToRaw(
      {
        id: 7,
        name: { full: '', native: 'ナルト' },
        image: { medium: null, large: null },
        description: null,
        favourites: 0,
        media: { nodes: [] },
      } as Parameters<typeof anilistToRaw>[0],
      100
    );
    expect(withNative.name).toBe('ナルト');
    expect(withNative.imageUrl).toBeNull();

    const withNeither = anilistToRaw(
      {
        id: 8,
        name: { full: '', native: null },
        image: { medium: null, large: null },
        description: null,
        favourites: 0,
        media: { nodes: [] },
      } as Parameters<typeof anilistToRaw>[0],
      100
    );
    expect(withNeither.name).toBe('AniList-8');
  });
});

describe('igdb adapter', () => {
  it('happy path: maps an IGDB character with games array', () => {
    const result = igdbToRaw({
      id: 555,
      name: 'Master Chief',
      slug: 'master-chief',
      description: 'Spartan-117.',
      mug_shot: { image_id: 'abc123' },
      games: [{ id: 1, name: 'Halo: Combat Evolved', popularity: 500 }],
    } as Parameters<typeof igdbToRaw>[0]);
    expect(result.name).toBe('Master Chief');
    expect(result.category).toBe('video-games');
    expect(result.imageUrl).toContain('abc123');
    expect(result.meta?.topGame).toBe('Halo: Combat Evolved');
  });

  it('failure mode: no mug_shot → null imageUrl, no games → empty meta arrays', () => {
    const result = igdbToRaw({
      id: 9,
      name: 'NoArt',
      slug: 'noart',
    } as Parameters<typeof igdbToRaw>[0]);
    expect(result.imageUrl).toBeNull();
    expect(result.popularity).toBe(0);
    expect(result.meta?.gameIds).toEqual([]);
  });
});

describe('tmdb adapter', () => {
  it('happy path: animated movie → movies category; live-action TV → tv-shows', () => {
    expect(categorizeFromGenres([16, 35], 'movie')).toBe('movies');
    expect(categorizeFromGenres([18, 80], 'tv')).toBe('tv-shows');
  });

  it('failure mode: animated TV → cartoons (genre 16 is animation)', () => {
    expect(categorizeFromGenres([16], 'tv')).toBe('cartoons');
    // And empty genres still maps to a sane default per media type.
    expect(categorizeFromGenres([], 'movie')).toBe('movies');
  });
});

describe('wikidata adapter', () => {
  it('happy path: maps a SPARQL result with image + description', () => {
    const result = wikidataToRaw(
      {
        char: { value: 'http://www.wikidata.org/entity/Q2351' },
        charLabel: { value: 'Batman' },
        charDesc: { value: 'fictional superhero from DC Comics' },
        image: { value: 'http://commons.wikimedia.org/wiki/Special:FilePath/Batman.png' },
      } as Parameters<typeof wikidataToRaw>[0],
      'comic character'
    );
    expect(result).not.toBeNull();
    expect(result?.name).toBe('Batman');
    expect(result?.category).toBe('comics');
    expect(result?.imageUrl).toContain('thumb.php');
    expect(result?.meta?.wikidataId).toBe('Q2351');
  });

  it('failure mode: unlabeled entity (label === Q-id) returns null', () => {
    const result = wikidataToRaw(
      {
        char: { value: 'http://www.wikidata.org/entity/Q99999' },
        charLabel: { value: 'Q99999' },
      } as Parameters<typeof wikidataToRaw>[0],
      'fictional character'
    );
    expect(result).toBeNull();
  });
});
