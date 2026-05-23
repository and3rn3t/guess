import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { EvidenceLog } from "@/components/GameOver/EvidenceLog";
import { GameOverFeedback } from "@/components/GameOver/GameOverFeedback";
import { GameOverReveal, type RevealResult } from "@/components/GameOver/GameOverReveal";
import { llmStream, LlmError } from "@/lib/llm";
import { narrativeExplanation_v1 } from "@/lib/prompts";
import { buildShareEmoji } from "@/lib/sharing";
import type { Character, Persona } from "@/lib/types";
import {
  ArrowClockwise,
  ChartBar,
  ClockCounterClockwise,
  House,
  Link as LinkIcon,
  ShareNetwork,
  Sparkle,
  XCircle,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface GameOverProps {
  won: boolean;
  exhausted?: boolean;
  character: Character | null;
  maxQuestions?: number;
  questionsAsked?: number;
  guessesUsed?: number;
  remainingCharacters?: number;
  gamesPlayed?: number;
  onPlayAgain: () => void;
  onNewGame?: () => void;
  onTeachMode?: () => void;
  onViewHistory?: () => void;
  onViewStats?: () => void;
  onShare?: () => void;
  onCopyLink?: () => void;
  answeredQuestions?: Array<{ question: string; answer: string; eliminated?: number }>;
  onReveal?: (characterName: string) => Promise<RevealResult>;
  onSubmitFeedback?: (rating: number, feedbackText?: string) => Promise<void>;
  surrendered?: boolean;
  persona?: Persona;
  isPersonalBest?: boolean;
  personalBest?: number | null;
}

export function GameOver({
  won,
  exhausted,
  character,
  maxQuestions,
  questionsAsked,
  guessesUsed,
  remainingCharacters,
  gamesPlayed,
  onPlayAgain,
  onNewGame,
  onTeachMode,
  onViewHistory,
  onViewStats,
  onShare,
  onCopyLink,
  answeredQuestions,
  onReveal,
  onSubmitFeedback,
  surrendered,
  persona,
  isPersonalBest = false,
  personalBest = null,
}: Readonly<GameOverProps>) {
  const [narrative, setNarrative] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const emojiText =
    character && answeredQuestions
      ? buildShareEmoji(
          answeredQuestions.map((q) => ({
            questionText: q.question,
            attribute: "",
            answer: q.answer as "yes" | "no" | "maybe" | "unknown",
          })),
          won,
          character.name,
          questionsAsked ?? answeredQuestions.length,
        )
      : null;

  const handleShareEmoji = async () => {
    if (!emojiText) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Andernator", text: emojiText });
        return;
      } catch {
        /* fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(emojiText);
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  useEffect(() => {
    if (!character) return;

    const qaList = answeredQuestions || [];
    const { system, user } = narrativeExplanation_v1(
      character.name,
      won,
      qaList,
      remainingCharacters || 0,
      persona,
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
  }, [character, won, answeredQuestions, remainingCharacters, persona]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-5 sm:p-8 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-sm border-2 border-primary/30 relative overflow-hidden">
        {/* CSS confetti burst on win — intensity scales with how quickly the player won */}
        {won && (
          <ConfettiBurst questionsAsked={questionsAsked} />
        )}

        {/* 🏆 Personal best banner */}
        {isPersonalBest && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 180, damping: 16 }}
            className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-accent/15 border border-accent/40 px-4 py-2"
          >
            <motion.span
              animate={{ scale: [1, 1.35, 1] }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="text-xl"
            >🏆</motion.span>
            <span className="text-sm font-bold text-accent">
              New Personal Best — {questionsAsked} question{questionsAsked === 1 ? '' : 's'}!
            </span>
          </motion.div>
        )}

        {/* Classified stamp */}
        <div className="relative mb-4 flex justify-center">
          <motion.div
            initial={{ opacity: 0, rotate: -12, scale: 1.5 }}
            animate={{ opacity: 1, rotate: -10, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.4, type: 'spring' }}
            className={`absolute -top-1 right-2 sm:right-6 px-3 py-1 border-2 rounded text-xs font-black tracking-widest uppercase select-none pointer-events-none ${
              won
                ? 'border-emerald-500 text-emerald-500'
                : surrendered
                  ? 'border-amber-400 text-amber-400'
                  : 'border-rose-500 text-rose-500'
            }`}
            style={{ fontFamily: 'monospace', opacity: 0.85 }}
          >
            {won ? 'IDENTIFIED' : surrendered ? 'ABANDONED' : 'ESCAPED'}
          </motion.div>

          {/* Character image */}
          <motion.div
            animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.3, 0.9, 1.15, 1] }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="animate-glow-pulse w-fit"
          >
            {character?.imageUrl ? (
              <div className={`w-20 h-20 rounded-full overflow-hidden ring-4 shadow-lg ${
                won ? 'ring-emerald-500/60 shadow-emerald-500/30' : 'ring-muted-foreground/30 shadow-muted/20 grayscale'
              }`}>
                <img src={character.imageUrl} alt={character.name} className="w-full h-full object-cover" />
              </div>
            ) : won ? (
              <Sparkle size={64} weight="fill" className="mx-auto text-accent" />
            ) : (
              <XCircle size={64} weight="fill" className="mx-auto text-muted-foreground" />
            )}
          </motion.div>
        </div>

        <div
          data-phase-focus
          tabIndex={-1}
          className="space-y-6 text-center focus:outline-none"
        >
          {won ? (
            <div>
              <h2 className="text-4xl font-bold text-gradient-win mb-2">
                {questionsAsked != null && questionsAsked <= 5
                  ? 'Uncanny!'
                  : maxQuestions != null && questionsAsked != null && questionsAsked >= maxQuestions - 1
                    ? 'Just in time.'
                    : 'I Got It Right!'}
              </h2>
              {character && (
                <p className="text-xl text-muted-foreground">
                  It was {character.name}!
                </p>
              )}
            </div>
          ) : surrendered ? (
            <div>
              <h2 className="text-4xl font-bold text-foreground mb-2">You Called It</h2>
              <p className="text-xl text-muted-foreground">
                You ended the game after {questionsAsked ?? 0} question{questionsAsked === 1 ? '' : 's'}.
              </p>
            </div>
          ) : exhausted ? (
            <div>
              <h2 className="text-4xl font-bold text-foreground mb-2">I'm Stumped!</h2>
              <p className="text-xl text-muted-foreground">
                I ran out of candidates after{' '}
                {guessesUsed != null && guessesUsed > 0
                  ? `${guessesUsed} guess${guessesUsed === 1 ? '' : 'es'}`
                  : 'all my questions'}.
              </p>
            </div>
          ) : (
            <div>
              <h2 className="text-4xl font-bold text-foreground mb-2">You Stumped Me!</h2>
              <p className="text-xl text-muted-foreground">I couldn't figure it out this time.</p>
              {(gamesPlayed ?? 0) >= 3 && (
                <p className="text-sm text-accent font-medium mt-2">
                  Check your Stats to see how we've both improved!
                </p>
              )}
            </div>
          )}

          {/* Case File — answer history in monospace */}
          {answeredQuestions && answeredQuestions.length > 0 && (
            <EvidenceLog answeredQuestions={answeredQuestions} />
          )}

          {(narrative || isStreaming) && (
            <div className="text-left bg-linear-to-br from-accent/10 to-primary/5 rounded-xl p-4 border border-accent/30 border-l-4 border-l-accent">
              <p className="text-sm text-foreground/80 italic">
                {narrative}
                {isStreaming && <span className="animate-pulse">▌</span>}
              </p>
            </div>
          )}

          {onSubmitFeedback && (
            <GameOverFeedback onSubmitFeedback={onSubmitFeedback} />
          )}

          {/* Reveal section — ask what the user was thinking of when AI lost */}
          {!won && onReveal && <GameOverReveal onReveal={onReveal} />}

          {(questionsAsked != null || remainingCharacters != null || guessesUsed != null) && (
            <p className="text-sm text-muted-foreground font-mono">
              [{questionsAsked != null ? `${questionsAsked}q` : '██q'}{guessesUsed != null && guessesUsed > 0 ? ` · ${guessesUsed}g` : ''}{remainingCharacters != null ? ` · ${remainingCharacters} remaining` : ''}{personalBest != null ? ` · best: ${personalBest}q` : ''}]
            </p>
          )}

          {/* Primary actions */}
          {won ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={onPlayAgain}
                size="lg"
                data-testid="play-again-btn"
                className="h-14 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/30 hover:scale-105 transition-transform"
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
                data-testid="play-again-btn"
                className="h-14 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/30 hover:scale-105 transition-transform"
              >
                <ArrowClockwise size={24} weight="bold" className="mr-2" />
                Play Again
              </Button>
              {onTeachMode && (
                <Button
                  onClick={onTeachMode}
                  size="lg"
                  variant="outline"
                  className="h-14 text-lg hover:scale-105 transition-transform text-accent border-accent/40 hover:bg-accent/10"
                >
                  <Sparkle size={24} weight="fill" className="mr-2" />
                  Teach Me
                </Button>
              )}
            </div>
          )}

          {(onShare || onCopyLink) && (
            <div className="flex flex-col gap-3">
              {emojiText && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <pre className="font-mono text-base leading-relaxed whitespace-pre-wrap text-center select-all">
                    {emojiText}
                  </pre>
                </div>
              )}
              <div className="flex gap-3 justify-center">
                {onShare && (
                  <Button
                    onClick={emojiText ? () => { void handleShareEmoji(); } : onShare}
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
            </div>
          )}

          {/* Tertiary row */}
          {(onViewStats || onViewHistory || onNewGame) && (
            <div className="flex flex-wrap gap-3 justify-center">
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
