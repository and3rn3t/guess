import { motion, useReducedMotion } from "motion/react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ConfettiBurstProps {
  /** Number of questions asked in the won game. Tunes intensity:
   *  ≤ 5 = full burst, ≤ 10 = medium, > 10 = minimal. */
  questionsAsked?: number;
}

/** Lightweight confetti burst rendered over the GameOver card on a win.
 *  Scales by question count, reduces on mobile, and respects reduced-motion. */
export function ConfettiBurst({ questionsAsked }: ConfettiBurstProps) {
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();
  if (reduced) return null;

  const intensity =
    questionsAsked == null ? 1 : questionsAsked <= 5 ? 1 : questionsAsked <= 10 ? 0.6 : 0.2;
  const baseCount = isMobile ? 20 : 50;
  const count = Math.max(3, Math.round(baseCount * intensity));
  const spread = isMobile ? 280 : 480;
  const driftMax = isMobile ? 240 : 340;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={`confetti-${i}`}
          className="absolute w-2 h-2 rounded-full"
          style={{
            left: "50%",
            top: "30%",
            backgroundColor: [
              "#a78bfa",
              "#34d399",
              "#fbbf24",
              "#f472b6",
              "#60a5fa",
              "#38bdf8",
              "#e879f9",
            ][i % 7],
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
          animate={{
            x: (Math.random() - 0.5) * spread,
            y: Math.random() * driftMax + 50,
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
