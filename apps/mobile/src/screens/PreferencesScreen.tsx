import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Animated, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, spacing, typography } from './tokens'
import { useScreenEntranceMotion } from './useScreenEntranceMotion'
import { useHaptics } from './useHaptics'
import type { MobilePhaseScreenProps } from './types'

/**
 * PreferencesScreen
 *
 * Player preferences and settings. MP.2 placeholder (L1 functional).
 * Difficulty, category filters, haptics, accessibility options.
 */
export function PreferencesScreen(_props: MobilePhaseScreenProps): ReactElement {
  const headerEntrance = useScreenEntranceMotion(0)
  const contentEntrance = useScreenEntranceMotion(80)
  const { trigger, success } = useHaptics()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [hapticsEnabled, setHapticsEnabled] = useState(true)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [largeText, setLargeText] = useState(false)

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const raw = await AsyncStorage.getItem('guess.mobile.preferences')
        if (raw) {
          const parsed = JSON.parse(raw) as {
            difficulty?: 'easy' | 'medium' | 'hard'
            hapticsEnabled?: boolean
            reduceMotion?: boolean
            largeText?: boolean
          }
          if (parsed.difficulty) setDifficulty(parsed.difficulty)
          if (typeof parsed.hapticsEnabled === 'boolean') setHapticsEnabled(parsed.hapticsEnabled)
          if (typeof parsed.reduceMotion === 'boolean') setReduceMotion(parsed.reduceMotion)
          if (typeof parsed.largeText === 'boolean') setLargeText(parsed.largeText)
        }
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load preferences'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void loadPreferences()
  }, [])

  const persist = async (
    next: {
      difficulty?: 'easy' | 'medium' | 'hard'
      hapticsEnabled?: boolean
      reduceMotion?: boolean
      largeText?: boolean
    } = {},
  ) => {
    const payload = {
      difficulty,
      hapticsEnabled,
      reduceMotion,
      largeText,
      ...next,
    }

    setSaving(true)
    setError(null)
    try {
      await AsyncStorage.setItem('guess.mobile.preferences', JSON.stringify(payload))
      setStatus('Preferences saved')
      void success()
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to save preferences'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const setDifficultyAndSave = (next: 'easy' | 'medium' | 'hard') => {
    setDifficulty(next)
    void trigger('light')
    void persist({ difficulty: next })
  }

  const setToggleAndSave = (
    key: 'hapticsEnabled' | 'reduceMotion' | 'largeText',
    value: boolean,
  ) => {
    if (key === 'hapticsEnabled') setHapticsEnabled(value)
    if (key === 'reduceMotion') setReduceMotion(value)
    if (key === 'largeText') setLargeText(value)
    void persist({ [key]: value })
  }

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
          <Text style={styles.subtitle}>Preferences are saved on this device.</Text>
        </Animated.View>

        <Animated.View style={[styles.section, contentEntrance]}>
          <Text style={styles.sectionTitle}>Gameplay</Text>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Difficulty</Text>
              <Text style={styles.settingDescription}>Default for new sessions</Text>
            </View>
            <View style={styles.segmentedRow}>
              {(['easy', 'medium', 'hard'] as const).map((option) => {
                const selected = difficulty === option
                return (
                  <Pressable
                    key={option}
                    onPress={() => setDifficultyAndSave(option)}
                    style={[styles.segmentedButton, selected && styles.segmentedButtonActive]}
                  >
                    <Text style={[styles.segmentedButtonText, selected && styles.segmentedButtonTextActive]}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Categories</Text>
              <Text style={styles.settingDescription}>All enabled (phase-in granularity in MP.4)</Text>
            </View>
            <Text style={styles.settingValue}>On</Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, contentEntrance]}>
          <Text style={styles.sectionTitle}>Accessibility</Text>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.settingLabel}>Haptic Feedback</Text>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={(value) => setToggleAndSave('hapticsEnabled', value)}
            />
          </View>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.settingLabel}>Reduce Motion</Text>
            </View>
            <Switch
              value={reduceMotion}
              onValueChange={(value) => setToggleAndSave('reduceMotion', value)}
            />
          </View>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.settingLabel}>Large Text</Text>
            </View>
            <Switch
              value={largeText}
              onValueChange={(value) => setToggleAndSave('largeText', value)}
            />
          </View>
        </Animated.View>

        <Animated.View style={[styles.section, contentEntrance]}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Version</Text>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>
          <Text style={styles.settingDescription}>
            {loading ? 'Loading preferences...' : saving ? 'Saving...' : status ?? 'All changes saved'}
          </Text>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </Animated.View>
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
  subtitle: {
    ...typography.subheading,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
  segmentedRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segmentedButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  segmentedButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  segmentedButtonText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  segmentedButtonTextActive: {
    color: colors.background,
  },
  errorText: {
    ...typography.caption,
    color: colors.destructiveBg,
  },
})
