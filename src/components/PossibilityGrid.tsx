import { memo, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users } from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import type { Character, Answer } from "@/lib/types";

interface PossibilityGridProps {
  characters: Character[];
  answers: Answer[];
  candidateScores?: Map<string, number>;
}

/**
 * Animated dot grid showing each character as a colored dot.
 * Eliminated characters fade out; remaining ones stay bright.
 * Tap/hover a dot to see the character name.
 */
export const PossibilityGrid = memo(function PossibilityGrid({ characters, answers, candidateScores }: PossibilityGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tappedId, setTappedId] = useState<string | null>(null);

  const activeId = tappedId ?? hoveredId;

  const handleTap = useCallback((charId: string) => {
    setTappedId((prev) => (prev === charId ? null : charId));
  }, []);

  const statusMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const char of characters) {
      let alive = true;
      for (const answer of answers) {
        const attr = char.attributes[answer.questionId];
        if (answer.value === "yes" && attr === false) {
          alive = false;
          break;
        }
        if (answer.value === "no" && attr === true) {
          alive = false;
          break;
        }
      }
      map.set(char.id, alive);
    }
    return map;
  }, [characters, answers]);

  const aliveCount = useMemo(
    () => [...statusMap.values()].filter(Boolean).length,
    [statusMap],
  );

  if (characters.length === 0) return null;

  // Category colors for visual variety
  const categoryColors: Record<string, string> = {
    "video-games": "#a78bfa",
    movies: "#f472b6",
    anime: "#34d399",
    comics: "#60a5fa",
    books: "#fbbf24",
    cartoons: "#fb923c",
    "tv-shows": "#c084fc",
    "pop-culture": "#f87171",
  };

  return (
    <Card className="p-4 bg-card/50 backdrop-blur-sm border border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <Users size={18} weight="bold" className="text-accent" />
        <h4 className="text-sm font-semibold text-foreground">
          Character Grid
        </h4>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {aliveCount}/{characters.length} alive
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 sm:gap-1 relative">
        <AnimatePresence>
          {characters.map((char) => {
            const alive = statusMap.get(char.id) ?? true;
            const color = categoryColors[char.category] ?? "#a78bfa";
            const prob = candidateScores?.get(char.id);
            const opacity = !alive
              ? 0.15
              : prob !== undefined
              ? 0.3 + (prob / 100) * 0.7
              : 0.5;
            const scale = !alive
              ? 0.7
              : prob !== undefined
              ? 0.7 + (prob / 100) * 0.5
              : 0.85;
            const tooltipExtra = prob !== undefined ? ` (${Math.round(prob)}%)` : !alive ? ' ✕' : '';
            return (
              <motion.button
                key={char.id}
                layout
                initial={{ opacity: 1, scale: 1 }}
                animate={{ opacity, scale }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="relative w-6 h-6 sm:w-4 sm:h-4 rounded-full cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                style={{ backgroundColor: color }}
                onClick={() => handleTap(char.id)}
                onMouseEnter={() => setHoveredId(char.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(char.id)}
                onBlur={() => setHoveredId(null)}
                aria-label={`${char.name}${!alive ? ' (eliminated)' : ''}`}
              >
                {activeId === char.id && (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-popover text-popover-foreground text-xs font-medium whitespace-nowrap shadow-md border border-border z-10 pointer-events-none"
                  >
                    {char.name}{tooltipExtra}
                  </motion.span>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </Card>
  );
});
