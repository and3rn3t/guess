import { describe, expect, it } from 'vitest';
import { getPhaseTransitionProfile } from './phaseTransitionProfile';

describe('phaseTransitionProfile', () => {
  it('returns fast profile for utility phases', () => {
    const profile = getPhaseTransitionProfile('stats');

    expect(profile).toEqual({
      fadeDurationMs: 120,
      slideDurationMs: 150,
      startOpacity: 0.9,
      startOffsetY: 4
    });
  });

  it('returns gameplay profile for playing and guessing', () => {
    const playingProfile = getPhaseTransitionProfile('playing');
    const guessingProfile = getPhaseTransitionProfile('guessing');

    expect(playingProfile).toEqual({
      fadeDurationMs: 190,
      slideDurationMs: 240,
      startOpacity: 0.84,
      startOffsetY: 10
    });

    expect(guessingProfile).toEqual(playingProfile);
  });

  it('returns default profile for non-utility, non-gameplay phases', () => {
    const profile = getPhaseTransitionProfile('welcome');

    expect(profile).toEqual({
      fadeDurationMs: 160,
      slideDurationMs: 210,
      startOpacity: 0.87,
      startOffsetY: 8
    });
  });
});
