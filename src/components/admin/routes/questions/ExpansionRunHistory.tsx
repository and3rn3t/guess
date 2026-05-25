import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { ExpansionRun, RunModeFilter, RunStatusFilter } from "./questionsTypes";

interface ExpansionRunHistoryProps {
  visibleExpansionRuns: ExpansionRun[];
  runStatusFilter: RunStatusFilter;
  setRunStatusFilter: (value: RunStatusFilter) => void;
  runModeFilter: RunModeFilter;
  setRunModeFilter: (value: RunModeFilter) => void;
  expanding: boolean;
  fetchExpansionHistory: () => void;
}

export function ExpansionRunHistory({
  visibleExpansionRuns,
  runStatusFilter,
  setRunStatusFilter,
  runModeFilter,
  setRunModeFilter,
  expanding,
  fetchExpansionHistory,
}: ExpansionRunHistoryProps): React.JSX.Element {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          Question Expansion Runs
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={runStatusFilter}
            onChange={(event) =>
              setRunStatusFilter(event.target.value as RunStatusFilter)
            }
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Filter runs by status"
          >
            <option value="all">All status</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
          <select
            value={runModeFilter}
            onChange={(event) =>
              setRunModeFilter(event.target.value as RunModeFilter)
            }
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Filter runs by mode"
          >
            <option value="all">All modes</option>
            <option value="dry-run">Dry-run</option>
            <option value="apply">Apply</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRunStatusFilter("all");
              setRunModeFilter("all");
            }}
            disabled={runStatusFilter === "all" && runModeFilter === "all"}
          >
            Clear
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchExpansionHistory()}
            disabled={expanding}
          >
            Refresh
          </Button>
        </div>
      </div>
      {visibleExpansionRuns.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No expansion runs recorded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {visibleExpansionRuns.slice(0, 8).map((run) => (
            <div
              key={run.requestId}
              className="rounded-lg border border-border/60 px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      run.status === "success" ? "secondary" : "destructive"
                    }
                  >
                    {run.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {new Date(run.createdAt).toLocaleString()}
                  </span>
                </div>
                <Badge variant="outline">
                  {run.dryRun ? "dry-run" : "apply"}
                </Badge>
              </div>
              <div className="mt-1 text-muted-foreground">
                targets: {run.targetAttributes} · candidates: {run.candidates}{" "}
                · inserted: {run.inserted}
              </div>
              {run.error && (
                <div className="mt-1 text-destructive">{run.error}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
