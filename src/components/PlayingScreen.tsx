import { CoachMark } from "@/components/CoachMark";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { QuestionCard, ThinkingCard } from "@/components/QuestionCard";
import { ReasoningPanel } from "@/components/ReasoningPanel";
import { PossibilityGrid } from "@/components/PossibilityGrid";
import { PossibilitySpaceChart } from "@/components/PossibilitySpaceChart";
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
import { llmStream } from "@/lib/llm";
import { ClockCounterClockwiseIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useCallback, useEffect, useRef, useState, useMemo } from "react";

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
  onSkip?: () => void;
  onGiveUp?: () => void;
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
  activeCharacters,
  readiness,
  onRetry,
  onSkip,
  onGiveUp,
}: Readonly<PlayingScreenProps>) {
  const [isUndoing, setIsUndoing] = useState(false);

  // ── Warm / cold indicator ────────────────────────────────────────────────
  const [tempIndicator, setTempIndicator] = useState<'warm' | 'cold' | null>(null);
  const prevTopProbRef = useRef<number | null>(null);

  useEffect(() => {
    const currentTop = reasoning?.topCandidates?.[0]?.probability ?? null;
    if (prevTopProbRef.current !== null && currentTop !== null) {
      const delta = currentTop - prevTopProbRef.current;
      if (delta >= 6) {
        setTempIndicator('warm');
        const t = setTimeout(() => setTempIndicator(null), 2200);
        return () => clearTimeout(t);
      } else if (delta <= -6) {
        setTempIndicator('cold');
        const t = setTimeout(() => setTempIndicator(null), 2200);
        return () => clearTimeout(t);
      }
    }
    if (currentTop !== null) prevTopProbRef.current = currentTop;
  }, [reasoning]);

  // ── Probability history (for top-3 chart + sparkline) ───────────────────
  // Each entry captures the top-3 candidates after an answer.
  const [probHistory, setProbHistory] = useState<Array<[number, number, number]>>([]);
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>([]);
  const prevReasoningIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!reasoning?.topCandidates || reasoning.topCandidates.length === 0) return;
    // Deduplicate: only add when the top candidate actually changed
    const topKey = `${reasoning.topCandidates[0].name}:${reasoning.topCandidates[0].probability}`;
    if (topKey === prevReasoningIdRef.current) return;
    prevReasoningIdRef.current = topKey;

    const triple: [number, number, number] = [
      reasoning.topCandidates[0]?.probability ?? 0,
      reasoning.topCandidates[1]?.probability ?? 0,
      reasoning.topCandidates[2]?.probability ?? 0,
    ];
    setProbHistory((prev) => [...prev, triple]);
    setConfidenceHistory((prev) => [...prev, reasoning.confidence]);
  }, [reasoning]);

  // Reset on game restart (gameSteps resets to 0)
  useEffect(() => {
    if (gameSteps.length === 0) {
      setProbHistory([]);
      setConfidenceHistory([]);
      prevReasoningIdRef.current = null;
      prevTopProbRef.current = null;
    }
  }, [gameSteps.length]);

  // ── Remaining-history → per-step eliminations ────────────────────────────
  const [remainingHistory, setRemainingHistory] = useState<number[]>([]);
  const prevStepsLenRef = useRef(0);

  useEffect(() => {
    const len = gameSteps.length;
    if (len > prevStepsLenRef.current) {
      setRemainingHistory((prev) => [...prev, effectiveRemaining]);
    } else if (len < prevStepsLenRef.current) {
      // Undo: trim the history
      setRemainingHistory((prev) => prev.slice(0, len));
    }
    prevStepsLenRef.current = len;
  }, [gameSteps.length, effectiveRemaining]);

  const stepEliminations = useMemo(
    () => remainingHistory.map((rem, i) => (i === 0 ? 0 : (remainingHistory[i - 1] - rem))),
    [remainingHistory],
  );
  const avgElimination = useMemo(
    () => stepEliminations.reduce((s, n) => s + n, 0) / (stepEliminations.length || 1),
    [stepEliminations],
  );

  // ── Streaming reasoning commentary ────────────────────────────────────────
  const [streamComment, setStreamComment] = useState('');
  const [isStreamingComment, setIsStreamingComment] = useState(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!reasoning || gameSteps.length === 0 || !currentQuestion) return;
    // Only fire on new questions (when isThinking goes false and we have a question)
    if (isThinking) return;

    // Abort any previous stream
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    setStreamComment('');
    setIsStreamingComment(true);

    const lastStep = gameSteps[gameSteps.length - 1];
    const topName = reasoning.topCandidates?.[0]?.name ?? 'unknown';
    const topProb = reasoning.topCandidates?.[0]?.probability ?? 0;

    const prompt = `The player just answered "${lastStep?.answer}" to: "${lastStep?.questionText}". \
Top suspect is now ${topName} at ${topProb}%. ${reasoning.remaining} characters remain. \
In 1-2 sentences, react in character to this answer and what it reveals. Be concise and specific.`;

    const run = async () => {
      let text = '';
      try {
        for await (const token of llmStream({
          prompt,
          model: 'gpt-4o-mini',
          systemPrompt: 'You are a sharp detective assistant. React briefly to each clue.',
          signal: controller.signal,
        })) {
          text += token;
          setStreamComment(text);
        }
      } catch (e) {
        // Abort is expected when the component unmounts or a new question arrives — ignore.
        if (e instanceof Error && e.name === 'AbortError') return;
        // LLM errors are non-fatal for decorative commentary — fail silently.
      } finally {
        if (!controller.signal.aborted) setIsStreamingComment(false);
      }
    };
    run();

    return () => { controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reasoning?.topCandidates?.[0]?.name, reasoning?.topCandidates?.[0]?.probability]);

  // ── Probability score map for PossibilityGrid ─────────────────────────────
  const candidateScores = useMemo(() => {
    if (!reasoning?.topCandidates || activeCharacters.length === 0) return undefined;
    const nameToId = new Map(activeCharacters.map((c) => [c.name, c.id]));
    const map = new Map<string, number>();
    for (const c of reasoning.topCandidates) {
      const id = nameToId.get(c.name);
      if (id) map.set(id, c.probability);
    }
    return map;
  }, [reasoning?.topCandidates, activeCharacters]);

  const handleUndo = useCallback(() => {
    if (isUndoing) return;
    setIsUndoing(true);
    setTimeout(() => {
      dispatch({ type: "UNDO_LAST_ANSWER" });
      setIsUndoing(false);
    }, 200);
  }, [dispatch, isUndoing]);

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
            <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
              {maxQuestions - answers.length} left
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
              {tempIndicator !== null && (
                <motion.span
                  key={`indicator-${tempIndicator}`}
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: [1, 1.1, 1] }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shadow-md"
                  style={{
                    backgroundColor: tempIndicator === 'warm' ? 'oklch(0.72 0.18 55 / 0.2)' : 'oklch(0.65 0.14 220 / 0.2)',
                    color: tempIndicator === 'warm' ? 'oklch(0.72 0.18 55)' : 'oklch(0.65 0.14 220)',
                  }}
                >
                  {tempIndicator === 'warm' ? '🔥 Getting warmer' : '򌠵 Going cold'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2">
            {answers.length > 0 && (
              <button
                onClick={handleUndo}
                disabled={isUndoing}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-2 disabled:opacity-50"
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
              const isLast = i === gameSteps.length - 1;
              const eliminated = stepEliminations[i] ?? 0;
              const isHighImpact = avgElimination > 0 && eliminated >= avgElimination * 1.5;
              return (
                <motion.span
                  key={step.questionId ?? `step-${i}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={
                    isLast && isUndoing
                      ? { scale: 0.85, opacity: 0.4, boxShadow: '0 0 0 3px rgba(239,68,68,0.7)' }
                      : { scale: 1, opacity: 1, boxShadow: isHighImpact ? '0 0 0 2px oklch(0.70 0.15 220 / 0.7)' : '0 0 0 0px rgba(0,0,0,0)' }
                  }
                  transition={
                    isLast && isUndoing
                      ? { duration: 0.15 }
                      : { type: 'spring', stiffness: 380, damping: 20, delay: i * 0.025 }
                  }
                  title={`Q${i + 1}: ${step.questionText} → ${step.answer}${eliminated > 0 ? ` (−${eliminated} eliminated)` : ''}`}
                  className={`inline-flex items-center justify-center w-8 h-8 sm:w-7 sm:h-7 rounded-full text-xs font-bold cursor-default transition-colors hover:scale-110 ring-1 ring-offset-1 ring-offset-background hover:ring-2 ${
                    bgClass[step.answer] ?? 'bg-muted text-muted-foreground ring-muted-foreground/30'
                  }${isHighImpact ? ' scale-[1.05]' : ''}`}
                >
                  {label[step.answer] ?? '?'}
                </motion.span>
              );
            })}
          </div>
        )}

        <div className="grid lg:grid-cols-2 xl:grid-cols-[1fr_380px] gap-4 lg:gap-6">
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
            {currentQuestion && onSkip && (
              <div className="text-center pt-1">
                <button
                  onClick={onSkip}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                >
                  Skip this question
                </button>
              </div>
            )}
            {answers.length >= 5 && onGiveUp && (
              <div className="text-center pt-2">
                <button
                  onClick={onGiveUp}
                  className="text-xs text-muted-foreground/60 hover:text-destructive transition-colors underline-offset-2 hover:underline"
                >
                  Give up
                </button>
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-8 lg:self-start xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto space-y-4">
            <ReasoningPanel
              reasoning={reasoning}
              isThinking={isThinking}
              readiness={readiness}
              streamComment={streamComment}
              isStreamingComment={isStreamingComment}
              confidenceHistory={confidenceHistory}
            />
            {probHistory.length >= 2 && (
              <PossibilitySpaceChart probHistory={probHistory} />
            )}
            {activeCharacters.length > 0 && (
              <PossibilityGrid
                characters={activeCharacters}
                answers={answers}
                candidateScores={candidateScores}
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export const PlayingScreen = memo(PlayingScreenBase);
