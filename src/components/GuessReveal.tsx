import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { llmStream, LlmError } from "@/lib/llm";
import { narrativeExplanation_v1 } from "@/lib/prompts";
import type { Character } from "@/lib/types";
import {
  ArrowClockwise,
  ChartBar,
  CheckCircle,
  ClockCounterClockwise,
  House,
  Link as LinkIcon,
  ShareNetwork,
  Sparkle,
  XCircle,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

/** Lightweight confetti burst — reduces particle count on mobile & respects reduced-motion */
function ConfettiBurst() {
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  if (reduced) return null;
  const count = isMobile ? 12 : 24;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={`confetti-${i}`}
          className="absolute w-2 h-2 rounded-full"
          style={{
            left: "50%",
            top: "30%",
            backgroundColor: ["#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#60a5fa"][i % 5],
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: (Math.random() - 0.5) * (isMobile ? 250 : 400),
            y: Math.random() * (isMobile ? 200 : 300) + 50,
            opacity: 0,
            scale: Math.random() * 1.5 + 0.5,
            rotate: Math.random() * 720 - 360,
          }}
          transition={{
            duration: 1.5 + Math.random() * 0.8,
            ease: "easeOut",
            delay: Math.random() * 0.3,
          }}
        />
      ))}
    </div>
  );
}

interface GuessRevealProps {
  character: Character;
  confidence?: number;
  onCorrect: () => void;
  onIncorrect: () => void;
}

