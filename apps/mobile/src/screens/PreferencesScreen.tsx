import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type Difficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTIES: { value: Difficulty; label: string; description: string }[] = [
  { value: 'easy', label: 'Easy', description: 'More common characters' },
  { value: 'medium', label: 'Medium', description: 'Balanced challenge' },
  { value: 'hard', label: 'Hard', description: 'Niche and obscure picks' }
];

interface PreferencesScreenProps {
  difficulty: Difficulty;
  onSaveDifficulty: (difficulty: Difficulty) => void;
  onOpenTeaching: () => void;
  onBackToWelcome: () => void;
}

export function PreferencesScreen({
  difficulty,
  onSaveDifficulty,
  onOpenTeaching,
  onBackToWelcome
}: Readonly<PreferencesScreenProps>): ReactElement {
  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>PREFERENCES</Text>
        <Text style={styles.title}>Preferences</Text>
        <Text style={styles.subtitle}>Customize your game experience. Changes apply to the next game.</Text>
      </View>

      <View style={styles.settingsBlock}>
        <Text style={styles.settingsLabel}>Difficulty</Text>
        <View style={styles.difficultyRow}>
          {DIFFICULTIES.map((opt) => {
            const isSelected = difficulty === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => { onSaveDifficulty(opt.value); }}
                style={[styles.difficultyOption, isSelected && styles.difficultyOptionSelected]}
              >
                <Text style={[styles.difficultyLabel, isSelected && styles.difficultyLabelSelected]}>
                  {opt.label}
                </Text>
                <Text style={[styles.difficultyDesc, isSelected && styles.difficultyDescSelected]}>
                  {opt.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.actionsBlock}>
        <Pressable onPress={onOpenTeaching} style={[styles.actionButton, styles.actionPrimary]}>
          <Text style={[styles.actionLabel, styles.actionLabelPrimary]}>Open Teaching</Text>
        </Pressable>
        <Pressable onPress={onBackToWelcome} style={[styles.actionButton, styles.actionSecondary]}>
          <Text style={[styles.actionLabel, styles.actionLabelSecondary]}>Back To Welcome</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 22
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
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0f172a'
  },
  settingsLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4
  },
  difficultyRow: {
    gap: 8
  },
  difficultyOption: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#1e293b'
  },
  difficultyOptionSelected: {
    borderColor: '#7c3aed',
    backgroundColor: '#1e1245'
  },
  difficultyLabel: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '700'
  },
  difficultyLabelSelected: {
    color: '#a78bfa'
  },
  difficultyDesc: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 2
  },
  difficultyDescSelected: {
    color: '#8b5cf6'
  },
  actionsBlock: {
    gap: 10
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionPrimary: {
    backgroundColor: '#7c3aed'
  },
  actionSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#6b7280'
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '700'
  },
  actionLabelPrimary: {
    color: '#ffffff'
  },
  actionLabelSecondary: {
    color: '#d1d5db'
  }
});
