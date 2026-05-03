import { AdminPageHeader } from '../AdminPageHeader'

const OPENAPI_IFRAME_DOC = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Guess API Docs</title>
    <link rel="stylesheet" href="/vendor/swagger-ui/swagger-ui.css" />
    <style>
      html, body, #swagger-ui {
        margin: 0;
        padding: 0;
        height: 100%;
      }

      body {
        background: #0b1020;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/vendor/swagger-ui/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.yaml',
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayRequestDuration: true,
      });
    </script>
  </body>
</html>`

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
          srcDoc={OPENAPI_IFRAME_DOC}
          className="h-[75vh] w-full"
        />
      </div>
    </div>
  )
}
