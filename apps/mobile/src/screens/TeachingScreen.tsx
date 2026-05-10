import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MobileGameState } from '../state/mobileGameState';
import {
  clampLessonIndex,
  getAdjacentLessonLabel,
  getLessonAnnouncement,
  getLessonStatus,
  getLessonPositionLabel,
  inferLessonIndexFromGuessCount,
  TEACHING_LESSONS
} from './teachingProgress';

interface TeachingScreenProps {
  state: MobileGameState;
  lessonIndex: number;
  onLessonIndexChange: (index: number) => void;
  onOpenFeedback: () => void;
  onBackToWelcome: () => void;
}

export function TeachingScreen({
  state,
  lessonIndex,
  onLessonIndexChange,
  onOpenFeedback,
  onBackToWelcome
}: Readonly<TeachingScreenProps>): ReactElement {
  const inferredIndex = inferLessonIndexFromGuessCount(state.guessCount);
  const [activeLessonIndex, setActiveLessonIndex] = useState(
    clampLessonIndex(Math.max(lessonIndex, inferredIndex))
  );

  useEffect(() => {
    setActiveLessonIndex(clampLessonIndex(Math.max(lessonIndex, inferredIndex)));
  }, [inferredIndex, lessonIndex]);

  useEffect(() => {
    if (activeLessonIndex !== lessonIndex) {
      onLessonIndexChange(activeLessonIndex);
    }
  }, [activeLessonIndex, lessonIndex, onLessonIndexChange]);

  const activeLesson = TEACHING_LESSONS[activeLessonIndex];
  const { lessonPositionLabel, lessonAnnouncement, previousLessonLabel, nextLessonLabel } = useMemo(
    () => ({
      lessonPositionLabel: getLessonPositionLabel(activeLessonIndex),
      lessonAnnouncement: getLessonAnnouncement(activeLessonIndex),
      previousLessonLabel: getAdjacentLessonLabel(activeLessonIndex, 'previous'),
      nextLessonLabel: getAdjacentLessonLabel(activeLessonIndex, 'next'),
    }),
    [activeLessonIndex]
  );

  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>TEACHING</Text>
        <Text style={styles.title}>Teaching</Text>
        <Text style={styles.subtitle}>Guided lessons to improve question quality, recovery, and guess timing.</Text>
      </View>

      <View style={styles.lessonsBlock}>
        <Text style={styles.lessonsLabel}>Lesson Progress</Text>
        {TEACHING_LESSONS.map((lesson, index) => {
          const status = getLessonStatus(index, activeLessonIndex);

          return (
            <Pressable
              key={lesson.id}
              onPress={() => {
                setActiveLessonIndex(index);
              }}
              style={[
                styles.lessonItem,
                status === 'active' ? styles.lessonItemActive : null
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${lesson.title}: ${status}`}
              accessibilityHint="Double tap to jump to this lesson"
            >
              <Text style={styles.lessonKey}>{lesson.title}</Text>
              <Text style={styles.lessonValue}>
                {status === 'done' ? 'Done' : status === 'active' ? 'Active' : 'Up next'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.lessonDetailBlock}>
        <Text
          style={styles.lessonPosition}
          accessibilityRole="text"
          accessibilityLabel={lessonAnnouncement}
        >
          {lessonPositionLabel}
        </Text>
        <Text style={styles.lessonDetailTitle}>{activeLesson.title}</Text>
        <Text style={styles.lessonDetailText}>Goal: {activeLesson.goal}</Text>
        <Text style={styles.lessonDetailText}>Tip: {activeLesson.tip}</Text>
        <Text style={styles.lessonDetailSignal}>Success signal: {activeLesson.successSignal}</Text>

        <View style={styles.lessonNavRow}>
          <Pressable
            onPress={() => {
              setActiveLessonIndex((index) => clampLessonIndex(index - 1));
            }}
            disabled={activeLessonIndex === 0}
            style={[
              styles.lessonNavButton,
              activeLessonIndex === 0 ? styles.lessonNavButtonDisabled : null
            ]}
            accessibilityRole="button"
            accessibilityHint="Moves to the previous teaching lesson"
            accessibilityLabel={
              activeLessonIndex === 0
                ? 'Previous lesson unavailable. You are on the first lesson.'
                : `Previous lesson. ${previousLessonLabel}`
            }
          >
            <Text style={styles.lessonNavLabel}>Previous</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setActiveLessonIndex((index) => clampLessonIndex(index + 1));
            }}
            disabled={activeLessonIndex >= TEACHING_LESSONS.length - 1}
            style={[
              styles.lessonNavButton,
              activeLessonIndex >= TEACHING_LESSONS.length - 1 ? styles.lessonNavButtonDisabled : null
            ]}
            accessibilityRole="button"
            accessibilityHint="Moves to the next teaching lesson"
            accessibilityLabel={
              activeLessonIndex >= TEACHING_LESSONS.length - 1
                ? 'Next lesson unavailable. You are on the final lesson.'
                : `Next lesson. ${nextLessonLabel}`
            }
          >
            <Text style={styles.lessonNavLabel}>Next</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.metricsBlock}>
        <Text style={styles.metricsLabel}>Current Session Context</Text>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Guesses</Text>
          <Text style={styles.metricValue}>{state.guessCount}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricKey}>Confidence</Text>
          <Text style={styles.metricValue}>{state.guessConfidence ?? 'n/a'}</Text>
        </View>
      </View>

      <View style={styles.actionsBlock}>
        <Pressable onPress={onOpenFeedback} style={[styles.actionButton, styles.actionPrimary]}>
          <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>Open Feedback</Text>
        </Pressable>
        <Pressable onPress={onBackToWelcome} style={[styles.actionButton, styles.actionSecondary]}>
          <Text style={[styles.actionLabel, styles.actionLabelSecondary]}>Back To Welcome</Text>
        </Pressable>
      </View>

      {state.lastError ? <Text style={styles.errorText}>{state.lastError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 22
  },
  headerBlock: {
    gap: 8
  },
  phasePill: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '800',
    color: '#101828',
    backgroundColor: '#d1fadf',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  title: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '800'
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24
  },
  lessonsBlock: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a'
  },
  lessonsLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  lessonItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  lessonItemActive: {
    borderColor: '#7c3aed',
    backgroundColor: '#1e1245'
  },
  lessonKey: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500'
  },
  lessonValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700'
  },
  lessonDetailBlock: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a'
  },
  lessonDetailTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700'
  },
  lessonPosition: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  lessonDetailText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 21
  },
  lessonDetailSignal: {
    color: '#93c5fd',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600'
  },
  lessonNavRow: {
    flexDirection: 'row',
    gap: 8
  },
  lessonNavButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10
  },
  lessonNavButtonDisabled: {
    opacity: 0.5
  },
  lessonNavLabel: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600'
  },
  metricsBlock: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a'
  },
  metricsLabel: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  metricItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  metricKey: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '500'
  },
  metricValue: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700'
  },
  actionsBlock: {
    gap: 10
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionPrimary: {
    backgroundColor: '#7c3aed'
  },
  actionSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6b7280'
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '700'
  },
  actionLabelPrimary: {
    color: '#ffffff'
  },
  actionLabelSecondary: {
    color: '#d1d5db'
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#7f1d1d'
  }
});
