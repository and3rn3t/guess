import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XIcon } from "@phosphor-icons/react";
import type { WeeklyRecap } from "@/hooks/useWeeklyRecap";
import { useReducedMotion } from "framer-motion";

interface WeeklyRecapCardProps {
  recap: WeeklyRecap;
}

export function WeeklyRecapCard({ recap }: WeeklyRecapCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const reducedMotion = useReducedMotion();

  if (dismissed) return null;

  const winPct = Math.round(recap.winRate * 100);

  return (
    <AnimatePresence>
      <motion.div
        key="weekly-recap"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        className="rounded-xl border border-accent/30 bg-accent/8 p-4 relative"
        role="region"
        aria-label="Last week's recap"
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss weekly recap"
        >
          <XIcon size={16} />
        </button>

        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-3">
          📅 Last Week's Recap
        </p>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold text-foreground">{recap.gamesPlayed}</p>
            <p className="text-xs text-muted-foreground">Games</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{winPct}%</p>
            <p className="text-xs text-muted-foreground">Win Rate</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{recap.avgQuestions}</p>
            <p className="text-xs text-muted-foreground">Avg Q's</p>
          </div>
        </div>

        {recap.hardestCharacter && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Toughest win:{" "}
            <span className="font-medium text-foreground">
              {recap.hardestCharacter}
            </span>{" "}
            ({recap.hardestQuestions}q)
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
