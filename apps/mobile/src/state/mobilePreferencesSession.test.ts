import { describe, expect, it } from 'vitest';
import {
  clampTeachingLessonIndex,
  createMobilePreferencesSessionState,
  hydrateMobilePreferencesSessionState,
  toPersistedMobilePreferences,
  toggleMobilePreferencesCategory
} from './mobilePreferencesSession';

describe('mobilePreferencesSession', () => {
  it('creates a non-hydrated default session state', () => {
    expect(createMobilePreferencesSessionState()).toEqual({
      difficulty: 'medium',
      selectedCategories: [],
      teachingLessonIndex: 0,
      hydrated: false
    });
  });

  it('hydrates session state from persisted preferences', () => {
    expect(
      hydrateMobilePreferencesSessionState({
        difficulty: 'hard',
        selectedCategories: ['anime', 'movies'],
        teachingLessonIndex: 2
      })
    ).toEqual({
      difficulty: 'hard',
      selectedCategories: ['anime', 'movies'],
      teachingLessonIndex: 2,
      hydrated: true
    });
  });

  it('supports preference round-trip hydrate mutate persist', () => {
    let session = hydrateMobilePreferencesSessionState({
      difficulty: 'easy',
      selectedCategories: ['anime'],
      teachingLessonIndex: 1
    });

    session = {
      ...session,
      difficulty: 'medium',
      selectedCategories: toggleMobilePreferencesCategory(session.selectedCategories, 'movies'),
      teachingLessonIndex: clampTeachingLessonIndex(3)
    };

    expect(toPersistedMobilePreferences(session)).toEqual({
      difficulty: 'medium',
      selectedCategories: ['anime', 'movies'],
      teachingLessonIndex: 3
    });
  });

  it('toggles categories deterministically', () => {
    const selected = ['anime', 'movies'] as const;

    expect(toggleMobilePreferencesCategory(selected, 'movies')).toEqual(['anime']);
    expect(toggleMobilePreferencesCategory(selected, 'books')).toEqual(['anime', 'movies', 'books']);
  });

  it('clamps invalid teaching lesson indexes', () => {
    expect(clampTeachingLessonIndex(-5)).toBe(0);
    expect(clampTeachingLessonIndex(2.8)).toBe(2);
    expect(clampTeachingLessonIndex(Number.NaN)).toBe(0);
  });
});
