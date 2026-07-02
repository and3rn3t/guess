# CLAUDE.md — Andernator (guess)

Guessing game ("Andernator") with a data pipeline behind it. The scripts surface is large — this file maps the core workflows; see `ARCHITECTURE.md`, `PRD.md`, and `AGENTS.md` for depth.

## Stack

- React + TypeScript + Vite; **pnpm** monorepo (`pnpm@10`, Node `>=22`) with `apps/mobile` (Expo/React Native)
- Cloudflare Pages + D1 (`guess-db` prod / `guess-db-preview`) + tail worker (`tail-worker/`)
- Tests: Vitest (unit/components/hooks/api/workers), Playwright e2e; husky + commitlint

## Core workflows

```bash
pnpm install
pnpm dev                 # frontend only (port 5000)
pnpm cf:dev              # full stack: build + local D1 migrations + wrangler pages dev
pnpm validate            # typecheck:all + lint + test + refactor:guard ← the "am I done" gate
pnpm validate:strict     # + build, worker dry-run, migration/schema checks, coverage
pnpm test                # vitest run (test:unit / test:components / test:api for slices)
```

## Database (D1)

- Migrations: `pnpm migrate:create` → `pnpm migrate:validate`; apply with `migrate:preview` / `migrate:prod` (remote — only when asked)
- `pnpm db:types` regenerates DB types after schema changes; `pnpm schema:check` detects drift

## Mobile (`apps/mobile`)

- `pnpm mobile:dev`, `pnpm mobile:typecheck`, `pnpm mobile:guardrails`, `pnpm mobile:scorecard`

## Guardrails

- `refactor:guard` enforces complexity limits; `quality:ratchet` tracks quality metrics — don't regress them
- Data-quality (`dq:*`), simulation (`simulate:*`), and ingest scripts hit remote D1 in preview/prod — never run `:prod` variants unprompted
- Deploys (`pnpm deploy`, `deploy:tail`, migrations `:prod`) only when explicitly asked
- Conventional commits enforced via commitlint; don't commit unless asked
