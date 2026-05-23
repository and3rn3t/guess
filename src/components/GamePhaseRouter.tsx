import { GameOver } from "@/components/GameOver";
import { GuessReveal } from "@/components/GuessReveal";
import { PlayingScreen } from "@/components/PlayingScreen";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { StaticPhaseContent } from "@/components/phases/StaticPhaseContent";
import { useGameContext } from "@/contexts/GameContext";
import { DEFAULT_QUESTIONS } from "@/lib/database";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Routes the current game phase to its screen.
 *
 * App.tsx owns the data; this component owns the per-phase rendering and
 * lazy-loading. Keep effects and state in App.tsx.
 */
export function GamePhaseRouter() {
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
    dailyChallenge,
    dailyLeaderboard,
    dailyLoading,
    dailyError,
    refreshDailyChallenge,
    showOnboarding,
    setShowOnboarding,
    startGame,
    startDailyChallenge,
    handleAnswer,
    handleSkip,
    handleGiveUp,
    handleCorrectGuess,
    handleIncorrectGuess,
    handleRejectGuess,
    retryAfterReject,
    serverLastError,
    clearServerError,
    retryServerAction,
    handleShare,
    handleCopyLink,
    handleReveal,
    handleSubmitFeedback,
  } = useGameContext();

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

  const containerRef = useRef<HTMLDivElement>(null);

  // Direction tracking for slide transitions (forward = right-to-left, back = left-to-right)
  const PHASE_ORDER: Partial<Record<typeof gamePhase, number>> = {
    welcome: 0, playing: 1, guessing: 2, gameOver: 3,
  };
  const prevPhaseRef = useRef<typeof gamePhase | null>(null);
  const directionRef = useRef<1 | -1>(1);
  if (prevPhaseRef.current !== null && prevPhaseRef.current !== gamePhase) {
    const fromIdx = PHASE_ORDER[prevPhaseRef.current] ?? -1;
    const toIdx = PHASE_ORDER[gamePhase] ?? -1;
    if (fromIdx !== -1 && toIdx !== -1) {
      directionRef.current = toIdx >= fromIdx ? 1 : -1;
    }
  }
  prevPhaseRef.current = gamePhase;

  const slideEase = [0.32, 0.72, 0, 1] as const;
  const slideIn = { opacity: 0, x: directionRef.current * 56 };
  const slideOut = { opacity: 0, x: directionRef.current * -56 };
  const slideTrans = { duration: 0.3, ease: slideEase };

  useEffect(() => {
    containerRef.current?.focus();
  }, [gamePhase]);

  type AnimatedPhase = "welcome" | "playing" | "guessing" | "gameOver";
  const isAnimatedPhase = (phase: typeof gamePhase): phase is AnimatedPhase =>
    phase === "welcome" ||
    phase === "playing" ||
    phase === "guessing" ||
    phase === "gameOver";

  const animatedPhaseManifest: Record<
    AnimatedPhase,
    () => ReactNode
  > = {
    welcome: () => (
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
        dailyChallenge={dailyChallenge}
        dailyLeaderboard={dailyLeaderboard}
        dailyLoading={dailyLoading}
        dailyError={dailyError}
        refreshDailyChallenge={() => void refreshDailyChallenge()}
        startDailyChallenge={() => void startDailyChallenge()}
      />
    ),
    playing: () => (
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
        inlineError={serverLastError}
        onClearInlineError={clearServerError}
        onRetryInlineError={retryServerAction}
      />
    ),
    guessing: () => (
      <div className="max-w-2xl mx-auto">
        <GuessReveal
          character={finalGuess!}
          confidence={confidence}
          guessNumber={guessCount}
          onCorrect={handleCorrectGuess}
          onIncorrect={handleIncorrectGuess}
          onRejectGuess={handleRejectGuess}
        />
      </div>
    ),
    gameOver: () => (
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
          onSubmitFeedback={handleSubmitFeedback}
          persona={persona}
          isPersonalBest={isNewPersonalBest}
          personalBest={personalBest}
        />
      </div>
    ),
  };

  const animatedPhase = isAnimatedPhase(gamePhase) ? gamePhase : null;
  const shouldRenderAnimatedPhase =
    animatedPhase != null &&
    (animatedPhase !== "guessing" || finalGuess != null);
  const animatedContent =
    shouldRenderAnimatedPhase && animatedPhase
      ? animatedPhaseManifest[animatedPhase]()
      : null;

  return (
    <div ref={containerRef} tabIndex={-1} className="outline-none">
      <AnimatePresence mode="wait">
        {animatedContent && (
          <motion.div
            key={animatedPhase!}
            initial={slideIn}
            animate={{ opacity: 1, x: 0 }}
            exit={slideOut}
            transition={slideTrans}
          >
            {animatedContent}
          </motion.div>
        )}
      </AnimatePresence>

      <StaticPhaseContent phase={gamePhase} />
    </div>
  );
}
