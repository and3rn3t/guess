import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Difficulty } from '../network/mobileGameApi';
import {
  MOBILE_CHARACTER_CATEGORIES,
  type MobileCharacterCategory
} from './mobileCategories';

const PREFERENCES_STORAGE_KEY = '@guess/mobile/preferences/v1';

export interface MobilePreferences {
  difficulty: Difficulty;
  selectedCategories: MobileCharacterCategory[];
  teachingLessonIndex: number;
}

const DEFAULT_PREFERENCES: MobilePreferences = {
  difficulty: 'medium',
  selectedCategories: [],
  teachingLessonIndex: 0
};

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard';
}

function isCharacterCategory(value: unknown): value is MobileCharacterCategory {
  return (
    typeof value === 'string' &&
    (MOBILE_CHARACTER_CATEGORIES as readonly string[]).includes(value)
  );
}

function sanitizeCategories(value: unknown): MobileCharacterCategory[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isCharacterCategory);
}

function sanitizeTeachingLessonIndex(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  const rounded = Math.floor(value);
  return rounded < 0 ? 0 : rounded;
}

export async function loadMobilePreferences(): Promise<MobilePreferences> {
  const raw = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'difficulty' in parsed &&
      isDifficulty((parsed as { difficulty?: unknown }).difficulty)
    ) {
      return {
        difficulty: (parsed as { difficulty: Difficulty }).difficulty,
        selectedCategories: sanitizeCategories(
          (parsed as { selectedCategories?: unknown }).selectedCategories
        ),
        teachingLessonIndex: sanitizeTeachingLessonIndex(
          (parsed as { teachingLessonIndex?: unknown }).teachingLessonIndex
        )
      };
    }
  } catch {
    return DEFAULT_PREFERENCES;
  }

  return DEFAULT_PREFERENCES;
}

export async function saveMobilePreferences(preferences: MobilePreferences): Promise<void> {
  await AsyncStorage.setItem(
    PREFERENCES_STORAGE_KEY,
    JSON.stringify({
      difficulty: preferences.difficulty,
      selectedCategories: sanitizeCategories(preferences.selectedCategories),
      teachingLessonIndex: sanitizeTeachingLessonIndex(preferences.teachingLessonIndex)
    })
  );
}
