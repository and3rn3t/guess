import { describe, expect, it } from 'vitest';
import {
  getAdjacentLessonLabel,
  getLessonAnnouncement,
  clampLessonIndex,
  getLessonStatus,
  getLessonPositionLabel,
  getTeachingProgressSummary,
  inferLessonIndexFromGuessCount,
  TEACHING_LESSONS
} from './teachingProgress';

describe('teachingProgress helpers', () => {
  it('clamps lesson index into valid range', () => {
    expect(clampLessonIndex(-1)).toBe(0);
    expect(clampLessonIndex(0)).toBe(0);
    expect(clampLessonIndex(1)).toBe(1);
    expect(clampLessonIndex(99)).toBe(TEACHING_LESSONS.length - 1);
  });

  it('infers lesson index from guess count', () => {
    expect(inferLessonIndexFromGuessCount(0)).toBe(0);
    expect(inferLessonIndexFromGuessCount(1)).toBe(1);
    expect(inferLessonIndexFromGuessCount(2)).toBe(1);
    expect(inferLessonIndexFromGuessCount(3)).toBe(2);
    expect(inferLessonIndexFromGuessCount(8)).toBe(2);
  });

  it('returns done active and up-next lesson statuses correctly', () => {
    expect(getLessonStatus(0, 1)).toBe('done');
    expect(getLessonStatus(1, 1)).toBe('active');
    expect(getLessonStatus(2, 1)).toBe('up-next');
  });

  it('returns clamped lesson position labels', () => {
    expect(getLessonPositionLabel(0)).toBe('Lesson 1 of 3');
    expect(getLessonPositionLabel(1)).toBe('Lesson 2 of 3');
    expect(getLessonPositionLabel(99)).toBe('Lesson 3 of 3');
  });

  it('returns teaching progress summary with clamped index', () => {
    expect(getTeachingProgressSummary(0)).toBe('Teaching progress: lesson 1/3');
    expect(getTeachingProgressSummary(2)).toBe('Teaching progress: lesson 3/3');
    expect(getTeachingProgressSummary(99)).toBe('Teaching progress: lesson 3/3');
  });

  it('returns lesson announcement for active lesson', () => {
    expect(getLessonAnnouncement(0)).toBe('Lesson 1 of 3: Question Strategy.');
    expect(getLessonAnnouncement(2)).toBe('Lesson 3 of 3: Guess Timing.');
  });

  it('returns adjacent lesson labels with clamped boundaries', () => {
    expect(getAdjacentLessonLabel(0, 'previous')).toBe('Lesson 1 of 3');
    expect(getAdjacentLessonLabel(0, 'next')).toBe('Lesson 2 of 3');
    expect(getAdjacentLessonLabel(2, 'next')).toBe('Lesson 3 of 3');
    expect(getAdjacentLessonLabel(2, 'previous')).toBe('Lesson 2 of 3');
  });
});
