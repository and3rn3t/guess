import React from 'react'

interface KpiProps {
  label: string
  value: string
  hint?: string
}

export function Kpi({ label, value, hint }: Readonly<KpiProps>): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground/70">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
