export interface TeachingLesson {
  id: 'question-strategy' | 'contradiction-recovery' | 'guess-timing';
  title: string;
  goal: string;
  tip: string;
  successSignal: string;
}

export const TEACHING_LESSONS: readonly TeachingLesson[] = [
  {
    id: 'question-strategy',
    title: 'Question Strategy',
    goal: 'Bias toward high-split questions early to shrink candidate space quickly.',
    tip: 'Use high-confidence binary answers first; save uncertain answers for later turns.',
    successSignal: 'Remaining pool drops rapidly in the first 3 questions.'
  },
  {
    id: 'contradiction-recovery',
    title: 'Contradiction Recovery',
    goal: 'Recover cleanly after contradictory answers without losing session momentum.',
    tip: 'When contradiction appears, answer the follow-up with your strongest known fact.',
    successSignal: 'You return to stable question flow in 1-2 turns.'
  },
  {
    id: 'guess-timing',
    title: 'Guess Timing',
    goal: 'Recognize when certainty is high enough to confirm instead of over-questioning.',
    tip: 'When confidence is high and alternatives are weak, confirm quickly and preserve score.',
    successSignal: 'Guess confirmations happen with fewer late-game reversals.'
  }
] as const;

export type TeachingLessonStatus = 'done' | 'active' | 'up-next';

export function clampLessonIndex(index: number): number {
  if (index < 0) {
    return 0;
  }

  const lastIndex = TEACHING_LESSONS.length - 1;
  if (index > lastIndex) {
    return lastIndex;
  }

  return index;
}

export function inferLessonIndexFromGuessCount(guessCount: number): number {
  if (guessCount >= 3) {
    return 2;
  }

  if (guessCount >= 1) {
    return 1;
  }

  return 0;
}

export function getLessonStatus(index: number, activeIndex: number): TeachingLessonStatus {
  if (index < activeIndex) {
    return 'done';
  }

  if (index === activeIndex) {
    return 'active';
  }

  return 'up-next';
}

export function getLessonPositionLabel(activeIndex: number): string {
  const clampedIndex = clampLessonIndex(activeIndex);
  return `Lesson ${clampedIndex + 1} of ${TEACHING_LESSONS.length}`;
}

export function getTeachingProgressSummary(activeIndex: number): string {
  const clampedIndex = clampLessonIndex(activeIndex);
  return `Teaching progress: lesson ${clampedIndex + 1}/${TEACHING_LESSONS.length}`;
}

export function getLessonAnnouncement(activeIndex: number): string {
  const clampedIndex = clampLessonIndex(activeIndex);
  const lesson = TEACHING_LESSONS[clampedIndex];
  return `${getLessonPositionLabel(clampedIndex)}: ${lesson.title}.`;
}

export function getAdjacentLessonLabel(activeIndex: number, direction: 'previous' | 'next'): string {
  const clampedIndex = clampLessonIndex(activeIndex);
  const delta = direction === 'previous' ? -1 : 1;
  const targetIndex = clampLessonIndex(clampedIndex + delta);
  return getLessonPositionLabel(targetIndex);
}
