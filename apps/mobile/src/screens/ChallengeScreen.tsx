import type { ReactElement } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "./tokens";
import { useHaptics } from "./useHaptics";
import type { MobilePhaseScreenProps } from "./types";

export function ChallengeScreen({
  dispatch,
  server,
}: MobilePhaseScreenProps): ReactElement {
  const { trigger, success } = useHaptics();

  return (
    <View style={styles.actionRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: server.isLoading }}
        disabled={server.isLoading}
        onPress={() => {
          success();
          void server.startGame();
        }}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Start Challenge</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          trigger("light");
          dispatch({ type: "BACK_TO_WELCOME" });
        }}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.rowGap,
    marginTop: spacing.rowTop,
  },
  primaryButton: {
    borderRadius: radii.button,
    backgroundColor: colors.primaryBg,
    paddingVertical: spacing.buttonV,
    paddingHorizontal: spacing.buttonH,
  },
  primaryButtonText: {
    color: colors.primaryFg,
    fontSize: typography.buttonSize,
    fontWeight: typography.buttonWeight,
  },
  secondaryButton: {
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.secondaryBorder,
    paddingVertical: spacing.buttonV,
    paddingHorizontal: spacing.buttonH,
  },
  secondaryButtonText: {
    color: colors.secondaryFg,
    fontSize: typography.buttonSize,
    fontWeight: typography.buttonWeight,
  },
});
