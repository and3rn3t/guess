import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { llmStream } from "@/lib/llm";
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
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface GuessRevealProps {
  character: Character;
  onCorrect: () => void;
  onIncorrect: () => void;
}

export function GuessReveal({
  character,
  onCorrect,
  onIncorrect,
}: GuessRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, rotateY: -15 }}
      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
      transition={{ duration: 0.5, type: "spring" }}
    >
      <Card
        className="p-8 bg-gradient-to-br from-primary/20 to-accent/10 backdrop-blur-sm border-2 border-accent shadow-2xl"
        aria-live="assertive"
      >
        <div className="space-y-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <Sparkle
              size={64}
              weight="fill"
              className="mx-auto text-accent animate-float"
            />
          </motion.div>

          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-muted-foreground">
              I believe you're thinking of...
            </h2>
            <motion.h1
              className="text-5xl md:text-6xl font-bold text-foreground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {character.name}
            </motion.h1>
          </div>

          <motion.div
            className="space-y-3 pt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <p className="text-lg text-muted-foreground mb-6">Was I correct?</p>
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
  onPlayAgain,
  onNewGame,
  onTeachMode,
  onViewHistory,
  onViewStats,
  onShare,
  onCopyLink,
  llmMode,
  answeredQuestions,
}: GameOverProps) {
  const [narrative, setNarrative] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

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
          prompt: `${system}\n\n${user}`,
          model: "gpt-4o-mini",
        })) {
          text += token;
          setNarrative(text);
        }
      } catch {
        // Non-blocking — static explanation is enough
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
      <Card className="p-8 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-2 border-primary/30">
        <div className="space-y-6 text-center">
          {won ? (
            <>
              <Sparkle
                size={64}
                weight="fill"
                className="mx-auto text-accent"
              />
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
              <XCircle
                size={64}
                weight="fill"
                className="mx-auto text-muted-foreground"
              />
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

          {/* Share row */}
          {(onShare || onCopyLink) && (
            <div className="flex gap-3 justify-center">
              {onShare && (
                <Button
                  onClick={onShare}
                  variant="outline"
                  size="sm"
                  className="gap-2"
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
                  size="sm"
                  className="gap-2"
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
                  size="sm"
                  className="gap-2"
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
                  size="sm"
                  className="gap-2"
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
                  size="sm"
                  className="gap-2"
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
