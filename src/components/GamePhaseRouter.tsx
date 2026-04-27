import { GameOver } from "@/components/GameOver";
import { GuessReveal } from "@/components/GuessReveal";
import { PlayingScreen } from "@/components/PlayingScreen";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Achievement } from "@/hooks/useAchievements";
import type {
  GameAction,
  GamePhase,
  GameState,
} from "@/hooks/useGameState";
import type { GlobalStats } from "@/hooks/useGlobalStats";
import type { WeeklyRecap } from "@/hooks/useWeeklyRecap";
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from "@/lib/database";
import type {
  AnswerValue,
  Character,
  CharacterCategory,
  Difficulty,
  GameHistoryEntry,
  GuessReadinessSnapshot,
  Persona,
  Question,
} from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, type Dispatch, type RefObject } from "react";

const TeachingMode = lazy(() =>
  import("@/components/TeachingMode").then((m) => ({ default: m.TeachingMode })),
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

interface RevealResult {
  found: boolean;
  characterName?: string | null;
  attributesFilled?: number;
}

export interface GamePhaseRouterProps {
  // Game state
  game: GameState;
  dispatch: Dispatch<GameAction>;
  navigate: (phase: GamePhase, character?: Character) => void;

  // Settings
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  categories: CharacterCategory[];
  setCategories: (c: CharacterCategory[]) => void;
  persona: Persona;
  maxQuestions: number;

  // Data collections
  characters: Character[] | null;
  questions: Question[] | null;
  activeCharacters: Character[];

  // Server-game derived state
  serverTotal: number | null;
  serverReadiness: GuessReadinessSnapshot | null;
  effectiveRemaining: number;
  confidence: number;

  // Global stats
  globalStats: GlobalStats | null;
  gameHistory: GameHistoryEntry[];
  gamesPlayed: number;
  statsLoading: boolean;

  // Session
  hasSavedSession: boolean;
  resumeSession: () => void;
  clearSession: () => void;

  // Transient UI state
  online: boolean;
  eliminatedCount: number | null;
  remainingHistoryRef: RefObject<number[]>;
  isNewPersonalBest: boolean;
  personalBest: number | null;
  dailyStreak: number;
  achievements: Achievement[];
  weeklyRecap: WeeklyRecap | null;
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;

  // Handlers
  startGame: () => void | Promise<void>;
  handleAnswer: (value: AnswerValue) => void | Promise<void>;
  handleSkip: () => void;
  handleGiveUp: () => void;
  handleCorrectGuess: () => void;
  handleIncorrectGuess: () => void;
  handleRejectGuess: () => void;
  retryAfterReject: () => void;
  handleShare: () => void | Promise<void>;
  handleCopyLink: () => void | Promise<void>;
  handleReveal: (name: string) => Promise<RevealResult>;
  handleAddCharacter: (c: Character) => void;
  handleAddQuestions: (q: Question[]) => void;
}

/**
 * Routes the current game phase to its screen.
 *
 * App.tsx owns the data; this component owns the per-phase rendering and
 * lazy-loading. Keep effects and state in App.tsx.
 */
export function GamePhaseRouter(props: GamePhaseRouterProps) {
  const {
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
    handleGiveUp,
    handleCorrectGuess,
    handleIncorrectGuess,
    handleRejectGuess,
    retryAfterReject,
    handleShare,
    handleCopyLink,
    handleReveal,
    handleAddCharacter,
    handleAddQuestions,
  } = props;

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

  return (
    <>
      <AnimatePresence mode="wait">
        {gamePhase === "welcome" && (
          <WelcomeScreen
            startGame={() => void startGame()}
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
            personalBest={personalBest}
            achievements={achievements}
            weeklyRecap={weeklyRecap}
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
            handleAnswer={(v) => void handleAnswer(v)}
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
                onPlayAgain={() => void startGame()}
                onNewGame={() => navigate("welcome")}
                onTeachMode={
                  gameWon ? undefined : () => navigate("teaching")
                }
                onViewHistory={() => navigate("history")}
                onViewStats={() => navigate("stats")}
                onShare={() => void handleShare()}
                onCopyLink={() => void handleCopyLink()}
                answeredQuestions={answers.map((a, i) => {
                  const q = (questions || DEFAULT_QUESTIONS).find(
                    (q) => q.id === a.questionId,
                  );
                  const hist = remainingHistoryRef.current ?? [];
                  const eliminated =
                    i === 0
                      ? 0
                      : (hist[i - 1] ?? 0) -
                        (hist[i] ?? hist[i - 1] ?? 0);
                  return {
                    question: q?.text || "",
                    answer: a.value,
                    eliminated,
                  };
                })}
                onReveal={gameWon ? undefined : handleReveal}
                persona={persona}
                isPersonalBest={isNewPersonalBest}
                personalBest={personalBest}
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
              onPlayAgain={() => void startGame()}
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
    </>
  );
}
