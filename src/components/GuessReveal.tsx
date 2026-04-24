import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Character } from "@/lib/types";
import {
  CheckCircle,
  Sparkle,
  XCircle,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

interface GuessRevealProps {
  character: Character;
  confidence?: number;
  guessNumber?: number;
  onCorrect: () => void;
  onIncorrect: () => void;
  onRejectGuess?: () => void;
}

export function GuessReveal({
  character,
  confidence,
  guessNumber,
  onCorrect,
  onIncorrect,
  onRejectGuess,
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
        className="p-5 sm:p-8 bg-linear-to-br from-primary/20 to-accent/10 backdrop-blur-sm border-2 border-accent shadow-2xl focus:outline-none"
        aria-live="assertive"
        data-phase-focus
        tabIndex={-1}
      >
        <div className="space-y-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            {character.imageUrl ? (
              <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                {/* Animated gradient ring — outer conic-gradient, inner clipped by background-colored ring */}
                <div className="animate-spin-ring absolute inset-0 rounded-full" />
                <div className="relative w-[88px] h-[88px] rounded-full overflow-hidden shadow-lg shadow-accent/20 animate-float border-[3px] border-background">
                  <motion.img
                    src={character.imageUrl}
                    alt={character.name}
                    className="w-full h-full object-cover"
                    loading="eager"
                    initial={{ filter: "blur(20px)", scale: 1.15 }}
                    animate={{ filter: "blur(0px)", scale: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                  />
                </div>
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
                {/* Radial burst pulse rings */}
                <div className="relative flex justify-center h-10">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="absolute w-20 h-20 rounded-full border-2 border-accent/40 animate-radial-burst"
                      style={{ animationDelay: `${i * 0.45}s` }}
                    />
                  ))}
                </div>
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
                initial={{ opacity: 0, scale: 0.7, filter: "blur(12px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ type: "spring", stiffness: 150, damping: 18 }}
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
                    <div className="relative flex items-center justify-center w-36 h-36">
                      {/* Radial burst on reveal */}
                      {[0, 1].map((i) => (
                        <div
                          key={i}
                          className="absolute inset-0 rounded-full border-2 border-accent/30 animate-radial-burst"
                          style={{ animationDelay: `${i * 0.6}s` }}
                        />
                      ))}
                      {/* Animated gradient ring */}
                      <div className="animate-spin-ring absolute inset-0 rounded-full" />
                      <div className="relative w-[128px] h-[128px] rounded-full overflow-hidden shadow-xl shadow-accent/30 border-[4px] border-background">
                        <motion.img
                          src={character.imageUrl}
                          alt={character.name}
                          className="w-full h-full object-cover"
                          loading="eager"
                          initial={{ filter: "blur(24px)", scale: 1.15 }}
                          animate={{ filter: "blur(0px)", scale: 1 }}
                          transition={{ duration: 1.5, ease: "easeOut", delay: 0.1 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
                <motion.h1
                  initial={{ opacity: 0, scale: 0.7, filter: "blur(8px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  transition={{ type: "spring", stiffness: 150, damping: 18, delay: 0.15 }}
                  className="text-5xl md:text-6xl font-bold text-gradient-win"
                >
                  {character.name}
                </motion.h1>
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
                {guessNumber != null && guessNumber > 1 && (
                  <span className="block text-sm text-muted-foreground/60 mt-1">
                    Guess attempt #{guessNumber}
                  </span>
                )}
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={onCorrect}
                  size="lg"
                  className="flex-1 max-w-xs h-14 text-lg bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30 hover:scale-105 transition-transform"
                >
                  <CheckCircle size={24} weight="fill" className="mr-2" />
                  Yes! Correct
                </Button>
                <Button
                  onClick={onRejectGuess ?? onIncorrect}
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
