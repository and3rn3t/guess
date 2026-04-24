import { AppHeader } from "@/components/AppHeader";
import { GameOver } from "@/components/GameOver";
import { GuessReveal } from "@/components/GuessReveal";
import { PlayingScreen } from "@/components/PlayingScreen";
import { WelcomeScreen } from "@/components/WelcomeScreen";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGameState } from "@/hooks/useGameState";
import { useKV } from "@/hooks/useKV";
import { useSound } from "@/hooks/useSound";
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
import type { SyncStatus } from "@/lib/sync";
import { getSyncStatus, onSyncStatusChange } from "@/lib/sync";
import type {
  AnswerValue,
  Character,
  CharacterCategory,
  Difficulty,
  Question,
} from "@/lib/types";
import { DIFFICULTIES, DIFFICULTY_TO_PERSONA } from "@/lib/types";
import { PlayIcon, SparkleIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast, Toaster } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useServerGame } from "@/hooks/useServerGame";
import { useGlobalStats } from "@/hooks/useGlobalStats";
import { useDailyStreak } from "@/hooks/useDailyStreak";
import { useWakeLock } from "@/hooks/useWakeLock";

const TeachingMode = lazy(() =>
  import("@/components/TeachingMode").then((m) => ({
    default: m.TeachingMode,
  })),
);
const DescribeYourselfScreen = lazy(() =>
  import("@/components/DescribeYourselfScreen").then((m) => ({
    default: m.DescribeYourselfScreen,
  })),
);
const QuestionManager = lazy(() =>
  import("@/components/QuestionManager").then((m) => ({
    default: m.QuestionManager,
  })),
);
const StatsDashboard = lazy(() =>
  import("@/components/StatsDashboard").then((m) => ({
    default: m.StatsDashboard,
  })),
);
const CharacterComparison = lazy(() =>
  import("@/components/CharacterComparison").then((m) => ({
    default: m.CharacterComparison,
  })),
);
const GameHistory = lazy(() =>
  import("@/components/GameHistory").then((m) => ({ default: m.GameHistory })),
);

