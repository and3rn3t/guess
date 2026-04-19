import { AppHeader } from "@/components/AppHeader";
import { GameOver, GuessReveal } from "@/components/GuessReveal";
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
  Difficulty,
  GameHistoryEntry,
  Question,
} from "@/lib/types";
import { DIFFICULTIES } from "@/lib/types";
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

const TeachingMode = lazy(() =>
  import("@/components/TeachingMode").then((m) => ({
    default: m.TeachingMode,
  })),
);
const QuestionManager = lazy(() =>
  import("@/components/QuestionManager").then((m) => ({
    default: m.QuestionManager,
  })),
);
const QuestionGeneratorDemo = lazy(() =>
  import("@/components/QuestionGeneratorDemo").then((m) => ({
    default: m.QuestionGeneratorDemo,
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
const AttributeCoverageReport = lazy(() =>
  import("@/components/AttributeCoverageReport").then((m) => ({
    default: m.AttributeCoverageReport,
  })),
);
const AttributeRecommender = lazy(() =>
  import("@/components/AttributeRecommender").then((m) => ({
    default: m.AttributeRecommender,
  })),
);
const CategoryRecommender = lazy(() =>
  import("@/components/CategoryRecommender").then((m) => ({
    default: m.CategoryRecommender,
  })),
);
const EnvironmentTest = lazy(() =>
  import("@/components/EnvironmentTest").then((m) => ({
    default: m.EnvironmentTest,
  })),
);
const MultiCategoryEnhancer = lazy(() =>
  import("@/components/MultiCategoryEnhancer").then((m) => ({
    default: m.MultiCategoryEnhancer,
  })),
);
const CostDashboard = lazy(() =>
  import("@/components/CostDashboard").then((m) => ({
    default: m.CostDashboard,
  })),
);
const DataHygiene = lazy(() =>
  import("@/components/DataHygiene").then((m) => ({
    default: m.DataHygiene,
  })),
);
const GameHistory = lazy(() =>
  import("@/components/GameHistory").then((m) => ({ default: m.GameHistory })),
);

// Lazy-loaded modules — fire-and-forget or async-only usage
const analytics = () => import("@/lib/analytics");

const ANSWER_EMOJI: Record<string, string> = {
  yes: "🟢",
  no: "🔴",
  maybe: "🟡",
};

function renderAdminPhase({
  gamePhase,
  characters,
  questions,
  selectedCharacter,
  challenge,
  navigate,
  handleUpdateCharacter,
  handleUpdateCharacters,
  handleUpdateQuestion,
  setChallenge,
}: {
  gamePhase: string;
  characters: Character[] | null;
  questions: Question[] | null;
  selectedCharacter: Character | null;
  challenge: SharePayload | null;
  navigate: (phase: "welcome") => void;
  handleUpdateCharacter: (c: Character) => void;
  handleUpdateCharacters: (c: Character[]) => void;
  handleUpdateQuestion: (q: Question) => void;
  setChallenge: (v: null) => void;
}): React.JSX.Element | null {
  const onBack = () => navigate("welcome");
  const allChars = characters || DEFAULT_CHARACTERS;
  const allQuestions = questions || DEFAULT_QUESTIONS;
  const wrap = (children: React.ReactNode, maxW?: string) => (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {maxW ? <div className={maxW}>{children}</div> : children}
      </div>
    </div>
  );

  switch (gamePhase) {
    case "bulkHabitat":
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <MultiCategoryEnhancer
            characters={allChars}
            onUpdateCharacters={handleUpdateCharacters}
            onBack={onBack}
          />
        </Suspense>,
      );
    case "demo":
      return (
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <QuestionGeneratorDemo onBack={onBack} />
        </Suspense>
      );
    case "environmentTest":
      if (!selectedCharacter) return null;
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <EnvironmentTest
            character={selectedCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onBack={onBack}
          />
        </Suspense>,
      );
    case "coverage":
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <AttributeCoverageReport characters={allChars} onBack={onBack} />
        </Suspense>,
      );
    case "categoryRecommender":
      if (!selectedCharacter) return null;
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <CategoryRecommender
            character={selectedCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onBack={onBack}
          />
        </Suspense>,
      );
    case "recommender":
      if (!selectedCharacter) return null;
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <AttributeRecommender
            character={selectedCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onBack={onBack}
          />
        </Suspense>,
      );
    case "costDashboard":
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <CostDashboard onBack={onBack} />
        </Suspense>,
        "max-w-4xl mx-auto",
      );
    case "dataHygiene":
      return wrap(
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <DataHygiene
            characters={allChars}
            questions={allQuestions}
            onUpdateCharacter={handleUpdateCharacter}
            onUpdateQuestion={handleUpdateQuestion}
            onBack={onBack}
          />
        </Suspense>,
        "max-w-4xl mx-auto",
      );
    case "challenge": {
      if (!challenge) return null;
      const answerBar = challenge.steps
        .map((s) => ANSWER_EMOJI[s.answer] ?? "⚪")
        .join("");
      return (
        <>
          <Toaster position="top-center" richColors />
          <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-6 text-center">
              <SparkleIcon
                size={64}
                weight="fill"
                className="mx-auto text-accent animate-float"
              />
              <h1 className="text-3xl font-bold text-foreground">Challenge!</h1>
              <p className="text-muted-foreground text-lg">
                {challenge.won
                  ? `Andernator figured out ${challenge.characterName} in ${challenge.questionCount} questions!`
                  : `Someone stumped Andernator thinking of ${challenge.characterName}!`}
              </p>
              <div className="text-2xl tracking-wider">{answerBar}</div>
              <div className="flex flex-wrap gap-2 justify-center">
                <span className="inline-flex items-center rounded-full bg-accent/20 px-3 py-1 text-sm font-medium text-accent">
                  {challenge.difficulty.charAt(0).toUpperCase() +
                    challenge.difficulty.slice(1)}
                </span>
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
                  {challenge.questionCount} questions
                </span>
              </div>
              <p className="text-foreground font-semibold text-lg">
                Can you do better?
              </p>
              <Button
                onClick={() => {
                  setChallenge(null);
                  navigate("welcome");
                }}
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
    default:
      return null;
  }
}

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
  const [gameHistory, setGameHistory] = useKV<GameHistoryEntry[]>(
    "game-history",
    [],
  );

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
    selectedCharacter,
    showDevTools,
  } = game;

  // ========== SETTINGS (hardcoded defaults) ==========
  const difficulty: Difficulty = "medium";
  const [challenge, setChallenge] = useState<SharePayload | null>(null);
  const {
    serverRemaining,
    serverTotal,
    startServerGame,
    handleServerAnswer,
    postServerResult,
  } = useServerGame(dispatch);
  const { muted, toggle: toggleMute } = useSound();
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const { theme, setTheme } = useTheme();
  const online = useOnlineStatus();
  const [eliminatedCount, setEliminatedCount] = useState<number | null>(null);
  const prevPossibleCount = useRef<number>(0);
  const maxQuestions = DIFFICULTIES[difficulty].maxQuestions;
  const [onboardingDone] = useKV("onboarding-complete", false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding when first game starts
  useEffect(() => {
    if (
      gamePhase === "playing" &&
      !onboardingDone &&
      gameHistory?.length === 0
    ) {
      setShowOnboarding(true);
    }
  }, [gamePhase, onboardingDone, gameHistory]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const activeCharacters = characters || DEFAULT_CHARACTERS;

  // ========== CONFIDENCE (server-provided) ==========
  const probabilities = null;

  const confidence = reasoning?.confidence ?? 0;

  const effectiveRemaining = serverRemaining;

  // ========== SYNC STATUS ==========
  useEffect(() => {
    setSyncStatus(getSyncStatus());
    const unsubscribe = onSyncStatusChange(setSyncStatus);
    return unsubscribe;
  }, []);

  // ========== ELIMINATION FEEDBACK ==========
  useEffect(() => {
    if (prevPossibleCount.current === 0) return;
    const eliminated = prevPossibleCount.current - serverRemaining;
    if (eliminated > 0) {
      setEliminatedCount(eliminated);
      setTimeout(() => setEliminatedCount(null), 2000);
    }
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
    await startServerGame([], difficulty);
  };

  // ========== ANSWER HANDLER ==========
  const handleAnswer = async (value: AnswerValue) => {
    prevPossibleCount.current = serverRemaining;
    dispatch({ type: "ANSWER", value });
    playAnswer();
    hapticLight();

    await handleServerAnswer(value, prevPossibleCount.current);
  };

  // ========== GAME OUTCOME HANDLERS ==========
  const recordGame = (won: boolean) => {
    if (!finalGuess) return;
    setGameHistory((prev) => [
      ...(prev || []),
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        characterId: finalGuess.id,
        characterName: finalGuess.name,
        won,
        timestamp: Date.now(),
        difficulty,
        totalQuestions: maxQuestions,
        steps: gameSteps,
      },
    ]);
  };

  const handleCorrectGuess = () => {
    dispatch({ type: "CORRECT_GUESS" });
    recordGame(true);
    analytics().then((m) => m.trackGameEnd(true, difficulty, gameSteps.length));
    playCorrectGuess();
    hapticSuccess();
    toast.success("🎉 I got it right!");
    postServerResult(true);
  };

  const handleIncorrectGuess = () => {
    dispatch({ type: "INCORRECT_GUESS" });
    recordGame(false);
    analytics().then((m) =>
      m.trackGameEnd(false, difficulty, gameSteps.length),
    );
    playIncorrectGuess();
    hapticMedium();
    toast.error("I'll learn from this and do better next time!");
    postServerResult(false);
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

  // ========== DATA HANDLERS ==========
  const handleAddCharacter = (character: Character) => {
    setCharacters((prev) => [...(prev || []), character]);
    toast.success(`I've learned about ${character.name}!`);
  };

  const handleAddQuestions = (newQuestions: Question[]) => {
    setQuestions((prev) => [...(prev || []), ...newQuestions]);
  };

  const handleUpdateCharacter = (updatedCharacter: Character) => {
    setCharacters((prev) =>
      (prev || []).map((char) =>
        char.id === updatedCharacter.id ? updatedCharacter : char,
      ),
    );
    toast.success(`Updated ${updatedCharacter.name}'s attributes!`);
  };

  const handleUpdateCharacters = (updatedCharacters: Character[]) => {
    setCharacters(() => updatedCharacters);
  };

  const handleUpdateQuestion = (updatedQuestion: Question) => {
    setQuestions((prev) =>
      (prev || []).map((q) =>
        q.id === updatedQuestion.id ? updatedQuestion : q,
      ),
    );
  };

  const adminPhase = renderAdminPhase({
    gamePhase,
    characters,
    questions,
    selectedCharacter,
    challenge,
    navigate,
    handleUpdateCharacter,
    handleUpdateCharacters,
    handleUpdateQuestion,
    setChallenge,
  });
  if (adminPhase) return adminPhase;

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
                `Question ${answers.length + 1}: ${currentQuestion.text}`}
              {gamePhase === "guessing" &&
                finalGuess &&
                `I think it's ${finalGuess.name}. Was I correct?`}
              {gamePhase === "gameOver" &&
                (gameWon
                  ? "Correct! I got it right!"
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
                  hasSavedSession={hasSavedSession}
                  resumeSession={resumeSession}
                  clearSession={clearSession}
                  showDevTools={showDevTools}
                  navigate={navigate}
                  characters={characters}
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
                  gameHistory={gameHistory}
                  showOnboarding={showOnboarding}
                  setShowOnboarding={setShowOnboarding}
                  activeCharacters={activeCharacters}
                  probabilities={probabilities}
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
                      onCorrect={handleCorrectGuess}
                      onIncorrect={handleIncorrectGuess}
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
                      character={finalGuess}
                      questionsAsked={gameSteps.length}
                      remainingCharacters={effectiveRemaining}
                      gameHistory={gameHistory || []}
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
                    characters={characters || DEFAULT_CHARACTERS}
                    questions={questions || DEFAULT_QUESTIONS}
                    gameHistory={gameHistory || []}
                    onBack={() => navigate("welcome")}
                  />
                </Suspense>
              </div>
            )}

            {gamePhase === "history" && (
              <div className="max-w-4xl mx-auto">
                <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                  <GameHistory
                    history={gameHistory || []}
                    onClearHistory={() => setGameHistory(() => [])}
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
            <AlertDialogTitle>Quit this game?</AlertDialogTitle>
            <AlertDialogDescription>
              Your progress will be lost. You'll return to the home screen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Playing</AlertDialogCancel>
            <AlertDialogAction onClick={() => navigate("welcome")}>
              Quit Game
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default App;
