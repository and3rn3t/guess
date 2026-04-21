import { CoachMark } from "@/components/CoachMark";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { QuestionCard, ThinkingCard } from "@/components/QuestionCard";
import { ReasoningPanel } from "@/components/ReasoningPanel";
import type { GameAction } from "@/hooks/useGameState";
import type {
  Answer,
  AnswerValue,
  Character,
  GameHistoryStep,
  GuessReadinessSnapshot,
  Question,
  ReasoningExplanation,
} from "@/lib/types";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { memo } from "react";

interface PlayingScreenProps {
  answers: Answer[];
  maxQuestions: number;
  confidence: number;
  effectiveRemaining: number;
  eliminatedCount: number | null;
  possibleCharacters: Character[];
  currentQuestion: Question | null;
  isThinking: boolean;
  reasoning: ReasoningExplanation | null;
  handleAnswer: (value: AnswerValue) => void;
  dispatch: React.Dispatch<GameAction>;
  gameSteps: GameHistoryStep[];
  gamesPlayed: number;
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
  activeCharacters: Character[];
  readiness: GuessReadinessSnapshot | null;
  onRetry?: () => void;
}

function PlayingScreenBase({
  answers,
  maxQuestions,
  confidence,
  effectiveRemaining,
  eliminatedCount,
  possibleCharacters: _possibleCharacters,
  currentQuestion,
  isThinking,
  reasoning,
  handleAnswer,
  dispatch,
  gameSteps,
  gamesPlayed,
  showOnboarding,
  setShowOnboarding,
  activeCharacters: _activeCharacters,
  readiness,
  onRetry,
}: Readonly<PlayingScreenProps>) {
  const readinessSummary = readiness?.blockedByRejectCooldown
    ? `Holding the next guess until I collect ${readiness.rejectCooldownRemaining} more answer${readiness.rejectCooldownRemaining === 1 ? "" : "s"}.`
    : readiness?.trigger === "high_certainty"
      ? "I’m closing in on a very strong suspect."
      : readiness?.trigger === "strict_readiness"
        ? "I’m nearly ready to guess, but I’m still validating the top suspects."
        : "I’m still narrowing down the strongest candidates before guessing.";

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
            <div
              className="flex-1 relative h-2 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              aria-valuenow={answers.length}
              aria-valuemin={0}
              aria-valuemax={maxQuestions}
            >
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${(answers.length / maxQuestions) * 100}%`,
                  background: 'linear-gradient(90deg, oklch(0.72 0.18 155), oklch(0.70 0.15 220), oklch(0.35 0.15 300))',
                  boxShadow: '0 0 8px oklch(0.70 0.15 220 / 0.5)',
                }}
              />
            </div>
            <span className="text-sm font-semibold text-accent whitespace-nowrap tabular-nums">
              {confidence}% confident
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4 lg:mb-6">
          <div className="flex items-center gap-3">
            <span>
              {effectiveRemaining} possibilities remaining
            </span>
            <AnimatePresence>
              {eliminatedCount !== null && (
                <motion.span
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: [1, 1.15, 1] }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4 }}
                  className="inline-flex items-center rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-medium text-destructive shadow-md shadow-destructive/30"
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
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-2"
                aria-label="Undo last answer"
              >
                <ClockCounterClockwiseIcon size={14} />
                Undo
              </button>
            )}
          </div>
        </div>

        {readiness && (
          <div className="mb-4 lg:mb-6 rounded-xl border-l-4 border-l-accent border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-foreground/90">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-accent">Guess timing</span>
              {readiness.questionsRemaining != null && (
                <span className="text-xs text-muted-foreground">
                  {readiness.questionsRemaining} question{readiness.questionsRemaining === 1 ? "" : "s"} left
                </span>
              )}
              {readiness.aliveCount != null && (
                <span className="text-xs text-muted-foreground">
                  {readiness.aliveCount} viable suspects
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{readinessSummary}</p>
          </div>
        )}

        {/* Answer history timeline */}
        {gameSteps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4 lg:mb-6" aria-label="Answer history">
            {gameSteps.map((step, i) => {
              const bgClass: Record<string, string> = {
                yes: 'bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 text-emerald-400 ring-emerald-500/40',
                no: 'bg-gradient-to-br from-rose-500/30 to-rose-600/20 text-rose-400 ring-rose-500/40',
                maybe: 'bg-gradient-to-br from-amber-500/30 to-amber-600/20 text-amber-400 ring-amber-500/40',
              };
              const label: Record<string, string> = { yes: 'Y', no: 'N', maybe: 'M' };
              return (
                <motion.span
                  key={step.questionId ?? `step-${i}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 20, delay: i * 0.025 }}
                  title={`Q${i + 1}: ${step.questionText} → ${step.answer}`}
                  className={`inline-flex items-center justify-center w-8 h-8 sm:w-7 sm:h-7 rounded-full text-xs font-bold cursor-default transition-all hover:scale-110 ring-1 ring-offset-1 ring-offset-background hover:ring-2 ${
                    bgClass[step.answer] ?? 'bg-muted text-muted-foreground ring-muted-foreground/30'
                  }`}
                >
                  {label[step.answer] ?? '?'}
                </motion.span>
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
              gamesPlayed={gamesPlayed}
            />
            <CoachMark
              id="stats"
              message="📊 After this game, visit Stats to see your win rate and trends."
              showAfterGames={3}
              gamesPlayed={gamesPlayed}
            />
            <CoachMark
              id="teaching"
              message="🎓 Stumped me? Use Teaching Mode to add your character to my brain!"
              showAfterGames={5}
              gamesPlayed={gamesPlayed}
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
              {!currentQuestion && !isThinking && onRetry && answers.length > 0 && (
                <motion.div
                  key="retry"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-xl border bg-card p-6 text-center space-y-3"
                >
                  <p className="text-sm text-muted-foreground">
                    Something went wrong loading the next question.
                  </p>
                  <button
                    onClick={onRetry}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Try Again
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="lg:sticky lg:top-8 lg:self-start space-y-4">
            <ReasoningPanel
              reasoning={reasoning}
              isThinking={isThinking}
              readiness={readiness}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export const PlayingScreen = memo(PlayingScreenBase);
