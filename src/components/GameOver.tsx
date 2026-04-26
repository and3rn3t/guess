import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

/** Lightweight confetti burst — scales intensity by questionsAsked, reduces on mobile & respects reduced-motion */
function ConfettiBurst({ questionsAsked }: { questionsAsked?: number }) {
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  if (reduced) return null;
  // Full burst ≤5 q, medium burst ≤10, minimal burst >10
  const intensity = questionsAsked == null ? 1 : questionsAsked <= 5 ? 1 : questionsAsked <= 10 ? 0.6 : 0.2;
  const baseCount = isMobile ? 20 : 50;
  const count = Math.max(3, Math.round(baseCount * intensity));
  const spread = isMobile ? 280 : 480;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={`confetti-${i}`}
          className="absolute w-2 h-2 rounded-full"
          style={{
            left: "50%",
            top: "30%",
            backgroundColor: ["#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#60a5fa", "#38bdf8", "#e879f9"][i % 7],
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{
            x: (Math.random() - 0.5) * spread,
            y: Math.random() * (isMobile ? 240 : 340) + 50,
            opacity: 0,
            scale: Math.random() * 1.5 + 0.5,
            rotate: Math.random() * 720 - 360,
          }}
          transition={{
            duration: (1.5 + Math.random() * 0.8) * intensity,
            ease: "easeOut",
            delay: Math.random() * 0.3,
          }}
        />
      ))}
    </div>
  );
}

interface RevealResult {
  found: boolean;
  characterName?: string | null;
  attributesFilled?: number;
}

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
  surrendered,
  persona,
  isPersonalBest = false,
  personalBest = null,
}: Readonly<GameOverProps>) {
  const [narrative, setNarrative] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [revealInput, setRevealInput] = useState("");
  const [revealStatus, setRevealStatus] = useState<
    "idle" | "loading" | "done"
  >("idle");
  const [revealResult, setRevealResult] = useState<RevealResult | null>(null);
  const revealInputRef = useRef<HTMLInputElement>(null);

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
    await navigator.clipboard.writeText(emojiText);
  };

  const handleRevealSubmit = async () => {
    if (!onReveal || revealInput.trim().length === 0 || revealStatus !== "idle")
      return;
    setRevealStatus("loading");
    try {
      const result = await onReveal(revealInput.trim());
      setRevealResult(result);
    } catch {
      setRevealResult({ found: false });
    } finally {
      setRevealStatus("done");
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
          {answeredQuestions && answeredQuestions.length > 0 && (() => {
            const maxElim = Math.max(...answeredQuestions.map((q) => q.eliminated ?? 0));
            const decisiveIdx = maxElim > 0
              ? answeredQuestions.findIndex((q) => (q.eliminated ?? 0) === maxElim)
              : -1;
            return (
              <div className="rounded-xl border border-border/60 bg-secondary/10 p-4 text-left">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Evidence Log</p>
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {answeredQuestions.map((q, i) => {
                    const icon = q.answer === 'yes' ? '✓' : q.answer === 'no' ? '✗' : '?';
                    const label = q.answer === 'yes' ? 'YES' : q.answer === 'no' ? 'NO' : 'MBE';
                    const color = q.answer === 'yes' ? 'text-emerald-400' : q.answer === 'no' ? 'text-rose-400' : 'text-amber-400';
                    const isDecisive = i === decisiveIdx;
                    return (
                      <li
                        key={i}
                        className={`flex gap-2 text-xs leading-relaxed font-mono${isDecisive ? ' rounded px-1 -mx-1 bg-accent/10 border border-accent/20' : ''}`}
                        title={isDecisive ? `Most decisive — eliminated ${maxElim} candidates` : undefined}
                      >
                        <span className={`shrink-0 font-bold ${color}`}>{icon} {label}</span>
                        <span className="text-foreground/70 truncate">{q.question}</span>
                        {isDecisive && (
                          <span className="ml-auto shrink-0 text-accent font-bold" aria-label="Most decisive question">★</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}

          {(narrative || isStreaming) && (
            <div className="text-left bg-linear-to-br from-accent/10 to-primary/5 rounded-xl p-4 border border-accent/30 border-l-4 border-l-accent">
              <p className="text-sm text-foreground/80 italic">
                {narrative}
                {isStreaming && <span className="animate-pulse">▌</span>}
              </p>
            </div>
          )}

          {/* Reveal section — ask what the user was thinking of when AI lost */}
          {!won && onReveal && (
            <div className="bg-linear-to-br from-primary/8 to-secondary/5 rounded-xl p-4 border border-primary/30 text-left space-y-3">
              {revealStatus === "done" && revealResult ? (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center space-y-1"
                >
                  {revealResult.found ? (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        Got it —{" "}
                        <span className="text-accent">
                          {revealResult.characterName}
                        </span>
                        !
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {revealResult.attributesFilled
                          ? `Used your answers to fill in ${revealResult.attributesFilled} attribute${revealResult.attributesFilled === 1 ? "" : "s"}. I'll be smarter next time!`
                          : "Your answers have been recorded to help me improve!"}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        Thanks for telling me!
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {revealInput} isn&apos;t in my database yet — your
                        answers have been logged so they can be added.
                      </p>
                    </>
                  )}
                </motion.div>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Who were you thinking of?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your answer helps train me for future games.
                  </p>
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleRevealSubmit();
                    }}
                  >
                    <Input
                      ref={revealInputRef}
                      value={revealInput}
                      onChange={(e) => setRevealInput(e.target.value)}
                      placeholder="Character name…"
                      disabled={revealStatus === "loading"}
                      className="h-9 text-sm"
                      maxLength={200}
                      autoComplete="off"
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={
                        revealInput.trim().length === 0 ||
                        revealStatus === "loading"
                      }
                      className="shrink-0"
                    >
                      {revealStatus === "loading" ? "Saving…" : "Submit"}
                    </Button>
                  </form>
                </>
              )}
            </div>
          )}

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
