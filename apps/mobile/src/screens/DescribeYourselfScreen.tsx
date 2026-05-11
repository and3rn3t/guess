import { useMemo, useState, type ReactElement } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  submitDescribeYourselfProfile,
  type AnswerValue,
} from "../network/mobileGameApi";
import {
  buildMobileDescribeArchetype,
  MOBILE_DESCRIBE_PROMPTS,
  type MobileDescribeAnswer,
} from "./mobileDescribeYourself";

interface DescribeYourselfScreenProps {
  isBusy: boolean;
  errorMessage: string | null;
  onBackToWelcome: () => void;
}

type LocalPhase = "questions" | "result";

const MIN_REQUIRED_ANSWERS = 5;

export function DescribeYourselfScreen({
  isBusy,
  errorMessage,
  onBackToWelcome,
}: Readonly<DescribeYourselfScreenProps>): ReactElement {
  const [phase, setPhase] = useState<LocalPhase>("questions");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<MobileDescribeAnswer[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completionSaved, setCompletionSaved] = useState(false);

  const prompt = MOBILE_DESCRIBE_PROMPTS[index] ?? null;
  const archetype = useMemo(() => buildMobileDescribeArchetype(answers), [answers]);

  const handleAnswer = (answer: AnswerValue): void => {
    if (!prompt || isBusy || isSubmitting) {
      return;
    }

    const nextAnswers = [
      ...answers,
      {
        promptKey: prompt.key,
        answer,
      },
    ];

    setAnswers(nextAnswers);
    setSubmitError(null);

    if (index + 1 >= MOBILE_DESCRIBE_PROMPTS.length) {
      setPhase("result");
      return;
    }

    setIndex((value) => value + 1);
  };

  const handlePersist = async (): Promise<void> => {
    if (answers.length < MIN_REQUIRED_ANSWERS || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await submitDescribeYourselfProfile(answers, archetype);
      setCompletionSaved(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save profile";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const answeredCount = answers.length;
  const progressLabel = `${Math.min(index + 1, MOBILE_DESCRIBE_PROMPTS.length)} / ${MOBILE_DESCRIBE_PROMPTS.length}`;

  if (phase === "result") {
    return (
      <View style={styles.root}>
        <View style={styles.headerBlock}>
          <Text style={styles.phasePill}>DESCRIBE YOURSELF</Text>
          <Text style={styles.title}>Your Profile Summary</Text>
          <Text style={styles.subtitle}>Mobile-first summary that saves your responses via the events contract.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.metricLabel}>Archetype</Text>
          <Text style={styles.archetype}>{archetype}</Text>
          <Text style={styles.metaText}>{answeredCount} answers captured</Text>

          {completionSaved ? (
            <Text style={styles.successText}>Saved to backend events successfully.</Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save describe yourself profile"
              disabled={isSubmitting || isBusy}
              onPress={() => {
                void handlePersist();
              }}
              style={[styles.actionButton, styles.actionPrimary, isSubmitting || isBusy ? styles.disabled : null]}
            >
              <Text style={styles.actionPrimaryText}>
                {isSubmitting ? "Saving..." : "Save Profile"}
              </Text>
            </Pressable>
          )}

          {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to welcome"
          onPress={onBackToWelcome}
          style={[styles.actionButton, styles.actionSecondary]}
        >
          <Text style={styles.actionSecondaryText}>Back To Welcome</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.headerBlock}>
        <Text style={styles.phasePill}>DESCRIBE YOURSELF</Text>
        <Text style={styles.title}>Tell Us About You</Text>
        <Text style={styles.subtitle}>Answer quick prompts and get a lightweight personality archetype.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.metricLabel}>Question {progressLabel}</Text>
        <Text style={styles.promptText}>{prompt?.prompt ?? "No prompt available"}</Text>
      </View>

      <View style={styles.answerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Answer yes"
          onPress={() => handleAnswer("yes")}
          style={[styles.answerButton, styles.answerYes]}
        >
          <Text style={styles.answerLabel}>Yes</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Answer maybe"
          onPress={() => handleAnswer("maybe")}
          style={[styles.answerButton, styles.answerMaybe]}
        >
          <Text style={styles.answerLabel}>Maybe</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Answer no"
          onPress={() => handleAnswer("no")}
          style={[styles.answerButton, styles.answerNo]}
        >
          <Text style={styles.answerLabel}>No</Text>
        </Pressable>
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      <Text style={styles.metaText}>At least {MIN_REQUIRED_ANSWERS} validated responses are required for persistence.</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to welcome"
        onPress={onBackToWelcome}
        style={[styles.actionButton, styles.actionSecondary]}
      >
        <Text style={styles.actionSecondaryText}>Back To Welcome</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    gap: 12,
  },
  headerBlock: {
    gap: 8,
  },
  phasePill: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
    backgroundColor: "#86efac",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  title: {
    color: "#f8fafc",
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    backgroundColor: "#0b1220",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  metricLabel: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "700",
  },
  promptText: {
    color: "#e2e8f0",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
  },
  archetype: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "800",
  },
  metaText: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 19,
  },
  answerRow: {
    flexDirection: "row",
    gap: 8,
  },
  answerButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  answerYes: {
    backgroundColor: "#052e16",
    borderColor: "#16a34a",
  },
  answerMaybe: {
    backgroundColor: "#3f2f05",
    borderColor: "#f59e0b",
  },
  answerNo: {
    backgroundColor: "#450a0a",
    borderColor: "#ef4444",
  },
  answerLabel: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
  actionButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionPrimary: {
    backgroundColor: "#22c55e",
  },
  actionSecondary: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
  },
  actionPrimaryText: {
    color: "#052e16",
    fontSize: 15,
    fontWeight: "700",
  },
  actionSecondaryText: {
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: "700",
  },
  successText: {
    color: "#4ade80",
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    color: "#fecaca",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  disabled: {
    opacity: 0.5,
  },
});
