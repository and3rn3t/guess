import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheckIcon, ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { AdminPageHeader } from "../AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ADMIN_API_ENDPOINTS } from "@/lib/constants";

interface CspViolation {
  id: number;
  directive: string;
  blocked_uri: string;
  document_uri: string | null;
  user_agent: string | null;
  count: number;
  first_seen: number;
  last_seen: number;
}

interface DirectiveBucket {
  directive: string;
  count: number;
}

interface CspViolationsResponse {
  violations: CspViolation[];
  total: number;
  page: number;
  pageSize: number;
  windowDays: number;
  directives: DirectiveBucket[];
}

interface CspDigest {
  generatedAt: number;
  windowDays: number;
  totalViolations: number;
  uniquePairs: number;
  topViolations: Array<{ directive: string; blocked_uri: string; count: number; last_seen: number }>;
  byDirective: DirectiveBucket[];
}

interface CspDigestResponse {
  digest: CspDigest | null;
}

const WINDOW_OPTIONS: ReadonlyArray<{ label: string; value: number }> = [
  { label: "24h", value: 1 },
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

const PAGE_SIZE = 50;

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

function DigestPanel({ digest }: Readonly<{ digest: CspDigest | null }>) {
  if (!digest) {
    return (
      <div className="rounded-lg border border-border/40 bg-card/30 p-4 text-sm text-muted-foreground">
        No weekly digest generated yet. The Monday 13:00 UTC cron will populate this panel on its next run.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border/40 bg-card/30 p-4">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h2 className="text-sm font-semibold">Last weekly digest</h2>
        <span className="text-xs text-muted-foreground">
          generated {formatRelative(digest.generatedAt)} · {digest.windowDays}-day window
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4 sm:grid-cols-4">
        <Stat label="Total violations" value={digest.totalViolations.toLocaleString()} />
        <Stat label="Unique pairs" value={digest.uniquePairs.toLocaleString()} />
        <Stat label="Top directive" value={digest.byDirective[0]?.directive ?? "—"} />
        <Stat label="Top count" value={(digest.byDirective[0]?.count ?? 0).toLocaleString()} />
      </div>
      {digest.byDirective.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {digest.byDirective.map((b) => (
            <Badge key={b.directive} variant="outline" className="text-xs">
              {b.directive} <span className="ml-1 text-muted-foreground">{b.count}</span>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

export default function SecurityRoute(): React.JSX.Element {
  const [data, setData] = useState<CspViolationsResponse | null>(null);
  const [digest, setDigest] = useState<CspDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [windowDays, setWindowDays] = useState(7);

  const loadDigest = useCallback(async () => {
    try {
      const res = await fetch(ADMIN_API_ENDPOINTS.cspDigest);
      if (!res.ok) throw new Error(`${res.status}`);
      const body = (await res.json()) as CspDigestResponse;
      setDigest(body.digest);
    } catch (err) {
      toast.error(`Failed to load CSP digest: ${(err as Error).message}`);
    }
  }, []);

  const loadViolations = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL(ADMIN_API_ENDPOINTS.cspViolations, globalThis.location.origin);
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", String(PAGE_SIZE));
      url.searchParams.set("windowDays", String(windowDays));
      const res = await fetch(url.pathname + url.search);
      if (!res.ok) throw new Error(`${res.status}`);
      const body = (await res.json()) as CspViolationsResponse;
      setData(body);
    } catch (err) {
      toast.error(`Failed to load CSP violations: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [page, windowDays]);

  useEffect(() => {
    void loadDigest();
  }, [loadDigest]);

  useEffect(() => {
    void loadViolations();
  }, [loadViolations]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  let totalLabel = "";
  if (data) {
    const noun = data.total === 1 ? "pair" : "pairs";
    totalLabel = `${data.total.toLocaleString()} unique ${noun}`;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Security"
        subtitle="CSP violation reports — dedup'd by directive + blocked URI"
        icon={<ShieldCheckIcon weight="duotone" className="w-5 h-5" />}
        sectionColor="violet"
      />

      <DigestPanel digest={digest} />

      <div className="rounded-lg border border-border/40 bg-card/30">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/40 px-4 py-3">
          <span className="text-sm font-medium">Window:</span>
          {WINDOW_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={windowDays === opt.value ? "default" : "outline"}
              onClick={() => {
                setWindowDays(opt.value);
                setPage(1);
              }}
            >
              {opt.label}
            </Button>
          ))}
          <div className="ml-auto text-xs text-muted-foreground">{totalLabel}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Directive</th>
                <th className="px-4 py-2 text-left font-medium">Blocked URI</th>
                <th className="px-4 py-2 text-right font-medium">Count</th>
                <th className="px-4 py-2 text-left font-medium">Last seen</th>
                <th className="px-4 py-2 text-left font-medium">First seen</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && data?.violations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No CSP violations in this window — nice.
                  </td>
                </tr>
              )}
              {!loading &&
                data?.violations.map((v) => (
                  <tr key={v.id} className="border-t border-border/30">
                    <td className="px-4 py-2 font-mono text-xs">{v.directive}</td>
                    <td className="px-4 py-2 max-w-md truncate font-mono text-xs" title={v.blocked_uri}>
                      {v.blocked_uri}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">
                      {v.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground" title={formatTimestamp(v.last_seen)}>
                      {formatRelative(v.last_seen)}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground" title={formatTimestamp(v.first_seen)}>
                      {formatRelative(v.first_seen)}
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
