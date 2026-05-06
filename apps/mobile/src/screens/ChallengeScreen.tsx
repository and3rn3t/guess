import type { ReactElement } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "./tokens";
import { useHaptics } from "./useHaptics";
import { useScreenEntranceMotion } from "./useScreenEntranceMotion";
import type { MobilePhaseScreenProps } from "./types";

function getTodayLabel(): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

export function ChallengeScreen({
  dispatch,
  server,
}: MobilePhaseScreenProps): ReactElement {
  const { trigger, success } = useHaptics();
  const heroEntrance = useScreenEntranceMotion(0);
  const actionsEntrance = useScreenEntranceMotion(80);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={[styles.hero, heroEntrance]}>
        <Text style={styles.eyebrow} accessibilityRole="header">
          Daily Challenge
        </Text>
        <Text style={styles.title} maxFontSizeMultiplier={1.6}>
          Today's{"\n"}Puzzle
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText} maxFontSizeMultiplier={1.4}>
              📅 {getTodayLabel()}
            </Text>
          </View>
          <View style={styles.metaBadge}>
            <Text style={styles.metaBadgeText} maxFontSizeMultiplier={1.4}>
              🤖 AI vs You
            </Text>
          </View>
        </View>
        <Text style={styles.description} maxFontSizeMultiplier={1.6}>
          Everyone plays with the same character today. Think of it, then see if the AI can figure it out!
        </Text>
      </Animated.View>

      <Animated.View style={[styles.actions, actionsEntrance]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={server.isLoading ? "Starting challenge" : "Start today's challenge"}
          accessibilityState={{ disabled: server.isLoading, busy: server.isLoading }}
          disabled={server.isLoading}
          onPress={() => {
            void success();
            void server.startGame();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            server.isLoading && styles.buttonDisabled,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText} maxFontSizeMultiplier={1.4}>
            {server.isLoading ? "Starting…" : "Start Challenge"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel and return to home"
          onPress={() => {
            void trigger("light");
            dispatch({ type: "BACK_TO_WELCOME" });
          }}
          style={({ pressed }) => [
            styles.tertiaryButton,
            pressed && styles.tertiaryButtonPressed,
          ]}
        >
          <Text style={styles.tertiaryButtonText} maxFontSizeMultiplier={1.4}>
            Cancel
          </Text>
        </Pressable>
      </Animated.View>
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
    paddingTop: spacing.screenV * 2,
    paddingBottom: spacing.screenV,
    gap: spacing.sectionGap * 2,
    justifyContent: "space-between",
  },
  hero: {
    gap: spacing.sectionGap,
  },
  eyebrow: {
    ...typography.caption,
    color: colors.secondaryLabel as never,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  title: {
    ...typography.largeTitle,
    color: colors.label as never,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.rowGap,
    flexWrap: "wrap",
  },
  metaBadge: {
    backgroundColor: colors.fill as never,
    borderRadius: radii.chip,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  metaBadgeText: {
    ...typography.footnote,
    color: colors.secondaryLabel as never,
  },
  description: {
    ...typography.body,
    color: colors.secondaryLabel as never,
  },
  actions: {
    gap: spacing.rowGap,
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
  buttonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.primaryFg,
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
});

