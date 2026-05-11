import type { MobileGamePhase } from '../state/mobileGameState';

export interface PhaseTransitionProfile {
  fadeDurationMs: number;
  slideDurationMs: number;
  startOpacity: number;
  startOffsetY: number;
}

const FAST_TRANSITION_PHASES = new Set<MobileGamePhase>([
  'stats',
  'history',
  'compare',
  'preferences',
  'teaching',
  'describeYourself',
  'feedback'
]);

export function getPhaseTransitionProfile(
  phase: MobileGamePhase
): PhaseTransitionProfile {
  if (FAST_TRANSITION_PHASES.has(phase)) {
    return {
      fadeDurationMs: 120,
      slideDurationMs: 150,
      startOpacity: 0.9,
      startOffsetY: 4
    };
  }

  if (phase === 'playing' || phase === 'guessing') {
    return {
      fadeDurationMs: 190,
      slideDurationMs: 240,
      startOpacity: 0.84,
      startOffsetY: 10
    };
  }

  return {
    fadeDurationMs: 160,
    slideDurationMs: 210,
    startOpacity: 0.87,
    startOffsetY: 8
  };
}
