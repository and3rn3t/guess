import type { AdminAutomationReport } from '@/lib/admin/adminApi'

import { formatElapsed, formatRunAge, stepTone } from './landingHelpers'

interface AutomationStatusCardProps {
  report: AdminAutomationReport | null
  fetchedAt: number | null
}

export function AutomationStatusCard({ report, fetchedAt }: Readonly<AutomationStatusCardProps>): React.JSX.Element {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Automation Pulse</h2>
        <span className="text-xs text-muted-foreground">{report ? formatRunAge(report.ranAt) : 'No report'}</span>
      </div>
      {report ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="rounded border border-border px-2 py-2">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Total</div>
              <div className="text-sm font-semibold text-foreground">{formatElapsed(report.durationMs)}</div>
            </div>
            <div className="rounded border border-border px-2 py-2">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Errors</div>
              <div className={`text-sm font-semibold ${report.errorCount > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                {report.errorCount}
              </div>
            </div>
            <div className="rounded border border-border px-2 py-2">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Embedded</div>
              <div className="text-sm font-semibold text-violet-300">{report.duplicatesEmbedded}</div>
            </div>
            <div className="rounded border border-border px-2 py-2">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Retired</div>
              <div className="text-sm font-semibold text-amber-300">{report.retiredQuestions}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-border px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-widest text-muted-foreground">Snapshot</span>
                <span className={stepTone(report.snapshot)}>{report.snapshot}</span>
              </div>
              <div className="text-muted-foreground mt-1">{formatElapsed(report.stepDurationsMs.snapshot)}</div>
            </div>
            <div className="rounded border border-border px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-widest text-muted-foreground">Duplicates</span>
                <span className={stepTone(report.duplicatesEmbedded > 0 ? 'started' : 'skipped')}>
                  {report.duplicatesEmbedded > 0 ? 'updated' : 'idle'}
                </span>
              </div>
              <div className="text-muted-foreground mt-1">{formatElapsed(report.stepDurationsMs.duplicates)}</div>
            </div>
            <div className="rounded border border-border px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-widest text-muted-foreground">Enrichment</span>
                <span className={stepTone(report.enrichmentKick)}>{report.enrichmentKick}</span>
              </div>
              <div className="text-muted-foreground mt-1">{formatElapsed(report.stepDurationsMs.enrichment)}</div>
            </div>
            <div className="rounded border border-border px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="uppercase tracking-widest text-muted-foreground">Auto-retire</span>
                <span className={stepTone(report.retiredQuestions > 0 ? 'started' : 'skipped')}>
                  {report.retiredQuestions > 0 ? 'active' : 'idle'}
                </span>
              </div>
              <div className="text-muted-foreground mt-1">{formatElapsed(report.stepDurationsMs.retirement)}</div>
            </div>
          </div>

          {!!report.notes.length && (
            <div className="rounded border border-border px-3 py-2 text-xs text-muted-foreground">
              {report.notes.join(' | ')}
            </div>
          )}

          <div className="text-[11px] text-muted-foreground">
            Fetched: {fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : 'n/a'}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No cron automation report yet. After the next cron tick, this card will show status and timing.
        </p>
      )}
    </div>
  )
}
