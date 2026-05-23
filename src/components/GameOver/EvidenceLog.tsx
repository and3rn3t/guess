// Evidence log of answered questions — extracted from GameOver in RF.4.
// Shows each Q/A pair with the most-decisive question marked with a ★.

interface AnsweredQuestion {
  question: string;
  answer: string;
  eliminated?: number;
}

interface EvidenceLogProps {
  answeredQuestions: AnsweredQuestion[];
}

export function EvidenceLog({ answeredQuestions }: Readonly<EvidenceLogProps>) {
  const maxElim = Math.max(
    ...answeredQuestions.map((q) => q.eliminated ?? 0),
  );
  const decisiveIdx =
    maxElim > 0
      ? answeredQuestions.findIndex((q) => (q.eliminated ?? 0) === maxElim)
      : -1;

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/10 p-4 text-left">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
        Evidence Log
      </p>
      <ul className="space-y-1 max-h-48 overflow-y-auto">
        {answeredQuestions.map((q, i) => {
          const icon =
            q.answer === "yes" ? "✓" : q.answer === "no" ? "✗" : "?";
          const label =
            q.answer === "yes" ? "YES" : q.answer === "no" ? "NO" : "MBE";
          const color =
            q.answer === "yes"
              ? "text-emerald-400"
              : q.answer === "no"
                ? "text-rose-400"
                : "text-amber-400";
          const isDecisive = i === decisiveIdx;
          return (
            <li
              key={i}
              className={`flex gap-2 text-xs leading-relaxed font-mono${isDecisive ? " rounded px-1 -mx-1 bg-accent/10 border border-accent/20" : ""}`}
              title={
                isDecisive
                  ? `Most decisive — eliminated ${maxElim} candidates`
                  : undefined
              }
            >
              <span className={`shrink-0 font-bold ${color}`}>
                {icon} {label}
              </span>
              <span className="text-foreground/70 truncate">{q.question}</span>
              {isDecisive && (
                <span
                  className="ml-auto shrink-0 text-accent font-bold"
                  aria-label="Most decisive question"
                >
                  ★
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
