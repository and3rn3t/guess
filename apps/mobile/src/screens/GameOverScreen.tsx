import type { ReactElement } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "./tokens";
import { useHaptics } from "./useHaptics";
import type { MobilePhaseScreenProps } from "./types";

export function GameOverScreen({
  dispatch,
}: MobilePhaseScreenProps): ReactElement {
  const { trigger } = useHaptics();

  return (
    <View style={styles.actionRow}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          trigger("medium");
          dispatch({ type: "BACK_TO_WELCOME" });
        }}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Play Again</Text>
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
});
