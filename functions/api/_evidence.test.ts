import { describe, it, expect } from 'vitest';
import {
  evidenceAdminManual,
  evidenceAdminCreate,
  evidenceCommunityVote,
  evidenceCorrection,
  evidenceCsvUpload,
  evidenceReveal,
  evidenceEnrichment,
  evidenceSeed,
  isValidEvidence,
  EVIDENCE_PREFIXES,
} from './_evidence';

describe('DQ.28 evidence helpers', () => {
  it('builds well-formed admin tags', () => {
    const t = 1714509000000;
    expect(evidenceAdminManual(t)).toBe('admin:manual:1714509000000');
    expect(evidenceAdminCreate(t)).toBe('admin:create:1714509000000');
  });

  it('builds well-formed community/correction/csv tags', () => {
    const t = 1714509000000;
    expect(evidenceCommunityVote(t)).toBe('community:vote:1714509000000');
    expect(evidenceCorrection(t)).toBe('correction:1714509000000');
    expect(evidenceCsvUpload(t)).toBe('csv-upload:1714509000000');
  });

  it('embeds the game session id in reveal tags', () => {
    expect(evidenceReveal('sess-123')).toBe('reveal:sess-123');
  });

  it('falls back to a non-empty placeholder when the session id is missing', () => {
    const out = evidenceReveal('');
    expect(out.startsWith('reveal:unknown-')).toBe(true);
    expect(isValidEvidence(out)).toBe(true);
  });

  it('builds enrichment tags with provider, model, and ISO timestamp', () => {
    expect(evidenceEnrichment('openai', 'gpt-4o-mini', '2026-04-30T18:50:30Z')).toBe(
      'enrichment:openai:gpt-4o-mini:run=2026-04-30T18:50:30Z',
    );
  });

  it('returns the static seed tag', () => {
    expect(evidenceSeed()).toBe('seed:default');
  });

  it('isValidEvidence accepts every helper output and rejects garbage', () => {
    const t = 1;
    const goods = [
      evidenceAdminManual(t),
      evidenceAdminCreate(t),
      evidenceCommunityVote(t),
      evidenceCorrection(t),
      evidenceCsvUpload(t),
      evidenceReveal('s'),
      evidenceEnrichment('openai', 'gpt-4o-mini'),
      evidenceSeed(),
    ];
    for (const g of goods) expect(isValidEvidence(g)).toBe(true);

    expect(isValidEvidence('')).toBe(false);
    expect(isValidEvidence('unknown:source:1')).toBe(false);
    expect(isValidEvidence(null)).toBe(false);
    expect(isValidEvidence(123)).toBe(false);
  });

  it('exposes the canonical prefix list', () => {
    expect(EVIDENCE_PREFIXES).toEqual([
      'admin',
      'community',
      'correction',
      'csv-upload',
      'reveal',
      'enrichment',
      'seed',
    ]);
  });
});
