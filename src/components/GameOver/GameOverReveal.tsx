// Reveal-character section of GameOver — extracted in RF.4.
// Asks the user what character they were thinking of; submits to onReveal.

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "motion/react";
import { useRef, useState } from "react";

export interface RevealResult {
  found: boolean;
  characterName?: string | null;
  attributesFilled?: number;
}

interface GameOverRevealProps {
  onReveal: (characterName: string) => Promise<RevealResult>;
}

export function GameOverReveal({ onReveal }: Readonly<GameOverRevealProps>) {
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<RevealResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (input.trim().length === 0 || status !== "idle") return;
    setStatus("loading");
    try {
      const r = await onReveal(input.trim());
      setResult(r);
    } catch {
      setResult({ found: false });
    } finally {
      setStatus("done");
    }
  };

  return (
    <div className="bg-linear-to-br from-primary/8 to-secondary/5 rounded-xl p-4 border border-primary/30 text-left space-y-3">
      {status === "done" && result ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-1"
        >
          {result.found ? (
            <>
              <p className="text-sm font-medium text-foreground">
                Got it —{" "}
                <span className="text-accent">{result.characterName}</span>!
              </p>
              <p className="text-xs text-muted-foreground">
                {result.attributesFilled
                  ? `Used your answers to fill in ${result.attributesFilled} attribute${result.attributesFilled === 1 ? "" : "s"}. I'll be smarter next time!`
                  : "Your answers have been recorded to help me improve!"}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                Thanks for telling me!
              </p>
              <p className="text-xs text-muted-foreground">
                {input} isn&apos;t in my database yet — your answers have been
                logged so they can be added.
              </p>
            </>
          )}
        </motion.div>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">
            Who were you thinking of?
          </p>
          <p className="text-xs text-muted-foreground">
            Your answer helps train me for future games.
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Character name…"
              disabled={status === "loading"}
              className="h-11 text-base"
              maxLength={200}
              autoComplete="off"
              inputMode="text"
              enterKeyHint="done"
              autoCapitalize="words"
              autoCorrect="on"
              onFocus={(e) => {
                const el = e.currentTarget;
                setTimeout(
                  () =>
                    el.scrollIntoView({ behavior: "smooth", block: "nearest" }),
                  300,
                );
              }}
            />
            <Button
              type="submit"
              size="sm"
              disabled={input.trim().length === 0 || status === "loading"}
              className="shrink-0"
            >
              {status === "loading" ? "Saving…" : "Submit"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
