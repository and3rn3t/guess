import { AppHeader } from "@/components/AppHeader";
import { ChallengeView } from "@/components/ChallengeView";
import { GamePhaseRouter } from "@/components/GamePhaseRouter";
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
import { useDailyStreak } from "@/hooks/useDailyStreak";
import { useEliminationTracker } from "@/hooks/useEliminationTracker";
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
import {
  buildShareUrl,
  generateShareText,
  parseUrlChallenge,
} from "@/lib/sharing";
import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  playAnswer,
  playCorrectGuess,
  playIncorrectGuess,
} from "@/lib/sounds";
import type {
  AnswerValue,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster } from "sonner";

const analytics = () => import("@/lib/analytics");

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
    rejectGuess,
    retryAfterReject,
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
  const adaptiveToastShownRef = useRef(false);
  useEffect(() => {
    if (gamePhase !== "welcome") return;
    if (adaptiveToastShownRef.current) return;
    if (difficulty === "hard") return;
    if (!gameHistory || gameHistory.length < 10) return;

    const nextDifficulty: Record<string, string> = {
      easy: "Medium",
      medium: "Hard",
    };
    const next = nextDifficulty[difficulty];
    if (!next) return;

    const last10 = gameHistory
      .filter((g) => g.difficulty === difficulty)
      .slice(-10);
    if (last10.length < 10) return;

    const winRate = last10.filter((g) => g.won).length / last10.length;
    if (winRate >= 0.8) {
      adaptiveToastShownRef.current = true;
      const wins = Math.round(winRate * 10);
      toast(
        `You've won ${wins}/10 on ${DIFFICULTIES[difficulty].label} — ready for ${next}?`,
        {
          duration: 6000,
          action: {
            label: `Try ${next}`,
            onClick: () =>
              setDifficulty(difficulty === "easy" ? "medium" : "hard"),
          },
        },
      );
    }
  }, [gamePhase, difficulty, gameHistory, setDifficulty]);

  // Show onboarding when first game starts
  useEffect(() => {
    if (gamePhase === "playing" && !onboardingDone && gamesPlayed === 0) {
      setShowOnboarding(true);
    }
  }, [gamePhase, onboardingDone, gamesPlayed]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
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
  useEffect(() => {
    if (!updateAvailable) return;
    toast("Update available", {
      description: "A new version of Andernator is ready.",
      action: { label: "Reload", onClick: reloadForUpdate },
      duration: Infinity,
    });
  }, [updateAvailable, reloadForUpdate]);

  // ========== FOCUS MANAGEMENT ON PHASE CHANGE ==========
  // Move focus to the new phase's primary heading/wrapper after transition,
  // so screen readers announce context and keyboard users land in the right
  // place. Components opt in by adding `data-phase-focus tabIndex={-1}`.
  useEffect(() => {
    const target = document.querySelector<HTMLElement>("[data-phase-focus]");
    if (target) target.focus({ preventScroll: true });
  }, [gamePhase]);

  // ========== PARSE URL CHALLENGE ON MOUNT ==========
  useEffect(() => {
    const payload = parseUrlChallenge();
    if (payload) {
      setChallenge(payload);
      navigate("challenge");
      globalThis.history.replaceState(
        null,
        "",
        globalThis.location.pathname,
      );
    }
  }, [navigate]);

  // ========== GAME START ==========
  const startGame = async () => {
    setIsNewPersonalBest(false);
    resetElimination();
    await startServerGame(categories, difficulty);
  };

  // ========== ANSWER HANDLER ==========
  const handleAnswer = async (value: AnswerValue) => {
    dispatch({ type: "ANSWER", value });
    playAnswer();
    hapticLight();
    await handleServerAnswer(value);
  };

  // ========== GAME OUTCOME HANDLERS ==========
  const handleCorrectGuess = () => {
    const isNewBest = updateBest(gameSteps.length);
    setIsNewPersonalBest(isNewBest);
    dispatch({ type: "CORRECT_GUESS" });
    analytics().then((m) =>
      m.trackGameEnd(true, difficulty, gameSteps.length, guessCount),
    );
    playCorrectGuess();
    hapticSuccess();
    toast.success("🎉 I got it right!");
    postServerResult(true);
    refreshStats();
  };

  const handleIncorrectGuess = () => {
    dispatch({ type: "INCORRECT_GUESS" });
    analytics().then((m) =>
      m.trackGameEnd(false, difficulty, gameSteps.length, guessCount),
    );
    playIncorrectGuess();
    hapticMedium();
    toast.error("I'll learn from this and do better next time!");
    postServerResult(false);
    refreshStats();
  };

  const handleRejectGuess = () => {
    if (!finalGuess) return;
    playIncorrectGuess();
    hapticMedium();
    rejectGuess(finalGuess.id);
  };

  const handleSurrender = () => {
    analytics().then((m) =>
      m.trackGameEnd(false, difficulty, gameSteps.length, guessCount),
    );
    postServerResult(false);
    refreshStats();
    setShowQuitDialog(false);
    dispatch({ type: "SURRENDER" });
  };

  const handleSkip = () => {
    handleServerSkip();
  };

  const handleGiveUp = () => {
    handleSurrender();
  };

  // ========== SHARE HANDLERS ==========
  const getSharePayload = (): SharePayload | null => {
    if (!finalGuess) return null;
    return {
      characterId: finalGuess.id,
      characterName: finalGuess.name,
      won: gameWon,
      difficulty,
      questionCount: gameSteps.length,
      steps: gameSteps,
    };
  };

  const handleShare = async () => {
    const payload = getSharePayload();
    if (!payload) return;
    const text = generateShareText(payload);
    const url = buildShareUrl(payload);
    if (navigator.share) {
      try {
        await navigator.share({ text: `${text}\n${url}` });
        analytics().then((m) => m.trackShare("native"));
      } catch {
        // User cancelled — ignore
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        analytics().then((m) => m.trackShare("clipboard"));
        toast.success("Copied to clipboard!");
      } catch {
        toast.error("Could not copy to clipboard");
      }
    }
  };

  const handleCopyLink = async () => {
    const payload = getSharePayload();
    if (!payload) return;
    const url = buildShareUrl(payload);
    try {
      await navigator.clipboard.writeText(url);
      analytics().then((m) => m.trackShare("link"));
      toast.success("Challenge link copied!");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handleReveal = async (
    characterName: string,
  ): Promise<{
    found: boolean;
    characterName?: string | null;
    attributesFilled?: number;
  }> => {
    const res = await fetch("/api/v2/game/reveal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterName,
        answers: answers.map((a) => ({
          questionId: a.questionId,
          value: a.value,
        })),
      }),
    });
    if (!res.ok) return { found: false };
    return res.json() as Promise<{
      found: boolean;
      characterName?: string | null;
      attributesFilled?: number;
    }>;
  };

  // ========== DATA HANDLERS ==========
  const handleAddCharacter = (character: Character) => {
    setCharacters((prev) => [...(prev || []), character]);
    toast.success(`I've learned about ${character.name}!`);
  };

  const handleAddQuestions = (newQuestions: Question[]) => {
    setQuestions((prev) => [...(prev || []), ...newQuestions]);
  };

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
            className="container mx-auto px-4 py-8 md:py-12"
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

            <GamePhaseRouter
              game={game}
              dispatch={dispatch}
              navigate={navigate}
              difficulty={difficulty}
              setDifficulty={setDifficulty}
              categories={categories}
              setCategories={setCategories}
              persona={persona}
              maxQuestions={maxQuestions}
              characters={characters}
              questions={questions}
              activeCharacters={activeCharacters}
              serverTotal={serverTotal}
              serverReadiness={serverReadiness}
              effectiveRemaining={effectiveRemaining}
              confidence={confidence}
              globalStats={globalStats}
              gameHistory={gameHistory}
              gamesPlayed={gamesPlayed}
              statsLoading={statsLoading}
              hasSavedSession={hasSavedSession}
              resumeSession={resumeSession}
              clearSession={clearSession}
              online={online}
              eliminatedCount={eliminatedCount}
              remainingHistoryRef={remainingHistoryRef}
              isNewPersonalBest={isNewPersonalBest}
              personalBest={personalBest}
              dailyStreak={dailyStreak}
              achievements={achievements}
              weeklyRecap={weeklyRecap}
              showOnboarding={showOnboarding}
              setShowOnboarding={setShowOnboarding}
              startGame={startGame}
              handleAnswer={handleAnswer}
              handleSkip={handleSkip}
              handleGiveUp={handleGiveUp}
              handleCorrectGuess={handleCorrectGuess}
              handleIncorrectGuess={handleIncorrectGuess}
              handleRejectGuess={handleRejectGuess}
              retryAfterReject={retryAfterReject}
              handleShare={handleShare}
              handleCopyLink={handleCopyLink}
              handleReveal={handleReveal}
              handleAddCharacter={handleAddCharacter}
              handleAddQuestions={handleAddQuestions}
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
