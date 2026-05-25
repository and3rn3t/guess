import React from 'react'

interface SectionCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function SectionCard({ title, subtitle, children }: Readonly<SectionCardProps>): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 md:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold tracking-wide text-foreground">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}
