import { describe, expect, it } from 'vitest';
import {
  createInitialMobileGameState,
  mobileGameReducer,
  type MobileGameState
} from './mobileGameState';

function baseState(overrides: Partial<MobileGameState> = {}): MobileGameState {
  return {
    ...createInitialMobileGameState(),
    ...overrides
  };
}

describe('mobileGameReducer', () => {
  it('stores session on START_SUCCESS', () => {
    const next = mobileGameReducer(
      baseState(),
      {
        type: 'START_SUCCESS',
        sessionId: 'sess-123',
        question: {
          id: 'q1',
          text: 'Is your character from a game?',
          attribute: 'fromGame'
        },
        reasoning: {
          why: 'This split removes 40% of candidates.',
          impact: 'high',
          remaining: 120,
          confidence: 78
        }
      }
    );

    expect(next.phase).toBe('playing');
    expect(next.sessionId).toBe('sess-123');
    expect(next.lastSessionId).toBe('sess-123');
    expect(next.guessCount).toBe(0);
  });

  it('preserves resumable session id on BACK_TO_WELCOME', () => {
    const next = mobileGameReducer(
      baseState({
        phase: 'playing',
        sessionId: 'sess-456',
        lastSessionId: 'sess-456',
        guessCount: 2
      }),
      { type: 'BACK_TO_WELCOME' }
    );

    expect(next.phase).toBe('welcome');
    expect(next.sessionId).toBeNull();
    expect(next.lastSessionId).toBe('sess-456');
    expect(next.guessCount).toBe(0);
  });

  it('hydrates active state from RESUME_SUCCESS', () => {
    const next = mobileGameReducer(
      baseState({ phase: 'resume', lastSessionId: 'sess-789' }),
      {
        type: 'RESUME_SUCCESS',
        sessionId: 'sess-789',
        question: {
          id: 'q2',
          text: 'Is your character a hero?',
          attribute: 'isHero'
        },
        reasoning: {
          why: 'Hero classification gives best split.',
          impact: 'medium',
          remaining: 64,
          confidence: 67
        },
        guessCount: 3
      }
    );

    expect(next.phase).toBe('playing');
    expect(next.sessionId).toBe('sess-789');
    expect(next.lastSessionId).toBe('sess-789');
    expect(next.guessCount).toBe(3);
    expect(next.lastError).toBeNull();
  });

  it('clears session and sets message on RESUME_EXPIRED', () => {
    const next = mobileGameReducer(
      baseState({
        phase: 'resume',
        sessionId: 'sess-old',
        lastSessionId: 'sess-old'
      }),
      { type: 'RESUME_EXPIRED' }
    );

    expect(next.phase).toBe('welcome');
    expect(next.sessionId).toBeNull();
    expect(next.lastSessionId).toBeNull();
    expect(next.lastError).toBe('Saved session expired. Start a new game.');
  });

  it('increments guessCount fallback on REJECT_QUESTION', () => {
    const next = mobileGameReducer(
      baseState({
        phase: 'guessing',
        guessCount: 1,
        finalGuess: {
          id: 'char-1',
          name: 'Mario',
          category: 'games'
        }
      }),
      {
        type: 'REJECT_QUESTION',
        question: {
          id: 'q3',
          text: 'Is your character from Nintendo?',
          attribute: 'fromNintendo'
        },
        reasoning: {
          why: 'High entropy reduction for remaining branch.',
          impact: 'high',
          remaining: 20,
          confidence: 72
        }
      }
    );

    expect(next.phase).toBe('playing');
    expect(next.finalGuess).toBeNull();
    expect(next.guessCount).toBe(2);
  });

  it('opens preferences via OPEN_PHASE without mutating session state', () => {
    const next = mobileGameReducer(
      baseState({
        phase: 'compare',
        sessionId: 'sess-777',
        lastSessionId: 'sess-777',
        guessCount: 4
      }),
      { type: 'OPEN_PHASE', phase: 'preferences' }
    );

    expect(next.phase).toBe('preferences');
    expect(next.sessionId).toBe('sess-777');
    expect(next.lastSessionId).toBe('sess-777');
    expect(next.guessCount).toBe(4);
    expect(next.lastError).toBeNull();
  });

  it('opens teaching via OPEN_PHASE and preserves active gameplay context', () => {
    const next = mobileGameReducer(
      baseState({
        phase: 'preferences',
        sessionId: 'sess-888',
        currentQuestion: {
          id: 'q5',
          text: 'Can your character fly?',
          attribute: 'canFly'
        },
        reasoning: {
          why: 'Flight ability resolves multiple branches quickly.',
          impact: 'high',
          remaining: 18,
          confidence: 74
        }
      }),
      { type: 'OPEN_PHASE', phase: 'teaching' }
    );

    expect(next.phase).toBe('teaching');
    expect(next.sessionId).toBe('sess-888');
    expect(next.currentQuestion?.id).toBe('q5');
    expect(next.reasoning?.confidence).toBe(74);
  });
});
