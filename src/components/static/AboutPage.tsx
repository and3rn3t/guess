import { StaticPageShell } from './StaticPageShell'

export function AboutPage(): React.JSX.Element {
  return (
    <StaticPageShell
      title="About Andernator"
      subtitle="An AI-powered guessing game that shows its reasoning as it narrows down who you are thinking of."
    >
      <p>
        Andernator is a portfolio project focused on one core experience: think of a fictional character,
        answer yes/no questions, and watch the AI reason its way to a guess in real time.
      </p>

      <p className="text-muted-foreground">
        The project is built to be transparent by default: game logic, data quality controls, and operational
        safeguards are documented in the repository so both players and reviewers can inspect how decisions are made.
      </p>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Built with</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>React + TypeScript + Vite</li>
          <li>Cloudflare Pages + Workers + D1 + KV + R2</li>
          <li>A shared game engine with Bayesian scoring and adaptive question selection</li>
        </ul>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Design goals</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Show the AI thinking, not just the final answer</li>
          <li>Make each round feel quick and playful</li>
          <li>Keep improving question quality from real gameplay data</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-3 pt-1">
        <a
          href="https://github.com/and3rn3t/guess"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground hover:bg-background transition-colors"
        >
          GitHub repository
        </a>
        <a
          href="https://github.com/and3rn3t/guess/blob/main/ARCHITECTURE.md"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground hover:bg-background transition-colors"
        >
          Architecture guide
        </a>
        <a
          href="/credits"
          className="inline-flex items-center rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground hover:bg-background transition-colors"
        >
          Credits and attributions
        </a>
      </div>
    </StaticPageShell>
  )
}