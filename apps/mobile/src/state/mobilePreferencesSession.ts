import type { Difficulty } from '../network/mobileGameApi';
import type { MobileCharacterCategory } from './mobileCategories';
import type { MobilePreferences } from './mobilePreferences';

export interface MobilePreferencesSessionState {
  difficulty: Difficulty;
  selectedCategories: MobileCharacterCategory[];
  teachingLessonIndex: number;
  hydrated: boolean;
}

export function createMobilePreferencesSessionState(): MobilePreferencesSessionState {
  return {
    difficulty: 'medium',
    selectedCategories: [],
    teachingLessonIndex: 0,
    hydrated: false
  };
}

export function hydrateMobilePreferencesSessionState(
  preferences: MobilePreferences
): MobilePreferencesSessionState {
  return {
    difficulty: preferences.difficulty,
    selectedCategories: preferences.selectedCategories,
    teachingLessonIndex: clampTeachingLessonIndex(preferences.teachingLessonIndex),
    hydrated: true
  };
}

export function toPersistedMobilePreferences(
  sessionState: MobilePreferencesSessionState
): MobilePreferences {
  return {
    difficulty: sessionState.difficulty,
    selectedCategories: sessionState.selectedCategories,
    teachingLessonIndex: clampTeachingLessonIndex(sessionState.teachingLessonIndex)
  };
}

export function toggleMobilePreferencesCategory(
  selectedCategories: readonly MobileCharacterCategory[],
  category: MobileCharacterCategory
): MobileCharacterCategory[] {
  if (selectedCategories.includes(category)) {
    return selectedCategories.filter((item) => item !== category);
  }

  return [...selectedCategories, category];
}

export function clampTeachingLessonIndex(index: number): number {
  if (!Number.isFinite(index)) {
    return 0;
  }

  const rounded = Math.floor(index);
  return rounded < 0 ? 0 : rounded;
}
