import { describe, it, expect } from 'vitest';
import { parseResponse, getAttributesForCategory, type AttributeDef } from './storage';

describe('parseResponse', () => {
  const validKeys = new Set(['isHuman', 'isVillain', 'usesMagic']);

  it('extracts known attribute keys for known character ids', () => {
    const raw = JSON.stringify({
      c1: { isHuman: true, isVillain: false, usesMagic: null },
      c2: { isHuman: false, isVillain: true, usesMagic: true },
    });
    const out = parseResponse(raw, ['c1', 'c2'], validKeys);
    expect(out).toEqual({
      c1: { isHuman: true, isVillain: false, usesMagic: null },
      c2: { isHuman: false, isVillain: true, usesMagic: true },
    });
  });

  it('drops unknown attribute keys', () => {
    const raw = JSON.stringify({ c1: { isHuman: true, unknownAttr: true } });
    const out = parseResponse(raw, ['c1'], validKeys);
    expect(out.c1).toEqual({ isHuman: true });
    expect('unknownAttr' in out.c1).toBe(false);
  });

  it('skips characters not present in the LLM response', () => {
    const raw = JSON.stringify({ c1: { isHuman: true } });
    const out = parseResponse(raw, ['c1', 'cMissing'], validKeys);
    expect(out).toEqual({ c1: { isHuman: true } });
    expect('cMissing' in out).toBe(false);
  });

  it('coerces non-boolean attribute values to null', () => {
    const raw = JSON.stringify({
      c1: { isHuman: 'yes', isVillain: 0, usesMagic: undefined },
    });
    const out = parseResponse(raw, ['c1'], validKeys);
    expect(out.c1.isHuman).toBeNull();
    expect(out.c1.isVillain).toBeNull();
    // undefined is dropped during JSON.stringify, so usesMagic isn't on the parsed object → skipped
    expect('usesMagic' in out.c1).toBe(false);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseResponse('not json', ['c1'], validKeys)).toThrow();
  });
});

describe('getAttributesForCategory', () => {
  const attrs: AttributeDef[] = [
    { key: 'universal', displayText: '', categories: null },
    { key: 'movieOnly', displayText: '', categories: '["movie"]' },
    { key: 'animeOrGame', displayText: '', categories: '["anime","videogame"]' },
    { key: 'malformed', displayText: '', categories: 'not-json' },
  ];

  it('always includes universal attributes (categories=null)', () => {
    const out = getAttributesForCategory(attrs, 'books');
    expect(out.map(a => a.key)).toContain('universal');
  });

  it('includes category-specific attrs only for matching category', () => {
    const movieOut = getAttributesForCategory(attrs, 'movie' as never);
    expect(movieOut.map(a => a.key)).toContain('movieOnly');

    const animeOut = getAttributesForCategory(attrs, 'anime' as never);
    expect(animeOut.map(a => a.key)).toContain('animeOrGame');
    expect(animeOut.map(a => a.key)).not.toContain('movieOnly');
  });

  it('treats malformed category JSON as "applies to all" (safe fallback)', () => {
    const out = getAttributesForCategory(attrs, 'book' as never);
    expect(out.map(a => a.key)).toContain('malformed');
  });
});
