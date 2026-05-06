import type { ReactElement } from "react";
import { Animated, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing, typography } from "./tokens";
import { useHaptics } from "./useHaptics";
import { useScreenEntranceMotion } from "./useScreenEntranceMotion";
import type { MobilePhaseScreenProps } from "./types";

export function GameOverScreen({
  dispatch,
  state,
  server,
}: MobilePhaseScreenProps): ReactElement {
  const { trigger } = useHaptics();
  const char = server.guessCharacter;
  const aiWon = !state.exhausted && !state.surrendered;
  const resultEntrance = useScreenEntranceMotion(0);
  const detailsEntrance = useScreenEntranceMotion(80);

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
        <Animated.View style={[styles.resultBadge, resultEntrance]}>
          <Text style={styles.resultEmoji} maxFontSizeMultiplier={1.2}>
            {aiWon ? "🤖" : "🏆"}
          </Text>
          <Text style={styles.resultHeadline} maxFontSizeMultiplier={1.6}>
            {aiWon ? "The AI got it!" : "You win!"}
          </Text>
          <Text style={styles.resultSubheadline} maxFontSizeMultiplier={1.5}>
            {aiWon
              ? `Figured it out in ${state.guessCount} question${state.guessCount === 1 ? "" : "s"}.`
              : state.surrendered
                ? "The AI gave up."
                : "The AI ran out of questions."}
          </Text>
        </Animated.View>

        {char ? (
          <Animated.View style={[styles.characterCard, detailsEntrance]}>
          {char.imageUrl ? (
            <Image
              source={{ uri: char.imageUrl }}
              style={styles.portrait}
              accessibilityLabel={`Portrait of ${char.name}`}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.portrait, styles.portraitPlaceholder]}>
              <Text style={styles.portraitPlaceholderText} maxFontSizeMultiplier={1.2}>
                ?
              </Text>
            </View>
          )}
          <View style={styles.characterInfo}>
            <Text style={styles.characterName} maxFontSizeMultiplier={1.6}>
              {char.name}
            </Text>
            {char.category ? (
              <View style={styles.categoryChip}>
                <Text style={styles.categoryChipText} maxFontSizeMultiplier={1.4}>
                  {char.category}
                </Text>
              </View>
            ) : null}
          </View>
          </Animated.View>
        ) : null}

        <Animated.View style={[styles.actions, detailsEntrance]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share result"
          onPress={() => void handleShare()}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText} maxFontSizeMultiplier={1.4}>
            Share Result
          </Text>
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
          <Text style={styles.primaryButtonText} maxFontSizeMultiplier={1.4}>
            Play Again
          </Text>
        </Pressable>
        </Animated.View>
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
    ...typography.largeTitle,
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
    ...typography.title1,
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

