import type { ReactElement } from 'react'
import { Animated, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, spacing, typography } from './tokens'
import { useScreenEntranceMotion } from './useScreenEntranceMotion'
import type { MobilePhaseScreenProps } from './types'

/**
 * PreferencesScreen
 *
 * Player preferences and settings. MP.2 placeholder (L1 functional).
 * Difficulty, category filters, haptics, accessibility options.
 */
export function PreferencesScreen(_props: MobilePhaseScreenProps): ReactElement {
  const headerEntrance = useScreenEntranceMotion(0)

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.header, headerEntrance]}>
          <Text style={styles.title} maxFontSizeMultiplier={1.6}>
            Settings
          </Text>
        </Animated.View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gameplay</Text>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Difficulty</Text>
              <Text style={styles.settingDescription}>Normal</Text>
            </View>
            <Text style={styles.settingValue}>›</Text>
          </View>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Categories</Text>
              <Text style={styles.settingDescription}>All enabled</Text>
            </View>
            <Text style={styles.settingValue}>›</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Accessibility</Text>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.settingLabel}>Haptic Feedback</Text>
            </View>
            <Switch />
          </View>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.settingLabel}>Reduce Motion</Text>
            </View>
            <Switch />
          </View>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.settingLabel}>Large Text</Text>
            </View>
            <Switch />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Version</Text>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.heading1,
    color: colors.text,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.subheading,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingLabel: {
    ...typography.body,
    color: colors.text,
  },
  settingDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  settingValue: {
    ...typography.body,
    color: colors.textSecondary,
  },
})
