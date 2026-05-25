import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { RewriteCandidate } from "./questionsTypes";

interface RewriteCandidatesPanelProps {
  rewriteQueue: RewriteCandidate[];
  applyRewriteCandidate: (candidate: RewriteCandidate) => void;
  applyAllRewrites: () => void;
}

export function RewriteCandidatesPanel({
  rewriteQueue,
  applyRewriteCandidate,
  applyAllRewrites,
}: RewriteCandidatesPanelProps): React.JSX.Element | null {
  if (rewriteQueue.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-blue-500">
            Ranked Rewrite Queue
          </h3>
          <p className="text-xs text-muted-foreground">
            Sorted by lowest average quality score first, then highest usage.
          </p>
        </div>
        <Button size="sm" onClick={() => applyAllRewrites()}>
          Apply All Rewrites
        </Button>
      </div>
      <div className="space-y-2">
        {rewriteQueue.map((candidate) => (
          <div
            key={candidate.key}
            className="rounded-lg border border-border/70 bg-card p-3"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {candidate.key}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  uses: {candidate.usageCount}
                </span>
                <span className="text-xs text-muted-foreground">
                  avg score: {candidate.averageScore.toFixed(2)}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyRewriteCandidate(candidate)}
              >
                Apply Rewrite
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded border border-border bg-background p-2">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Current
                </p>
                <p className="text-xs text-foreground">
                  {candidate.originalText || "(empty)"}
                </p>
              </div>
              <div className="rounded border border-blue-500/30 bg-blue-500/5 p-2">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-blue-500">
                  Suggested
                </p>
                <p className="text-xs text-foreground">{candidate.rewriteText}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
