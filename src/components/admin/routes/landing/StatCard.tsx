import { Link } from 'react-router-dom'

import type { StatCardProps } from './landingHelpers'

export function StatCard({ label, value, icon, color, to, alert }: Readonly<StatCardProps>): React.JSX.Element {
  const inner = (
    <div
      className={`rounded-xl border bg-card px-5 py-4 space-y-2 transition-colors ${to ? 'hover:bg-muted/30 cursor-pointer' : ''} ${alert && Number(value) > 0 ? 'border-yellow-500/40' : ''}`}
    >
      <div
        className={`flex items-center gap-2 text-xs text-muted-foreground ${alert && Number(value) > 0 ? 'text-yellow-500' : ''}`}
      >
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}
