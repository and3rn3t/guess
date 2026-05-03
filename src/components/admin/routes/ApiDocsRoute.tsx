import { AdminPageHeader } from '../AdminPageHeader'

export default function ApiDocsRoute(): React.JSX.Element {
  return (
    <div className="container mx-auto px-4 py-8 space-y-4">
      <AdminPageHeader
        title="API Docs"
        subtitle="OpenAPI contract generated from functions/api and rendered via Swagger UI."
      />

      <div className="rounded-lg border border-border/60 bg-card/60 p-4">
        <p className="text-sm text-muted-foreground">
          Source artifacts: <span className="font-mono">docs/openapi.yaml</span> and <span className="font-mono">public/openapi.yaml</span>.
          Regenerate with <span className="font-mono">pnpm openapi:generate</span>.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
        <iframe
          title="Guess OpenAPI Docs"
          src="/openapi.html"
          className="h-[75vh] w-full"
        />
      </div>
    </div>
  )
}
