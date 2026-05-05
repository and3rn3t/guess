import type { ReactElement } from "react";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "./tokens";
import { useHaptics } from "./useHaptics";
import type { MobilePhaseScreenProps } from "./types";

function ProgressBar({ total, remaining }: { total: number; remaining: number }): ReactElement {
  const progress = total > 0 ? (total - remaining) / total : 0;
  return (
    <View style={progressStyles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: total - remaining }}>
      <View style={[progressStyles.fill, { flex: progress }]} />
      <View style={[progressStyles.empty, { flex: 1 - progress }]} />
    </View>
  );
}

const progressStyles = StyleSheet.create({
  track: {
    flexDirection: "row",
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: spacing.sectionGap,
  },
  fill: {
    backgroundColor: colors.primaryBg as never,
  },
  empty: {
    backgroundColor: colors.fill as never,
  },
});

export function PlayingScreen({
  server,
}: MobilePhaseScreenProps): ReactElement {
  const { trigger, success } = useHaptics();
  const [reasoningExpanded, setReasoningExpanded] = useState(false);

  // Total questions heuristic: 20 questions max — show progress relative to remaining
  const TOTAL_QUESTIONS = 20;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <ProgressBar total={TOTAL_QUESTIONS} remaining={server.remaining} />

      <View style={styles.questionCard}>
        <Text style={styles.questionMeta} accessibilityElementsHidden>
          Question {Math.max(1, TOTAL_QUESTIONS - server.remaining)} of {TOTAL_QUESTIONS}
        </Text>
        <Text
          style={styles.questionText}
          accessibilityRole="header"
          accessibilityLabel={`Question: ${server.question?.text ?? "Loading…"}`}
        >
          {server.question?.text ?? "Loading…"}
        </Text>
      </View>

      {server.reasoning?.explanation ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reasoningExpanded ? "Hide AI reasoning" : "Show AI reasoning"}
          accessibilityState={{ expanded: reasoningExpanded }}
          onPress={() => setReasoningExpanded((v) => !v)}
          style={styles.reasoningToggle}
        >
          <Text style={styles.reasoningToggleText}>
            {reasoningExpanded ? "Hide reasoning ▲" : "AI reasoning ▼"}
          </Text>
        </Pressable>
      ) : null}

      {reasoningExpanded && server.reasoning?.explanation ? (
        <View style={styles.reasoningCard}>
          <Text style={styles.reasoningText}>{server.reasoning.explanation}</Text>
          {server.reasoning.confidence !== undefined ? (
            <Text style={styles.confidenceText}>
              Confidence: {Math.round(server.reasoning.confidence * 100)}%
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yes"
          accessibilityHint="The answer to this question is yes"
          accessibilityState={{ disabled: server.isLoading }}
          disabled={server.isLoading}
          onPress={() => {
            void success();
            void server.submitAnswer("yes");
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Yes</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="No"
          accessibilityHint="The answer to this question is no"
          accessibilityState={{ disabled: server.isLoading }}
          disabled={server.isLoading}
          onPress={() => {
            void trigger("light");
            void server.submitAnswer("no");
          }}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>No</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip question"
          accessibilityState={{ disabled: server.isLoading }}
          disabled={server.isLoading}
          onPress={() => {
            void trigger("light");
            void server.skipQuestion();
          }}
          style={({ pressed }) => [
            styles.tertiaryButton,
            pressed && styles.tertiaryButtonPressed,
          ]}
        >
          <Text style={styles.tertiaryButtonText}>Skip</Text>
        </Pressable>
      </View>

      {server.alertMessage ? (
        <Pressable
          accessibilityRole="alert"
          onPress={server.clearAlert}
          style={styles.alert}
        >
          <Text style={styles.alertText}>{server.alertMessage}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background as never,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.screenV,
    paddingBottom: spacing.screenV,
    gap: spacing.sectionGap,
  },
  questionCard: {
    backgroundColor: colors.cardBackground as never,
    borderRadius: radii.card,
    padding: spacing.screenH,
    gap: spacing.rowGap / 2,
  },
  questionMeta: {
    ...typography.caption,
    color: colors.secondaryLabel as never,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  questionText: {
    ...typography.title2,
    color: colors.label as never,
    lineHeight: 30,
  },
  reasoningToggle: {
    paddingVertical: 6,
    minHeight: spacing.minTouch,
    justifyContent: "center",
  },
  reasoningToggleText: {
    ...typography.footnote,
    color: colors.secondaryLabel as never,
  },
  reasoningCard: {
    backgroundColor: colors.fill as never,
    borderRadius: radii.card,
    padding: spacing.screenH,
    gap: spacing.rowGap / 2,
  },
  reasoningText: {
    ...typography.callout,
    color: colors.secondaryLabel as never,
    lineHeight: 22,
  },
  confidenceText: {
    ...typography.footnote,
    color: colors.secondaryLabel as never,
  },
  actions: {
    gap: spacing.rowGap,
    marginTop: spacing.sectionGap,
  },
  primaryButton: {
    backgroundColor: colors.primaryBg as never,
    borderRadius: radii.button,
    paddingVertical: spacing.buttonV,
    paddingHorizontal: spacing.buttonH,
    alignItems: "center",
    minHeight: spacing.minTouch,
    justifyContent: "center",
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.primaryFg,
  },
  secondaryButton: {
    borderRadius: radii.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.secondaryBorder as never,
    backgroundColor: colors.cardBackground as never,
    paddingVertical: spacing.buttonV,
    paddingHorizontal: spacing.buttonH,
    alignItems: "center",
    minHeight: spacing.minTouch,
    justifyContent: "center",
  },
  secondaryButtonPressed: {
    backgroundColor: colors.fill as never,
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.label as never,
  },
  tertiaryButton: {
    paddingVertical: spacing.buttonV,
    paddingHorizontal: spacing.buttonH,
    alignItems: "center",
    minHeight: spacing.minTouch,
    justifyContent: "center",
  },
  tertiaryButtonPressed: {
    opacity: 0.6,
  },
  tertiaryButtonText: {
    ...typography.callout,
    color: colors.secondaryLabel as never,
  },
  alert: {
    backgroundColor: colors.fill as never,
    borderRadius: radii.card,
    padding: spacing.screenH,
  },
  alertText: {
    ...typography.footnote,
    color: colors.secondaryLabel as never,
    textAlign: "center",
  },
});

