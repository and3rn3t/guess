# Refactor Boundaries

This document defines architectural boundaries for the refactor program so extractions stay behavior-preserving and responsibilities do not regress back into orchestration hotspots.

## Goals

- Keep feature behavior stable while reducing module coupling.
- Move decision logic and side effects out of orchestration-heavy files.
- Keep request handlers thin and route-focused.
- Make future worker extraction (service bindings) mechanical, not architectural.

## Boundary Map

### Frontend app shell

- Entry orchestrator: `src/App.tsx`
- Routing/presentation switcher: `src/components/GamePhaseRouter.tsx`
- Runtime server delegate: `src/hooks/useServerGame.ts`
- State reducer and persistence: `src/hooks/useGameState.ts`
- Shared runtime contract: `src/contexts/GameContext.tsx`

Allowed responsibilities:

- `App.tsx`: composition, provider wiring, high-level orchestration only.
- `GamePhaseRouter.tsx`: phase-to-screen mapping and screen-level rendering only.
- `useServerGame.ts`: client-side API flow and dispatch coordination only.
- `useGameState.ts`: state machine transitions and session persistence only.

Not allowed responsibilities:

- New business rules in `App.tsx` or `GamePhaseRouter.tsx`.
- Route-level API knowledge spread outside `useServerGame.ts` and `src/lib/gameApi.ts`.
- UI components mutating server session state directly.

### Server runtime game flow

- Request handlers: `functions/api/v2/game/*.ts`
- Engine boundary adapter: `functions/api/v2/_game-engine.ts`
- Cross-cutting helpers: `functions/api/_helpers.ts`

Allowed responsibilities:

- Route handlers: parse/validate requests, call domain services, shape response.
- `_game-engine.ts`: adapter/wrapper boundary to `@guess/game-engine`.
- `_helpers.ts`: generic transport/auth/rate-limit/json helpers.

Not allowed responsibilities:

- Duplicate guess/turn logic across multiple route handlers.
- Route handlers embedding substantial persistence orchestration.
- Engine option divergence by route without explicit shared contract.

### Admin composition

- Route composition: `src/components/admin/AdminApp.tsx`
- Shell/navigation: `src/components/admin/AdminShell.tsx`
- Shared admin state: `src/components/admin/AdminDataProvider.tsx`
- Admin API client: `src/lib/admin/adminApi.ts`

Allowed responsibilities:

- One typed route manifest as source of truth for admin routes and nav.
- Wrapper consistency (suspense/boundary/page shell) from one place.
- Data providers scoped by domain where possible.

Not allowed responsibilities:

- Dual maintenance of route definitions and nav definitions.
- Monolithic provider holding unrelated concerns by default.

### Ingestion and enrichment pipeline

- Pipeline entry: `scripts/ingest/run.ts`
- Enrichment orchestration: `scripts/ingest/enrich.ts`
- Source adapters: `scripts/ingest/sources/*`

Allowed responsibilities:

- Deterministic stage composition in orchestrators.
- Source adapters remain focused on source retrieval/normalization.
- Persistence concerns abstracted behind adapters.

Not allowed responsibilities:

- Stage-specific retry/error policy duplicated across files.
- Writer/persistence details tightly coupled to orchestration stages.

## Refactor Guardrails

- Complexity guard script: `scripts/check-complexity.ts`
- Validation command: `pnpm refactor:guard` (run via `pnpm validate:fast` and in CI)
- Report mode: `pnpm refactor:guard --report` — emits `.ci-artifacts/checks-static/complexity-report.json` and prints top-5 files closest to their ceiling
- Ratchet mode: `pnpm refactor:guard --ratchet` — prints suggested new ceilings (current + 10% grace). **Manual only, never run in CI.** Copy output back into the `rules` array.
- Metrics tracked: `lines` (total), `ownImports` (top-level import statements)
- Auto-scan: any `.ts`/`.tsx` file in `{src,functions,scripts,packages}` with >400 lines that is not in the explicit `rules` list emits an ungoverned-hotspot warning (never fails; visible in `--report` output)
- Exclusions from auto-scan: test files, `src/lib/seed/`, `scripts/openapi/lib.ts` (expected-large data/generated)
- Characterization tests should be added before extracting new boundaries.

## Change Protocol

1. Add or update characterization tests before extraction.
2. Perform extraction with behavior parity.
3. Remove legacy path only after parity checks pass.
4. Update this boundary document when ownership changes.