// Lazy-loaded modules — fire-and-forget or async-only usage
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
    navigate,
    hasSavedSession,
    resumeSession,
    clearSession,
  } = useGameState();
  const {
    phase: gamePhase,
    answers,
    currentQuestion,
    reasoning,
    possibleCharacters,
    finalGuess,
    isThinking,
    gameWon,
    gameSteps,
    showDevTools,
    guessCount,
    exhausted,
    surrendered,
  } = game;

  // ========== SETTINGS ==========
  const [difficulty, setDifficulty] = useKV<Difficulty>("pref:difficulty", "medium");
  const [categories, setCategories] = useKV<CharacterCategory[]>("pref:categories", []);
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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const { theme, setTheme } = useTheme();
  const online = useOnlineStatus();
  const [eliminatedCount, setEliminatedCount] = useState<number | null>(null);
  const prevPossibleCount = useRef<number>(0);
  const maxQuestions = DIFFICULTIES[difficulty].maxQuestions;
  const persona = DIFFICULTY_TO_PERSONA[difficulty];
  const [onboardingDone] = useKV("onboarding-complete", false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding when first game starts
  useEffect(() => {
    if (
      gamePhase === "playing" &&
      !onboardingDone &&
      gamesPlayed === 0
    ) {
      setShowOnboarding(true);
    }
  }, [gamePhase, onboardingDone, gamesPlayed]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const activeCharacters = characters || DEFAULT_CHARACTERS;

  // ========== CONFIDENCE (server-provided) ==========
  const confidence = reasoning?.confidence ?? 0;

  const effectiveRemaining = serverRemaining;

  // ========== SYNC STATUS ==========
  useEffect(() => {
    setSyncStatus(getSyncStatus());
    const unsubscribe = onSyncStatusChange(setSyncStatus);
    return unsubscribe;
  }, []);

  // ========== KEEP SCREEN AWAKE DURING ACTIVE PLAY ==========
  useWakeLock(gamePhase === "playing" || gamePhase === "guessing");

  // ========== FOCUS MANAGEMENT ON PHASE CHANGE ==========
  // Move focus to the new phase's primary heading/wrapper after transition,
  // so screen readers announce context and keyboard users land in the right
  // place. Components opt in by adding `data-phase-focus tabIndex={-1}`.
  useEffect(() => {
    const target = document.querySelector<HTMLElement>("[data-phase-focus]");
    if (target) target.focus({ preventScroll: true });
  }, [gamePhase]);

  // ========== ELIMINATION FEEDBACK ==========
  useEffect(() => {
    const eliminated = prevPossibleCount.current - serverRemaining;
    if (prevPossibleCount.current > 0 && eliminated > 0) {
      setEliminatedCount(eliminated);
      setTimeout(() => setEliminatedCount(null), 2000);
    }
    prevPossibleCount.current = serverRemaining;
  }, [serverRemaining]);

  // ========== PARSE URL CHALLENGE ON MOUNT ==========
  useEffect(() => {
    const payload = parseUrlChallenge();
    if (payload) {
      setChallenge(payload);
      navigate("challenge");
      // Clear hash so it doesn't persist on reload
      globalThis.history.replaceState(null, "", globalThis.location.pathname);
    }
  }, [navigate]);

  // Server manages question flow — no client-side auto-generation needed

  // ========== GAME START ==========
  const startGame = async () => {
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
    dispatch({ type: "CORRECT_GUESS" });
    analytics().then((m) => m.trackGameEnd(true, difficulty, gameSteps.length, guessCount));
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
    analytics().then((m) => m.trackGameEnd(false, difficulty, gameSteps.length, guessCount));
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
    const ANSWER_EMOJI: Record<string, string> = { yes: "🟢", no: "🔴", maybe: "🟡" };
    const answerBar = challenge.steps.map((s) => ANSWER_EMOJI[s.answer] ?? "⚪").join("");
    return (
      <>
        <Toaster position="top-center" richColors />
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <SparkleIcon size={64} weight="fill" className="mx-auto text-accent animate-float" />
            <h1 className="text-3xl font-bold text-foreground">Challenge!</h1>
            <p className="text-muted-foreground text-lg">
              {challenge.won
                ? `Andernator figured out ${challenge.characterName} in ${challenge.questionCount} questions!`
                : `Someone stumped Andernator thinking of ${challenge.characterName}!`}
            </p>
            <div className="text-2xl tracking-wider">{answerBar}</div>
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="inline-flex items-center rounded-full bg-accent/20 px-3 py-1 text-sm font-medium text-accent">
                {challenge.difficulty.charAt(0).toUpperCase() + challenge.difficulty.slice(1)}
              </span>
              <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                {challenge.questionCount} questions
              </span>
            </div>
            <p className="text-foreground font-semibold text-lg">Can you do better?</p>
            <Button
              onClick={() => { setChallenge(null); navigate("welcome"); }}
              size="lg"
              className="h-14 px-8 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
            >
              <PlayIcon size={24} weight="fill" className="mr-2" />
              Play Now
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-cosmic-glow" />

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
          />

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

            <AnimatePresence mode="wait">
              {gamePhase === "welcome" && (
                <WelcomeScreen
                  startGame={startGame}
                  serverTotal={serverTotal}
                  online={online}
                  maxQuestions={maxQuestions}
                  gameHistory={gameHistory}
                  gamesPlayed={gamesPlayed}
                  hasSavedSession={hasSavedSession}
                  resumeSession={resumeSession}
                  clearSession={clearSession}
                  showDevTools={showDevTools}
                  navigate={navigate}
                  characters={characters}
                  globalStats={globalStats}
                  difficulty={difficulty}
                  setDifficulty={setDifficulty}
                  categories={categories}
                  setCategories={setCategories}
                  streak={dailyStreak}
                />
              )}

              {gamePhase === "playing" && (
                <PlayingScreen
                  answers={answers}
                  maxQuestions={maxQuestions}
                  confidence={confidence}
                  effectiveRemaining={effectiveRemaining}
                  eliminatedCount={eliminatedCount}
                  possibleCharacters={possibleCharacters}
                  currentQuestion={currentQuestion}
                  isThinking={isThinking}
                  reasoning={reasoning}
                  handleAnswer={handleAnswer}
                  dispatch={dispatch}
                  gameSteps={gameSteps}
                  gamesPlayed={gamesPlayed}
                  showOnboarding={showOnboarding}
                  setShowOnboarding={setShowOnboarding}
                  activeCharacters={activeCharacters}
                  readiness={serverReadiness}
                  onRetry={retryAfterReject}
                  onSkip={handleSkip}
                  onGiveUp={handleGiveUp}
                />
              )}

              {gamePhase === "guessing" && finalGuess && (
                <motion.div
                  key="guessing"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="max-w-2xl mx-auto">
                    <GuessReveal
                      character={finalGuess}
                      confidence={confidence}
                      guessNumber={guessCount}
                      onCorrect={handleCorrectGuess}
                      onIncorrect={handleIncorrectGuess}
                      onRejectGuess={handleRejectGuess}
                    />
                  </div>
                </motion.div>
              )}

              {gamePhase === "gameOver" && (
                <motion.div
                  key="gameOver"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="max-w-2xl mx-auto">
                    <GameOver
                      won={gameWon}
                      exhausted={exhausted}
                      surrendered={surrendered}
                      character={finalGuess}
                      maxQuestions={maxQuestions}
                      questionsAsked={gameSteps.length}
                      guessesUsed={guessCount}
                      remainingCharacters={effectiveRemaining}
                      gamesPlayed={gamesPlayed}
                      onPlayAgain={startGame}
                      onNewGame={() => navigate("welcome")}
                      onTeachMode={
                        gameWon ? undefined : () => navigate("teaching")
                      }
                      onViewHistory={() => navigate("history")}
                      onViewStats={() => navigate("stats")}
                      onShare={handleShare}
                      onCopyLink={handleCopyLink}
                      answeredQuestions={answers.map((a) => {
                        const q = (questions || DEFAULT_QUESTIONS).find(
                          (q) => q.id === a.questionId,
                        );
                        return { question: q?.text || "", answer: a.value };
                      })}
                      onReveal={gameWon ? undefined : handleReveal}
                      persona={persona}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {gamePhase === "teaching" && (
              <div className="max-w-2xl mx-auto">
                <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                  <TeachingMode
                    answers={answers}
                    existingCharacters={characters || DEFAULT_CHARACTERS}
                    onAddCharacter={handleAddCharacter}
                    onAddQuestions={handleAddQuestions}
                    onPlayAgain={startGame}
                    onGoHome={() => navigate("welcome")}
                  />
                </Suspense>
              </div>
            )}

            {gamePhase === "describeYourself" && (
              <div className="max-w-xl mx-auto">
                <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                  <DescribeYourselfScreen
                    questions={questions || DEFAULT_QUESTIONS}
                    characters={activeCharacters}
                    persona={persona}
                    onClose={() => navigate("welcome")}
                  />
                </Suspense>
              </div>
            )}

            {gamePhase === "manage" && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-foreground">
                      Question Pool Manager
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      Generate new questions from user-taught characters
                    </p>
                  </div>
                  <Button onClick={() => navigate("welcome")} variant="outline">
                    Back to Game
                  </Button>
                </div>
                <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                  <QuestionManager
                    characters={characters || DEFAULT_CHARACTERS}
                    questions={questions || DEFAULT_QUESTIONS}
                    onAddQuestions={handleAddQuestions}
                  />
                </Suspense>
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    Current Statistics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-background/50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-accent">
                        {(characters || DEFAULT_CHARACTERS).length}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Total Characters
                      </div>
                    </div>
                    <div className="bg-background/50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-accent">
                        {(questions || DEFAULT_QUESTIONS).length}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Total Questions
                      </div>
                    </div>
                    <div className="bg-background/50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-accent">
                        {
                          (characters || DEFAULT_CHARACTERS).filter((c) =>
                            c.id.startsWith("char-"),
                          ).length
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">
                        User-Taught
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {gamePhase === "stats" && (
              <div className="max-w-4xl mx-auto">
                <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                  <StatsDashboard
                    stats={globalStats}
                    loading={statsLoading}
                    onBack={() => navigate("welcome")}
                  />
                </Suspense>
              </div>
            )}

            {gamePhase === "history" && (
              <div className="max-w-4xl mx-auto">
                <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                  <GameHistory
                    history={gameHistory}
                    loading={statsLoading}
                    onBack={() => navigate("welcome")}
                  />
                </Suspense>
              </div>
            )}

            {gamePhase === "compare" && (
              <div className="max-w-4xl mx-auto">
                <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                  <CharacterComparison
                    characters={characters || DEFAULT_CHARACTERS}
                    onBack={() => navigate("welcome")}
                  />
                </Suspense>
              </div>
            )}
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
            <AlertDialogCancel className="sm:mr-auto">Keep Playing</AlertDialogCancel>
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
