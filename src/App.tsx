import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { ChallengeView } from "@/components/ChallengeView";
import { GamePhaseRouter } from "@/components/GamePhaseRouter";
import { GameContext } from "@/contexts/GameContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAchievements } from "@/hooks/useAchievements";
import { useAdaptiveDifficulty } from "@/hooks/useAdaptiveDifficulty";
import { useAppLifecycleEffects } from "@/hooks/useAppLifecycleEffects";
import { useDailyStreak } from "@/hooks/useDailyStreak";
import { useEliminationTracker } from "@/hooks/useEliminationTracker";
import { useGameActions } from "@/hooks/useGameActions";
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
import { useWakeLock } from "@/hooks/useWakeLock";
import { useWeeklyRecap } from "@/hooks/useWeeklyRecap";
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from "@/lib/database";
import type { SharePayload } from "@/lib/sharing";
import type {
  Character,
  CharacterCategory,
  Difficulty,
  Question,
} from "@/lib/types";
import {
  DIFFICULTIES,
  DIFFICULTY_TO_PERSONA,
  sanitizeCategories,
} from "@/lib/types";
import { startViewTransition } from "@/lib/view-transitions";
import { useTheme } from "next-themes";
import { useCallback, useMemo, useState } from "react";
import { Toaster } from "sonner";
const THEME_ORDER = ["dark", "light", "system"] as const;

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
    "pref:difficulty",
    "medium",
  );
  const [rawCategories, setCategories] = useKV<CharacterCategory[]>(
    "pref:categories",
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
  const { theme, setTheme } = useTheme();
  const online = useOnlineStatus();
  const [isNewPersonalBest, setIsNewPersonalBest] = useState(false);
  const { eliminatedCount, remainingHistoryRef, reset: resetElimination } =
    useEliminationTracker(serverRemaining);
  const { personalBest, updateBest } = usePersonalBest(difficulty);
  const achievements = useAchievements(gameHistory, dailyStreak, gamesPlayed);
  const weeklyRecap = useWeeklyRecap(gameHistory);
  const maxQuestions = DIFFICULTIES[difficulty].maxQuestions;
  const persona = DIFFICULTY_TO_PERSONA[difficulty];
  const [onboardingDone] = useKV("onboarding-complete", false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Adaptive difficulty suggestion — show once per session when win rate ≥ 80% over last 10 games
  useAdaptiveDifficulty(gamePhase, difficulty, gameHistory, setDifficulty);

  const toggleTheme = useCallback(() => {
    const currentIndex = THEME_ORDER.indexOf((theme as (typeof THEME_ORDER)[number]) ?? "dark");
    const nextTheme = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length];
    setTheme(nextTheme);
  }, [theme, setTheme]);

  const activeCharacters = characters || DEFAULT_CHARACTERS;
  const confidence = reasoning?.confidence ?? 0;
  const effectiveRemaining = serverRemaining;

  // ========== KEEP SCREEN AWAKE DURING ACTIVE PLAY ==========
  useWakeLock(gamePhase === "playing" || gamePhase === "guessing");

  // ========== PWA: INSTALL PROMPT ==========
  const { canInstall, promptInstall } = useInstallPrompt();

  // ========== PWA: SW UPDATE NOTIFICATION ==========
  const { updateAvailable, reload: reloadForUpdate } = useSWUpdate();
  const {
    startGame,
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
  });

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
    startGame,
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
        <div
          className="absolute inset-0 bg-cosmic-hot-glow transition-opacity duration-1000 ease-out"
          style={{
            opacity:
              gamePhase === "playing" ? (confidence / 100) * 0.18 : 0,
          }}
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
              You&rsquo;re offline — new games are unavailable until you reconnect.
            </div>
          )}

          <main
            role="main"
            aria-label="Game content"
            className={`container mx-auto px-4 py-8 md:py-12 ${["welcome", "stats", "history", "compare"].includes(gamePhase) ? "pb-24 lg:pb-12" : ""}`}
          >
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {gamePhase === "playing" &&
                currentQuestion &&
                `Question ${answers.length + 1}: ${currentQuestion.displayText || currentQuestion.text}`}
              {gamePhase === "guessing" &&
                finalGuess &&
                `I think it's ${finalGuess.name}. Was I correct?`}
              {gamePhase === "gameOver" &&
                (gameWon
                  ? "Correct! I got it right!"
                  : surrendered
                    ? "Game ended early."
                    : "Wrong guess. You stumped me!")}
            </div>

            <GameContext.Provider
              value={{
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
                showOnboarding,
                setShowOnboarding,
                startGame,
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
              }}
            >
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

      <AlertDialog open={showQuitDialog} onOpenChange={setShowQuitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End this game?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>Give Up</strong> records your session and asks what you were thinking of — same as a regular loss.
              <br />
              <strong>Quit</strong> abandons the game without saving anything.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="sm:mr-auto">
              Keep Playing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSurrender}
              className="bg-amber-500 hover:bg-amber-600 text-white border-0"
            >
              Give Up
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => navigate("welcome")}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-0"
            >
              Quit Without Saving
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default App;
