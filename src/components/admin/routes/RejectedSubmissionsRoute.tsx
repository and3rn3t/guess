/**
 * AI.6 — Admin UI for the moderation-rejection review queue.
 *
 * Consumes `GET /api/admin/community/rejected` (paginated list of payloads
 * blocked by the LDNOOBW fast-path or Llama-Guard escalation) and
 * `PATCH /api/admin/community/rejected` (mark a row reviewed).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ShieldCheckIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ArrowsClockwiseIcon,
} from "@phosphor-icons/react";
import { AdminPageHeader } from "../AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ADMIN_API_ENDPOINTS } from "@/lib/constants";
import { JSON_CONTENT_TYPE } from "@/lib/http";

interface RejectionRow {
  id: number;
  source: string;
  reason: string;
  payload: string;
  actor_id: string | null;
  reviewed: number;
  reviewed_by: string | null;
  reviewed_at: number | null;
  created_at: number;
}

interface RejectionsResponse {
  rejections: RejectionRow[];
  total: number;
  page: number;
  pageSize: number;
}

type StatusFilter = "pending" | "reviewed" | "all";
type SourceFilter = "" | "v2/characters" | "admin/proposed-attributes" | "v2/game/feedback";

const PAGE_SIZE = 25;

const STATUS_OPTIONS: ReadonlyArray<{ label: string; value: StatusFilter }> = [
  { label: "Pending", value: "pending" },
  { label: "Reviewed", value: "reviewed" },
  { label: "All", value: "all" },
];

const SOURCE_OPTIONS: ReadonlyArray<{ label: string; value: SourceFilter }> = [
  { label: "All sources", value: "" },
  { label: "Character submissions", value: "v2/characters" },
  { label: "Proposed attributes", value: "admin/proposed-attributes" },
  { label: "Game feedback", value: "v2/game/feedback" },
];

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

function formatRelative(ms: number): string {
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86_400)}d ago`;
}

function reasonBadge(reason: string): React.JSX.Element {
  if (reason === "ldnoobw") return <Badge variant="destructive">LDNOOBW</Badge>;
  if (reason.startsWith("llama-guard:")) {
    const codes = reason.slice("llama-guard:".length).toUpperCase();
    return <Badge variant="destructive">Llama-Guard {codes}</Badge>;
  }
  if (reason === "empty") return <Badge variant="outline">Empty</Badge>;
  if (reason === "ai-binding-missing") return <Badge variant="secondary">No AI binding</Badge>;
  if (reason === "llama-guard-error") return <Badge variant="secondary">Guard error</Badge>;
  return <Badge variant="outline">{reason}</Badge>;
}

function sourceBadge(source: string): React.JSX.Element {
  const labels: Record<string, string> = {
    "v2/characters": "Character",
    "admin/proposed-attributes": "Proposed attr",
    "v2/game/feedback": "Feedback",
  };
  return <Badge variant="outline">{labels[source] ?? source}</Badge>;
}

export default function RejectedSubmissionsRoute(): React.JSX.Element {
  const [data, setData] = useState<RejectionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [source, setSource] = useState<SourceFilter>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(ADMIN_API_ENDPOINTS.communityRejected, globalThis.location.origin);
      url.searchParams.set("status", status);
      if (source) url.searchParams.set("source", source);
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", String(PAGE_SIZE));
      const res = await fetch(url.pathname + url.search);
      if (!res.ok) throw new Error(`${res.status}`);
      setData((await res.json()) as RejectionsResponse);
    } catch (err) {
      toast.error(`Failed to load rejections: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [page, status, source]);

  useEffect(() => {
    void load();
  }, [load]);

  const markReviewed = async (id: number) => {
    setActing(id);
    try {
      const res = await fetch(ADMIN_API_ENDPOINTS.communityRejected, {
        method: "PATCH",
        headers: JSON_CONTENT_TYPE,
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.success("Marked reviewed");
      await load();
    } catch (err) {
      toast.error(`Failed to mark reviewed: ${(err as Error).message}`);
    } finally {
      setActing(null);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  let totalLabel = "";
  if (data) {
    const noun = data.total === 1 ? "rejection" : "rejections";
    totalLabel = `${data.total.toLocaleString()} ${noun}`;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Rejected submissions"
        subtitle="Payloads blocked by the moderation gate (AI.6) — LDNOOBW fast-path + Llama-Guard escalation"
        icon={<ShieldCheckIcon weight="duotone" className="w-5 h-5" />}
        sectionColor="violet"
      />

      <div className="rounded-lg border border-border/40 bg-card/30">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/40 px-4 py-3">
          <span className="text-sm font-medium">Status:</span>
          {STATUS_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={status === opt.value ? "default" : "outline"}
              onClick={() => {
                setStatus(opt.value);
                setPage(1);
              }}
            >
              {opt.label}
            </Button>
          ))}
          <span className="ml-4 text-sm font-medium">Source:</span>
          <select
            aria-label="Filter by source"
            className="rounded-md border border-border/40 bg-background px-2 py-1 text-sm"
            value={source}
            onChange={(e) => {
              setSource(e.target.value as SourceFilter);
              setPage(1);
            }}
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void load()}
            disabled={loading}
            className="ml-auto"
          >
            <ArrowsClockwiseIcon className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <div className="text-xs text-muted-foreground">{totalLabel}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Source</th>
                <th className="px-4 py-2 text-left font-medium">Reason</th>
                <th className="px-4 py-2 text-left font-medium">Payload</th>
                <th className="px-4 py-2 text-left font-medium">Actor</th>
                <th className="px-4 py-2 text-left font-medium">When</th>
                <th className="px-4 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && data?.rejections.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No rejections in this view.
                  </td>
                </tr>
              )}
              {!loading &&
                data?.rejections.map((r) => (
                  <tr key={r.id} className="border-t border-border/30 align-top">
                    <td className="px-4 py-2">{sourceBadge(r.source)}</td>
                    <td className="px-4 py-2">{reasonBadge(r.reason)}</td>
                    <td className="px-4 py-2 max-w-md whitespace-pre-wrap wrap-break-word text-xs">
                      {r.payload}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {r.actor_id ?? "—"}
                    </td>
                    <td
                      className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap"
                      title={formatTimestamp(r.created_at)}
                    >
                      {formatRelative(r.created_at)}
                      {r.reviewed === 1 && r.reviewed_at !== null && (
                        <div className="mt-1 text-[10px]">
                          reviewed {formatRelative(r.reviewed_at)}
                          {r.reviewed_by ? ` by ${r.reviewed_by}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.reviewed === 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={acting === r.id}
                          onClick={() => void markReviewed(r.id)}
                        >
                          <CheckCircleIcon className="w-4 h-4 mr-1" /> Mark reviewed
                        </Button>
                      ) : (
                        <Badge variant="secondary">Reviewed</Badge>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {data && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/40 px-4 py-3">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ArrowLeftIcon className="w-4 h-4 mr-1" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ArrowRightIcon className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
