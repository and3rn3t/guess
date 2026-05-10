import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    })
  }
}));

describe('mobilePreferences', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('returns medium difficulty by default when storage is empty', async () => {
    const { loadMobilePreferences } = await import('./mobilePreferences');

    await expect(loadMobilePreferences()).resolves.toEqual({
      difficulty: 'medium',
      selectedCategories: [],
      teachingLessonIndex: 0
    });
  });

  it('loads saved difficulty from storage', async () => {
    storage.set(
      '@guess/mobile/preferences/v1',
      JSON.stringify({
        difficulty: 'hard',
        selectedCategories: ['anime', 'movies'],
        teachingLessonIndex: 2
      })
    );

    const { loadMobilePreferences } = await import('./mobilePreferences');

    await expect(loadMobilePreferences()).resolves.toEqual({
      difficulty: 'hard',
      selectedCategories: ['anime', 'movies'],
      teachingLessonIndex: 2
    });
  });

  it('loads legacy difficulty-only payloads and defaults categories to empty', async () => {
    storage.set('@guess/mobile/preferences/v1', JSON.stringify({ difficulty: 'easy' }));

    const { loadMobilePreferences } = await import('./mobilePreferences');

    await expect(loadMobilePreferences()).resolves.toEqual({
      difficulty: 'easy',
      selectedCategories: [],
      teachingLessonIndex: 0
    });
  });

  it('falls back to medium difficulty when storage is malformed', async () => {
    storage.set('@guess/mobile/preferences/v1', '{bad-json');

    const { loadMobilePreferences } = await import('./mobilePreferences');

    await expect(loadMobilePreferences()).resolves.toEqual({
      difficulty: 'medium',
      selectedCategories: [],
      teachingLessonIndex: 0
    });
  });

  it('persists selected difficulty and categories to storage', async () => {
    const { loadMobilePreferences, saveMobilePreferences } = await import('./mobilePreferences');

    await saveMobilePreferences({
      difficulty: 'easy',
      selectedCategories: ['comics', 'books'],
      teachingLessonIndex: 1
    });

    await expect(loadMobilePreferences()).resolves.toEqual({
      difficulty: 'easy',
      selectedCategories: ['comics', 'books'],
      teachingLessonIndex: 1
    });
  });

  it('sanitizes unknown categories before persisting', async () => {
    const { loadMobilePreferences, saveMobilePreferences } = await import('./mobilePreferences');

    await saveMobilePreferences({
      difficulty: 'hard',
      selectedCategories: ['movies', 'bad-category' as 'movies'],
      teachingLessonIndex: -3
    });

    await expect(loadMobilePreferences()).resolves.toEqual({
      difficulty: 'hard',
      selectedCategories: ['movies'],
      teachingLessonIndex: 0
    });
  });
});
