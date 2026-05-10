import type { Difficulty } from './PreferencesScreen';
import {
  MOBILE_CATEGORY_LABELS,
  type MobileCharacterCategory
} from '../state/mobileCategories';

function toDifficultyLabel(difficulty: Difficulty): string {
  if (difficulty === 'easy') {
    return 'Easy';
  }

  if (difficulty === 'hard') {
    return 'Hard';
  }

  return 'Medium';
}

export function buildQuickStartSummary(
  difficulty: Difficulty,
  selectedCategories: readonly MobileCharacterCategory[]
): string {
  const difficultyLabel = toDifficultyLabel(difficulty);
  if (selectedCategories.length === 0) {
    return `${difficultyLabel} difficulty with all categories enabled.`;
  }

  const labelList = selectedCategories.map((category) => MOBILE_CATEGORY_LABELS[category]);
  const categoriesSummary =
    labelList.length <= 2
      ? labelList.join(' + ')
      : `${labelList.slice(0, 2).join(' + ')} +${labelList.length - 2} more`;

  return `${difficultyLabel} difficulty focused on ${categoriesSummary}.`;
}
