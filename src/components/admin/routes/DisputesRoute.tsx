import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  WarningOctagonIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

interface Dispute {
  id: number;
  character_id: string;
  character_name: string | null;
  attribute_key: string;
  current_value: number | null;
  dispute_reason: string;
  confidence: number;
  disputed_by: string;
  created_at: number;
  status: "open" | "resolved" | "dismissed";
  resolved_by: string | null;
  resolved_at: number | null;
}

interface PageData {
  disputes: Dispute[];
  total: number;
  page: number;
  pageSize: number;
}

type Filter = "open" | "resolved" | "dismissed" | "all";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  resolved: "bg-green-500/20 text-green-400 border-green-500/30",
  dismissed: "bg-muted text-muted-foreground",
};

const VALUE_LABEL: Record<string, string> = {
  "1": "true",
  "0": "false",
  null: "unknown",
};

interface ResolveTarget {
  id: number;
  characterId: string;
  attributeKey: string;
}

export default function DisputesRoute(): React.JSX.Element {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState<number | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ResolveTarget | null>(null);
  const [correctedValue, setCorrectedValue] = useState<1 | 0 | null>(1);
  const [resolving, setResolving] = useState(false);
  const pageSize = 25;

  const fetchData = async (f: Filter, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: f,
        page: String(p),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/admin/attribute-disputes?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData(filter, page);
  }, [filter, page]);

  const action = async (id: number, status: "dismissed") => {
    setActing(id);
    try {
      const res = await fetch("/api/admin/attribute-disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      await fetchData(filter, page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActing(null);
    }
  };

  const resolveAction = async () => {
    if (!resolveTarget) return;
    setResolving(true);
    try {
      // 1. Apply corrected value to character_attributes
      const patchRes = await fetch(
        `/api/admin/characters/${encodeURIComponent(resolveTarget.characterId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attributeKey: resolveTarget.attributeKey,
            value: correctedValue,
          }),
        }
      );
      if (!patchRes.ok) {
        const body = (await patchRes.json()) as { error?: string };
        throw new Error(body.error ?? `Character patch failed: ${patchRes.status}`);
      }
      // 2. Mark dispute resolved
      const disputeRes = await fetch("/api/admin/attribute-disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resolveTarget.id, status: "resolved" }),
      });
      if (!disputeRes.ok) throw new Error(`Dispute update failed: ${disputeRes.status}`);
      setResolveTarget(null);
      await fetchData(filter, page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setResolving(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;
  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Attribute Disputes</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-1">
              {data.total} disputes
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {(["open", "resolved", "dismissed", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? "bg-violet-600 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-5 animate-pulse h-24"
            />
          ))}
        </div>
      )}

      {!loading && data?.total === 0 && (
        <div className="rounded-xl border bg-card px-6 py-12 text-center space-y-3">
          <WarningOctagonIcon
            size={40}
            className="mx-auto text-muted-foreground/40"
          />
          <p className="text-muted-foreground text-sm">
            {filter === "open"
              ? "No open disputes. Run enrich with --validate to generate adversarial checks."
              : `No ${filter} disputes.`}
          </p>
        </div>
      )}

      {!loading && (data?.total ?? 0) > 0 && (
        <>
          <div className="space-y-3">
          {(data?.disputes ?? []).map((d) => (
            <div key={d.id} className="rounded-xl border bg-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">
                      {d.character_name ?? d.character_id}
                    </span>
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                      {d.attribute_key}
                    </code>
                    <Badge
                      className={`text-xs ${STATUS_STYLES[d.status] ?? ""}`}
                    >
                      {d.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      current:{" "}
                      <span className="font-mono">
                        {VALUE_LABEL[String(d.current_value)] ?? "?"}
                      </span>
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {d.dispute_reason}
                  </p>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>confidence: {(d.confidence * 100).toFixed(0)}%</span>
                    <span>by {d.disputed_by}</span>
                    <span>{formatDate(d.created_at)}</span>
                    {d.resolved_by && <span>resolved by {d.resolved_by}</span>}
                  </div>
                </div>
                {d.status === "open" && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-400 border-green-500/40 hover:bg-green-500/10"
                      disabled={acting === d.id || resolving}
                      onClick={() => {
                        setCorrectedValue(d.current_value === 1 ? 0 : 1);
                        setResolveTarget({
                          id: d.id,
                          characterId: d.character_id,
                          attributeKey: d.attribute_key,
                        });
                      }}
                    >
                      <CheckCircleIcon size={14} className="mr-1.5" />
                      Resolve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-muted-foreground"
                      disabled={acting === d.id || resolving}
                      onClick={() => void action(d.id, "dismissed")}
                    >
                      <XCircleIcon size={14} className="mr-1.5" />
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
              {/* Inline resolution panel */}
              {resolveTarget?.id === d.id && (
                <div className="mt-2 p-3 rounded-lg bg-muted/50 border border-border space-y-3">
                  <p className="text-sm font-medium">
                    Set corrected value for{" "}
                    <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
                      {d.attribute_key}
                    </code>
                  </p>
                  <div className="flex gap-2">
                    {([1, 0, null] as (1 | 0 | null)[]).map((v) => (
                      <button
                        key={String(v)}
                        onClick={() => setCorrectedValue(v)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                          correctedValue === v
                            ? "bg-violet-600 text-white border-violet-600"
                            : "bg-background text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {v === 1 ? "true" : v === 0 ? "false" : "unknown (remove)"}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={resolving} onClick={() => void resolveAction()}>
                      {resolving ? "Applying\u2026" : "Confirm resolve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resolving}
                      onClick={() => setResolveTarget(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ArrowLeftIcon size={14} className="mr-1.5" />
            Prev
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ArrowRightIcon size={14} className="ml-1.5" />
          </Button>
        </div>
        </>
      )}
    </div>
  );
}
