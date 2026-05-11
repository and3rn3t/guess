import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { triggerImpactHaptic } from '../lib/mobileHaptics';
import { SecondaryActionsSheet } from './SecondaryActionsSheet';
import {
  MOBILE_CATEGORY_LABELS,
  MOBILE_CHARACTER_CATEGORIES,
  type MobileCharacterCategory
} from '../state/mobileCategories';

export type Difficulty = 'easy' | 'medium' | 'hard';

interface PersonaOption {
  difficulty: Difficulty;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
}

const PERSONAS: PersonaOption[] = [
  {
    difficulty: 'easy',
    name: 'Poirot',
    emoji: '🎩',
    tagline: 'Theatrical & precise',
    description: '20 questions · deliberate'
  },
  {
    difficulty: 'medium',
    name: 'Watson',
    emoji: '📓',
    tagline: 'Warm & methodical',
    description: '15 questions · balanced'
  },
  {
    difficulty: 'hard',
    name: 'Sherlock',
    emoji: '🔍',
    tagline: 'Terse & brilliant',
    description: '10 questions · intense'
  }
];

interface PreferencesScreenProps {
  difficulty: Difficulty;
  onSaveDifficulty: (difficulty: Difficulty) => void;
  selectedCategories: readonly MobileCharacterCategory[];
  onToggleCategory: (category: MobileCharacterCategory) => void;
  onOpenTeaching: () => void;
  onBackToWelcome: () => void;
}

export function PreferencesScreen({
  difficulty,
  onSaveDifficulty,
  selectedCategories,
  onToggleCategory,
  onOpenTeaching,
  onBackToWelcome
}: Readonly<PreferencesScreenProps>): ReactElement {
  const selectedCategoryCount = selectedCategories.length;

  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>PREFERENCES</Text>
        <Text style={styles.title}>Preferences</Text>
        <Text style={styles.subtitle}>Who's your detective? Your choice sets the difficulty and question style.</Text>
      </View>

      <View style={styles.settingsBlock}>
        <Text style={styles.settingsLabel}>Choose your detective</Text>
        <View style={styles.personaRow}>
          {PERSONAS.map((persona) => {
            const isSelected = difficulty === persona.difficulty;
            return (
              <Pressable
                key={persona.difficulty}
                onPress={() => {
                  triggerImpactHaptic('light');
                  onSaveDifficulty(persona.difficulty);
                }}
                style={[styles.personaCard, isSelected && styles.personaCardSelected]}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${persona.name}: ${persona.tagline}`}
              >
                <Text style={styles.personaEmoji}>{persona.emoji}</Text>
                <Text style={[styles.personaName, isSelected && styles.personaNameSelected]}>
                  {persona.name}
                </Text>
                <Text style={[styles.personaTagline, isSelected && styles.personaTaglineSelected]}>
                  {persona.tagline}
                </Text>
                <Text style={[styles.personaDesc, isSelected && styles.personaDescSelected]}>
                  {persona.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.settingsBlock}>
        <Text style={styles.settingsLabel}>Category Focus (Optional)</Text>
        <Text style={styles.selectionHint}>
          {selectedCategoryCount === 0
            ? 'All categories enabled'
            : `${selectedCategoryCount} categories selected`}
        </Text>
        <View style={styles.categoryRow}>
          {MOBILE_CHARACTER_CATEGORIES.map((category) => {
            const selected = selectedCategories.includes(category);

            return (
              <Pressable
                key={category}
                onPress={() => {
                  triggerImpactHaptic('light');
                  onToggleCategory(category);
                }}
                style={[styles.categoryPill, selected && styles.categoryPillSelected]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={MOBILE_CATEGORY_LABELS[category]}
              >
                <Text style={[styles.categoryPillText, selected && styles.categoryPillTextSelected]}>
                  {MOBILE_CATEGORY_LABELS[category]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.helperText}>
          Leave all unselected to include every category.
        </Text>
      </View>

      <View style={styles.actionsBlock}>
        <SecondaryActionsSheet
          primaryLabel="Open Teaching"
          primaryAccessibilityLabel="Open teaching"
          onPrimaryPress={() => {
            triggerImpactHaptic('light');
            onOpenTeaching();
          }}
          secondaryActions={[
            {
              key: 'back-to-welcome',
              label: 'Back To Welcome',
              accessibilityLabel: 'Back to welcome',
              onPress: () => {
                triggerImpactHaptic('medium');
                onBackToWelcome();
              },
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 18
  },
  headerBlock: {
    gap: 8
  },
  phasePill: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '800',
    color: '#101828',
    backgroundColor: '#d1fadf',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  title: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '800'
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24
  },
  settingsBlock: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0f172a'
  },
  settingsLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
    textAlign: 'center'
  },
  personaRow: {
    flexDirection: 'row',
    gap: 8
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  selectionHint: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500'
  },
  categoryPill: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: '#1e293b'
  },
  categoryPillSelected: {
    borderColor: '#7c3aed',
    backgroundColor: '#1e1245'
  },
  categoryPillText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600'
  },
  categoryPillTextSelected: {
    color: '#a78bfa'
  },
  helperText: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18
  },
  personaCard: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 10,
    backgroundColor: '#1e293b'
  },
  personaCardSelected: {
    borderColor: '#7c3aed',
    backgroundColor: '#1e1245'
  },
  personaEmoji: {
    fontSize: 26,
    lineHeight: 32
  },
  personaName: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center'
  },
  personaNameSelected: {
    color: '#a78bfa'
  },
  personaTagline: {
    color: '#64748b',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14
  },
  personaTaglineSelected: {
    color: '#8b5cf6'
  },
  personaDesc: {
    color: '#475569',
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 1
  },
  personaDescSelected: {
    color: '#7c3aed',
    fontWeight: '500'
  },
  actionsBlock: {
    gap: 8
  }
});
