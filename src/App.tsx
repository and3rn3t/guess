import { GameOver, GuessReveal } from "@/components/GuessReveal";
import { CoachMark } from "@/components/CoachMark";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useGameState } from "@/hooks/useGameState";
import { useKV } from "@/hooks/useKV";
import { useSound } from "@/hooks/useSound";
import { DEFAULT_CHARACTERS, DEFAULT_QUESTIONS } from "@/lib/database";
import {
  calculateProbabilities,
  detectContradictions,
  generateReasoning,
  getBestGuess,
  selectBestQuestion,
  shouldMakeGuess,
} from "@/lib/gameEngine";
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
  playSuspense,
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
  ArrowLeftIcon,
  BrainIcon,
  ChartBarIcon,
  ClipboardTextIcon,
  ClockCounterClockwiseIcon,
  CloudArrowUpIcon,
  CloudCheckIcon,
  CloudSlashIcon,
  CloudXIcon,
  FlaskIcon,
  GearIcon,
  HouseIcon,
  LightningIcon,
  MoonIcon,
  PlayIcon,
  SparkleIcon,
  SpeakerHighIcon,
  SpeakerSlashIcon,
  SunIcon,
  TreeStructureIcon,
  UsersIcon,
  WifiSlashIcon,
  WrenchIcon,
} from "@phosphor-icons/react";
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

