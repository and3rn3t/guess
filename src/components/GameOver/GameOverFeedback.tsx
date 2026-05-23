// Feedback section of GameOver — extracted in RF.4.
// Self-contained: owns rating + text state and the loading lifecycle.

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

interface GameOverFeedbackProps {
  onSubmitFeedback: (rating: number, feedbackText?: string) => Promise<void>;
}

export function GameOverFeedback({
  onSubmitFeedback,
}: Readonly<GameOverFeedbackProps>) {
  const [rating, setRating] = useState<number>(0);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  const submit = async () => {
    if (rating < 1 || status !== "idle") return;
    setStatus("loading");
    try {
      await onSubmitFeedback(rating, text.trim() || undefined);
      setStatus("done");
      toast.success("Thanks for the feedback!");
    } catch {
      setStatus("idle");
      toast.error("Could not save feedback right now.");
    }
  };

  return (
    <div className="bg-linear-to-br from-secondary/20 to-secondary/5 rounded-xl p-4 border border-border/60 text-left space-y-3">
      <p className="text-sm font-medium text-foreground">How was this round?</p>
      {status === "done" ? (
        <p className="text-xs text-muted-foreground">
          Feedback saved. This helps tune question quality.
        </p>
      ) : (
        <>
          <div
            className="grid grid-cols-5 gap-2"
            role="radiogroup"
            aria-label="Game rating"
          >
            {[1, 2, 3, 4, 5].map((r) => (
              <Button
                key={r}
                type="button"
                variant={rating === r ? "default" : "outline"}
                className="h-10"
                onClick={() => setRating(r)}
                aria-pressed={rating === r}
              >
                {r}
              </Button>
            ))}
          </div>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Optional: what felt off or great?"
            maxLength={300}
            disabled={status === "loading"}
          />
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={rating < 1 || status === "loading"}
            className="w-full sm:w-auto"
          >
            {status === "loading" ? "Saving feedback..." : "Send Feedback"}
          </Button>
        </>
      )}
    </div>
  );
}
