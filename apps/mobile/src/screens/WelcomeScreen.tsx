import type { ReactElement } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useEffect, useRef } from "react";
import { colors, radii, spacing, typography } from "./tokens";
import { useHaptics } from "./useHaptics";
import { useReduceMotion } from "../native/useNativeServices";
import type { MobilePhaseScreenProps } from "./types";

export function WelcomeScreen({
  dispatch,
  server,
}: MobilePhaseScreenProps): ReactElement {
  const { trigger, success } = useHaptics();
  const reduceMotion = useReduceMotion();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: reduceMotion ? 0 : 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, reduceMotion]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={[styles.hero, { opacity: fadeAnim }]}>
        <Text style={styles.eyebrow} accessibilityRole="header">
          Andernator
        </Text>
        <Text style={styles.title}>Think of a{"\n"}character.</Text>
        <Text style={styles.subtitle}>
          The AI will ask yes/no questions to figure out who you're thinking of.
        </Text>
      </Animated.View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={server.isLoading ? "Starting game" : "Start game"}
          accessibilityState={{ disabled: server.isLoading, busy: server.isLoading }}
          disabled={server.isLoading}
          onPress={() => {
            void success();
            void server.startGame();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {server.isLoading ? "Starting…" : "Start Game"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Daily challenge"
          onPress={() => {
            void trigger("light");
            dispatch({ type: "GO_TO_CHALLENGE" });
          }}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Daily Challenge</Text>
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
    lineHeight: 24,
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

