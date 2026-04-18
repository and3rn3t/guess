import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KV_TOKEN_USAGE } from "@/lib/constants";
import { ArrowLeft } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

interface TokenUsage {
  timestamp: number;
  promptTokens: number;
  completionTokens: number;
  model: string;
  endpoint: string;
}

function getUsageHistory(): TokenUsage[] {
  try {
    const raw = localStorage.getItem(KV_TOKEN_USAGE);
    return raw ? (JSON.parse(raw) as TokenUsage[]) : [];
  } catch {
    return [];
  }
}

const COST_PER_1K: Record<string, { prompt: number; completion: number }> = {
  "gpt-4o-mini": { prompt: 0.00015, completion: 0.0006 },
  "gpt-4o": { prompt: 0.005, completion: 0.015 },
};

interface CostDashboardProps {
  onBack: () => void;
}

export function CostDashboard({ onBack }: CostDashboardProps) {
  const [history, setHistory] = useState<TokenUsage[]>([]);

  useEffect(() => {
    setHistory(getUsageHistory());
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const todayUsage = history.filter((u) => u.timestamp >= todayMs);
  const totalPromptTokens = todayUsage.reduce((s, u) => s + u.promptTokens, 0);
  const totalCompletionTokens = todayUsage.reduce(
    (s, u) => s + u.completionTokens,
    0,
  );

  const estimatedCost = todayUsage.reduce((total, u) => {
    const rates = COST_PER_1K[u.model] || COST_PER_1K["gpt-4o-mini"];
    return (
      total +
      (u.promptTokens / 1000) * rates.prompt +
      (u.completionTokens / 1000) * rates.completion
    );
  }, 0);

  // Group by endpoint
  const byEndpoint = todayUsage.reduce<
    Record<string, { calls: number; tokens: number }>
  >((acc, u) => {
    const key = u.endpoint || "unknown";
    if (!acc[key]) acc[key] = { calls: 0, tokens: 0 };
    acc[key].calls++;
    acc[key].tokens += u.promptTokens + u.completionTokens;
    return acc;
  }, {});

  // 7-day trend
  const dailyTotals = Array.from({ length: 7 }, (_, i) => {
    const dayStart = todayMs - (6 - i) * 86400000;
    const dayEnd = dayStart + 86400000;
    const dayUsage = history.filter(
      (u) => u.timestamp >= dayStart && u.timestamp < dayEnd,
    );
    return {
      day: new Date(dayStart).toLocaleDateString("en", { weekday: "short" }),
      tokens: dayUsage.reduce(
        (s, u) => s + u.promptTokens + u.completionTokens,
        0,
      ),
    };
  });

  const maxTokens = Math.max(...dailyTotals.map((d) => d.tokens), 1);

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
          <ArrowLeft size={18} />
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
            {todayUsage.length} API calls today
          </p>
        </Card>

        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Requests by Endpoint</p>
          <div className="mt-2 space-y-1">
            {Object.entries(byEndpoint).map(([endpoint, data]) => (
              <div key={endpoint} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{endpoint}</span>
                <Badge variant="secondary">{data.calls} calls</Badge>
              </div>
            ))}
            {Object.keys(byEndpoint).length === 0 && (
              <p className="text-sm text-muted-foreground">No calls today</p>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          7-Day Trend
        </h3>
        <div className="flex items-end gap-2 h-32">
          {dailyTotals.map((d) => (
            <div
              key={d.day}
              className="flex-1 flex flex-col items-center gap-1"
            >
              <div
                className="w-full bg-accent/60 rounded-t"
                style={{
                  height: `${(d.tokens / maxTokens) * 100}%`,
                  minHeight: d.tokens > 0 ? "4px" : "0",
                }}
              />
              <span className="text-xs text-muted-foreground">{d.day}</span>
            </div>
          ))}
        </div>
      </Card>

      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          localStorage.removeItem(KV_TOKEN_USAGE);
          setHistory([]);
        }}
      >
        Clear Usage History
      </Button>
    </div>
  );
}
