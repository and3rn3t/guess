import { motion } from "motion/react";
import {
  CheckCircle,
  Question as QuestionIcon,
  XCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type { AnswerValue } from "@/lib/types";

interface AnswerStripProps {
  onAnswer: (value: AnswerValue) => void;
  isProcessing: boolean;
  /** Show the skip link above the buttons */
  showSkip?: boolean;
  onSkip?: () => void;
  /** Show the give-up link above the buttons */
  showGiveUp?: boolean;
  onGiveUp?: () => void;
}

const BUTTONS: Array<{
  value: AnswerValue;
  label: string;
  icon: typeof CheckCircle;
  className: string;
}> = [
  {
    value: "yes",
    label: "Yes",
    icon: CheckCircle,
    className:
      "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30",
  },
  {
    value: "no",
    label: "No",
    icon: XCircle,
    className:
      "bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/30",
  },
  {
    value: "maybe",
    label: "Maybe",
    icon: QuestionIcon,
    className:
      "bg-amber-500 hover:bg-amber-400 text-white shadow-lg shadow-amber-500/30",
  },
  {
    value: "unknown",
    label: "?",
    icon: QuestionIcon,
    className:
      "bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-muted-foreground/30",
  },
];

export function AnswerStrip({
  onAnswer,
  isProcessing,
  showSkip,
  onSkip,
  showGiveUp,
  onGiveUp,
}: Readonly<AnswerStripProps>) {
  const hasLinks = (showSkip && onSkip) || (showGiveUp && onGiveUp);

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Skip / Give up links */}
      {hasLinks && (
        <div className="flex items-center justify-between px-4 pt-2 pb-0 text-xs text-muted-foreground">
          <span className="flex-1">
            {showSkip && onSkip && (
              <button
                onClick={onSkip}
                data-testid="skip-btn-strip"
                className="min-h-[32px] inline-flex items-center hover:text-foreground transition-colors underline-offset-2 hover:underline"
              >
                Skip question
              </button>
            )}
          </span>
          <span className="flex-1 text-right">
            {showGiveUp && onGiveUp && (
              <button
                onClick={onGiveUp}
                className="min-h-[32px] inline-flex items-center text-muted-foreground/60 hover:text-destructive transition-colors underline-offset-2 hover:underline"
              >
                Give up
              </button>
            )}
          </span>
        </div>
      )}

      {/* Answer buttons */}
      <div className="grid grid-cols-4 gap-2 p-3">
        {BUTTONS.map(({ value, label, icon: Icon, className }) => (
          <motion.div
            key={value}
            whileTap={{ scale: 0.93 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
          >
            <Button
              onClick={() => onAnswer(value)}
              disabled={isProcessing}
              aria-label={`Answer ${label}`}
              className={`w-full h-14 flex-col gap-0.5 text-xs font-medium transition-all duration-200 select-none ${className}`}
            >
              <Icon size={20} weight="fill" />
              {label}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
