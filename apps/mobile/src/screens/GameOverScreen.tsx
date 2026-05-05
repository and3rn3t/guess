import type { ReactElement } from "react";
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "./tokens";
import { useHaptics } from "./useHaptics";
import type { MobilePhaseScreenProps } from "./types";

export function GameOverScreen({
  dispatch,
  state,
  server,
}: MobilePhaseScreenProps): ReactElement {
  const { trigger } = useHaptics();
  const char = server.guessCharacter;
  const aiWon = !state.exhausted && !state.surrendered;

  const handleShare = async () => {
    const characterName = char?.name ?? "the character";
    const outcome = aiWon
      ? `The AI guessed ${characterName} in ${state.guessCount} question(s)! 🤖`
      : `I stumped the AI! It couldn't guess ${characterName}. 🎉`;
    try {
      await Share.share({
        message: `${outcome}\n\nPlay Andernator: https://andernator.pages.dev`,
      });
    } catch {
      // dismissed
    }
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.resultBadge}>
        <Text style={styles.resultEmoji}>{aiWon ? "🤖" : "🏆"}</Text>
        <Text style={styles.resultHeadline}>
          {aiWon ? "The AI got it!" : "You win!"}
        </Text>
        <Text style={styles.resultSubheadline}>
          {aiWon
            ? `Figured it out in ${state.guessCount} question${state.guessCount === 1 ? "" : "s"}.`
            : state.surrendered
              ? "The AI gave up."
              : "The AI ran out of questions."}
        </Text>
      </View>

      {char ? (
        <View style={styles.characterCard}>
          {char.imageUrl ? (
            <Image
              source={{ uri: char.imageUrl }}
              style={styles.portrait}
              accessibilityLabel={`Portrait of ${char.name}`}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.portrait, styles.portraitPlaceholder]}>
              <Text style={styles.portraitPlaceholderText}>?</Text>
            </View>
          )}
          <View style={styles.characterInfo}>
            <Text style={styles.characterName}>{char.name}</Text>
            {char.category ? (
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText}>{char.category}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share result"
          onPress={() => void handleShare()}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Share Result</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Play again"
          onPress={() => {
            void trigger("medium");
            dispatch({ type: "BACK_TO_WELCOME" });
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Play Again</Text>
        </Pressable>
      </View>
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
    gap: spacing.sectionGap * 1.5,
  },
  resultBadge: {
    alignItems: "center",
    gap: spacing.rowGap / 2,
    paddingVertical: spacing.sectionGap,
  },
  resultEmoji: {
    fontSize: 56,
    lineHeight: 64,
  },
  resultHeadline: {
    ...typography.title1,
    color: colors.label as never,
    textAlign: "center",
  },
  resultSubheadline: {
    ...typography.body,
    color: colors.secondaryLabel as never,
    textAlign: "center",
  },
  characterCard: {
    backgroundColor: colors.cardBackground as never,
    borderRadius: radii.card,
    overflow: "hidden",
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
    fontSize: 60,
    color: colors.secondaryLabel as never,
  },
  characterInfo: {
    padding: spacing.screenH,
    gap: spacing.rowGap / 2,
  },
  characterName: {
    ...typography.title2,
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
    color: colors.primaryBg as never,
  },
});

