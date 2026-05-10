import { describe, expect, it } from 'vitest';
import { buildQuickStartSummary } from './mobileQuickStartSummary';

describe('buildQuickStartSummary', () => {
  it('returns all-categories summary when no categories are selected', () => {
    expect(buildQuickStartSummary('medium', [])).toBe(
      'Medium difficulty with all categories enabled.'
    );
  });

  it('returns concise category summary for one or two selected categories', () => {
    expect(buildQuickStartSummary('easy', ['anime'])).toBe(
      'Easy difficulty focused on Anime.'
    );

    expect(buildQuickStartSummary('hard', ['anime', 'movies'])).toBe(
      'Hard difficulty focused on Anime + Movies.'
    );
  });

  it('returns compact +more summary when more than two categories are selected', () => {
    expect(buildQuickStartSummary('medium', ['anime', 'movies', 'books'])).toBe(
      'Medium difficulty focused on Anime + Movies +1 more.'
    );
  });
});
