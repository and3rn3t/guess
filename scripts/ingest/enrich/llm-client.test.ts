import { describe, it, expect } from 'vitest';
import { mergeConsensusResults } from './llm-client';

describe('mergeConsensusResults', () => {
  it('full agreement (true=true) → confidence 0.92, not contested', () => {
    const out = mergeConsensusResults({ a: true }, { a: true });
    expect(out.merged).toEqual({ a: true });
    expect(out.confidence).toEqual({ a: 0.92 });
    expect(out.contested).toEqual({ a: false });
  });

  it('full agreement (false=false) → confidence 0.92', () => {
    const out = mergeConsensusResults({ a: false }, { a: false });
    expect(out.confidence.a).toBe(0.92);
    expect(out.merged.a).toBe(false);
  });

  it('both null → confidence 0.7, not contested', () => {
    const out = mergeConsensusResults({ a: null }, { a: null });
    expect(out.merged.a).toBeNull();
    expect(out.confidence.a).toBe(0.7);
    expect(out.contested.a).toBe(false);
  });

  it('primary definite, secondary null → primary wins at 0.72', () => {
    const out = mergeConsensusResults({ a: true }, { a: null });
    expect(out.merged.a).toBe(true);
    expect(out.confidence.a).toBe(0.72);
    expect(out.contested.a).toBe(false);
  });

  it('secondary definite, primary null → secondary wins at 0.72', () => {
    const out = mergeConsensusResults({ a: null }, { a: false });
    expect(out.merged.a).toBe(false);
    expect(out.confidence.a).toBe(0.72);
    expect(out.contested.a).toBe(false);
  });

  it('genuine disagreement (true vs false) → primary wins, contested=true, confidence=0.5', () => {
    const out = mergeConsensusResults({ a: true }, { a: false });
    expect(out.merged.a).toBe(true);
    expect(out.confidence.a).toBe(0.5);
    expect(out.contested.a).toBe(true);
  });

  it('unions keys from both sides', () => {
    const out = mergeConsensusResults({ a: true }, { b: false });
    expect(Object.keys(out.merged).sort()).toEqual(['a', 'b']);
    // missing on the other side is treated as null → use definite at 0.72
    expect(out.merged.a).toBe(true);
    expect(out.confidence.a).toBe(0.72);
    expect(out.merged.b).toBe(false);
    expect(out.confidence.b).toBe(0.72);
  });
});
