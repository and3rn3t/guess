import type { ReactElement } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing, typography } from "./tokens";
import { useHaptics } from "./useHaptics";
import { useScreenEntranceMotion } from "./useScreenEntranceMotion";
import type { MobilePhaseScreenProps } from "./types";

export function WelcomeScreen({
  dispatch,
  server,
}: MobilePhaseScreenProps): ReactElement {
  const { trigger, success } = useHaptics();
  const heroEntrance = useScreenEntranceMotion(0);
  const actionsEntrance = useScreenEntranceMotion(80);

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
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
            Andernator
          </Text>
          <Text style={styles.title} maxFontSizeMultiplier={1.6}>
            Think of a{"\n"}character.
          </Text>
          <Text style={styles.subtitle} maxFontSizeMultiplier={1.6}>
            The AI will ask yes/no questions to figure out who you're thinking of.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.actions, actionsEntrance]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={server.isLoading ? "Starting game" : "Start game"}
            accessibilityHint="Starts a new game session"
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
              {server.isLoading ? "Starting…" : "Start Game"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Daily challenge"
            accessibilityHint="Opens today's shared challenge mode"
            accessibilityState={{ disabled: server.isLoading }}
            disabled={server.isLoading}
            onPress={() => {
              void trigger("light");
              dispatch({ type: "GO_TO_CHALLENGE" });
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              server.isLoading && styles.buttonDisabled,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText} maxFontSizeMultiplier={1.4}>
              Daily Challenge
            </Text>
          </Pressable>
        </Animated.View>

        {server.alertMessage || server.error ? (
          <Pressable
            accessibilityRole="alert"
            onPress={() => {
              server.clearAlert();
              server.clearError();
            }}
            style={styles.alert}
          >
            <Text style={styles.alertText} maxFontSizeMultiplier={1.5}>
              {server.alertMessage ?? server.error}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background as never,
  },
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
  subtitle: {
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
  secondaryButton: {
    borderRadius: radii.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.secondaryBorder as never,
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
    color: colors.primaryBg as never,
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

