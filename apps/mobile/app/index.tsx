import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MobileApiError,
  fetchDailyChallenge,
  fetchDailyLeaderboard,
  fetchHistoryGames,
  fetchStatsOverview,
  rejectGuess,
  resumeGame,
  skipQuestion,
  startGame,
  submitAnswer,
  submitFeedback,
  submitResult,
  type AnswerValue,
  type MobileDailyChallenge,
  type MobileDailyLeaderboard,
  type MobileHistoryGame,
  type MobileStatsOverview,
} from "../src/network/mobileGameApi";
import {
  finishMobilePerfTimer,
  startMobilePerfTimer,
} from "../src/perf/mobilePerfMetrics";
import { ChallengeScreen } from "../src/screens/ChallengeScreen";
import { CompareScreen } from "../src/screens/CompareScreen";
import { ConnectionStatusBanner } from "../src/screens/ConnectionStatusBanner";
import { FeedbackScreen } from "../src/screens/FeedbackScreen";
import { GameOverScreen } from "../src/screens/GameOverScreen";
import { GuessingScreen } from "../src/screens/GuessingScreen";
import { HistoryScreen } from "../src/screens/HistoryScreen";
import { LowBandwidthWarningModal } from "../src/screens/LowBandwidthWarningModal";
import { PhaseScaffold } from "../src/screens/PhaseScaffold";
import { PlayingScreen } from "../src/screens/PlayingScreen";
import {
  PreferencesScreen,
  type Difficulty,
} from "../src/screens/PreferencesScreen";
import { ResumeScreen } from "../src/screens/ResumeScreen";
import { StatsScreen } from "../src/screens/StatsScreen";
import { TeachingScreen } from "../src/screens/TeachingScreen";
import { WelcomeScreen } from "../src/screens/WelcomeScreen";
import { buildQuickStartSummary } from "../src/screens/mobileQuickStartSummary";
import { getTeachingProgressSummary } from "../src/screens/teachingProgress";
import { useMobileConnectionStatus } from "../src/network/useMobileConnectionStatus";
import { getPhaseTransitionProfile } from "../src/lib/phaseTransitionProfile";
import { MobileGameProvider } from "../src/state/MobileGameProvider";
import type { MobileCharacterCategory } from "../src/state/mobileCategories";
import { createMobileActionGuard } from "../src/state/mobileActionGuard";
import type { MobileGamePhase } from "../src/state/mobileGameState";
import {
  loadMobilePreferences,
  saveMobilePreferences,
} from "../src/state/mobilePreferences";
import {
  clampTeachingLessonIndex,
  createMobilePreferencesSessionState,
  hydrateMobilePreferencesSessionState,
  toPersistedMobilePreferences,
  toggleMobilePreferencesCategory,
} from "../src/state/mobilePreferencesSession";
import { useMobileGame } from "../src/state/useMobileGame";

interface PhaseMeta {
  title: string;
  subtitle: string;
}

const PHASE_META: Record<MobileGamePhase, PhaseMeta> = {
  welcome: {
    title: "Welcome",
    subtitle:
      "Foundation shell for start, challenge entry, and resume actions.",
  },
  playing: {
    title: "Playing",
    subtitle:
      "Question/answer runtime with deterministic transition to guess or game over.",
  },
  guessing: {
    title: "Guessing",
    subtitle:
      "Confirm or reject candidate flow before ending or continuing the session.",
  },
  gameOver: {
    title: "Game Over",
    subtitle: "End-state handoff to replay, utility surfaces, and feedback.",
  },
  challenge: {
    title: "Challenge",
    subtitle: "Daily challenge entry point and challenge-run completion path.",
  },
  stats: {
    title: "Stats",
    subtitle:
      "Utility surface placeholder for progression and streak summaries.",
  },
  history: {
    title: "History",
    subtitle: "Utility surface placeholder for previous-session browsing.",
  },
  compare: {
    title: "Compare",
    subtitle:
      "Utility surface placeholder for category and difficulty comparisons.",
  },
  resume: {
    title: "Session Resume",
    subtitle:
      "Utility surface placeholder for safe interrupted-session recovery.",
  },
  preferences: {
    title: "Preferences",
    subtitle:
      "Utility surface placeholder for local settings and accessibility controls.",
  },
  teaching: {
    title: "Teaching",
    subtitle: "Utility surface placeholder for guided strategy lessons.",
  },
  feedback: {
    title: "Post-Game Feedback",
    subtitle:
      "Utility surface placeholder for rating and optional qualitative feedback.",
  },
};

