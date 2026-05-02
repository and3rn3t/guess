import type { ReactNode } from 'react'
import { HouseIcon } from '@phosphor-icons/react'

interface StaticPageShellProps {
  title: string
  subtitle: string
  children: ReactNode
}

export function StaticPageShell({ title, subtitle, children }: Readonly<StaticPageShellProps>): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 bg-cosmic-glow" />
      <main className="relative z-10 container mx-auto px-4 py-10 md:py-14 max-w-3xl">
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <HouseIcon size={16} weight="duotone" />
          Back to game
        </a>

        <header className="mt-6 space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">{title}</h1>
          <p className="text-sm md:text-base text-muted-foreground">{subtitle}</p>
        </header>

        <section className="mt-8 rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-5 md:p-7 space-y-6 text-sm md:text-base text-foreground/90 leading-relaxed">
          {children}
        </section>
      </main>
    </div>
  )
}