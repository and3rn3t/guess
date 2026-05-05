import type { ReactElement } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "./tokens";
import { useHaptics } from "./useHaptics";
import type { MobilePhaseScreenProps } from "./types";

export function GuessingScreen({
  server,
}: MobilePhaseScreenProps): ReactElement {
  const { trigger, success } = useHaptics();
  const char = server.guessCharacter;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>My guess is…</Text>

      <View style={styles.characterCard}>
        {char?.imageUrl ? (
          <Image
            source={{ uri: char.imageUrl }}
            style={styles.portrait}
            accessibilityLabel={char ? `Portrait of ${char.name}` : "Character portrait"}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.portrait, styles.portraitPlaceholder]}>
            <Text style={styles.portraitPlaceholderText}>?</Text>
          </View>
        )}

        <View style={styles.characterInfo}>
          <Text style={styles.characterName}>{char?.name ?? "…"}</Text>
          {char?.category ? (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{char.category}</Text>
            </View>
          ) : null}
        </View>

        {char?.trivia && char.trivia.length > 0 ? (
          <View style={styles.triviaList}>
            {char.trivia.slice(0, 3).map((fact, i) => (
              <View key={i} style={styles.triviaRow}>
                <Text style={styles.triviaBullet}>•</Text>
                <Text style={styles.triviaText}>{fact}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yes, that's correct"
          accessibilityHint="Confirm the AI guessed correctly"
          accessibilityState={{ disabled: server.isLoading }}
          disabled={server.isLoading}
          onPress={() => {
            void success();
            void server.confirmCorrect();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Correct! 🎉</Text>
        </Pressable>

        {char ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Not this one"
            accessibilityHint="The AI's guess is wrong, keep asking questions"
            accessibilityState={{ disabled: server.isLoading }}
            disabled={server.isLoading}
            onPress={() => {
              void trigger("light");
              void server.rejectGuess(char.id);
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Not This One</Text>
          </Pressable>
        ) : null}
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
  eyebrow: {
    ...typography.caption,
    color: colors.secondaryLabel as never,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  characterCard: {
    backgroundColor: colors.cardBackground as never,
    borderRadius: radii.card,
    overflow: "hidden",
    gap: spacing.sectionGap,
  },
  portrait: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: colors.fill as never,
  },
  portraitPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  portraitPlaceholderText: {
    ...typography.largeTitle,
    color: colors.secondaryLabel as never,
    fontSize: 60,
  },
  characterInfo: {
    paddingHorizontal: spacing.screenH,
    gap: spacing.rowGap / 2,
  },
  characterName: {
    ...typography.title1,
    color: colors.label as never,
  },
  categoryChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.fill as never,
    borderRadius: radii.chip,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  categoryChipText: {
    ...typography.caption,
    color: colors.secondaryLabel as never,
  },
  triviaList: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: spacing.screenH,
    gap: spacing.rowGap / 2,
  },
  triviaRow: {
    flexDirection: "row",
    gap: spacing.rowGap / 2,
    alignItems: "flex-start",
  },
  triviaBullet: {
    ...typography.callout,
    color: colors.secondaryLabel as never,
    lineHeight: 22,
  },
  triviaText: {
    ...typography.callout,
    color: colors.secondaryLabel as never,
    lineHeight: 22,
    flex: 1,
  },
  actions: {
    gap: spacing.rowGap,
  },
  primaryButton: {
    backgroundColor: colors.positiveBg as never,
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

