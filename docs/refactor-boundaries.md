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

---

## Governed Files (RF.v2.4)

Files governed by an explicit `FileRule` in `scripts/check-complexity.ts` that are above the 400-line auto-scan threshold. Ceilings are set at current + ~10% grace. Revisit on the next ungoverned-hotspot sweep.

### Heuristic used for govern vs. extract

- **Govern** — data-shaped files (seed lists, scoring tables, type catalogs), CLI scripts whose monolithic design reflects a single sequential pipeline, admin routes that are tightly coupled single-screen views, and game/admin components whose internal state is only meaningful as a unit.
- **Extract** — orchestration-heavy files that duplicate logic across call sites or whose sections have independently testable boundaries. Deferred to RF.v2.1 / RF.v2.3 / RF.v2.5.

### CLI enrichment scripts

Monolithic single-file pipelines. Splitting would add cross-script coupling with no isolation gain.

| File | Lines | Rationale |
|------|-------|-----------|
| `scripts/bulk-enrich-characters.ts` | 825 | Bulk enrichment CLI — reads/writes full dataset |
| `scripts/vision-validate.ts` | 568 | Vision validation CLI — single-pass script with inline helpers |
| `scripts/vision-enrich-characters.ts` | 475 | Vision enrichment CLI — sequential pipeline with inline prompts |
| `scripts/wikidata-enrich.ts` | 492 | Wikidata CLI — API rate-limiting and result folding in one pass |
| `scripts/reconcile-attributes.ts` | 420 | Attribute reconciliation CLI — single-pass compare-and-merge |
| `scripts/sparse-fill-attributes.ts` | 420 | Sparse fill CLI — single-pass null-coverage filler |
| `scripts/generate-trivia.ts` | 414 | Trivia generation CLI — single LLM-prompted generation script |
| `scripts/generate-gap-questions.ts` | 457 | Gap question generator CLI — sequential LLM-prompted generation |
| `scripts/ingest/images.ts` | 401 | Image ingestion — inline download/resize/upload pipeline |

### Simulation scripts

Self-contained parameter-space and simulation harnesses.

| File | Lines | Rationale |
|------|-------|-----------|
| `scripts/simulate/engine.ts` | 488 | Simulation engine — full yes/no game simulation logic; shared state makes extraction hazardous |
| `scripts/simulate/grid-search.ts` | 434 | Grid-search script — iterates parameter space calling engine; self-contained |
| `scripts/simulate/run.ts` | 410 | Simulation runner — single-shot suite harness; monolithic by design |

### Data-quality scripts

Sequential single-artifact builders; CLI by design.

| File | Lines | Rationale |
|------|-------|-----------|
| `scripts/data-quality/report.ts` | 556 | DQ report orchestrator — unions four DQ subsystem outputs (DQ.v2.1) |
| `scripts/data-quality/build-null-closure-queue.ts` | 427 | Null-closure queue builder — sequential scan producing one JSON artifact |

### Mobile analysis scripts

| File | Lines | Rationale |
|------|-------|-----------|
| `scripts/mobile/check-screen-scorecard.ts` | 639 | Mobile screen scorecard — comprehensive single-file screen analysis CLI |

### Worker / cron handlers

Cohesive single-responsibility server-side handlers.

| File | Lines | Rationale |
|------|-------|-----------|
| `functions/cron/_automation.ts` | 622 | Admin automation cron — single handler; extraction to sub-handlers deferred (RF.v2.1) |
| `functions/api/admin/recommender.ts` | 535 | Admin recommender API — single-endpoint handler with inline recommendation logic |
| `functions/api/llm.ts` | 424 | LLM proxy handler — single endpoint with inline streaming and provider fallback |

### Admin UI route components

Comprehensive single-screen views; filter/query state is shared across sections.

| File | Lines | Rationale |
|------|-------|-----------|
| `src/components/admin/routes/AnalyticsRoute.tsx` | 553 | Analytics route — comprehensive dashboard with shared filter state |
| `src/components/admin/routes/ErrorLogsRoute.tsx` | 466 | Error logs route — log viewer with filter state; single-screen admin tool |
| `src/components/admin/routes/DisputesRoute.tsx` | 445 | Disputes route — dispute-management screen with shared filter state |

### Admin tool components

Single multi-step workflows; steps share local reducer/mutation state.

| File | Lines | Rationale |
|------|-------|-----------|
| `src/components/admin/MultiCategoryEnhancer.tsx` | 713 | Multi-category enhancer — single multi-step workflow; steps share local reducer |
| `src/components/admin/AttributeRecommender.tsx` | 519 | Attribute recommender tool — interactive workflow; extraction deferred (RF.v2.3) |
| `src/components/admin/CategoryRecommender.tsx` | 490 | Category recommender tool — single interactive workflow with shared suggestion state |
| `src/components/admin/DataHygiene.tsx` | 444 | Data hygiene tool — multi-tab cleanup workflow; tabs share mutation state |
| `src/components/admin/QuestionGeneratorDemo.tsx` | 410 | Question generator demo — single interactive admin tool; monolithic by design |
| `src/components/admin/AdminShell.tsx` | 403 | Admin shell/navigation — architectural boundary file per §Admin composition |

### Standalone game / screen components

Tightly coupled animation variants or comparison state; extraction would scatter shared context.

| File | Lines | Rationale |
|------|-------|-----------|
| `src/components/StatsDashboard.tsx` | 766 | Stats dashboard — multi-chart component with shared query state |
| `src/components/WelcomeScreen.tsx` | 491 | Welcome screen — inline animation variants and motion configs |
| `src/components/CharacterComparison.tsx` | 473 | Character comparison — single multi-section view with shared query |
| `src/components/TeachingMode.tsx` | 436 | Teaching mode — own state machine; extraction deferred (RF.v2.5) |

### Services

| File | Lines | Rationale |
|------|-------|-----------|
| `src/lib/admin/attributeRecommender.ts` | 478 | Attribute recommendation service — single-concern scoring/ranking; large due to inline scoring tables |
