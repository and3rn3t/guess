import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, buildSkepticPrompt } from './prompts';

describe('buildSystemPrompt', () => {
  it('includes attribute count in both the rule line and the header', () => {
    const keys = ['isHuman', 'isVillain', 'usesMagic'];
    const out = buildSystemPrompt(keys);
    // AI.4: dropped the RESPONSE FORMAT example block, so we now expect the
    // count twice (rule + header) instead of three times. Asserting >=2 here
    // gives us forward room without re-introducing the trimmed schema example.
    const occurrences = out.match(/3/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
    expect(out).toContain('isHuman, isVillain, usesMagic');
    expect(out).toContain('ATTRIBUTE KEYS (3 total');
  });

  it('handles empty attribute list', () => {
    const out = buildSystemPrompt([]);
    expect(out).toContain('0 attribute keys');
    expect(out).toContain('ATTRIBUTE KEYS (0 total');
  });

  it('AI.4: still mentions JSON (required for json_object mode) but drops the inline schema example', () => {
    const out = buildSystemPrompt(['isHuman']);
    expect(out).toContain('JSON');
    // Regression guard: the trimmed `RESPONSE FORMAT` example block and its
    // example body must NOT come back. If a future edit re-introduces the
    // schema sketch, this test fires.
    expect(out).not.toContain('RESPONSE FORMAT');
    expect(out).not.toContain('"char_id_1"');
  });

  it('AI.4: 200-attribute prompt fits the post-compression budget', () => {
    // Baseline (pre-AI.4): ~2531 chars for 200 attrs (includes the inline
    // `RESPONSE FORMAT: {…}` example block).
    // Post-trim: 2371 chars — ~6% shrink on the system prompt alone, which
    // compounds across every batch × chunk during enrichment. Budget set ~5%
    // above current observed so a future regression that re-bloats the prompt
    // fires here.
    const keys = Array.from({ length: 200 }, (_, i) => `attr${i}`);
    const out = buildSystemPrompt(keys);
    expect(out.length).toBeLessThan(2500);
  });
});

describe('buildUserPrompt', () => {
  it('lists each character on its own line with id, name, category', () => {
    const out = buildUserPrompt([
      { id: 'c1', name: 'Alice', category: 'book', description: null },
      { id: 'c2', name: 'Bob', category: 'movie', description: 'A short bio' },
    ]);
    expect(out).toContain('- c1: "Alice" (book)');
    expect(out).toContain('- c2: "Bob" (movie) — A short bio');
  });

  it('truncates descriptions over 200 chars', () => {
    const longDesc = 'x'.repeat(300);
    const out = buildUserPrompt([
      { id: 'c1', name: 'Alice', category: 'book', description: longDesc },
    ]);
    // 200 x's after the em-dash
    expect(out).toContain(' — ' + 'x'.repeat(200));
    expect(out).not.toContain(' — ' + 'x'.repeat(201));
  });
});

describe('buildSkepticPrompt', () => {
  it('omits null attribute values and includes only definite assignments', () => {
    const out = buildSkepticPrompt(
      [{ id: 'c1', name: 'Alice', category: 'book' }],
      { c1: { isHuman: true, isAlien: false, hasMagic: null } },
    );
    expect(out).toContain('Alice (book):');
    expect(out).toContain('isHuman: true');
    expect(out).toContain('isAlien: false');
    expect(out).not.toContain('hasMagic');
  });

  it('returns empty-dispute instruction when no attributes provided', () => {
    const out = buildSkepticPrompt(
      [{ id: 'c1', name: 'Alice', category: 'book' }],
      {},
    );
    expect(out).toContain('Alice (book):');
    expect(out).toContain('{ "disputes": [] }');
  });
});
