import { llmStream, LlmError } from "@/lib/llm";
import { reformulateForSelf, selfMatchNarrative_v1 } from "@/lib/prompts";
import type { Character, Persona, Question } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowRight, CheckCircle, XCircle, Minus } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

interface SelfAnswer {
  question: string;
  attribute: string;
  answer: "yes" | "no" | "maybe";
}

type DescribePhase = "questions" | "matching" | "result";

interface DescribeYourselfScreenProps {
  questions: Question[];
  characters: Character[];
  persona?: Persona;
  onClose: () => void;
}

/**
 * Phase 7: "Describe Yourself" mode.
 * Player answers yes/no questions about themselves; AI finds their closest character match.
 */
export function DescribeYourselfScreen({
  questions,
  characters,
  persona,
  onClose,
}: Readonly<DescribeYourselfScreenProps>) {
  const [phase, setPhase] = useState<DescribePhase>("questions");
  const [idx, setIdx] = useState(0);
  const [selfAnswers, setSelfAnswers] = useState<SelfAnswer[]>([]);
  const [topMatch, setTopMatch] = useState<{ character: Character; score: number } | null>(null);
  const [narrative, setNarrative] = useState("");
  const [narrativeDone, setNarrativeDone] = useState(false);

  // Use a fixed subset of questions (first 10 with text)
  const pool = questions.filter((q) => q.text).slice(0, 10);

  const currentQ = pool[idx];
  const progress = idx / pool.length;

  const handleAnswer = useCallback(
    (answer: "yes" | "no" | "maybe") => {
      const newAnswer: SelfAnswer = {
        question: currentQ.text,
        attribute: currentQ.attribute,
        answer,
      };
      const next = [...selfAnswers, newAnswer];
      setSelfAnswers(next);

      if (idx + 1 >= pool.length) {
        // Done with questions — find best match
        const scored = characters.map((char) => {
          let matches = 0;
          let total = 0;
          for (const a of next) {
            const charVal = char.attributes[a.attribute];
            if (charVal === null || charVal === undefined) continue;
            total++;
            const answerBool = a.answer === "yes";
            if (charVal === answerBool) matches++;
          }
          return { character: char, score: total > 0 ? matches / total : 0 };
        });
        scored.sort((a, b) => b.score - a.score);
        setTopMatch(scored[0] ?? null);
        setPhase("matching");
      } else {
        setIdx((i) => i + 1);
      }
    },
    [currentQ, selfAnswers, idx, pool.length, characters],
  );

  // Stream narrative when we have a match
  useEffect(() => {
    if (phase !== "matching" || !topMatch) return;

    const { system, user } = selfMatchNarrative_v1(
      topMatch.character.name,
      topMatch.score,
      selfAnswers.map((a) => ({ question: a.question, answer: a.answer })),
      persona,
    );

    let accumulated = "";
    const controller = new AbortController();

    const run = async () => {
      try {
        for await (const token of llmStream({
          prompt: user,
          model: "gpt-4o-mini",
          systemPrompt: system,
          signal: controller.signal,
        })) {
          accumulated += token;
          setNarrative(accumulated);
        }
      } catch (e) {
        if (e instanceof LlmError) {
          console.warn("DescribeYourself: narrative failed", e.code);
        }
      } finally {
        setNarrativeDone(true);
        setPhase("result");
      }
    };
    run();

    return () => controller.abort();
  }, [phase, topMatch]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      key="describe-yourself"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="max-w-xl mx-auto space-y-6 py-4"
    >
      {/* Header */}
      <div className="text-center space-y-1">
        <h2
          data-phase-focus
          tabIndex={-1}
          className="text-2xl md:text-3xl font-bold text-foreground focus:outline-none"
        >
          Describe Yourself
        </h2>
        <p className="text-sm text-muted-foreground">
          Answer honestly — I'll find your character match.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {phase === "questions" && currentQ && (
          <motion.div
            key={`q-${idx}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Progress bar */}
            <div className="w-full h-1.5 bg-border/40 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-accent rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-6 text-center space-y-4">
              <p className="text-xs text-muted-foreground/70 uppercase tracking-wide">
                Question {idx + 1} of {pool.length}
              </p>
              <p className="text-lg md:text-xl font-semibold text-foreground leading-snug">
                {reformulateForSelf(currentQ.displayText ?? currentQ.text)}
              </p>

              <div className="flex justify-center gap-3 pt-2">
                <AnswerButton
                  icon={<CheckCircle size={20} weight="fill" />}
                  label="Yes"
                  onClick={() => handleAnswer("yes")}
                  variant="yes"
                />
                <AnswerButton
                  icon={<Minus size={20} weight="bold" />}
                  label="Sort of"
                  onClick={() => handleAnswer("maybe")}
                  variant="maybe"
                />
                <AnswerButton
                  icon={<XCircle size={20} weight="fill" />}
                  label="No"
                  onClick={() => handleAnswer("no")}
                  variant="no"
                />
              </div>
            </div>
          </motion.div>
        )}

        {(phase === "matching" || phase === "result") && (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-6 space-y-4 text-center"
          >
            {topMatch && (
              <>
                {topMatch.character.imageUrl && (
                  <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-accent/40 mx-auto shadow-lg">
                    <img
                      src={topMatch.character.imageUrl}
                      alt={topMatch.character.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent/70">
                    You are most like…
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {topMatch.character.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(topMatch.score * 100)}% match
                  </p>
                </div>

                <p
                  className="text-base leading-relaxed text-foreground/90 min-h-[3rem]"
                  aria-live="polite"
                  aria-atomic="false"
                >
                  {narrative}
                  {!narrativeDone && (
                    <span className="inline-block w-1 h-4 ml-0.5 bg-accent animate-pulse rounded-sm align-middle" />
                  )}
                </p>
              </>
            )}

            {narrativeDone && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={onClose}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors"
              >
                Back to game
                <ArrowRight size={16} weight="bold" />
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Internal sub-component
// ---------------------------------------------------------------------------

interface AnswerButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant: "yes" | "no" | "maybe";
}

function AnswerButton({ icon, label, onClick, variant }: Readonly<AnswerButtonProps>) {
  const colors: Record<string, string> = {
    yes: "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20",
    no: "bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20",
    maybe: "bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl border font-medium text-sm transition-all",
        colors[variant],
      )}
    >
      {icon}
      {label}
    </button>
  );
}
