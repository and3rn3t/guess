import { llmStream, LlmError } from "@/lib/llm";
import { suspectDescription_v1 } from "@/lib/prompts";
import type { Persona } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";

interface Candidate {
  name: string;
  probability: number;
}

interface SuspectDescriptionOverlayProps {
  topCandidates: Candidate[];
  confidence: number;
  answeredQuestions: Array<{ question: string; answer: string }>;
  persona?: Persona;
  /** Called when the description stream completes — transition to guess reveal */
  onReveal: () => void;
}

/**
 * C.1: At ~85% confidence, stream a 2-sentence prose description of the suspected
 * character WITHOUT naming them. Builds suspense before the final reveal.
 */
export function SuspectDescriptionOverlay({
  topCandidates,
  confidence,
  answeredQuestions,
  persona,
  onReveal,
}: Readonly<SuspectDescriptionOverlayProps>) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { system, user } = suspectDescription_v1(
      topCandidates,
      confidence,
      answeredQuestions,
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
          setText(accumulated);
        }
      } catch (e) {
        if (e instanceof LlmError) {
          console.warn("SuspectDescriptionOverlay: stream failed", e.code);
        }
      } finally {
        setDone(true);
      }
    };
    run();

    return () => controller.abort();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      <motion.div
        key="suspect-overlay"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.35 }}
        className="max-w-xl mx-auto text-center space-y-5 py-6"
      >
        <motion.div
          animate={{ rotate: [0, -5, 5, -3, 3, 0] }}
          transition={{ duration: 1.2, delay: 0.3 }}
          className="flex justify-center"
        >
          <MagnifyingGlass
            size={48}
            weight="duotone"
            className="text-accent"
            aria-hidden
          />
        </motion.div>

        <p className="text-sm font-semibold uppercase tracking-widest text-accent/70">
          I have a suspect…
        </p>

        <p
          className="text-lg md:text-xl leading-relaxed text-foreground font-medium min-h-[3.5rem]"
          aria-live="polite"
          aria-atomic="false"
        >
          {text}
          {!done && (
            <span className="inline-block w-1 h-4 ml-0.5 bg-accent animate-pulse rounded-sm align-middle" />
          )}
        </p>

        {done && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            onClick={onReveal}
            className="mt-2 px-6 py-2.5 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 transition-colors shadow-md shadow-accent/20"
          >
            Reveal my guess →
          </motion.button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
