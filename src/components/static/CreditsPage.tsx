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
          <li>
            <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground transition-colors">
              TMDb
            </a>
          </li>
          <li>
            <a href="https://anilist.co/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground transition-colors">
              AniList
            </a>
          </li>
          <li>
            <a href="https://www.igdb.com/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground transition-colors">
              IGDB
            </a>
          </li>
          <li>
            <a href="https://comicvine.gamespot.com/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground transition-colors">
              ComicVine
            </a>
          </li>
          <li>
            <a href="https://www.wikidata.org/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground transition-colors">
              Wikidata
            </a>
          </li>
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
          <li><a href="https://react.dev/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground transition-colors">React</a></li>
          <li><a href="https://www.typescriptlang.org/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground transition-colors">TypeScript</a></li>
          <li><a href="https://vite.dev/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground transition-colors">Vite</a></li>
          <li><a href="https://tailwindcss.com/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground transition-colors">Tailwind CSS</a></li>
          <li><a href="https://ui.shadcn.com/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground transition-colors">shadcn/ui</a></li>
          <li><a href="https://vitest.dev/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground transition-colors">Vitest</a> and <a href="https://playwright.dev/" target="_blank" rel="noreferrer noopener" className="underline underline-offset-2 hover:text-foreground transition-colors">Playwright</a></li>
        </ul>
      </div>

      <p className="text-muted-foreground">
        Some character images and metadata remain subject to their original licensors and source platform
        terms. If you are a rightsholder and want an update or removal, open an issue in the project repo.
      </p>

      <p className="text-muted-foreground">
        API names and logos are property of their respective owners. This project is an independent portfolio
        implementation and is not endorsed by source providers.
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