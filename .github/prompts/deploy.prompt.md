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
- See [ARCHITECTURE.md](../../ARCHITECTURE.md) for CI/CD pipeline details and infrastructure bindings

## Important Considerations
- Persistence uses localStorage (`useKV` hook) for client-side data and Cloudflare D1/KV for server-side
- Server game sessions stored in Cloudflare KV (`game:{sessionId}`, 1hr TTL)
- Character data served from D1; images from R2
- See [ARCHITECTURE.md — Data Layer](../../ARCHITECTURE.md#data-layer) for full details

## Troubleshooting
- "Not logged in" → Run `pnpm cf:login`
- Build fails → Check `pnpm build` works locally first
- 404 on routes → This is a SPA; ensure `_headers` file handles client-side routing
- KV/D1 errors → Verify bindings in `wrangler.toml` match your Cloudflare dashboard

{{input}}
