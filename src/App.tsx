import { GameOver, GuessReveal } from "@/components/GuessReveal";
import { QuestionCard } from "@/components/QuestionCard";
import { ReasoningPanel } from "@/components/ReasoningPanel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useGameState } from "@/hooks/useGameState";
import { useKV } from "@/hooks/useKV";
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from "@/lib/database";
import {
  calculateProbabilities,
  detectContradictions,
  generateReasoning,
  getBestGuess,
  selectBestQuestion,
  shouldMakeGuess,
} from "@/lib/gameEngine";
import type {
  AnswerValue,
  Character,
  CharacterCategory,
  Difficulty,
  GameHistoryEntry,
  Question,
} from "@/lib/types";
import { CATEGORY_LABELS, DIFFICULTIES } from "@/lib/types";
import {
  BrainIcon,
  ChartBarIcon,
  ClipboardTextIcon,
  ClockCounterClockwiseIcon,
  FlaskIcon,
  GearIcon,
  PlayIcon,
  SparkleIcon,
  TreeStructureIcon,
  UsersIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
import { AnimatePresence } from "framer-motion";
import { lazy, Suspense, useEffect, useState } from "react";
import { toast, Toaster } from "sonner";

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
const GameHistory = lazy(() =>
  import("@/components/GameHistory").then((m) => ({ default: m.GameHistory })),
);

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
  const { state: game, dispatch, navigate } = useGameState();
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

  // ========== SETTINGS ==========
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [selectedCategories, setSelectedCategories] = useState<
    Set<CharacterCategory>
  >(new Set());

  const maxQuestions = DIFFICULTIES[difficulty].maxQuestions;

  const activeCharacters = (() => {
    const all = characters || DEFAULT_CHARACTERS;
    if (selectedCategories.size === 0) return all;
    return all.filter((c) => selectedCategories.has(c.category));
  })();

  // ========== AUTO-GENERATE QUESTION ==========
  useEffect(() => {
    if (
      gamePhase === "playing" &&
      currentQuestion === null &&
      possibleCharacters.length > 0
    ) {
      generateNextQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, currentQuestion, possibleCharacters]);

  // ========== CATEGORY TOGGLE ==========
  const toggleCategory = (cat: CharacterCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // ========== GAME START ==========
  const startGame = () => {
    if (activeCharacters.length < 2) {
      toast.error("Select categories with at least 2 characters");
      return;
    }
    dispatch({ type: "START_GAME", characters: activeCharacters });
  };

  // ========== GENERATE NEXT QUESTION ==========
  const generateNextQuestion = () => {
    dispatch({ type: "SET_THINKING", isThinking: true });

    setTimeout(() => {
      const allQuestions = questions || DEFAULT_QUESTIONS;
      const filtered = filterPossibleCharacters(possibleCharacters, answers);
      dispatch({ type: "SET_POSSIBLE_CHARACTERS", characters: filtered });

      const { hasContradiction } = detectContradictions(
        possibleCharacters,
        answers,
      );
      if (hasContradiction) {
        toast.warning(
          "Your answers seem contradictory — no characters match! Undoing last answer.",
        );
        dispatch({ type: "UNDO_LAST_ANSWER" });
        dispatch({ type: "SET_THINKING", isThinking: false });
        return;
      }

      if (shouldMakeGuess(filtered, answers, answers.length, maxQuestions)) {
        const guess = getBestGuess(filtered, answers);
        if (guess) dispatch({ type: "MAKE_GUESS", character: guess });
        return;
      }

      const nextQuestion = selectBestQuestion(filtered, answers, allQuestions);

      if (nextQuestion) {
        const newReasoning = generateReasoning(nextQuestion, filtered, answers);
        dispatch({
          type: "SET_QUESTION",
          question: nextQuestion,
          reasoning: newReasoning,
        });
      } else {
        const guess = getBestGuess(filtered, answers);
        if (guess) dispatch({ type: "MAKE_GUESS", character: guess });
      }

      dispatch({ type: "SET_THINKING", isThinking: false });
    }, 800);
  };

  // ========== FILTER POSSIBLE CHARACTERS ==========
  const filterPossibleCharacters = (
    chars: Character[],
    currentAnswers: { questionId: string; value: AnswerValue }[],
  ): Character[] => {
    return chars.filter((char) => {
      const probabilities = calculateProbabilities([char], currentAnswers);
      return probabilities.get(char.id)! > 0;
    });
  };

  // ========== ANSWER HANDLER ==========
  const handleAnswer = (value: AnswerValue) => {
    dispatch({ type: "ANSWER", value });
    toast.success(`Answer recorded: ${value}`);
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
    toast.success("🎉 I got it right!");
  };

  const handleIncorrectGuess = () => {
    dispatch({ type: "INCORRECT_GUESS" });
    recordGame(false);
    toast.error("I'll learn from this and do better next time!");
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

  if (gamePhase === "bulkHabitat") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <MultiCategoryEnhancer
              characters={characters || DEFAULT_CHARACTERS}
              onUpdateCharacters={handleUpdateCharacters}
              onBack={() => navigate('welcome')}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (gamePhase === "demo") {
    return (
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <QuestionGeneratorDemo onBack={() => navigate('welcome')} />
      </Suspense>
    );
  }

  if (gamePhase === 'environmentTest' && selectedCharacter) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <EnvironmentTest
            character={selectedCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onBack={() => navigate('welcome')}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (gamePhase === "coverage") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <AttributeCoverageReport
              characters={characters || DEFAULT_CHARACTERS}
              onBack={() => navigate('welcome')}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (gamePhase === 'categoryRecommender' && selectedCharacter) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <CategoryRecommender
            character={selectedCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onBack={() => navigate('welcome')}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (gamePhase === 'recommender' && selectedCharacter) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <AttributeRecommender
            character={selectedCharacter}
            onUpdateCharacter={handleUpdateCharacter}
            onBack={() => navigate('welcome')}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (gamePhase === "compare") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <CharacterComparison
              characters={characters || DEFAULT_CHARACTERS}
            onBack={() => navigate('welcome')}
            onOpenRecommender={(c: Character) => navigate('categoryRecommender', c)}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (gamePhase === "stats") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <StatsDashboard
              characters={characters || DEFAULT_CHARACTERS}
              questions={questions || DEFAULT_QUESTIONS}
              gameHistory={gameHistory || []}
              onBack={() => navigate('welcome')}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (gamePhase === "history") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <GameHistory
              history={gameHistory || []}
              onClearHistory={() => setGameHistory(() => [])}
              onBack={() => navigate('welcome')}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-background relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 50%, oklch(0.35 0.15 300 / 0.3) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, oklch(0.70 0.15 220 / 0.2) 0%, transparent 50%),
              radial-gradient(circle at 40% 20%, oklch(0.28 0.12 280 / 0.2) 0%, transparent 50%)
            `,
          }}
        />

        <div className="relative z-10">
          <header className="border-b border-border/50 backdrop-blur-sm bg-background/80">
            <div className="container mx-auto px-4 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <SparkleIcon
                    size={40}
                    weight="fill"
                    className="text-accent"
                  />
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                    Mystic Guesser
                  </h1>
                </div>
                <div className="flex items-center gap-3">
                  {gamePhase === "welcome" && (
                    <>
                      <Button
                        onClick={() => navigate('stats')}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 bg-accent/10 hover:bg-accent/20 border-accent/30"
                      >
                        <ChartBarIcon size={20} />
                        <span className="hidden sm:inline">Statistics</span>
                      </Button>
                      <Button
                        onClick={() => navigate('history')}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <ClockCounterClockwiseIcon size={20} />
                        <span className="hidden sm:inline">History</span>
                      </Button>
                      <Button
                        onClick={() => navigate('compare')}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <UsersIcon size={20} />
                        <span className="hidden sm:inline">Compare</span>
                      </Button>
                      {import.meta.env.DEV && (
                        <Button
                        onClick={() => dispatch({ type: 'TOGGLE_DEV_TOOLS' })}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2 border-dashed border-yellow-500/50 text-yellow-500"
                        >
                          <WrenchIcon size={20} />
                          <span className="hidden sm:inline">Dev Tools</span>
                        </Button>
                      )}
                    </>
                  )}
                  {gamePhase !== "welcome" && (
                    <div className="text-sm text-muted-foreground">
                      Questions: {answers.length}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="container mx-auto px-4 py-8 md:py-12">
            {gamePhase === "welcome" && (
              <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center space-y-4">
                  <SparkleIcon
                    size={80}
                    weight="fill"
                    className="mx-auto text-accent animate-float"
                  />
                  <h2 className="text-4xl md:text-5xl font-bold text-foreground">
                    Think of a Character
                  </h2>
                  <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                    I'll read your mind by asking strategic questions. Watch as
                    I explain my reasoning in real-time!
                  </p>
                </div>

                <div className="bg-card/50 backdrop-blur-sm border-2 border-primary/20 rounded-xl p-8 space-y-6">
                  <h3 className="text-2xl font-semibold text-foreground">
                    How It Works
                  </h3>
                  <div className="space-y-4 text-foreground/90">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold">
                        1
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">
                          Strategic Questioning
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          I analyze all possibilities and ask questions that
                          split them optimally, eliminating roughly half with
                          each answer.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold">
                        2
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">
                          Real-Time Reasoning
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          The explanation panel shows you exactly why I chose
                          each question and how your answers narrow down the
                          possibilities.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold">
                        3
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">
                          Confidence Building
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Watch my confidence grow with each answer until I'm
                          ready to make my final guess!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Difficulty
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {(
                      Object.entries(DIFFICULTIES) as [
                        Difficulty,
                        (typeof DIFFICULTIES)[Difficulty],
                      ][]
                    ).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setDifficulty(key)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          difficulty === key
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-card border-border hover:bg-accent/10"
                        }`}
                      >
                        {cfg.label}
                        <span className="block text-xs opacity-70">
                          {cfg.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">
                      Categories
                    </h3>
                    <span className="text-sm text-muted-foreground">
                      {selectedCategories.size === 0
                        ? "All"
                        : selectedCategories.size}{" "}
                      selected · {activeCharacters.length} characters
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {(
                      Object.entries(CATEGORY_LABELS) as [
                        CharacterCategory,
                        string,
                      ][]
                    ).map(([key, label]) => {
                      const count = (characters || DEFAULT_CHARACTERS).filter(
                        (c) => c.category === key,
                      ).length;
                      const isSelected = selectedCategories.has(key);
                      return (
                        <button
                          key={key}
                          onClick={() => toggleCategory(key)}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            isSelected
                              ? "bg-accent text-accent-foreground border-accent"
                              : "bg-card border-border hover:bg-accent/10"
                          }`}
                        >
                          {label}
                          <span className="block text-xs opacity-70">
                            {count} characters
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="text-center space-y-4">
                  <Button
                    onClick={startGame}
                    size="lg"
                    className="h-16 px-8 text-xl bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
                  >
                    <PlayIcon size={28} weight="fill" className="mr-3" />
                    Start Game
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    {activeCharacters.length} characters · {maxQuestions}{" "}
                    questions · {DIFFICULTIES[difficulty].label} mode
                  </p>
                </div>

                {import.meta.env.DEV && showDevTools && (
                  <div className="border-2 border-dashed border-yellow-500/30 rounded-xl p-6 space-y-4">
                    <h3 className="text-lg font-semibold text-yellow-500 flex items-center gap-2">
                      <WrenchIcon size={24} />
                      Developer Tools
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => navigate('coverage')}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <ClipboardTextIcon size={18} />
                        Coverage Report
                      </Button>
                      <Button
                        onClick={() => navigate('demo')}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <FlaskIcon size={18} />
                        Test Generator
                      </Button>
                      <Button
                        onClick={() => navigate('manage')}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <GearIcon size={18} />
                        Manage Questions
                      </Button>
                      <Button
                        onClick={() => {
                          const spongebob = (
                            characters || DEFAULT_CHARACTERS
                          ).find((c) => c.id === "spongebob");
                          if (spongebob) navigate('environmentTest', spongebob);
                        }}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <TreeStructureIcon size={18} />
                        Test Environment
                      </Button>
                      <Button
                        onClick={() => navigate('bulkHabitat')}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <BrainIcon size={18} weight="fill" />
                        AI Enrichment
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {gamePhase === "playing" && (
              <div className="max-w-7xl mx-auto space-y-4 lg:space-y-0">
                <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm py-2 -mx-4 px-4 lg:static lg:bg-transparent lg:backdrop-blur-none lg:py-0 lg:mx-0 lg:px-0 lg:mb-6">
                  <Progress
                    value={(answers.length / maxQuestions) * 100}
                    className="h-2"
                  />
                </div>

                <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
                  <div>
                    <AnimatePresence mode="wait">
                      {currentQuestion && (
                        <QuestionCard
                          question={currentQuestion}
                          questionNumber={answers.length + 1}
                          totalQuestions={maxQuestions}
                          onAnswer={handleAnswer}
                          isProcessing={isThinking}
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="lg:sticky lg:top-8 lg:self-start">
                    <ReasoningPanel
                      reasoning={reasoning}
                      isThinking={isThinking}
                    />
                  </div>
                </div>
              </div>
            )}

            {gamePhase === "guessing" && finalGuess && (
              <div className="max-w-2xl mx-auto">
                <GuessReveal
                  character={finalGuess}
                  onCorrect={handleCorrectGuess}
                  onIncorrect={handleIncorrectGuess}
                />
              </div>
            )}

            {gamePhase === "gameOver" && (
              <div className="max-w-2xl mx-auto">
                <GameOver
                  won={gameWon}
                  character={finalGuess}
                  onPlayAgain={startGame}
                  onTeachMode={!gameWon ? () => navigate('teaching') : undefined}
                  onViewHistory={() => navigate('history')}
                />
              </div>
            )}

            {gamePhase === "teaching" && (
              <div className="max-w-2xl mx-auto">
                <Suspense fallback={<Skeleton className="h-96 w-full" />}>
                  <TeachingMode
                    answers={answers}
                    existingCharacters={characters || DEFAULT_CHARACTERS}
                    onAddCharacter={handleAddCharacter}
                    onSkip={() => navigate('gameOver')}
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
                  <Button onClick={() => navigate('welcome')} variant="outline">
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
          </main>
        </div>
      </div>
    </>
  );
}

export default App;