const TeachingMode = lazy(() =>
  import("@/components/TeachingMode").then((m) => ({
    default: m.TeachingMode,
  })),
);
const PossibilityGrid = lazy(() =>
  import("@/components/PossibilityGrid").then((m) => ({
    default: m.PossibilityGrid,
  })),
);
const PossibilitySpaceChart = lazy(() =>
  import("@/components/PossibilitySpaceChart").then((m) => ({
    default: m.PossibilitySpaceChart,
  })),
);
const ProbabilityLeaderboard = lazy(() =>
  import("@/components/ProbabilityLeaderboard").then((m) => ({
    default: m.ProbabilityLeaderboard,
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
const INSIGHT_TABS = [
  { phase: "stats" as const, label: "Stats", icon: ChartBarIcon },
  {
    phase: "history" as const,
    label: "History",
    icon: ClockCounterClockwiseIcon,
  },
  { phase: "compare" as const, label: "Compare", icon: UsersIcon },
] as const;

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
const loadLlm = () => import("@/lib/llm");
const loadPrompts = () => import("@/lib/prompts");

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
  const [serverMode, setServerMode] = useKV<boolean>("server-mode", false);
  const selectedCategories = new Set(selectedCategoryList);
  const [challenge, setChallenge] = useState<SharePayload | null>(null);
  const [serverSessionId, setServerSessionId] = useState<string | null>(null);
  const [serverRemaining, setServerRemaining] = useState(0);
  const [serverTotal, setServerTotal] = useState(0);
  const { muted, toggle: toggleMute } = useSound();
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const { theme, setTheme } = useTheme();
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [eliminatedCount, setEliminatedCount] = useState<number | null>(null);
  const prevPossibleCount = useRef<number>(0);
  const llmAbortRef = useRef<AbortController | null>(null);
  const [onboardingDone] = useKV("onboarding-complete", false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Show onboarding when first game starts
  useEffect(() => {
    if (gamePhase === "playing" && !onboardingDone && gameHistory?.length === 0) {
      setShowOnboarding(true);
    }
  }, [gamePhase, onboardingDone, gameHistory]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // ========== ONLINE STATUS ==========
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => {
      setOnline(false);
      if (llmMode) {
        toast.warning(
          "You're offline — AI-Enhanced features won't work until you reconnect.",
        );
      }
    };
    globalThis.addEventListener("online", goOnline);
    globalThis.addEventListener("offline", goOffline);
    return () => {
      globalThis.removeEventListener("online", goOnline);
      globalThis.removeEventListener("offline", goOffline);
    };
  }, [llmMode]);

  const maxQuestions = DIFFICULTIES[difficulty].maxQuestions;

  const activeCharacters = (() => {
    const all = characters || DEFAULT_CHARACTERS;
    if (selectedCategories.size === 0) return all;
    return all.filter((c) => selectedCategories.has(c.category));
  })();

  // ========== CONFIDENCE (cached probabilities) ==========
  const probabilities = (() => {
    if (serverMode) return null;
    if (possibleCharacters.length === 0 || answers.length === 0) return null;
    return calculateProbabilities(possibleCharacters, answers);
  })();

  const confidence = (() => {
    if (serverMode) return reasoning?.confidence ?? 0;
    if (!probabilities) return 0;
    let max = 0;
    for (const p of probabilities.values()) if (p > max) max = p;
    return Math.round(max * 100);
  })();

  const effectiveRemaining = serverMode ? serverRemaining : possibleCharacters.length;

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
      globalThis.history.replaceState(null, "", globalThis.location.pathname);
    }
  }, [navigate]);

  // ========== AUTO-GENERATE QUESTION ==========
  useEffect(() => {
    if (serverMode) return; // Server manages question flow
    if (
      gamePhase === "playing" &&
      currentQuestion === null &&
      possibleCharacters.length > 0
    ) {
      generateNextQuestion();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, currentQuestion, possibleCharacters, serverMode]);

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
  const startGame = async () => {
    if (serverMode) {
      dispatch({ type: "SET_THINKING", isThinking: true });
      playThinking();
      try {
        const res = await fetch("/api/v2/game/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categories: selectedCategoryList.length
              ? selectedCategoryList
              : undefined,
            difficulty,
          }),
        });
        if (!res.ok) throw new Error("Failed to start");
        const data = (await res.json()) as {
          sessionId: string;
          question: Question;
          reasoning: typeof reasoning;
          totalCharacters: number;
        };
        setServerSessionId(data.sessionId);
        setServerRemaining(data.totalCharacters);
        setServerTotal(data.totalCharacters);
        dispatch({ type: "START_GAME", characters: [] });
        dispatch({
          type: "SET_QUESTION",
          question: data.question,
          reasoning: data.reasoning,
        });
        analytics().then((m) =>
          m.trackGameStart(difficulty, data.totalCharacters),
        );
      } catch {
        toast.error(
          "Failed to start server game — try again or switch to local mode",
        );
        dispatch({ type: "NAVIGATE", phase: "welcome" });
      } finally {
        dispatch({ type: "SET_THINKING", isThinking: false });
      }
      return;
    }

    if (activeCharacters.length < 2) {
      toast.error("Select categories with at least 2 characters");
      return;
    }
    dispatch({ type: "START_GAME", characters: activeCharacters });
    analytics().then((m) =>
      m.trackGameStart(difficulty, activeCharacters.length),
    );
  };

  // ========== GENERATE NEXT QUESTION ==========
  const generateNextQuestion = () => {
    dispatch({ type: "SET_THINKING", isThinking: true });
    playThinking();

    setTimeout(() => {
      const allQuestions = questions || DEFAULT_QUESTIONS;
      const filtered = filterPossibleCharacters(possibleCharacters, answers);
      dispatch({ type: "SET_POSSIBLE_CHARACTERS", characters: filtered });

      // Show elimination feedback
      if (prevPossibleCount.current > 0) {
        const eliminated = prevPossibleCount.current - filtered.length;
        if (eliminated > 0) {
          setEliminatedCount(eliminated);
          setTimeout(() => setEliminatedCount(null), 2000);
        }
      }

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
          playSuspense();
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
          // Abort any in-flight LLM request
          llmAbortRef.current?.abort();
          const controller = new AbortController();
          llmAbortRef.current = controller;

          const answeredQs = answers.map((a) => {
            const q = (questions || DEFAULT_QUESTIONS).find(
              (q) => q.attribute === a.questionId,
            );
            return { question: q?.text || "", answer: a.value };
          });
          const topNames = filtered.slice(0, 5).map((c) => c.name);
          const confidence = filtered.length > 0 ? 1 / filtered.length : 0;

          Promise.all([loadPrompts(), loadLlm()])
            .then(([{ dynamicQuestion_v1 }, { llmWithMeta }]) => {
              if (controller.signal.aborted) return null;
              const { system, user } = dynamicQuestion_v1(
                nextQuestion.text,
                nextQuestion.attribute,
                answeredQs,
                topNames,
                confidence,
              );
              return llmWithMeta({
                prompt: user,
                model: "gpt-4o-mini",
                jsonMode: true,
                systemPrompt: system,
                signal: controller.signal,
              });
            })
            .then((result) => {
              if (!result) return;
              try {
                const parsed = JSON.parse(result.content) as { text: string };
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
          playSuspense();
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
  const handleAnswer = async (value: AnswerValue) => {
    prevPossibleCount.current = serverMode
      ? serverRemaining
      : possibleCharacters.length;
    dispatch({ type: "ANSWER", value });
    playAnswer();
    hapticLight();

    if (serverMode) {
      dispatch({ type: "SET_THINKING", isThinking: true });
      try {
        const res = await fetch("/api/v2/game/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: serverSessionId, value }),
        });
        if (!res.ok) throw new Error("Failed to process answer");
        const data = (await res.json()) as {
          type: "question" | "guess" | "contradiction";
          question?: Question;
          reasoning?: typeof reasoning;
          character?: {
            id: string;
            name: string;
            category: string;
            imageUrl: string | null;
          };
          confidence?: number;
          remaining?: number;
          eliminated?: number;
          questionCount?: number;
          message?: string;
        };

        if (data.type === "contradiction") {
          dispatch({ type: "UNDO_LAST_ANSWER" });
          toast.warning(
            data.message || "Contradictory answers — undoing last answer.",
          );
          if (data.question && data.reasoning) {
            dispatch({
              type: "SET_QUESTION",
              question: data.question,
              reasoning: data.reasoning,
            });
          }
        } else if (data.type === "guess" && data.character) {
          const guessChar: Character = {
            id: data.character.id,
            name: data.character.name,
            category: (data.character.category || "other") as CharacterCategory,
            attributes: {},
            imageUrl: data.character.imageUrl ?? undefined,
          };
          dispatch({ type: "MAKE_GUESS", character: guessChar });
          setServerRemaining(data.remaining ?? 1);
          playSuspense();
        } else if (data.type === "question" && data.question && data.reasoning) {
          dispatch({
            type: "SET_QUESTION",
            question: data.question,
            reasoning: data.reasoning,
          });
          const remaining = data.remaining ?? serverRemaining;
          setServerRemaining(remaining);
          const eliminated = prevPossibleCount.current - remaining;
          if (eliminated > 0) {
            setEliminatedCount(eliminated);
            setTimeout(() => setEliminatedCount(null), 2000);
          }
          toast.success(`Answer recorded: ${value}`);
        }
      } catch {
        toast.error("Failed to process answer — try again");
        dispatch({ type: "UNDO_LAST_ANSWER" });
      } finally {
        dispatch({ type: "SET_THINKING", isThinking: false });
      }
      return;
    }

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
    analytics().then((m) => m.trackGameEnd(true, difficulty, gameSteps.length));
    playCorrectGuess();
    hapticSuccess();
    toast.success("🎉 I got it right!");
    if (serverMode && serverSessionId) {
      fetch("/api/v2/game/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: serverSessionId, correct: true }),
      }).catch(() => {});
      setServerSessionId(null);
    }
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
    if (serverMode && serverSessionId) {
      fetch("/api/v2/game/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: serverSessionId, correct: false }),
      }).catch(() => {});
      setServerSessionId(null);
    }
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
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              radial-gradient(circle at 20% 50%, var(--color-primary) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, var(--color-accent) 0%, transparent 50%),
              radial-gradient(circle at 40% 20%, var(--color-secondary) 0%, transparent 50%)
            `,
          }}
        />

        <div className="relative z-10">
          <header
            aria-label="Game navigation"
            className="border-b border-border/50 backdrop-blur-sm bg-background/80"
          >
            <div className="container mx-auto px-4 py-4 md:py-6">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    if (gamePhase === "playing") {
                      setShowQuitDialog(true);
                    } else {
                      navigate("welcome");
                    }
                  }}
                  className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity"
                >
                  <SparkleIcon
                    size={32}
                    weight="fill"
                    className="text-accent md:w-10 md:h-10"
                  />
                  <h1 className="text-2xl md:text-4xl font-bold text-foreground tracking-tight">
                    Mystic Guesser
                  </h1>
                </button>
                <div className="flex items-center gap-1.5 md:gap-3">
                  {/* Welcome phase: Stats, History, Compare, Dev Tools */}
                  {gamePhase === "welcome" && (
                    <>
                      <Button
                        onClick={() => {
                          analytics().then((m) => m.trackFeatureUse("stats"));
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
                          analytics().then((m) => m.trackFeatureUse("history"));
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
                          analytics().then((m) => m.trackFeatureUse("compare"));
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
                        <ArrowLeftIcon size={16} />
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
                      <HouseIcon size={20} />
                      <span className="hidden sm:inline">Home</span>
                    </Button>
                  )}

                  {/* Stats / History / Compare: cross-navigation tabs + Home */}
                  {(gamePhase === "stats" ||
                    gamePhase === "history" ||
                    gamePhase === "compare") && (
                    <>
                      {INSIGHT_TABS.map((tab) => (
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
                        <HouseIcon size={20} />
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
                      <CloudCheckIcon size={18} className="text-green-400" />
                    )}
                    {syncStatus === "pending" && (
                      <CloudArrowUpIcon
                        size={18}
                        className="text-yellow-400 animate-pulse"
                      />
                    )}
                    {syncStatus === "error" && (
                      <CloudXIcon size={18} className="text-red-400" />
                    )}
                    {syncStatus === "offline" && (
                      <CloudSlashIcon
                        size={18}
                        className="text-muted-foreground"
                      />
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
                  <Button
                    onClick={toggleTheme}
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                    title={
                      theme === "dark"
                        ? "Switch to light mode"
                        : "Switch to dark mode"
                    }
                    aria-label={
                      theme === "dark"
                        ? "Switch to light mode"
                        : "Switch to dark mode"
                    }
                  >
                    {theme === "dark" ? (
                      <SunIcon size={20} />
                    ) : (
                      <MoonIcon size={20} />
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

            <AnimatePresence mode="wait">
            {gamePhase === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Hero */}
                <div className="text-center space-y-3">
                  <SparkleIcon
                    size={64}
                    weight="fill"
                    className="mx-auto text-accent animate-float"
                  />
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                    Think of a Character
                  </h2>
                  <p className="text-base text-muted-foreground max-w-md mx-auto">
                    I'll ask strategic questions and try to guess who you're
                    thinking of.
                  </p>
                </div>

                {/* Resume saved session */}
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

                {/* Last game + Quick Play for returning players */}
                {gameHistory &&
                  gameHistory.length > 0 &&
                  !hasSavedSession &&
                  (() => {
                    const last = gameHistory[gameHistory.length - 1];
                    return (
                      <div className="space-y-3">
                        <Button
                          onClick={startGame}
                          size="lg"
                          className="w-full h-14 text-lg gap-3 bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-[1.02] transition-transform"
                        >
                          <LightningIcon size={22} weight="fill" />
                          Quick Play
                        </Button>
                        <p className="text-center text-xs text-muted-foreground">
                          Last: {last.won ? "Won" : "Lost"} in{" "}
                          {last.steps.length} Qs — {last.characterName}
                          {" · "}
                          {DIFFICULTIES[difficulty].label} · {serverMode ? (serverTotal || "500+") : activeCharacters.length} characters
                        </p>
                      </div>
                    );
                  })()}

                {/* Primary CTA for new players */}
                {(!gameHistory || gameHistory.length === 0) && !hasSavedSession && (
                  <div className="text-center">
                    <Button
                      onClick={startGame}
                      size="lg"
                      className="h-14 px-8 text-xl bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
                    >
                      <PlayIcon size={28} weight="fill" className="mr-3" />
                      Start Game
                    </Button>
                  </div>
                )}

                {/* How It Works — expanded for new users, collapsed for returning */}
                <Collapsible defaultOpen={!gameHistory || gameHistory.length === 0}>
                  <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-5">
                    <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                      <h3 className="text-base font-semibold text-foreground">
                        How It Works
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {gameHistory && gameHistory.length > 0
                          ? "Tap to expand"
                          : ""}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4 space-y-3 text-foreground/90">
                      {[
                        ["1", "Strategic Questioning", "I ask questions that split possibilities optimally."],
                        ["2", "Real-Time Reasoning", "See exactly why I chose each question."],
                        ["3", "Confidence Building", "Watch my confidence grow until the final guess!"],
                      ].map(([num, title, desc]) => (
                        <div key={num} className="flex gap-3 items-start">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold">
                            {num}
                          </div>
                          <div>
                            <span className="font-medium text-sm">{title}</span>
                            <span className="text-sm text-muted-foreground ml-1">— {desc}</span>
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* Game Settings — consolidated single card */}
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-5 space-y-5">
                  {/* Difficulty */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Difficulty</h4>
                    <div className="flex gap-2">
                      {(
                        Object.entries(DIFFICULTIES) as [
                          Difficulty,
                          (typeof DIFFICULTIES)[Difficulty],
                        ][]
                      ).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => setDifficulty(key)}
                          className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            difficulty === key
                              ? "bg-accent text-accent-foreground border-accent"
                              : "bg-card border-border hover:bg-accent/10"
                          }`}
                        >
                          {cfg.label}
                          <span className="block text-[11px] opacity-70">
                            {cfg.maxQuestions} Qs
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-border/50" />

                  {/* Categories */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground">Categories</h4>
                      <span className="text-xs text-muted-foreground">
                        {selectedCategories.size === 0
                          ? "All"
                          : selectedCategories.size}{" "}
                        selected · {activeCharacters.length} characters
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
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
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              isSelected
                                ? "bg-accent text-accent-foreground border-accent"
                                : "bg-card border-border hover:bg-accent/10"
                            }`}
                          >
                            {label}
                            <span className="ml-1 opacity-60">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                    {activeCharacters.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        e.g.{" "}
                        {activeCharacters
                          .slice(0, 4)
                          .map((c) => c.name)
                          .join(", ")}
                        {activeCharacters.length > 4 && ` + ${activeCharacters.length - 4} more`}
                      </p>
                    )}
                  </div>

                  <div className="border-t border-border/50" />

                  {/* AI Mode */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BrainIcon size={18} weight="fill" className="text-accent" />
                      <span className="text-sm font-medium text-foreground">AI-Enhanced Mode</span>
                    </div>
                    <button
                      onClick={() => setLlmMode(!llmMode)}
                      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                        llmMode ? "bg-accent" : "bg-muted"
                      }`}
                      role="switch"
                      aria-checked={llmMode}
                      aria-label="Toggle AI-Enhanced Mode"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          llmMode ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {llmMode && (
                    <p
                      className={`text-xs -mt-3 ${online ? "text-accent" : "text-destructive"}`}
                    >
                      {online ? (
                        "✨ Dynamic questions & narrative explanations"
                      ) : (
                        <span className="flex items-center gap-1">
                          <WifiSlashIcon size={14} weight="bold" />
                          Offline — AI features unavailable
                        </span>
                      )}
                    </p>
                  )}

                  <div className="border-t border-border/50" />

                  {/* Server Mode */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CloudCheckIcon size={18} className="text-accent" />
                      <span className="text-sm font-medium text-foreground">Server Mode</span>
                    </div>
                    <button
                      onClick={() => setServerMode(!serverMode)}
                      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                        serverMode ? "bg-accent" : "bg-muted"
                      }`}
                      role="switch"
                      aria-checked={serverMode}
                      aria-label="Toggle Server Mode"
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          serverMode ? "translate-x-5" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {serverMode && (
                    <p
                      className={`text-xs -mt-3 ${online ? "text-accent" : "text-destructive"}`}
                    >
                      {online ? (
                        "🌐 Play against the full character database on the server"
                      ) : (
                        <span className="flex items-center gap-1">
                          <WifiSlashIcon size={14} weight="bold" />
                          Offline — server mode unavailable
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {/* Bottom CTA */}
                <div className="text-center space-y-2">
                  <Button
                    onClick={startGame}
                    size="lg"
                    className="h-12 px-8 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
                  >
                    <PlayIcon size={24} weight="fill" className="mr-2" />
                    Start Game
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {serverMode ? (serverTotal || "500+") : activeCharacters.length} characters · {maxQuestions}{" "}
                    questions · {DIFFICULTIES[difficulty].label}
                    {serverMode && " · Server"}
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
              </motion.div>
            )}

            {gamePhase === "playing" && (
              <motion.div
                key="playing"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
              <div className="max-w-7xl mx-auto space-y-4 lg:space-y-0">
                <AnimatePresence>
                  {showOnboarding && (
                    <OnboardingOverlay onComplete={() => setShowOnboarding(false)} />
                  )}
                </AnimatePresence>
                <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm py-2 -mx-4 px-4 lg:static lg:bg-transparent lg:backdrop-blur-none lg:py-0 lg:mx-0 lg:px-0 lg:mb-6 space-y-2">
                  <div className="flex items-center gap-3">
                    <Progress
                      value={(answers.length / maxQuestions) * 100}
                      className="h-2 flex-1"
                    />
                    <span className="text-xs font-semibold text-accent whitespace-nowrap tabular-nums">
                      {confidence}% confident
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground mb-4 lg:mb-6">
                  <div className="flex items-center gap-3">
                    <span>
                      {effectiveRemaining} possibilities remaining
                      {serverMode && (
                        <span className="ml-2 text-xs text-accent">🌐 Server</span>
                      )}
                      {llmMode && !serverMode && (
                        <span className="ml-2 text-xs text-accent">✨ AI</span>
                      )}
                    </span>
                    <AnimatePresence>
                      {eliminatedCount !== null && (
                        <motion.span
                          initial={{ opacity: 0, y: 8, scale: 0.9 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.3 }}
                          className="inline-flex items-center rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive"
                        >
                          −{eliminatedCount} eliminated
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex items-center gap-2">
                    {answers.length > 0 && (
                      <button
                        onClick={() => dispatch({ type: "UNDO_LAST_ANSWER" })}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Undo last answer"
                      >
                        <ClockCounterClockwiseIcon size={14} />
                        Undo
                      </button>
                    )}
                    {!serverMode && possibleCharacters.length > 0 &&
                      possibleCharacters.length <= 5 && (
                        <span className="text-accent font-medium">
                          Top: {possibleCharacters[0]?.name}
                        </span>
                      )}
                  </div>
                </div>

                {/* Answer history timeline */}
                {gameSteps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4 lg:mb-6" aria-label="Answer history">
                    {gameSteps.map((step, i) => (
                      <span
                        key={i}
                        title={`Q${i + 1}: ${step.questionText} → ${step.answer}`}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold cursor-default transition-transform hover:scale-110 ${
                          step.answer === "yes"
                            ? "bg-accent/20 text-accent"
                            : step.answer === "no"
                              ? "bg-destructive/20 text-destructive"
                              : step.answer === "maybe"
                                ? "bg-yellow-500/20 text-yellow-500"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {step.answer === "yes"
                          ? "Y"
                          : step.answer === "no"
                            ? "N"
                            : step.answer === "maybe"
                              ? "M"
                              : "?"}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
                  <div className="space-y-3">
                    {/* Coach marks based on game count */}
                    <CoachMark
                      id="reasoning"
                      message="💡 Check the Reasoning panel to see how I'm thinking!"
                      showAfterGames={1}
                      gamesPlayed={gameHistory?.length ?? 0}
                    />
                    <CoachMark
                      id="stats"
                      message="📊 After this game, visit Stats to see your win rate and trends."
                      showAfterGames={3}
                      gamesPlayed={gameHistory?.length ?? 0}
                    />
                    <CoachMark
                      id="teaching"
                      message="🎓 Stumped me? Use Teaching Mode to add your character to my brain!"
                      showAfterGames={5}
                      gamesPlayed={gameHistory?.length ?? 0}
                    />
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
                    {!serverMode && (
                    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
                    <ProbabilityLeaderboard
                      characters={activeCharacters}
                      answers={answers}
                      probabilities={probabilities}
                    />
                    <PossibilitySpaceChart
                      totalCharacters={activeCharacters.length}
                      characters={activeCharacters}
                      answers={answers}
                    />
                    <PossibilityGrid
                      characters={activeCharacters}
                      answers={answers}
                    />
                    </Suspense>
                    )}
                  </div>
                </div>
              </div>
              </motion.div>
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