export function GuessReveal({
  character,
  confidence,
  onCorrect,
  onIncorrect,
}: Readonly<GuessRevealProps>) {
  const [stage, setStage] = useState<"analyzing" | "confidence" | "reveal">("analyzing");

  useEffect(() => {
    const t1 = setTimeout(() => setStage("confidence"), 1200);
    const t2 = setTimeout(() => setStage("reveal"), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ duration: 0.5, type: "spring" }}
    >
      <Card
        className="p-5 sm:p-8 bg-linear-to-br from-primary/20 to-accent/10 backdrop-blur-sm border-2 border-accent shadow-2xl"
        aria-live="assertive"
      >
        <div className="space-y-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            {character.imageUrl ? (
              <div className="mx-auto w-24 h-24 rounded-full overflow-hidden ring-4 ring-accent/50 shadow-lg shadow-accent/20 animate-float">
                <img
                  src={character.imageUrl}
                  alt={character.name}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
            ) : (
              <Sparkle
                size={64}
                weight="fill"
                className="mx-auto text-accent animate-float"
              />
            )}
          </motion.div>

          <AnimatePresence mode="wait">
            {stage === "analyzing" && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                <h2 className="text-2xl font-semibold text-muted-foreground">
                  Analyzing all evidence...
                </h2>
                <div className="flex justify-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-accent"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {stage === "confidence" && (
              <motion.div
                key="confidence"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-3"
              >
                <h2 className="text-2xl font-semibold text-muted-foreground">
                  I'm{" "}
                  <span className="text-accent font-bold">
                    {confidence ?? "?"}%
                  </span>{" "}
                  confident...
                </h2>
                <p className="text-lg text-muted-foreground/70">
                  I believe you're thinking of...
                </p>
              </motion.div>
            )}

            {stage === "reveal" && (
              <motion.div
                key="reveal"
                initial={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.5 }}
                className="space-y-3"
              >
                <h2 className="text-2xl font-semibold text-muted-foreground">
                  I believe you're thinking of...
                </h2>
                {character.imageUrl && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                    className="flex justify-center"
                  >
                    <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-accent/50 shadow-xl shadow-accent/30">
                      <img
                        src={character.imageUrl}
                        alt={character.name}
                        className="w-full h-full object-cover"
                        loading="eager"
                      />
                    </div>
                  </motion.div>
                )}
                <h1 className="text-5xl md:text-6xl font-bold text-foreground">
                  {character.name}
                </h1>
              </motion.div>
            )}
          </AnimatePresence>

          {stage === "reveal" && (
            <motion.div
              className="space-y-3 pt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <p className="text-lg text-muted-foreground mb-6">
                Was I correct?
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={onCorrect}
                  size="lg"
                  className="flex-1 max-w-xs h-14 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
                >
                  <CheckCircle size={24} weight="fill" className="mr-2" />
                  Yes! Correct
                </Button>
                <Button
                  onClick={onIncorrect}
                  size="lg"
                  variant="outline"
                  className="flex-1 max-w-xs h-14 text-lg hover:scale-105 transition-transform"
                >
                  <XCircle size={24} weight="fill" className="mr-2" />
                  No, Wrong
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

interface GameOverProps {
  won: boolean;
  character: Character | null;
  questionsAsked?: number;
  remainingCharacters?: number;
  gameHistory?: Array<{ won: boolean }>;
  onPlayAgain: () => void;
  onNewGame?: () => void;
  onTeachMode?: () => void;
  onViewHistory?: () => void;
  onViewStats?: () => void;
  onShare?: () => void;
  onCopyLink?: () => void;
  llmMode?: boolean;
  answeredQuestions?: Array<{ question: string; answer: string }>;
}

export function GameOver({
  won,
  character,
  questionsAsked,
  remainingCharacters,
  gameHistory,
  onPlayAgain,
  onNewGame,
  onTeachMode,
  onViewHistory,
  onViewStats,
  onShare,
  onCopyLink,
  llmMode,
  answeredQuestions,
}: Readonly<GameOverProps>) {
  const [narrative, setNarrative] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // Calculate best win streak for loss encouragement
  const bestStreak = (() => {
    if (!gameHistory || gameHistory.length === 0) return 0;
    let max = 0;
    let cur = 0;
    for (const g of gameHistory) {
      if (g.won) { cur++; max = Math.max(max, cur); } else { cur = 0; }
    }
    return max;
  })();

  useEffect(() => {
    if (!llmMode || !character) return;

    const qaList = answeredQuestions || [];
    const { system, user } = narrativeExplanation_v1(
      character.name,
      won,
      qaList,
      remainingCharacters || 0,
    );

    setIsStreaming(true);
    let text = "";
    const run = async () => {
      try {
        for await (const token of llmStream({
          prompt: user,
          model: "gpt-4o-mini",
          systemPrompt: system,
        })) {
          text += token;
          setNarrative(text);
        }
      } catch (e) {
        if (e instanceof LlmError) {
          console.warn('Narrative generation failed:', e.code, e.message)
        }
      } finally {
        setIsStreaming(false);
      }
    };
    run();
  }, [llmMode, character, won, answeredQuestions, remainingCharacters]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-5 sm:p-8 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm border-2 border-primary/30 relative overflow-hidden">
        {/* CSS confetti burst on win */}
        {won && (
          <ConfettiBurst />
        )}

        <div className="space-y-6 text-center">
          {won ? (
            <>
              <motion.div
                animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                {character?.imageUrl ? (
                  <div className="mx-auto w-20 h-20 rounded-full overflow-hidden ring-4 ring-accent/50 shadow-lg shadow-accent/20">
                    <img
                      src={character.imageUrl}
                      alt={character.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <Sparkle
                    size={64}
                    weight="fill"
                    className="mx-auto text-accent"
                  />
                )}
              </motion.div>
              <div>
                <h2 className="text-4xl font-bold text-foreground mb-2">
                  I Got It Right!
                </h2>
                {character && (
                  <p className="text-xl text-muted-foreground">
                    It was {character.name}!
                  </p>
                )}
              </div>
              <p className="text-foreground/80">
                Thanks for playing! The more games we play, the smarter I
                become.
              </p>
            </>
          ) : (
            <>
              <motion.div
                animate={{ x: [0, -6, 6, -4, 4, -2, 2, 0] }}
                transition={{ duration: 0.5, delay: 0.15 }}
              >
                <XCircle
                  size={64}
                  weight="fill"
                  className="mx-auto text-muted-foreground"
                />
              </motion.div>
              <div>
                <h2 className="text-4xl font-bold text-foreground mb-2">
                  You Stumped Me!
                </h2>
                <p className="text-xl text-muted-foreground">
                  I couldn't figure it out this time.
                </p>
              </div>
              <p className="text-foreground/80">
                But I learn from every game! Play again to help me get better.
              </p>
              {bestStreak >= 2 && (
                <p className="text-sm text-accent font-medium">
                  Your best win streak: {bestStreak} in a row — can you beat it?
                </p>
              )}
            </>
          )}

          {(narrative || isStreaming) && (
            <div className="text-left bg-accent/5 rounded-lg p-4 border border-accent/20">
              <p className="text-sm text-foreground/80 italic">
                {narrative}
                {isStreaming && <span className="animate-pulse">▌</span>}
              </p>
            </div>
          )}

          {(questionsAsked != null || remainingCharacters != null) && (
            <p className="text-sm text-muted-foreground">
              {questionsAsked != null && (
                <>
                  Guessed in {questionsAsked} question
                  {questionsAsked === 1 ? "" : "s"}
                </>
              )}
              {questionsAsked != null && remainingCharacters != null && " · "}
              {remainingCharacters != null && (
                <>
                  {remainingCharacters} character
                  {remainingCharacters === 1 ? "" : "s"} remaining
                </>
              )}
            </p>
          )}

          {/* Primary actions */}
          {won ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={onPlayAgain}
                size="lg"
                className="h-14 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg hover:scale-105 transition-transform"
              >
                <ArrowClockwise size={24} weight="bold" className="mr-2" />
                Play Again
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={onPlayAgain}
                size="lg"
                className="h-14 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg hover:scale-105 transition-transform"
              >
                <ArrowClockwise size={24} weight="bold" className="mr-2" />
                Play Again
              </Button>
              {onTeachMode && (
                <Button
                  onClick={onTeachMode}
                  size="lg"
                  className="h-14 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg hover:scale-105 transition-transform"
                >
                  <Sparkle size={24} weight="fill" className="mr-2" />
                  Teach Me
                </Button>
              )}
            </div>
          )}

          {(onShare || onCopyLink) && (
            <div className="flex gap-3 justify-center">
              {onShare && (
                <Button
                  onClick={onShare}
                  variant="outline"
                  className="gap-2 touch-target"
                  aria-label="Share result"
                >
                  <ShareNetwork size={18} />
                  Share Result
                </Button>
              )}
              {onCopyLink && (
                <Button
                  onClick={onCopyLink}
                  variant="outline"
                  className="gap-2 touch-target"
                  aria-label="Copy share link"
                >
                  <LinkIcon size={18} />
                  Copy Link
                </Button>
              )}
            </div>
          )}

          {/* Tertiary row */}
          {(onViewStats || onViewHistory || onNewGame) && (
            <div className="flex gap-3 justify-center">
              {onViewStats && (
                <Button
                  onClick={onViewStats}
                  variant="ghost"
                  className="gap-2 touch-target"
                  aria-label="View stats"
                >
                  <ChartBar size={18} />
                  Stats
                </Button>
              )}
              {onViewHistory && (
                <Button
                  onClick={onViewHistory}
                  variant="ghost"
                  className="gap-2 touch-target"
                  aria-label="View game history"
                >
                  <ClockCounterClockwise size={18} />
                  History
                </Button>
              )}
              {onNewGame && (
                <Button
                  onClick={onNewGame}
                  variant="ghost"
                  className="gap-2 touch-target"
                  aria-label="Start new game from welcome screen"
                >
                  <House size={18} />
                  New Game
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