export default function HomeScreen(): ReactElement {
  return (
    <MobileGameProvider>
      <MobileShell />
    </MobileGameProvider>
  );
}

function toOfflineAwareError(
  error: unknown,
  tone: string,
  offlineMessage: string,
): string {
  if (
    error instanceof MobileApiError &&
    error.kind === "transport" &&
    tone === "offline"
  ) {
    return offlineMessage;
  }
  return toErrorMessage(error);
}

function MobileShell(): ReactElement {
  const { state, dispatch } = useMobileGame();
  const connectionStatus = useMobileConnectionStatus();
  const isOffline = connectionStatus.tone === "offline";
  const meta = PHASE_META[state.phase];
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [preferencesState, setPreferencesState] = useState(
    createMobilePreferencesSessionState,
  );
  const [statsOverview, setStatsOverview] =
    useState<MobileStatsOverview | null>(null);
  const [historyGames, setHistoryGames] = useState<MobileHistoryGame[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [dailyChallenge, setDailyChallenge] =
    useState<MobileDailyChallenge | null>(null);
  const [dailyLeaderboard, setDailyLeaderboard] =
    useState<MobileDailyLeaderboard | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const actionGuardRef = useRef(createMobileActionGuard());
  const tapFeedbackTimerStartMsRef = useRef<number | null>(null);
  const pendingQuestionRenderTimerStartMsRef = useRef<number | null>(null);
  const transitionTimerStartMsRef = useRef<number | null>(null);
  const transitionCompleteTimerStartMsRef = useRef<number | null>(null);
  const previousPhaseRef = useRef<MobileGamePhase>(state.phase);
  const previousQuestionIdRef = useRef<string | null>(
    state.currentQuestion?.id ?? null,
  );
  const phaseContentOpacity = useRef(new Animated.Value(1)).current;
  const phaseContentTranslateY = useRef(new Animated.Value(0)).current;
  const difficulty: Difficulty = preferencesState.difficulty;
  const selectedCategories: MobileCharacterCategory[] =
    preferencesState.selectedCategories;
  const teachingLessonIndex = preferencesState.teachingLessonIndex;
  const quickStartSummary = useMemo(
    () => buildQuickStartSummary(difficulty, selectedCategories),
    [difficulty, selectedCategories],
  );
  const teachingProgressSummary = useMemo(
    () => getTeachingProgressSummary(teachingLessonIndex),
    [teachingLessonIndex],
  );
  const phaseTransitionProfile = useMemo(
    () => getPhaseTransitionProfile(state.phase),
    [state.phase],
  );

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        setPrefersReducedMotion(enabled);
      })
      .catch(() => {
        setPrefersReducedMotion(false);
      });
  }, []);

  useEffect(() => {
    if (!state.isBusy || tapFeedbackTimerStartMsRef.current === null) {
      return;
    }

    finishMobilePerfTimer(
      "tap_to_feedback",
      tapFeedbackTimerStartMsRef.current,
    );
    tapFeedbackTimerStartMsRef.current = null;
  }, [state.isBusy]);

  useEffect(() => {
    const questionId = state.currentQuestion?.id ?? null;
    if (previousQuestionIdRef.current === questionId) {
      return;
    }

    previousQuestionIdRef.current = questionId;
    if (
      questionId === null ||
      pendingQuestionRenderTimerStartMsRef.current === null
    ) {
      return;
    }

    finishMobilePerfTimer(
      "feedback_to_next_question",
      pendingQuestionRenderTimerStartMsRef.current,
    );
    pendingQuestionRenderTimerStartMsRef.current = null;
  }, [state.currentQuestion?.id]);

  useEffect(() => {
    if (previousPhaseRef.current === state.phase) {
      return;
    }

    previousPhaseRef.current = state.phase;
    if (transitionTimerStartMsRef.current !== null) {
      finishMobilePerfTimer(
        "transition_start",
        transitionTimerStartMsRef.current,
      );
      transitionTimerStartMsRef.current = null;
    }

    if (transitionCompleteTimerStartMsRef.current === null) {
      return;
    }

    const completionTimerStartMs = transitionCompleteTimerStartMsRef.current;
    transitionCompleteTimerStartMsRef.current = null;
    const timeoutId = setTimeout(() => {
      finishMobilePerfTimer("transition_complete", completionTimerStartMs);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [state.phase]);

  useEffect(() => {
    if (prefersReducedMotion) {
      phaseContentOpacity.setValue(1);
      phaseContentTranslateY.setValue(0);
      return;
    }

    phaseContentOpacity.setValue(phaseTransitionProfile.startOpacity);
    phaseContentTranslateY.setValue(phaseTransitionProfile.startOffsetY);
    Animated.parallel([
      Animated.timing(phaseContentOpacity, {
        toValue: 1,
        duration: phaseTransitionProfile.fadeDurationMs,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(phaseContentTranslateY, {
        toValue: 0,
        duration: phaseTransitionProfile.slideDurationMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    phaseContentOpacity,
    phaseContentTranslateY,
    phaseTransitionProfile.fadeDurationMs,
    phaseTransitionProfile.slideDurationMs,
    phaseTransitionProfile.startOffsetY,
    phaseTransitionProfile.startOpacity,
    prefersReducedMotion,
  ]);

  const beginTapFeedbackTiming = (): void => {
    tapFeedbackTimerStartMsRef.current = startMobilePerfTimer();
  };

  const beginPhaseTransitionTiming = (): void => {
    const startMs = startMobilePerfTimer();
    transitionTimerStartMsRef.current = startMs;
    transitionCompleteTimerStartMsRef.current = startMs;
  };

  useEffect(() => {
    let cancelled = false;

    void loadMobilePreferences()
      .then((preferences) => {
        if (cancelled) {
          return;
        }

        setPreferencesState(hydrateMobilePreferencesSessionState(preferences));
      })
      .finally(() => {
        if (!cancelled) {
          setPreferencesState((current) => ({
            ...current,
            hydrated: true,
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!preferencesState.hydrated) {
      return;
    }

    void saveMobilePreferences(toPersistedMobilePreferences(preferencesState));
  }, [preferencesState]);

  const toggleCategory = (category: MobileCharacterCategory): void => {
    setPreferencesState((current) => {
      return {
        ...current,
        selectedCategories: toggleMobilePreferencesCategory(
          current.selectedCategories,
          category,
        ),
      };
    });
  };

  const saveDifficulty = (nextDifficulty: Difficulty): void => {
    setPreferencesState((current) => ({
      ...current,
      difficulty: nextDifficulty,
    }));
  };

  const saveTeachingLessonIndex = (index: number): void => {
    setPreferencesState((current) => ({
      ...current,
      teachingLessonIndex: clampTeachingLessonIndex(index),
    }));
  };

  const onRetry = useCallback(() => setFetchKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    if (state.phase === "stats") {
      setStatsLoading(true);
      setStatsError(null);

      void Promise.all([fetchStatsOverview(), fetchHistoryGames(100)])
        .then(([stats, history]) => {
          if (cancelled) {
            return;
          }

          setStatsOverview(stats);
          setHistoryGames(history);
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }

          setStatsError(toErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) {
            setStatsLoading(false);
          }
        });
    }

    if (state.phase === "history") {
      setHistoryLoading(true);
      setHistoryError(null);

      void fetchHistoryGames(100)
        .then((history) => {
          if (cancelled) {
            return;
          }

          setHistoryGames(history);
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }

          setHistoryError(toErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) {
            setHistoryLoading(false);
          }
        });
    }

    if (state.phase === "challenge") {
      setChallengeLoading(true);
      setChallengeError(null);

      void Promise.all([fetchDailyChallenge(), fetchDailyLeaderboard()])
        .then(([daily, lb]) => {
          if (cancelled) return;
          setDailyChallenge(daily);
          setDailyLeaderboard(lb);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setChallengeError(toErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) {
            setChallengeLoading(false);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [state.phase, fetchKey]);

  const runStartGame = async (): Promise<void> => {
    if (!actionGuardRef.current.tryEnter()) {
      return;
    }

    beginTapFeedbackTiming();
    dispatch({ type: "SET_BUSY", isBusy: true });
    dispatch({ type: "SET_ERROR", message: null });
    try {
      const response = await startGame({
        difficulty,
        categories: selectedCategories,
      });
      beginPhaseTransitionTiming();
      pendingQuestionRenderTimerStartMsRef.current = startMobilePerfTimer();
      dispatch({
        type: "START_SUCCESS",
        sessionId: response.sessionId,
        question: response.question,
        reasoning: response.reasoning,
      });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        message: toOfflineAwareError(
          error,
          connectionStatus.tone,
          "You're offline \u2014 connect to the internet to start a new game.",
        ),
      });
    } finally {
      dispatch({ type: "SET_BUSY", isBusy: false });
      actionGuardRef.current.leave();
    }
  };

  const runStartChallenge = async (characterId: string): Promise<void> => {
    if (!actionGuardRef.current.tryEnter()) {
      return;
    }

    beginTapFeedbackTiming();
    dispatch({ type: "SET_BUSY", isBusy: true });
    dispatch({ type: "SET_ERROR", message: null });
    try {
      const response = await startGame({
        difficulty,
        categories: selectedCategories,
        characterId,
      });
      beginPhaseTransitionTiming();
      pendingQuestionRenderTimerStartMsRef.current = startMobilePerfTimer();
      dispatch({
        type: "START_SUCCESS",
        sessionId: response.sessionId,
        question: response.question,
        reasoning: response.reasoning,
      });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        message: toOfflineAwareError(
          error,
          connectionStatus.tone,
          "You're offline \u2014 connect to the internet to start a challenge.",
        ),
      });
    } finally {
      dispatch({ type: "SET_BUSY", isBusy: false });
      actionGuardRef.current.leave();
    }
  };

  const runAnswer = async (value: AnswerValue): Promise<void> => {
    if (!state.sessionId) {
      dispatch({
        type: "SET_ERROR",
        message: "No active session. Start a game first.",
      });
      return;
    }

    if (!actionGuardRef.current.tryEnter()) {
      return;
    }

    beginTapFeedbackTiming();
    dispatch({ type: "SET_BUSY", isBusy: true });
    dispatch({ type: "SET_ERROR", message: null });
    try {
      const response = await submitAnswer(state.sessionId, value);
      if (response.type === "question") {
        pendingQuestionRenderTimerStartMsRef.current = startMobilePerfTimer();
        dispatch({
          type: "ANSWER_QUESTION",
          question: response.question,
          reasoning: response.reasoning,
        });
        return;
      }

      if (response.type === "guess") {
        beginPhaseTransitionTiming();
        dispatch({
          type: "ANSWER_GUESS",
          character: response.character,
          confidence: response.confidence,
        });
        return;
      }

      dispatch({
        type: "ANSWER_CONTRADICTION",
        message: response.message,
        question: response.question,
        reasoning: response.reasoning,
      });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        message: toOfflineAwareError(
          error,
          connectionStatus.tone,
          "You're offline \u2014 reconnect to continue your game. Your progress is saved.",
        ),
      });
    } finally {
      dispatch({ type: "SET_BUSY", isBusy: false });
      actionGuardRef.current.leave();
    }
  };

  const runSkip = async (): Promise<void> => {
    if (!state.sessionId) {
      dispatch({
        type: "SET_ERROR",
        message: "No active session. Start a game first.",
      });
      return;
    }

    if (!actionGuardRef.current.tryEnter()) {
      return;
    }

    beginTapFeedbackTiming();
    dispatch({ type: "SET_BUSY", isBusy: true });
    dispatch({ type: "SET_ERROR", message: null });
    try {
      const response = await skipQuestion(state.sessionId);
      if (!response) {
        beginPhaseTransitionTiming();
        dispatch({ type: "SKIP_EXHAUSTED" });
        return;
      }

      pendingQuestionRenderTimerStartMsRef.current = startMobilePerfTimer();
      dispatch({
        type: "SKIP_QUESTION",
        question: response.question,
        reasoning: response.reasoning,
      });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        message: toOfflineAwareError(
          error,
          connectionStatus.tone,
          "You're offline \u2014 reconnect to skip a question. Your progress is saved.",
        ),
      });
    } finally {
      dispatch({ type: "SET_BUSY", isBusy: false });
      actionGuardRef.current.leave();
    }
  };

  const runRejectGuess = async (): Promise<void> => {
    if (!state.sessionId || !state.finalGuess) {
      dispatch({ type: "SET_ERROR", message: "No active guess to reject." });
      return;
    }

    if (!actionGuardRef.current.tryEnter()) {
      return;
    }

    beginTapFeedbackTiming();
    dispatch({ type: "SET_BUSY", isBusy: true });
    dispatch({ type: "SET_ERROR", message: null });
    try {
      const response = await rejectGuess(state.sessionId, state.finalGuess.id);
      if (response.type === "exhausted") {
        beginPhaseTransitionTiming();
        dispatch({ type: "REJECT_EXHAUSTED", message: response.message });
        return;
      }

      beginPhaseTransitionTiming();
      pendingQuestionRenderTimerStartMsRef.current = startMobilePerfTimer();
      dispatch({
        type: "REJECT_QUESTION",
        question: response.question,
        reasoning: response.reasoning,
        rejectCooldownRemaining: response.rejectCooldownRemaining,
        guessCount: response.guessCount,
      });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        message: toOfflineAwareError(
          error,
          connectionStatus.tone,
          "You're offline \u2014 reconnect to continue. Your session is preserved.",
        ),
      });
    } finally {
      dispatch({ type: "SET_BUSY", isBusy: false });
      actionGuardRef.current.leave();
    }
  };

  const runSubmitResult = async (correct: boolean): Promise<void> => {
    if (!state.sessionId) {
      dispatch({
        type: "SET_ERROR",
        message: "No active session. Start a game first.",
      });
      return;
    }

    if (!actionGuardRef.current.tryEnter()) {
      return;
    }

    beginTapFeedbackTiming();
    dispatch({ type: "SET_BUSY", isBusy: true });
    dispatch({ type: "SET_ERROR", message: null });
    try {
      await submitResult(state.sessionId, correct);
      beginPhaseTransitionTiming();
      dispatch({ type: "END_GAME", exhausted: false, surrendered: false });
    } catch (error) {
      dispatch({ type: "SET_ERROR", message: toErrorMessage(error) });
    } finally {
      dispatch({ type: "SET_BUSY", isBusy: false });
      actionGuardRef.current.leave();
    }
  };

  const runResumeGame = async (): Promise<void> => {
    const targetSessionId = state.lastSessionId ?? state.sessionId;
    if (!targetSessionId) {
      dispatch({ type: "SET_ERROR", message: "No saved session to resume." });
      return;
    }

    if (!actionGuardRef.current.tryEnter()) {
      return;
    }

    beginTapFeedbackTiming();
    dispatch({ type: "SET_BUSY", isBusy: true });
    dispatch({ type: "SET_ERROR", message: null });
    try {
      const response = await resumeGame(targetSessionId);
      if (!response) {
        beginPhaseTransitionTiming();
        dispatch({ type: "RESUME_EXPIRED" });
        return;
      }

      beginPhaseTransitionTiming();
      pendingQuestionRenderTimerStartMsRef.current = startMobilePerfTimer();
      dispatch({
        type: "RESUME_SUCCESS",
        sessionId: targetSessionId,
        question: response.question,
        reasoning: response.reasoning,
        guessCount: response.guessCount,
      });
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        message: toOfflineAwareError(
          error,
          connectionStatus.tone,
          "You're offline \u2014 your session is preserved. Reconnect to resume.",
        ),
      });
    } finally {
      dispatch({ type: "SET_BUSY", isBusy: false });
      actionGuardRef.current.leave();
    }
  };

  const runSubmitFeedback = async (
    rating: number,
    feedbackText: string,
  ): Promise<boolean> => {
    const targetSessionId = state.lastSessionId ?? state.sessionId;
    if (!targetSessionId) {
      dispatch({
        type: "SET_ERROR",
        message: "No completed session found for feedback.",
      });
      return false;
    }

    if (!actionGuardRef.current.tryEnter()) {
      return false;
    }

    beginTapFeedbackTiming();
    dispatch({ type: "SET_BUSY", isBusy: true });
    dispatch({ type: "SET_ERROR", message: null });
    try {
      await submitFeedback(targetSessionId, rating, feedbackText);
      return true;
    } catch (error) {
      dispatch({ type: "SET_ERROR", message: toErrorMessage(error) });
      return false;
    } finally {
      dispatch({ type: "SET_BUSY", isBusy: false });
      actionGuardRef.current.leave();
    }
  };

  const onStartGame = (): void => {
    void runStartGame();
  };

  const onAnswer = (value: AnswerValue): void => {
    void runAnswer(value);
  };

  const onSkip = (): void => {
    void runSkip();
  };

  const onRejectGuess = (): void => {
    void runRejectGuess();
  };

  const onSubmitResult = (correct: boolean): void => {
    void runSubmitResult(correct);
  };

  const onResumeGame = (): void => {
    void runResumeGame();
  };

  const renderPrimaryPhase = (): ReactElement | null => {
    if (state.phase === "welcome") {
      return (
        <WelcomeScreen
          isBusy={state.isBusy}
          isOffline={isOffline}
          lastError={state.lastError}
          hasSavedSession={Boolean(state.lastSessionId ?? state.sessionId)}
          quickStartSummary={quickStartSummary}
          teachingProgressSummary={teachingProgressSummary}
          onStartGame={onStartGame}
          onOpenChallenge={() => dispatch({ type: "GO_TO_CHALLENGE" })}
          onOpenTeaching={() =>
            dispatch({ type: "OPEN_PHASE", phase: "teaching" })
          }
          onOpenResume={() => dispatch({ type: "OPEN_PHASE", phase: "resume" })}
        />
      );
    }

    if (state.phase === "gameOver") {
      return (
        <GameOverScreen
          exhausted={state.exhausted}
          surrendered={state.surrendered}
          isBusy={state.isBusy}
          onBackToWelcome={() => dispatch({ type: "BACK_TO_WELCOME" })}
          onOpenFeedback={() =>
            dispatch({ type: "OPEN_PHASE", phase: "feedback" })
          }
          onOpenStats={() => dispatch({ type: "OPEN_PHASE", phase: "stats" })}
        />
      );
    }

    if (state.phase === "challenge") {
      return (
        <ChallengeScreen
          isBusy={state.isBusy}
          errorMessage={state.lastError}
          daily={dailyChallenge}
          leaderboard={dailyLeaderboard}
          isLoading={challengeLoading}
          loadError={challengeError}
          onStartChallenge={(characterId) => {
            void runStartChallenge(characterId);
          }}
          onBackToWelcome={() => dispatch({ type: "BACK_TO_WELCOME" })}
          onOpenHistory={() =>
            dispatch({ type: "OPEN_PHASE", phase: "history" })
          }
          onRetry={onRetry}
        />
      );
    }

    if (state.phase === "resume") {
      return (
        <ResumeScreen
          isBusy={state.isBusy}
          isOffline={isOffline}
          savedSessionId={state.lastSessionId ?? state.sessionId}
          errorMessage={state.lastError}
          onResume={onResumeGame}
          onDiscard={() => dispatch({ type: "BACK_TO_WELCOME" })}
        />
      );
    }

    if (state.phase === "feedback") {
      return (
        <FeedbackScreen
          isBusy={state.isBusy}
          sessionId={state.lastSessionId ?? state.sessionId}
          errorMessage={state.lastError}
          onSubmitFeedback={runSubmitFeedback}
          onBackToWelcome={() => dispatch({ type: "BACK_TO_WELCOME" })}
          onStartNewGame={onStartGame}
        />
      );
    }

    if (state.phase === "stats") {
      return (
        <StatsScreen
          state={state}
          stats={statsOverview}
          historyGames={historyGames}
          isLoading={statsLoading}
          loadError={statsError}
          onOpenCompare={() =>
            dispatch({ type: "OPEN_PHASE", phase: "compare" })
          }
          onBackToWelcome={() => dispatch({ type: "BACK_TO_WELCOME" })}
          onRetry={onRetry}
        />
      );
    }

    if (state.phase === "history") {
      return (
        <HistoryScreen
          state={state}
          historyGames={historyGames}
          isLoading={historyLoading}
          loadError={historyError}
          onOpenStats={() => dispatch({ type: "OPEN_PHASE", phase: "stats" })}
          onBackToWelcome={() => dispatch({ type: "BACK_TO_WELCOME" })}
          onRetry={onRetry}
        />
      );
    }

    if (state.phase === "compare") {
      return (
        <CompareScreen
          state={state}
          stats={statsOverview}
          historyGames={historyGames}
          onOpenPreferences={() =>
            dispatch({ type: "OPEN_PHASE", phase: "preferences" })
          }
          onBackToWelcome={() => dispatch({ type: "BACK_TO_WELCOME" })}
        />
      );
    }

    if (state.phase === "preferences") {
      return (
        <PreferencesScreen
          difficulty={difficulty}
          onSaveDifficulty={saveDifficulty}
          selectedCategories={selectedCategories}
          onToggleCategory={toggleCategory}
          onOpenTeaching={() =>
            dispatch({ type: "OPEN_PHASE", phase: "teaching" })
          }
          onBackToWelcome={() => dispatch({ type: "BACK_TO_WELCOME" })}
        />
      );
    }

    if (state.phase === "teaching") {
      return (
        <TeachingScreen
          state={state}
          lessonIndex={teachingLessonIndex}
          onLessonIndexChange={saveTeachingLessonIndex}
          onOpenFeedback={() =>
            dispatch({ type: "OPEN_PHASE", phase: "feedback" })
          }
          onBackToWelcome={() => dispatch({ type: "BACK_TO_WELCOME" })}
        />
      );
    }

    if (state.phase === "playing") {
      return (
        <PlayingScreen
          questionText={
            state.currentQuestion?.displayText ??
            state.currentQuestion?.text ??
            "Loading question..."
          }
          reasoningText={state.reasoning?.why ?? null}
          confidence={state.reasoning?.confidence ?? null}
          guessCount={state.guessCount}
          rejectCooldownRemaining={state.rejectCooldownRemaining}
          isBusy={state.isBusy}
          errorMessage={state.lastError}
          onAnswer={onAnswer}
          onSkip={onSkip}
          onEndGame={() => dispatch({ type: "END_GAME" })}
        />
      );
    }

    if (state.phase === "guessing") {
      return (
        <GuessingScreen
          characterName={state.finalGuess?.name ?? "Unknown character"}
          characterCategory={state.finalGuess?.category ?? "unknown"}
          confidence={state.guessConfidence}
          guessCount={state.guessCount}
          isBusy={state.isBusy}
          errorMessage={state.lastError}
          onConfirm={() => onSubmitResult(true)}
          onReject={onRejectGuess}
          onSurrender={() => onSubmitResult(false)}
        />
      );
    }

    return null;
  };

  const primaryPhase = renderPrimaryPhase();

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <LowBandwidthWarningModal />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={styles.keyboardArea}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <ConnectionStatusBanner />
            <Animated.View
              style={[
                styles.phaseContent,
                {
                  opacity: phaseContentOpacity,
                  transform: [{ translateY: phaseContentTranslateY }],
                },
              ]}
            >
              {primaryPhase ?? (
                <PhaseScaffold
                  phase={state.phase}
                  title={meta.title}
                  subtitle={meta.subtitle}
                  state={state}
                  onDispatch={dispatch}
                  actions={getPhaseActions(state.phase, {
                    onStartGame,
                    onAnswer,
                    onSkip,
                    onRejectGuess,
                    onSubmitResult,
                    onResumeGame,
                  })}
                />
              )}
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface PhaseActionHandlers {
  onStartGame: () => void;
  onAnswer: (value: AnswerValue) => void;
  onSkip: () => void;
  onRejectGuess: () => void;
  onSubmitResult: (correct: boolean) => void;
  onResumeGame: () => void;
}

function getPhaseActions(
  phase: MobileGamePhase,
  handlers: PhaseActionHandlers,
) {
  switch (phase) {
    case "welcome":
      return [
        { label: "Start Game", onPress: handlers.onStartGame },
        {
          label: "Open Challenge",
          action: { type: "GO_TO_CHALLENGE" } as const,
          tone: "secondary" as const,
        },
        {
          label: "Open Session Resume",
          action: { type: "OPEN_PHASE", phase: "resume" } as const,
          tone: "secondary" as const,
        },
      ];
    case "playing":
      return [
        { label: "Answer: Yes", onPress: () => handlers.onAnswer("yes") },
        { label: "Answer: No", onPress: () => handlers.onAnswer("no") },
        { label: "Answer: Maybe", onPress: () => handlers.onAnswer("maybe") },
        {
          label: "Answer: Unknown",
          onPress: () => handlers.onAnswer("unknown"),
          tone: "secondary" as const,
        },
        {
          label: "Skip Question",
          onPress: handlers.onSkip,
          tone: "secondary" as const,
        },
        {
          label: "End Game",
          action: { type: "END_GAME" } as const,
          tone: "secondary" as const,
        },
      ];
    case "guessing":
      return [
        {
          label: "Yes, Correct Guess",
          onPress: () => handlers.onSubmitResult(true),
        },
        {
          label: "No, Keep Going",
          onPress: handlers.onRejectGuess,
          tone: "secondary" as const,
        },
        {
          label: "Surrender",
          onPress: () => handlers.onSubmitResult(false),
          tone: "secondary" as const,
        },
      ];
    case "gameOver":
      return [
        {
          label: "Back to Welcome",
          action: { type: "BACK_TO_WELCOME" } as const,
        },
        {
          label: "Open Feedback",
          action: { type: "OPEN_PHASE", phase: "feedback" } as const,
          tone: "secondary" as const,
        },
        {
          label: "Open Stats",
          action: { type: "OPEN_PHASE", phase: "stats" } as const,
          tone: "secondary" as const,
        },
      ];
    case "challenge":
      return [
        {
          label: "Back to Welcome",
          action: { type: "BACK_TO_WELCOME" } as const,
        },
        {
          label: "Open History",
          action: { type: "OPEN_PHASE", phase: "history" } as const,
          tone: "secondary" as const,
        },
      ];
    case "stats":
      return [
        {
          label: "Open Compare",
          action: { type: "OPEN_PHASE", phase: "compare" } as const,
        },
        {
          label: "Back to Welcome",
          action: { type: "BACK_TO_WELCOME" } as const,
          tone: "secondary" as const,
        },
      ];
    case "history":
      return [
        {
          label: "Open Stats",
          action: { type: "OPEN_PHASE", phase: "stats" } as const,
        },
        {
          label: "Back to Welcome",
          action: { type: "BACK_TO_WELCOME" } as const,
          tone: "secondary" as const,
        },
      ];
    case "compare":
      return [
        {
          label: "Open Preferences",
          action: { type: "OPEN_PHASE", phase: "preferences" } as const,
        },
        {
          label: "Back to Welcome",
          action: { type: "BACK_TO_WELCOME" } as const,
          tone: "secondary" as const,
        },
      ];
    case "resume":
      return [
        { label: "Resume to Playing", onPress: handlers.onResumeGame },
        {
          label: "Discard and Welcome",
          action: { type: "BACK_TO_WELCOME" } as const,
          tone: "secondary" as const,
        },
      ];
    case "preferences":
      return [
        {
          label: "Open Teaching",
          action: { type: "OPEN_PHASE", phase: "teaching" } as const,
        },
        {
          label: "Back to Welcome",
          action: { type: "BACK_TO_WELCOME" } as const,
          tone: "secondary" as const,
        },
      ];
    case "teaching":
      return [
        {
          label: "Open Feedback",
          action: { type: "OPEN_PHASE", phase: "feedback" } as const,
        },
        {
          label: "Back to Welcome",
          action: { type: "BACK_TO_WELCOME" } as const,
          tone: "secondary" as const,
        },
      ];
    case "feedback":
      return [
        {
          label: "Back to Welcome",
          action: { type: "BACK_TO_WELCOME" } as const,
        },
        {
          label: "Start New Game",
          onPress: handlers.onStartGame,
          tone: "secondary" as const,
        },
      ];
    default:
      return [
        {
          label: "Back to Welcome",
          action: { type: "BACK_TO_WELCOME" } as const,
        },
      ];
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof MobileApiError) {
    if (error.kind === "server" && error.status) {
      return `Server error (${error.status}). Please try again.`;
    }
    if (error.kind === "transport") {
      return "Network error. Check connection or EXPO_PUBLIC_API_BASE_URL.";
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error. Please try again.";
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020617",
  },
  keyboardArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  container: {
    flex: 1,
    minHeight: "100%",
    paddingVertical: 24,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  phaseContent: {
    width: "100%",
  },
});
