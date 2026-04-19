import { CoachMark } from "@/components/CoachMark";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { QuestionCard, ThinkingCard } from "@/components/QuestionCard";
import { ReasoningPanel } from "@/components/ReasoningPanel";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import type { GameAction } from "@/hooks/useGameState";
import type {
  Answer,
  AnswerValue,
  Character,
  GameHistoryEntry,
  GameHistoryStep,
  Question,
  ReasoningExplanation,
} from "@/lib/types";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense } from "react";

const ProbabilityLeaderboard = lazy(() =>
  import("@/components/ProbabilityLeaderboard").then((m) => ({
    default: m.ProbabilityLeaderboard,
  })),
);
const PossibilitySpaceChart = lazy(() =>
  import("@/components/PossibilitySpaceChart").then((m) => ({
    default: m.PossibilitySpaceChart,
  })),
);
const PossibilityGrid = lazy(() =>
  import("@/components/PossibilityGrid").then((m) => ({
    default: m.PossibilityGrid,
  })),
);

interface PlayingScreenProps {
  answers: Answer[];
  maxQuestions: number;
  confidence: number;
  effectiveRemaining: number;
  serverMode: boolean;
  llmMode: boolean;
  eliminatedCount: number | null;
  possibleCharacters: Character[];
  currentQuestion: Question | null;
  isThinking: boolean;
  reasoning: ReasoningExplanation | null;
  handleAnswer: (value: AnswerValue) => void;
  dispatch: React.Dispatch<GameAction>;
  gameSteps: GameHistoryStep[];
  gameHistory: GameHistoryEntry[] | null;
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
  activeCharacters: Character[];
  probabilities: Map<string, number> | null;
}

export function PlayingScreen({
  answers,
  maxQuestions,
  confidence,
  effectiveRemaining,
  serverMode,
  llmMode,
  eliminatedCount,
  possibleCharacters,
  currentQuestion,
  isThinking,
  reasoning,
  handleAnswer,
  dispatch,
  gameSteps,
  gameHistory,
  showOnboarding,
  setShowOnboarding,
  activeCharacters,
  probabilities,
}: Readonly<PlayingScreenProps>) {
  return (
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
            {gameSteps.map((step, i) => {
              const bgClass: Record<string, string> = {
                yes: "bg-accent/20 text-accent",
                no: "bg-destructive/20 text-destructive",
                maybe: "bg-yellow-500/20 text-yellow-500",
              };
              const label: Record<string, string> = { yes: "Y", no: "N", maybe: "M" };
              return (
                <span
                  key={step.questionId ?? `step-${i}`}
                  title={`Q${i + 1}: ${step.questionText} → ${step.answer}`}
                  className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold cursor-default transition-transform hover:scale-110 ${
                    bgClass[step.answer] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {label[step.answer] ?? "?"}
                </span>
              );
            })}
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
              {currentQuestion && (
                <QuestionCard
                  question={currentQuestion}
                  questionNumber={answers.length + 1}
                  totalQuestions={maxQuestions}
                  onAnswer={handleAnswer}
                  isProcessing={isThinking}
                />
              )}
              {!currentQuestion && isThinking && <ThinkingCard />}
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
  );
}
