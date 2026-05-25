import { cn } from "@/lib/utils";

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: "bg-green-500/15 text-green-600 border-green-500/30",
  medium: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  hard: "bg-red-500/15 text-red-600 border-red-500/30",
};

export function DifficultyBadge({
  difficulty,
}: Readonly<{
  difficulty: string | null;
}>): React.JSX.Element {
  if (!difficulty)
    return <span className="text-xs text-muted-foreground/50">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        DIFFICULTY_STYLES[difficulty] ??
          "bg-muted text-muted-foreground border-border",
      )}
    >
      {difficulty}
    </span>
  );
}
