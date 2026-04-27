import { Button } from "@/components/ui/button";
import type { SharePayload } from "@/lib/sharing";
import { PlayIcon, SparkleIcon } from "@phosphor-icons/react";
import { Toaster } from "sonner";

const ANSWER_EMOJI: Record<string, string> = {
  yes: "🟢",
  no: "🔴",
  maybe: "🟡",
};

interface ChallengeViewProps {
  challenge: SharePayload;
  onPlay: () => void;
}

export function ChallengeView({ challenge, onPlay }: ChallengeViewProps) {
  const answerBar = challenge.steps
    .map((s) => ANSWER_EMOJI[s.answer] ?? "⚪")
    .join("");

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <SparkleIcon
            size={64}
            weight="fill"
            className="mx-auto text-accent animate-float"
          />
          <h1
            data-phase-focus
            tabIndex={-1}
            className="text-3xl font-bold text-foreground"
          >
            Challenge!
          </h1>
          <p className="text-muted-foreground text-lg">
            {challenge.won
              ? `Andernator figured out ${challenge.characterName} in ${challenge.questionCount} questions!`
              : `Someone stumped Andernator thinking of ${challenge.characterName}!`}
          </p>
          <div className="text-2xl tracking-wider">{answerBar}</div>
          <div className="flex flex-wrap gap-2 justify-center">
            <span className="inline-flex items-center rounded-full bg-accent/20 px-3 py-1 text-sm font-medium text-accent">
              {challenge.difficulty.charAt(0).toUpperCase() +
                challenge.difficulty.slice(1)}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
              {challenge.questionCount} questions
            </span>
          </div>
          <p className="text-foreground font-semibold text-lg">
            Can you do better?
          </p>
          <Button
            onClick={onPlay}
            size="lg"
            className="h-14 px-8 text-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg shadow-accent/20 hover:scale-105 transition-transform"
          >
            <PlayIcon size={24} weight="fill" className="mr-2" />
            Play Now
          </Button>
        </div>
      </div>
    </>
  );
}
