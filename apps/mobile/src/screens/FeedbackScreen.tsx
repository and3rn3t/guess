import { useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface FeedbackScreenProps {
  sessionId: string | null;
  isBusy: boolean;
  errorMessage: string | null;
  onSubmitFeedback: (rating: number, feedbackText: string) => Promise<boolean>;
  onBackToWelcome: () => void;
  onStartNewGame: () => void;
}

export function FeedbackScreen({
  sessionId,
  isBusy,
  errorMessage,
  onSubmitFeedback,
  onBackToWelcome,
  onStartNewGame
}: Readonly<FeedbackScreenProps>): ReactElement {
  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (): void => {
    if (!sessionId || selectedRating < 1 || selectedRating > 5 || isBusy) {
      return;
    }

    void onSubmitFeedback(selectedRating, feedbackText).then((success) => {
      if (!success) {
        setSubmitted(false);
        return;
      }

      setSubmitted(true);
      setFeedbackText('');
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>FEEDBACK</Text>
        <Text style={styles.title}>How Was This Round?</Text>
        <Text style={styles.subtitle}>
          Share a quick rating and optional notes so future rounds get better.
        </Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Session</Text>
        <Text style={styles.infoBody}>{sessionId ?? 'No completed session available yet.'}</Text>
      </View>

      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = selectedRating === rating;
          return (
            <Pressable
              key={rating}
              accessibilityRole="button"
              disabled={isBusy || !sessionId}
              onPress={() => setSelectedRating(rating)}
              style={[
                styles.ratingButton,
                selected ? styles.ratingButtonSelected : null,
                isBusy || !sessionId ? styles.disabled : null
              ]}
            >
              <Text style={[styles.ratingButtonText, selected ? styles.ratingButtonTextSelected : null]}>
                {rating}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        editable={!isBusy && Boolean(sessionId)}
        maxLength={500}
        multiline
        onChangeText={setFeedbackText}
        placeholder="Optional notes about the round..."
        placeholderTextColor="#94a3b8"
        style={styles.textInput}
        value={feedbackText}
      />

      <Pressable
        accessibilityRole="button"
        disabled={isBusy || !sessionId || selectedRating === 0}
        onPress={handleSubmit}
        style={[styles.actionButton, styles.actionSubmit, isBusy || !sessionId || selectedRating === 0 ? styles.disabled : null]}
      >
        <Text style={styles.actionSubmitText}>{isBusy ? 'Submitting...' : 'Submit Feedback'}</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onBackToWelcome}
        style={[styles.actionButton, styles.actionPrimary, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionPrimaryText}>Back To Welcome</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={onStartNewGame}
        style={[styles.actionButton, styles.actionSecondary, isBusy ? styles.disabled : null]}
      >
        <Text style={styles.actionSecondaryText}>Start New Game</Text>
      </Pressable>

      {submitted ? <Text style={styles.successText}>Feedback submitted. Thank you.</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: 14
  },
  headerBlock: {
    gap: 8
  },
  phasePill: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '800',
    color: '#2f1b0c',
    backgroundColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  title: {
    color: '#f8fafc',
    fontSize: 30,
    fontWeight: '800'
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22
  },
  infoCard: {
    borderWidth: 1,
    borderColor: '#9a3412',
    borderRadius: 14,
    backgroundColor: '#431407',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4
  },
  infoTitle: {
    color: '#fdba74',
    fontSize: 13,
    fontWeight: '700'
  },
  infoBody: {
    color: '#ffedd5',
    fontSize: 14,
    lineHeight: 20
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 8
  },
  ratingButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    alignItems: 'center'
  },
  ratingButtonSelected: {
    borderColor: '#fb923c',
    backgroundColor: '#7c2d12'
  },
  ratingButtonText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '700'
  },
  ratingButtonTextSelected: {
    color: '#ffedd5'
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    backgroundColor: '#0f172a',
    color: '#f8fafc',
    minHeight: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top'
  },
  actionButton: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center'
  },
  actionPrimary: {
    backgroundColor: '#22c55e'
  },
  actionSubmit: {
    backgroundColor: '#fb923c'
  },
  actionSecondary: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155'
  },
  actionPrimaryText: {
    color: '#052e16',
    fontSize: 15,
    fontWeight: '700'
  },
  actionSecondaryText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700'
  },
  actionSubmitText: {
    color: '#431407',
    fontSize: 15,
    fontWeight: '800'
  },
  disabled: {
    opacity: 0.5
  },
  successText: {
    color: '#86efac',
    fontSize: 14,
    fontWeight: '600'
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#7f1d1d'
  }
});
