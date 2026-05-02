import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fetchAdminCosts, type DailyCostUsage } from "@/lib/admin/costApi";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

const COST_PER_1K: Record<string, { prompt: number; completion: number }> = {
  "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
  "gpt-4o": { prompt: 0.005, completion: 0.015 },
};

interface CostDashboardProps {
  onBack: () => void;
}

export function CostDashboard({ onBack }: Readonly<CostDashboardProps>) {
  const [history, setHistory] = useState<DailyCostUsage[]>([]);
  const [todayUsage, setTodayUsage] = useState<DailyCostUsage>({
    date: '',
    promptTokens: 0,
    completionTokens: 0,
    calls: 0,
  });
  const [todayCalls, setTodayCalls] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await fetchAdminCosts(7);
        if (!active) return;
        setHistory(data.history);
        setTodayUsage(data.today);
        setTodayCalls(data.today.calls);
        setErrorMessage(null);
      } catch {
        if (!active) return;
        setHistory([]);
        setTodayUsage({
          date: '',
          promptTokens: 0,
          completionTokens: 0,
          calls: 0,
        });
        setTodayCalls(0);
        setErrorMessage("Failed to load cost summary");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const totalPromptTokens = todayUsage.promptTokens;
  const totalCompletionTokens = todayUsage.completionTokens;

  const rates = COST_PER_1K["gpt-4o-mini"];
  const estimatedCost =
    (totalPromptTokens / 1000) * rates.prompt
    + (totalCompletionTokens / 1000) * rates.completion;

  const dailyTotals = history.map((entry) => ({
    day: new Date(`${entry.date}T00:00:00Z`).toLocaleDateString("en", {
      weekday: "short",
      timeZone: "UTC",
    }),
    tokens: entry.promptTokens + entry.completionTokens,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            LLM Cost Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">
            Token usage and cost tracking
          </p>
        </div>
        <Button onClick={onBack} variant="outline" className="gap-2">
          <ArrowLeftIcon size={18} />
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Today's Tokens</p>
          <p className="text-3xl font-bold text-foreground mt-1">
            {(totalPromptTokens + totalCompletionTokens).toLocaleString()}
          </p>
          <div className="text-xs text-muted-foreground mt-2">
            <span>Prompt: {totalPromptTokens.toLocaleString()}</span>
            <span className="mx-2">·</span>
            <span>Completion: {totalCompletionTokens.toLocaleString()}</span>
          </div>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Estimated Cost</p>
          <p className="text-3xl font-bold text-foreground mt-1">
            ${estimatedCost.toFixed(4)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {todayCalls} API calls today
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Data Source</p>
          <div className="mt-2 space-y-1">
            <Badge variant="secondary">Server KV Rollup</Badge>
            <p className="text-xs text-muted-foreground">
              Derived from per-user daily LLM usage records.
            </p>
          </div>
        </Card>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading cost summary...</p>
      )}
      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          7-Day Trend
        </h3>
        <div className="space-y-2">
          {dailyTotals.map((d) => (
            <div key={d.day} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{d.day}</span>
              <Badge variant="secondary">{d.tokens.toLocaleString()} tokens</Badge>
            </div>
          ))}
          {dailyTotals.length === 0 && (
            <p className="text-sm text-muted-foreground">No usage in this period</p>
          )}
        </div>
      </Card>
    </div>
  );
}
