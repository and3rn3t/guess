import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { ChallengeView } from "@/components/ChallengeView";
import { GamePhaseRouter } from "@/components/GamePhaseRouter";
import { QuitDialog } from "@/components/QuitDialog";
import { GameContext } from "@/contexts/GameContext";
import { useAchievements } from "@/hooks/useAchievements";
import { useAdaptiveDifficulty } from "@/hooks/useAdaptiveDifficulty";
import { useAppLifecycleEffects } from "@/hooks/useAppLifecycleEffects";
import { useDailyStreak } from "@/hooks/useDailyStreak";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { useDailyChallengeGameFlow } from "@/hooks/useDailyChallengeGameFlow";
import { useEliminationTracker } from "@/hooks/useEliminationTracker";
import { useGameActions } from "@/hooks/useGameActions";
import { useGameContextValue } from "@/hooks/useGameContextValue";
import { useGameState } from "@/hooks/useGameState";
import { useGlobalStats } from "@/hooks/useGlobalStats";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useKV } from "@/hooks/useKV";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePersonalBest } from "@/hooks/usePersonalBest";
import { useServerGame } from "@/hooks/useServerGame";
import { useSound } from "@/hooks/useSound";
import { useSWUpdate } from "@/hooks/useSWUpdate";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useThemeMode } from "@/hooks/useThemeMode";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWeeklyRecap } from "@/hooks/useWeeklyRecap";
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from "@/lib/database";
import {
  ONBOARDING_COMPLETE_KEY,
  PREF_CATEGORIES_KEY,
  PREF_DIFFICULTY_KEY,
  PRIMARY_NAV_PHASES,
} from "@/lib/constants";
import type { SharePayload } from "@/lib/sharing";
import {
  DIFFICULTIES,
  DIFFICULTY_TO_PERSONA,
  sanitizeCategories,
  type Character,
  type CharacterCategory,
  type Difficulty,
  type Question,
} from "@/lib/types";
import { startViewTransition } from "@/lib/view-transitions";
import { motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { Toaster } from "sonner";

function App() {
  // ========== PERSISTENT STATE ==========
  const [characters, setCharacters] = useKV<Character[]>(
    "characters",
    DEFAULT_CHARACTERS,
  );
  const [questions, setQuestions] = useKV<Question[]>(
    "questions",
    DEFAULT_QUESTIONS,
  );

  // ========== GLOBAL STATS (server-sourced) ==========
  const {
    stats: globalStats,
    gameHistory,
    gamesPlayed,
    loading: statsLoading,
    refresh: refreshStats,
  } = useGlobalStats();

  const dailyStreak = useDailyStreak(gameHistory);

  // ========== GAME STATE (reducer) ==========
  const {
    state: game,
    dispatch,
    navigate: rawNavigate,
    hasSavedSession,
    resumeSession,
    clearSession,
  } = useGameState();

  /** Wraps navigate with the View Transitions API cross-fade. */
  const navigate = useCallback(
    (
      phase: Parameters<typeof rawNavigate>[0],
      char?: Parameters<typeof rawNavigate>[1],
    ) => {
      startViewTransition(() => rawNavigate(phase, char));
    },
    [rawNavigate],
  );

  const {
    phase: gamePhase,
    answers,
    gameWon,
    gameSteps,
    guessCount,
    surrendered,
    currentQuestion,
    finalGuess,
    reasoning,
  } = game;

  // ========== SETTINGS ==========
  const [difficulty, setDifficulty] = useKV<Difficulty>(
    PREF_DIFFICULTY_KEY,
    "medium",
  );
  const [rawCategories, setCategories] = useKV<CharacterCategory[]>(
    PREF_CATEGORIES_KEY,
    [],
  );
  const categories = useMemo(
    () => sanitizeCategories(rawCategories),
    [rawCategories],
  );
  const [challenge, setChallenge] = useState<SharePayload | null>(null);
  const {
    serverRemaining,
    serverTotal,
    serverReadiness,
    startServerGame,
    handleServerAnswer,
    handleServerSkip,
    postServerResult,
    submitPostGameFeedback,
    rejectGuess,
    retryAfterReject,
    lastError: serverLastError,
    clearLastError: clearServerError,
    retryLastAction: retryServerAction,
  } = useServerGame(dispatch);
  const { muted, toggle: toggleMute } = useSound();
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const syncStatus = useSyncStatus();
  const { theme, toggleTheme } = useThemeMode();
  const online = useOnlineStatus();
  const [isNewPersonalBest, setIsNewPersonalBest] = useState(false);
  const { eliminatedCount, remainingHistoryRef, reset: resetElimination } =
    useEliminationTracker(serverRemaining);
  const { personalBest, updateBest } = usePersonalBest(difficulty);
  const achievements = useAchievements(gameHistory, dailyStreak, gamesPlayed);
  const weeklyRecap = useWeeklyRecap(gameHistory);
  const maxQuestions = DIFFICULTIES[difficulty].maxQuestions;
  const persona = DIFFICULTY_TO_PERSONA[difficulty];
  const [onboardingDone] = useKV(ONBOARDING_COMPLETE_KEY, false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Adaptive difficulty suggestion — show once per session when win rate ≥ 80% over last 10 games
  useAdaptiveDifficulty(gamePhase, difficulty, gameHistory, setDifficulty);

  const activeCharacters = characters || DEFAULT_CHARACTERS;
  const confidence = reasoning?.confidence ?? 0;
  const effectiveRemaining = serverRemaining;

  // ========== KEEP SCREEN AWAKE DURING ACTIVE PLAY ==========
  useWakeLock(gamePhase === "playing" || gamePhase === "guessing");

  // ========== PWA: INSTALL PROMPT ==========
  const { canInstall, promptInstall } = useInstallPrompt();
  const {
    status: dailyChallenge,
    leaderboard: dailyLeaderboard,
    loading: dailyLoading,
    error: dailyError,
    refresh: refreshDailyChallenge,
    recordCompletion: recordDailyCompletion,
  } = useDailyChallenge();
  const {
    activateDailyChallenge,
    clearActiveDailyChallenge,
    onGameCompleted,
  } =
    useDailyChallengeGameFlow({
      dailyChallenge,
      recordDailyCompletion,
    });

  // ========== PWA: SW UPDATE NOTIFICATION ==========
  const { updateAvailable, reload: reloadForUpdate } = useSWUpdate();
  const {
    startGame,
    startGameWithCharacter,
    handleAnswer,
    handleCorrectGuess,
    handleIncorrectGuess,
    handleRejectGuess,
    handleSurrender,
    handleSkip,
    handleShare,
    handleCopyLink,
    handleReveal,
    handleAddCharacter,
    handleAddQuestions,
  } = useGameActions({
    categories,
    difficulty,
    startServerGame,
    resetElimination,
    setIsNewPersonalBest,
    dispatch,
    handleServerAnswer,
    updateBest,
    gameSteps,
    guessCount,
    postServerResult,
    refreshStats,
    finalGuess,
    rejectGuess,
    gamePhase,
    setShowQuitDialog,
    currentQuestion,
    serverRemaining,
    handleServerSkip,
    gameWon,
    answers,
    setCharacters,
    setQuestions,
    onGameCompleted,
  });

  const startDailyChallenge = useCallback(async () => {
    if (!dailyChallenge?.characterId) return;
    activateDailyChallenge(dailyChallenge.date);
    await startGameWithCharacter(dailyChallenge.characterId);
  }, [dailyChallenge, activateDailyChallenge, startGameWithCharacter]);

  const startStandardGame = useCallback(async () => {
    clearActiveDailyChallenge();
    await startGame();
  }, [clearActiveDailyChallenge, startGame]);

  useAppLifecycleEffects({
    gamePhase,
    onboardingDone,
    gamesPlayed,
    setShowOnboarding,
    updateAvailable,
    reloadForUpdate,
    navigate,
    setChallenge,
    serverLastError,
    clearServerError,
    showQuitDialog,
    setShowQuitDialog,
    dispatch,
    startGame: startStandardGame,
  });

  let gameOverAnnouncement = "";
  if (gamePhase === "gameOver") {
    if (gameWon) {
      gameOverAnnouncement = "Correct! I got it right!";
    } else if (surrendered) {
      gameOverAnnouncement = "Game ended early.";
    } else {
      gameOverAnnouncement = "Wrong guess. You stumped me!";
    }
  }

  const gameContextValue = useGameContextValue({
    game,
    dispatch,
    navigate,
    difficulty,
    setDifficulty,
    categories,
    setCategories,
    persona,
    maxQuestions,
    characters,
    questions,
    activeCharacters,
    serverTotal,
    serverReadiness,
    effectiveRemaining,
    confidence,
    globalStats,
    gameHistory,
    gamesPlayed,
    statsLoading,
    hasSavedSession,
    resumeSession,
    clearSession,
    online,
    eliminatedCount,
    remainingHistoryRef,
    isNewPersonalBest,
    personalBest,
    dailyStreak,
    achievements,
    weeklyRecap,
    dailyChallenge,
    dailyLeaderboard,
    dailyLoading,
    dailyError,
    refreshDailyChallenge,
    showOnboarding,
    setShowOnboarding,
    startGame: startStandardGame,
    startDailyChallenge,
    handleAnswer,
    handleSkip,
    handleGiveUp: handleSurrender,
    handleCorrectGuess,
    handleIncorrectGuess,
    handleRejectGuess,
    retryAfterReject,
    serverLastError,
    clearServerError,
    retryServerAction,
    handleShare,
    handleCopyLink,
    handleReveal,
    handleSubmitFeedback: submitPostGameFeedback,
    handleAddCharacter,
    handleAddQuestions,
  });

  // Challenge view is a standalone screen — render before the main layout
  if (gamePhase === "challenge" && challenge) {
    return (
      <ChallengeView
        challenge={challenge}
        onPlay={() => {
          setChallenge(null);
          navigate("welcome");
        }}
      />
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-cosmic-glow" />
        {/* Ambient confidence reactor — brightens as the AI homes in */}
        <motion.div
          className="absolute inset-0 bg-cosmic-hot-glow transition-opacity duration-1000 ease-out"
          animate={{
            opacity: gamePhase === "playing" ? (confidence / 100) * 0.18 : 0,
          }}
          transition={{ duration: 1, ease: "easeOut" }}
          aria-hidden="true"
        />

        <div className="relative z-10">
          <AppHeader
            gamePhase={gamePhase}
            navigate={navigate}
            dispatch={dispatch}
            answers={answers}
            currentQuestion={currentQuestion}
            maxQuestions={maxQuestions}
            syncStatus={syncStatus}
            muted={muted}
            toggleMute={toggleMute}
            theme={theme}
            toggleTheme={toggleTheme}
            setShowQuitDialog={setShowQuitDialog}
            canInstall={canInstall}
            promptInstall={promptInstall}
          />
          {!online && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 text-sm text-yellow-400"
            >
              <span
                className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse"
                aria-hidden="true"
              />
              <span>You&rsquo;re offline — new games are unavailable until you reconnect.</span>
            </div>
          )}

          <main
            role="main"
            aria-label="Game content"
            className={`container mx-auto px-4 py-8 md:py-12 ${PRIMARY_NAV_PHASES.includes(gamePhase) ? "pb-24 lg:pb-12" : ""}`}
          >
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {gamePhase === "playing" &&
                currentQuestion &&
                `Question ${answers.length + 1}: ${currentQuestion.displayText || currentQuestion.text}`}
              {gamePhase === "guessing" &&
                finalGuess &&
                `I think it's ${finalGuess.name}. Was I correct?`}
              {gameOverAnnouncement}
            </div>

            <GameContext.Provider value={gameContextValue}>
              <GamePhaseRouter />
            </GameContext.Provider>
            <BottomNav
              gamePhase={gamePhase}
              navigate={navigate}
              muted={muted}
              toggleMute={toggleMute}
              theme={theme}
              toggleTheme={toggleTheme}
              canInstall={canInstall}
              promptInstall={promptInstall}
            />
          </main>
        </div>
      </div>

      <QuitDialog
        open={showQuitDialog}
        onOpenChange={setShowQuitDialog}
        onSurrender={handleSurrender}
        onQuit={() => navigate("welcome")}
      />
    </>
  );
}

export default App;
