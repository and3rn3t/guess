import { useEffect, useRef, useState } from 'react'
import { SwaggerUIBundle } from 'swagger-ui-dist'
import 'swagger-ui-dist/swagger-ui.css'
import { AdminPageHeader } from '../AdminPageHeader'

export default function ApiDocsRoute(): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    let swaggerUi: { destroy?: () => void } | null = null

    const mountDocs = async (): Promise<void> => {
      try {
        const response = await fetch('/openapi.yaml', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Failed to load spec (${response.status})`)
        }

        const rawSpec = await response.text()
        const spec = JSON.parse(rawSpec) as Record<string, unknown>

        if (disposed || !containerRef.current) {
          return
        }

        containerRef.current.replaceChildren()
        swaggerUi = SwaggerUIBundle({
          spec,
          domNode: containerRef.current,
          deepLinking: true,
          displayRequestDuration: true,
        })
      } catch (error) {
        if (disposed) {
          return
        }

        setErrorMessage(error instanceof Error ? error.message : 'Failed to load OpenAPI spec.')
      }
    }

    void mountDocs()

    return () => {
      disposed = true
      swaggerUi?.destroy?.()
    }
  }, [])

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

      {errorMessage ? (
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          Unable to render the OpenAPI docs: {errorMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/60 bg-background">
        <div ref={containerRef} className="min-h-[75vh] bg-white" />
      </div>
    </div>
  )
}
