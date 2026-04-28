import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useKV } from "@/hooks/useKV";

interface CoachMarkProps {
  id: string;
  message: string;
  /** Number of completed games required before showing */
  showAfterGames: number;
  gamesPlayed: number;
}

export function CoachMark({
  id,
  message,
  showAfterGames,
  gamesPlayed,
}: CoachMarkProps) {
  const [dismissed, setDismissed] = useKV(`coach-${id}`, false);
  const [visible, setVisible] = useState(true);

  if (dismissed || !visible || gamesPlayed < showAfterGames) return null;

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2 rounded-lg bg-accent/15 border border-accent/30 px-3 py-2.5 text-sm text-accent"
        >
          <span className="flex-1">{message}</span>
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded p-1.5 hover:bg-accent/20 transition-colors touch-target"
            aria-label="Dismiss tip"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
