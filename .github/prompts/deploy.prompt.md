---
description: "Deploy the app to Cloudflare Pages or troubleshoot deployment issues."
mode: "agent"
---

# Deploy to Cloudflare

Deploy the Guess game to Cloudflare Pages.

## Prerequisites
- Authenticated with Cloudflare: `pnpm cf:login` (runs `wrangler login`)
- Project builds cleanly: `pnpm build`

## Deployment Commands
- **Production**: `pnpm deploy` — builds and deploys to production
- **Preview**: `pnpm deploy:preview` — builds and deploys to a preview URL
- **Local with CF bindings**: `pnpm cf:dev` — runs Vite dev server with Wrangler proxying Cloudflare bindings

## Configuration
- `wrangler.toml` — Cloudflare Pages config (project name: `guess`, output: `dist/`)
- Build command: `tsc -b --noCheck && vite build`
- Output directory: `dist/`

## Important Considerations
- This app currently uses `@github/spark` KV hooks (`useKV`) for persistence
- Spark KV will NOT work when deployed to Cloudflare Pages
- To migrate persistence, replace `useKV` calls with either:
  - Cloudflare KV (via Workers Functions + KV bindings)
  - localStorage (for client-only persistence)
  - Cloudflare D1 (for structured data)
- The game engine, UI, and all client-side logic will work as-is on Cloudflare Pages

## Troubleshooting
- "Not logged in" → Run `pnpm cf:login`
- Build fails → Check `pnpm build` works locally first
- 404 on routes → This is a SPA; ensure `_redirects` or `_headers` file handles client-side routing if needed
- KV errors in production → Spark KV only works on the Spark platform; see migration notes above

{{input}}
