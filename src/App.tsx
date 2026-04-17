import { GameOver, GuessReveal } from "@/components/GuessReveal";
import { PossibilitySpaceChart } from "@/components/PossibilitySpaceChart";
import { ProbabilityLeaderboard } from "@/components/ProbabilityLeaderboard";
import { QuestionCard, ThinkingCard } from "@/components/QuestionCard";
import { ReasoningPanel } from "@/components/ReasoningPanel";
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
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useGameState } from "@/hooks/useGameState";
import { useKV } from "@/hooks/useKV";
import { useSound } from "@/hooks/useSound";
import {
  trackFeatureUse,
  trackGameEnd,
  trackGameStart,
  trackShare,
} from "@/lib/analytics";
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from "@/lib/database";
import {
  detectContradictions,
  generateReasoning,
  getBestGuess,
  selectBestQuestion,
  shouldMakeGuess,
} from "@/lib/gameEngine";
import { llm } from "@/lib/llm";
import { dynamicQuestion_v1 } from "@/lib/prompts";
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
  playReveal,
  playThinking,
} from "@/lib/sounds";
import type { SyncStatus } from "@/lib/sync";
import { getSyncStatus, initialSync, onSyncStatusChange } from "@/lib/sync";
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
  ArrowLeft,
  BrainIcon,
  ChartBarIcon,
  ClipboardTextIcon,
  ClockCounterClockwiseIcon,
  CloudArrowUp,
  CloudCheck,
  CloudSlash,
  CloudX,
  FlaskIcon,
  GearIcon,
  House,
  PlayIcon,
  SparkleIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
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

  // ========== SETTINGS ==========
  const [difficulty, setDifficulty] = useKV<Difficulty>("difficulty", "medium");
  const [selectedCategoryList, setSelectedCategoryList] = useKV<
    CharacterCategory[]
  >("selected-categories", []);
  const [llmMode, setLlmMode] = useKV<boolean>("llm-mode", false);
  const selectedCategories = new Set(selectedCategoryList);
  const [challenge, setChallenge] = useState<SharePayload | null>(null);
  const { muted, toggle: toggleMute } = useSound();
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");

  const maxQuestions = DIFFICULTIES[difficulty].maxQuestions;

  const activeCharacters = (() => {
    const all = characters || DEFAULT_CHARACTERS;
    if (selectedCategories.size === 0) return all;
    return all.filter((c) => selectedCategories.has(c.category));
  })();

  // ========== SYNC STATUS ==========
  useEffect(() => {
    setSyncStatus(getSyncStatus());
    const unsubscribe = onSyncStatusChange(setSyncStatus);
    // Run initial sync (fire-and-forget)
    initialSync().catch(() => {});
    return unsubscribe;
  }, []);

  // ========== PARSE URL CHALLENGE ON MOUNT ==========
  useEffect(() => {
    const payload = parseUrlChallenge();
    if (payload) {
      setChallenge(payload);
      navigate("challenge");
      // Clear hash so it doesn't persist on reload
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [navigate]);

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
    setSelectedCategoryList((prev) => {
      const set = new Set(prev);
      if (set.has(cat)) set.delete(cat);
      else set.add(cat);
      return [...set];
    });
  };

  // ========== GAME START ==========
  const startGame = () => {
    if (activeCharacters.length < 2) {
      toast.error("Select categories with at least 2 characters");
      return;
    }
    dispatch({ type: "START_GAME", characters: activeCharacters });
    trackGameStart(difficulty, activeCharacters.length);
  };

  // ========== GENERATE NEXT QUESTION ==========
  const generateNextQuestion = () => {
    dispatch({ type: "SET_THINKING", isThinking: true });
    playThinking();

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
        if (guess) {
          dispatch({ type: "MAKE_GUESS", character: guess });
          playReveal();
        }
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

        // LLM rephrasing (non-blocking, updates question text after)
        if (llmMode) {
          const answeredQs = answers.map((a) => {
            const q = (questions || DEFAULT_QUESTIONS).find(
              (q) => q.id === a.questionId,
            );
            return { question: q?.text || "", answer: a.value };
          });
          const topNames = filtered.slice(0, 5).map((c) => c.name);
          const confidence = filtered.length > 0 ? 1 / filtered.length : 0;
          const { system, user } = dynamicQuestion_v1(
            nextQuestion.text,
            nextQuestion.attribute,
            answeredQs,
            topNames,
            confidence,
          );

          llm(`${system}\n\n${user}`, "gpt-4o-mini", true)
            .then((response) => {
              try {
                const parsed = JSON.parse(response) as { text: string };
                if (parsed.text && parsed.text.length < 150) {
                  dispatch({
                    type: "SET_QUESTION",
                    question: { ...nextQuestion, text: parsed.text },
                    reasoning: newReasoning,
                  });
                }
              } catch {
                /* Use original question */
              }
            })
            .catch(() => {
              /* Fallback: keep deterministic question */
            });
        }
      } else {
        const guess = getBestGuess(filtered, answers);
        if (guess) {
          dispatch({ type: "MAKE_GUESS", character: guess });
          playReveal();
        }
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
      for (const answer of currentAnswers) {
        const attr = char.attributes[answer.questionId];
        if (answer.value === "yes" && attr === false) return false;
        if (answer.value === "no" && attr === true) return false;
        // 'maybe' and 'unknown' don't eliminate
      }
      return true;
    });
  };

  // ========== ANSWER HANDLER ==========
  const handleAnswer = (value: AnswerValue) => {
    dispatch({ type: "ANSWER", value });
    playAnswer();
    hapticLight();
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
    trackGameEnd(true, difficulty, gameSteps.length);
    playCorrectGuess();
    hapticSuccess();
    toast.success("🎉 I got it right!");
  };

  const handleIncorrectGuess = () => {
    dispatch({ type: "INCORRECT_GUESS" });
    recordGame(false);
    trackGameEnd(false, difficulty, gameSteps.length);
    playIncorrectGuess();
    hapticMedium();
    toast.error("I'll learn from this and do better next time!");
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
        trackShare("native");
      } catch {
        // User cancelled — ignore
      }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      trackShare("clipboard");
      toast.success("Copied to clipboard!");
    }
  };

  const handleCopyLink = async () => {
    const payload = getSharePayload();
    if (!payload) return;
    const url = buildShareUrl(payload);
    await navigator.clipboard.writeText(url);
    trackShare("link");
    toast.success("Challenge link copied!");
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

  if (gamePhase === "bulkHabitat") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <MultiCategoryEnhancer
              characters={characters || DEFAULT_CHARACTERS}
              onUpdateCharacters={handleUpdateCharacters}
              onBack={() => navigate("welcome")}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (gamePhase === "demo") {
    return (
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <QuestionGeneratorDemo onBack={() => navigate("welcome")} />
      </Suspense>
    );
  }

  if (gamePhase === "environmentTest" && selectedCharacter) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <EnvironmentTest
              character={selectedCharacter}
              onUpdateCharacter={handleUpdateCharacter}
              onBack={() => navigate("welcome")}
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
              onBack={() => navigate("welcome")}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (gamePhase === "categoryRecommender" && selectedCharacter) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <CategoryRecommender
              character={selectedCharacter}
              onUpdateCharacter={handleUpdateCharacter}
              onBack={() => navigate("welcome")}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (gamePhase === "recommender" && selectedCharacter) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <AttributeRecommender
              character={selectedCharacter}
              onUpdateCharacter={handleUpdateCharacter}
              onBack={() => navigate("welcome")}
            />
          </Suspense>
        </div>
      </div>
    );
  }

  if (gamePhase === "costDashboard") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
              <CostDashboard onBack={() => navigate("welcome")} />
            </Suspense>
          </div>
        </div>
      </div>
    );
  }

  if (gamePhase === "dataHygiene") {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Suspense fallback={<Skeleton className="h-96 w-full" />}>
              <DataHygiene
                characters={characters || DEFAULT_CHARACTERS}
                questions={questions || DEFAULT_QUESTIONS}
                onUpdateCharacter={handleUpdateCharacter}
                onUpdateQuestion={handleUpdateQuestion}
                onBack={() => navigate("welcome")}
              />
            </Suspense>
          </div>
        </div>
      </div>
    );
  }

  // stats, history, compare phases are now rendered inside the main layout with persistent header

  if (gamePhase === "challenge" && challenge) {
    const answerBar = challenge.steps
      .map((s) => {
        switch (s.answer) {
          case "yes":
            return "🟢";
          case "no":
            return "🔴";
          case "maybe":
            return "🟡";
          default:
            return "⚪";
        }
      })
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
                ? `Mystic Guesser figured out ${challenge.characterName} in ${challenge.questionCount} questions!`
                : `Someone stumped Mystic Guesser thinking of ${challenge.characterName}!`}
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
          <header
            aria-label="Game navigation"
            className="border-b border-border/50 backdrop-blur-sm bg-background/80"
          >
            <div className="container mx-auto px-4 py-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    if (gamePhase === "playing") {
                      setShowQuitDialog(true);
                    } else {
                      navigate("welcome");
                    }
                  }}
                  className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <SparkleIcon
                    size={40}
                    weight="fill"
                    className="text-accent"
                  />
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                    Mystic Guesser
                  </h1>
                </button>
                <div className="flex items-center gap-3">
                  {/* Welcome phase: Stats, History, Compare, Dev Tools */}
                  {gamePhase === "welcome" && (
                    <>
                      <Button
                        onClick={() => {
                          trackFeatureUse("stats");
                          navigate("stats");
                        }}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2 bg-accent/10 hover:bg-accent/20 border-accent/30"
                      >
                        <ChartBarIcon size={20} />
                        <span className="hidden sm:inline">Statistics</span>
                      </Button>
                      <Button
                        onClick={() => {
                          trackFeatureUse("history");
                          navigate("history");
                        }}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <ClockCounterClockwiseIcon size={20} />
                        <span className="hidden sm:inline">History</span>
                      </Button>
                      <Button
                        onClick={() => {
                          trackFeatureUse("compare");
                          navigate("compare");
                        }}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <UsersIcon size={20} />
                        <span className="hidden sm:inline">Compare</span>
                      </Button>
                      {import.meta.env.DEV && (
                        <Button
                          onClick={() => dispatch({ type: "TOGGLE_DEV_TOOLS" })}
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

                  {/* Playing phase: question counter badge + quit button */}
                  {gamePhase === "playing" && (
                    <>
                      <span className="inline-flex items-center rounded-full bg-accent/20 px-3 py-1 text-sm font-medium text-accent">
                        Q{answers.length + (currentQuestion ? 1 : 0)}/
                        {maxQuestions}
                      </span>
                      <button
                        onClick={() => setShowQuitDialog(true)}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowLeft size={16} />
                        Quit
                      </button>
                    </>
                  )}

                  {/* GameOver / Teaching phase: Home button */}
                  {(gamePhase === "gameOver" ||
                    gamePhase === "teaching" ||
                    gamePhase === "guessing") && (
                    <Button
                      onClick={() => navigate("welcome")}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <House size={20} />
                      <span className="hidden sm:inline">Home</span>
                    </Button>
                  )}

                  {/* Stats / History / Compare: cross-navigation tabs + Home */}
                  {(gamePhase === "stats" ||
                    gamePhase === "history" ||
                    gamePhase === "compare") && (
                    <>
                      {[
                        {
                          phase: "stats" as const,
                          label: "Stats",
                          icon: ChartBarIcon,
                        },
                        {
                          phase: "history" as const,
                          label: "History",
                          icon: ClockCounterClockwiseIcon,
                        },
                        {
                          phase: "compare" as const,
                          label: "Compare",
                          icon: UsersIcon,
                        },
                      ].map((tab) => (
                        <Button
                          key={tab.phase}
                          onClick={() => navigate(tab.phase)}
                          variant={
                            gamePhase === tab.phase ? "default" : "outline"
                          }
                          size="sm"
                          className={`flex items-center gap-2 ${gamePhase === tab.phase ? "bg-accent text-accent-foreground" : ""}`}
                        >
                          <tab.icon size={18} />
                          <span className="hidden sm:inline">{tab.label}</span>
                        </Button>
                      ))}
                      <Button
                        onClick={() => navigate("welcome")}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <House size={20} />
                        <span className="hidden sm:inline">Home</span>
                      </Button>
                    </>
                  )}

                  <span
                    className="text-muted-foreground"
                    title={`Sync: ${syncStatus}`}
                    aria-label={`Sync status: ${syncStatus}`}
                  >
                    {syncStatus === "synced" && (
                      <CloudCheck size={18} className="text-green-400" />
                    )}
                    {syncStatus === "pending" && (
                      <CloudArrowUp
                        size={18}
                        className="text-yellow-400 animate-pulse"
                      />
                    )}
                    {syncStatus === "error" && (
                      <CloudX size={18} className="text-red-400" />
                    )}
                    {syncStatus === "offline" && (
                      <CloudSlash size={18} className="text-muted-foreground" />
                    )}
                  </span>
                  <Button
                    onClick={toggleMute}
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    title={muted ? "Unmute sounds" : "Mute sounds"}
                    aria-label={muted ? "Unmute sounds" : "Mute sounds"}
                  >
                    {muted ? (
                      <SpeakerSlashIcon size={20} />
                    ) : (
                      <SpeakerHighIcon size={20} />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </header>

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

                {hasSavedSession && (
                  <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">
                        Resume your game?
                      </p>
                      <p className="text-sm text-muted-foreground">
                        You have an unfinished game in progress
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4 shrink-0">
                      <Button
                        onClick={resumeSession}
                        size="sm"
                        className="bg-accent hover:bg-accent/90"
                      >
                        Resume
                      </Button>
                      <Button
                        onClick={clearSession}
                        variant="outline"
                        size="sm"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}

                {gameHistory &&
                  gameHistory.length > 0 &&
                  (() => {
                    const last = gameHistory[gameHistory.length - 1];
                    return (
                      <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-center justify-between">
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            Last game:{" "}
                          </span>
                          <span
                            className={
                              last.won
                                ? "text-accent font-semibold"
                                : "text-muted-foreground"
                            }
                          >
                            {last.won ? "Won" : "Lost"}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            in {last.steps.length} questions —{" "}
                            {last.characterName}
                          </span>
                        </div>
                        <Button
                          onClick={startGame}
                          variant="outline"
                          size="sm"
                          className="ml-4 shrink-0"
                        >
                          Rematch
                        </Button>
                      </div>
                    );
                  })()}

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

                {gameHistory &&
                  gameHistory.length > 0 &&
                  (() => {
                    const last = gameHistory[gameHistory.length - 1];
                    return (
                      <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 flex items-center justify-between">
                        <div className="text-sm">
                          <span className="text-muted-foreground">
                            Last game:{" "}
                          </span>
                          <span
                            className={
                              last.won
                                ? "text-accent font-semibold"
                                : "text-muted-foreground"
                            }
                          >
                            {last.won ? "Won" : "Lost"}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            in {last.steps.length} questions —{" "}
                            {last.characterName}
                          </span>
                        </div>
                        <Button
                          onClick={startGame}
                          variant="outline"
                          size="sm"
                          className="ml-4 shrink-0"
                        >
                          Rematch
                        </Button>
                      </div>
                    );
                  })()}

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

                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <BrainIcon size={20} weight="fill" />
                        AI-Enhanced Mode
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Dynamic questions, narrative explanations, and
                        conversational answers
                      </p>
                    </div>
                    <button
                      onClick={() => setLlmMode(!llmMode)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                        llmMode ? "bg-accent" : "bg-muted"
                      }`}
                      role="switch"
                      aria-checked={llmMode ? "true" : "false"}
                      aria-label="Toggle AI-Enhanced Mode"
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                          llmMode ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {llmMode && (
                    <p className="text-xs text-accent mt-2">
                      ✨ Requires internet connection
                    </p>
                  )}
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
                        onClick={() => navigate("coverage")}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <ClipboardTextIcon size={18} />
                        Coverage Report
                      </Button>
                      <Button
                        onClick={() => navigate("demo")}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <FlaskIcon size={18} />
                        Test Generator
                      </Button>
                      <Button
                        onClick={() => navigate("manage")}
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
                          if (spongebob) navigate("environmentTest", spongebob);
                        }}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <TreeStructureIcon size={18} />
                        Test Environment
                      </Button>
                      <Button
                        onClick={() => navigate("bulkHabitat")}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <BrainIcon size={18} weight="fill" />
                        AI Enrichment
                      </Button>
                      <Button
                        onClick={() => navigate("costDashboard")}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <ChartBarIcon size={18} />
                        Cost Dashboard
                      </Button>
                      <Button
                        onClick={() => navigate("dataHygiene")}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <WrenchIcon size={18} />
                        Data Hygiene
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

                <div className="flex items-center justify-between text-sm text-muted-foreground mb-4 lg:mb-6">
                  <span>
                    {possibleCharacters.length} possibilities remaining
                    {llmMode && (
                      <span className="ml-2 text-xs text-accent">✨ AI</span>
                    )}
                  </span>
                  {possibleCharacters.length > 0 &&
                    possibleCharacters.length <= 5 && (
                      <span className="text-accent font-medium">
                        Top: {possibleCharacters[0]?.name}
                      </span>
                    )}
                </div>

                <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
                  <div>
                    <AnimatePresence mode="wait">
                      {currentQuestion ? (
                        <QuestionCard
                          question={currentQuestion}
                          questionNumber={answers.length + 1}
                          totalQuestions={maxQuestions}
                          onAnswer={handleAnswer}
                          isProcessing={isThinking}
                        />
                      ) : isThinking ? (
                        <ThinkingCard />
                      ) : null}
                    </AnimatePresence>
                  </div>

                  <div className="lg:sticky lg:top-8 lg:self-start space-y-4">
                    <ReasoningPanel
                      reasoning={reasoning}
                      isThinking={isThinking}
                    />
                    <ProbabilityLeaderboard
                      characters={activeCharacters}
                      answers={answers}
                    />
                    <PossibilitySpaceChart
                      totalCharacters={activeCharacters.length}
                      characters={activeCharacters}
                      answers={answers}
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
                  questionsAsked={gameSteps.length}
                  remainingCharacters={possibleCharacters.length}
                  onPlayAgain={startGame}
                  onNewGame={() => navigate("welcome")}
                  onTeachMode={
                    !gameWon ? () => navigate("teaching") : undefined
                  }
                  onViewHistory={() => navigate("history")}
                  onViewStats={() => navigate("stats")}
                  onShare={handleShare}
                  onCopyLink={handleCopyLink}
                  llmMode={llmMode}
                  answeredQuestions={answers.map((a) => {
                    const q = (questions || DEFAULT_QUESTIONS).find(
                      (q) => q.id === a.questionId,
                    );
                    return { question: q?.text || "", answer: a.value };
                  })}
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
