import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, buildSkepticPrompt } from './prompts';

describe('buildSystemPrompt', () => {
  it('includes attribute count three times (rules, header, format)', () => {
    const keys = ['isHuman', 'isVillain', 'usesMagic'];
    const out = buildSystemPrompt(keys);
    const occurrences = out.match(/3/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
    expect(out).toContain('isHuman, isVillain, usesMagic');
    expect(out).toContain('ATTRIBUTE KEYS (3 total');
  });

  it('handles empty attribute list', () => {
    const out = buildSystemPrompt([]);
    expect(out).toContain('0 attribute keys');
    expect(out).toContain('ATTRIBUTE KEYS (0 total');
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
