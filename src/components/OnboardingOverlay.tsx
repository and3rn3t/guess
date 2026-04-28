import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { useKV } from "@/hooks/useKV";

const STEPS = [
  {
    title: "Answer Yes or No",
    body: "I'll ask questions about your character. Answer honestly — yes, no, maybe, or unknown.",
  },
  {
    title: "Watch Me Think",
    body: "The reasoning panel shows my thought process as I narrow down the possibilities.",
  },
  {
    title: "Confidence Meter",
    body: "Keep an eye on the progress bar — when I'm confident enough, I'll make my guess!",
  },
  {
    title: "Undo Mistakes",
    body: "Answered wrong? Use the Undo button to take back your last answer.",
  },
] as const;

interface OnboardingOverlayProps {
  onComplete: () => void;
}

export function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0);
  const [, setDone] = useKV("onboarding-complete", false);

  const finish = () => {
    setDone(true);
    onComplete();
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      finish();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.2 }}
          className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4"
        >
          {/* Step indicator */}
          <div className="flex gap-1.5 justify-center">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-accent" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-foreground">
              {STEPS[step].title}
            </h3>
            <p className="text-sm text-muted-foreground">{STEPS[step].body}</p>
          </div>

          <div className="flex gap-2 justify-center">
            <Button variant="ghost" size="sm" onClick={finish}>
              Skip
            </Button>
            <Button size="sm" onClick={next}>
              {step < STEPS.length - 1 ? "Next" : "Got it!"}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
