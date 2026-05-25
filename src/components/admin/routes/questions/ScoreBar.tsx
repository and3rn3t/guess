import {
  SCORE_BAR_WIDTH_CLASSES,
  clampScore,
  scoreBarColor,
} from "./questionsHelpers";

export function ScoreBar({
  label,
  value,
}: Readonly<{
  label: string;
  value: number;
}>): React.JSX.Element {
  const clampedValue = clampScore(value);
  const color = scoreBarColor(value);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} ${SCORE_BAR_WIDTH_CLASSES[clampedValue]}`}
        />
      </div>
      <span className="w-6 text-right font-medium">{value}</span>
    </div>
  );
}
