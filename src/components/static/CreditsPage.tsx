import { StaticPageShell } from './StaticPageShell'

export function CreditsPage(): React.JSX.Element {
  return (
    <StaticPageShell
      title="Credits"
      subtitle="Data sources, APIs, and open-source libraries that power Andernator."
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Character and metadata sources</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>TMDb</li>
          <li>AniList</li>
          <li>IGDB</li>
          <li>ComicVine</li>
          <li>Wikidata</li>
        </ul>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Infrastructure and runtime</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Cloudflare Pages</li>
          <li>Cloudflare Workers</li>
          <li>Cloudflare D1, KV, and R2</li>
          <li>Cloudflare AI Gateway</li>
        </ul>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-foreground">Open-source libraries</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>React</li>
          <li>TypeScript</li>
          <li>Vite</li>
          <li>Tailwind CSS</li>
          <li>shadcn/ui</li>
          <li>Vitest and Playwright</li>
        </ul>
      </div>

      <p className="text-muted-foreground">
        Some character images and metadata remain subject to their original licensors and source platform
        terms. If you are a rightsholder and want an update or removal, open an issue in the project repo.
      </p>

      <div className="flex flex-wrap gap-3 pt-1">
        <a
          href="https://github.com/and3rn3t/guess/blob/main/LICENSE"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground hover:bg-background transition-colors"
        >
          Project license
        </a>
        <a
          href="/about"
          className="inline-flex items-center rounded-md border border-border/60 bg-background/70 px-3 py-2 text-sm text-foreground hover:bg-background transition-colors"
        >
          About this project
        </a>
      </div>
    </StaticPageShell>
  )
}