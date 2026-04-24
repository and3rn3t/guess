import type { Difficulty } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PersonaOption {
  difficulty: Difficulty;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
}

const PERSONAS: PersonaOption[] = [
  {
    difficulty: "easy",
    name: "Poirot",
    emoji: "🎩",
    tagline: "Theatrical & precise",
    description: "20 questions · deliberate pace",
  },
  {
    difficulty: "medium",
    name: "Watson",
    emoji: "📓",
    tagline: "Warm & methodical",
    description: "15 questions · balanced",
  },
  {
    difficulty: "hard",
    name: "Sherlock",
    emoji: "🔍",
    tagline: "Terse & brilliant",
    description: "10 questions · intense",
  },
];

interface PersonaSelectorProps {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
}

export function PersonaSelector({ difficulty, setDifficulty }: Readonly<PersonaSelectorProps>) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-center text-muted-foreground/80 font-medium uppercase tracking-wide">
        Who's your detective?
      </p>
      <div
        className="grid grid-cols-3 gap-2"
        role="group"
        aria-label="Select detective persona"
      >
        {PERSONAS.map(({ difficulty: d, name, emoji, tagline, description }) => {
          const active = difficulty === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              aria-pressed={active}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-3 rounded-xl border transition-all text-center",
                active
                  ? "bg-accent/15 border-accent text-foreground shadow-sm shadow-accent/20"
                  : "bg-card/40 border-border/50 text-muted-foreground hover:border-accent/40 hover:text-foreground",
              )}
            >
              <span className="text-2xl leading-none" aria-hidden>
                {emoji}
              </span>
              <span className="text-sm font-semibold leading-tight">{name}</span>
              <span className="text-[10px] leading-tight opacity-70">{tagline}</span>
              <span
                className={cn(
                  "text-[10px] leading-tight mt-0.5",
                  active ? "text-accent font-medium" : "text-muted-foreground/60",
                )}
              >
                {description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
