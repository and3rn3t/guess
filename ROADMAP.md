# Roadmap (v1.9)

> **Status:** Full-product roadmap. Mobile is one track among five.
> **Source of truth.** AI on-ramp: [AGENTS.md](AGENTS.md) · Icebox: [docs/ROADMAP-icebox.md](docs/ROADMAP-icebox.md)
>
> Archives:
> - [docs/ROADMAP-archive-v1.8-mobile-may-2026.md](docs/ROADMAP-archive-v1.8-mobile-may-2026.md) — mobile-only chapter (2026-05-11 → 2026-05-25)
> - [docs/ROADMAP-archive-v1.6.1-mobile-pivot-2026-05-11.md](docs/ROADMAP-archive-v1.6.1-mobile-pivot-2026-05-11.md) — pre-mobile-pivot
> - [docs/ROADMAP-archive-v1.5.md](docs/ROADMAP-archive-v1.5.md) · [docs/ROADMAP-archive-v1.4.md](docs/ROADMAP-archive-v1.4.md)

---

## Status Key

- `⬜` not started · `🟡` in progress · `✅ YYYY-MM-DD` shipped · `⚪` deferred / parked

## How To Pull Work

1. Start from **In Progress / Up Next**.
2. Finish any `🟡` item before starting new work.
3. Otherwise pull the topmost `⬜` item from the [Wave Sequence](#wave-sequence).
4. Cross-wave parallelism is allowed only when items share no file ownership (see `docs/refactor-boundaries.md`).
5. Update roadmap status in the same commit as implementation/docs.

## Definition Of Done (universal)

An item is `✅` only when **all** apply:

- [ ] Code and/or docs merged to `main` and (if applicable) deployed.
- [ ] `pnpm validate` passes (type-check + lint + test).
- [ ] `pnpm build && pnpm build:worker` both green.
- [ ] Mobile checks pass for mobile-touching scope: `pnpm mobile:typecheck`, `pnpm mobile:guardrails`, `pnpm mobile:reliability-gate`.
- [ ] [CHANGELOG.md](CHANGELOG.md) updated under Unreleased (or next version).
- [ ] Roadmap row updated to `✅ YYYY-MM-DD` in the same commit.
- [ ] New env var / binding / secret / migration documented in [ARCHITECTURE.md](ARCHITECTURE.md) and mirrored in `wrangler.toml` / `.dev.vars.example`.
- [ ] The wave row's "Done when" criterion is verifiably true.

---

## In Progress / Up Next

- ⬜ **Next:** [SE.2](#se-2) admin RBAC coverage audit + CI gate (impact-first batch)
- ⚪ **Parked:** [MOB.1](#mob-1) — needs physical-device evidence; no engineering blockers. Re-pull when device time available.
- 📦 **Recently shipped:** mobile wave (MR/MN/MX/MY.1) — see [Shipped — Mobile Wave (May 2026)](#shipped--mobile-wave-may-2026)

**Active batch (impact-ordered, see Decision Log 2026-05-25):** SE.2 → DX.v2.4 → PI.1 → PI.3 → EN.1 → A11Y.1 + PF.1.

---

## Wave Sequence

Priority × ease, small wins first to re-establish full-product velocity:

1. [PI.1](#pi-1) wrangler audit (S)
2. [DX.v2.4](#dxv2-4) pre-commit hook (S)
3. [SE.2](#se-2) admin RBAC coverage audit (S)
4. [PF.1](#pf-1) bundle-size budget in CI (S)
5. [A11Y.1](#a11y-1) axe-core CI gate (S)
6. [DQ.v2.1](#dqv2-1) `pnpm dq:report` (M)
7. [RF.v2.4](#rfv2-4) ungoverned-hotspot sweep (M)
8. [SE.1](#se-1) CSP report pipeline (M)
9. [EN.1](#en-1) calibration v2 (M)
10. [DX.v2.1](#dxv2-1) generated typed API client (L)
11. [DX.v2.5](#dxv2-5) OpenAPI drift detector (M, pairs with [DX.v2.1](#dxv2-1))
12. [RF.v2.3](#rfv2-3) split `question-selection.ts` + property tests (M, pairs with [DX.v2.3](#dxv2-3))
13. [DQ.v2.3](#dqv2-3) shared source adapter base (M)
14. [PI.3](#pi-3) Tail Worker → `error_logs` (M)
15. [OB.1](#ob-1) SLO definitions + error-budget doc (S, after [PI.3](#pi-3))
16. [RF.v2.5](#rfv2-5) admin API client consolidation (depends on [DX.v2.1](#dxv2-1))
17. Remaining items in order: [MOB.2](#mob-2), [DQ.v2.2](#dqv2-2), [DQ.v2.4](#dqv2-4), [EN.2](#en-2), [EN.3](#en-3), [EN.4](#en-4), [PI.2](#pi-2), [PI.4](#pi-4), [DX.v2.2](#dxv2-2), [DX.v2.3](#dxv2-3).
18. Deferred (re-evaluate when ceiling pressure returns): [RF.v2.1](#rfv2-1), [RF.v2.2](#rfv2-2).

---

## Wave RF.v2 — Code Health & Boundary Cleanup

> Continuation of RF.1–RF.6 (shipped). Targets: ungoverned hotspots, server-engine boundaries, admin API duplication.

### RF.v2.1

**Title:** Slim `src/hooks/useServerGame.ts`
**Status:** ⚪ deferred until clear headroom pressure (currently 371/430 lines, 10/12 imports). Re-evaluate after [DX.v2.1](#dxv2-1) lands — codegen may shrink it organically.

Done when (when re-activated):

- [ ] Per-action API call helpers extracted into `src/lib/gameApi/` modules (start, answer, skip, reject, resume, result, reveal, feedback).
- [ ] Each helper reuses `HttpClient` from `src/lib/http.ts` (no bespoke retry loops).
- [ ] Characterization tests added under `src/hooks/__tests__/useServerGame.test.tsx` before extraction.
- [ ] Complexity-guard ceiling ratcheted down (≤340 lines / ≤10 imports).

Primary files: `src/hooks/useServerGame.ts`, `src/lib/gameApi.ts`, new `src/lib/gameApi/`.

### RF.v2.2

**Title:** Split `functions/api/v2/game/answer.ts`
**Status:** ⚪ deferred (currently 179/360 lines after recent extractions). Re-evaluate if headroom drops below 50 lines.

Done when (when re-activated):

- [ ] `_answer_helpers.ts` sibling extracted with: guess-readiness gate, adaptive-data loader, response shaper.
- [ ] Handler ≤150 lines, ≤6 own imports.
- [ ] Existing route tests pass unchanged.
- [ ] Complexity-guard ceiling ratcheted down for `answer.ts` to 200 lines.

Primary files: `functions/api/v2/game/answer.ts`, new `functions/api/v2/game/_answer_helpers.ts`.

### RF.v2.3

**Title:** Split `packages/game-engine/src/question-selection.ts`
**Status:** ⬜
**Why:** Governed at 490 lines. Math (entropy, info gain) is conceptually separable from selection orchestration.

Done when:

- [ ] Pure math (`scoreQuestion`, `expectedInfoGain`, `weightUtility`) moved to `question-selection/math.ts`.
- [ ] Orchestration (candidate generation, filtering, ranking) stays in `question-selection.ts` shell.
- [ ] Property-based tests added via `fast-check` (seeds [DX.v2.3](#dxv2-3)): probability sums to 1, monotonic info gain, no NaN on any answer pattern.
- [ ] Complexity-guard ceiling tightened to 300 lines for the shell.

### RF.v2.4

**Title:** Ungoverned-hotspot sweep
**Status:** ⬜
**Why:** `pnpm refactor:guard --report` auto-scans `{src,functions,scripts,packages}` for >400-line files not in the rules list. Each one is either an extraction candidate or needs an explicit governance rule + rationale.

Done when:

- [ ] `pnpm refactor:guard --report` shows zero ungoverned hotspots.
- [ ] For each hotspot: either extracted to ≤400 lines, or added to `rules` in `scripts/check-complexity.ts` with a rationale comment.
- [ ] Outcome documented in [docs/refactor-boundaries.md](docs/refactor-boundaries.md) under "Governed files".

### RF.v2.5

**Title:** Consolidate admin API client
**Status:** ⬜
**Why:** `src/lib/admin/adminApi.ts` duplicates fetch patterns across 30+ admin routes; types drift from server-side handler signatures.

Done when:

- [ ] Admin fetch wrappers consume generated types from [DX.v2.1](#dxv2-1) (this item depends on DX.v2.1 landing first).
- [ ] All admin route components import from a single typed client surface.
- [ ] No `as any` or `unknown` casts in admin API call sites.

---

## Wave DQ.v2 — Data Quality & Enrichment Hardening

> Continues the data-quality program. Source: [docs/data-quality-execution-map.md](docs/data-quality-execution-map.md), `data/quality-reports/` backlog.

### DQ.v2.1

**Title:** Canonical `pnpm dq:report` command
**Status:** ⬜
**Why:** Today the attribute-completeness SLA, golden-image audit, and null-closure status each emit separate reports. Operators have no single source of truth for "is data quality OK to ship?".

Done when:

- [ ] New `pnpm dq:report` script emits the union to `.ci-artifacts/data-quality/report.json` + a human-readable `report.md` summary.
- [ ] Report includes: attribute-completeness SLA pass/fail, golden-image audit drift, null-closure queue depth, top-10 sparse attributes.
- [ ] Wired into CI as warning-only for ≥7 days, then blocking.
- [ ] [docs/ci-artifacts.md](docs/ci-artifacts.md) updated with the new artifact path and contents.

### DQ.v2.2

**Title:** Step-resumable enrichment orchestration
**Status:** ⬜
**Why:** `scripts/ingest/enrich.ts` retries from scratch on partial failures. Re-reading enriched cache before retrying makes runs idempotent and is a precondition for the IX.2 (Cloudflare Workflows) icebox option.

Done when:

- [ ] Each pipeline stage checks `data/enrich-cache/` before invoking LLM / source adapter.
- [ ] All persistence SQL is idempotent (`INSERT OR IGNORE` / `ON CONFLICT DO UPDATE`).
- [ ] Resumability covered by integration test that kills the process mid-stage and reruns.

### DQ.v2.3

**Title:** Shared source-adapter base
**Status:** ⬜
**Why:** `scripts/ingest/sources/{comicvine,igdb,tmdb,anilist,wikidata}.ts` each reimplement retry, rate-limit, and schema validation differently.

Done when:

- [ ] New `scripts/ingest/sources/_base.ts` exports `withRateLimit`, `withRetry`, and `parseWithSchema` helpers.
- [ ] All five adapters refactored to consume the base; per-adapter logic kept to source-specific fetch + normalization.
- [ ] Each adapter has a focused unit test covering happy-path + one failure mode.

### DQ.v2.4

**Title:** Adversarial dispute review queue (`/admin/disputes`)
**Status:** ⬜ (promoted from icebox)
**Why:** `attribute_disputes` (migration 0026) accumulates rows from adversarial enrichment validation but has no operator UI. Backlog drift inflates noise in source-of-truth data.

Done when:

- [ ] `/admin/disputes` lists disputes sorted by controversy score, paginated.
- [ ] Reviewer can accept (apply attribute change), reject (drop dispute), or escalate (flag for second reviewer).
- [ ] Resolution writes to `attribute_disputes.resolved_at` + `resolved_by` (new columns if missing — add via migration).
- [ ] Admin route count and migration history updated in `/memories/repo/project-overview.md`.

---

## Wave EN — Engine Accuracy & Calibration

> Source: `packages/game-engine/`, [docs/guess-readiness-calibration.md](docs/guess-readiness-calibration.md), simulate scripts.

### EN.1

**Title:** Calibration v2 against current 53K character pool
**Status:** ⬜
**Why:** Current scoring constants were tuned against a smaller pool. Re-running the grid search closes drift between simulator and production outcomes.

Done when:

- [ ] `pnpm simulate:grid` re-run against current pool; results checked into `data/`.
- [ ] [docs/guess-readiness-calibration.md](docs/guess-readiness-calibration.md) regenerated with new optimal weights and delta vs prior calibration.
- [ ] `pnpm simulate:apply-weights` applied; engine constants updated in `packages/game-engine/src/`.
- [ ] CHANGELOG records the win-rate delta from the prior calibration.

### EN.2

**Title:** MCTS A/B at 10% via D1 `engine_config` feature flag
**Status:** ⬜
**Why:** `selectBestQuestionMCTS` exists but is not exercised in production. `game_stats.variant` (migration 0033) is already in the schema, waiting for a routing signal.

Done when:

- [ ] `engine_config` table gains a `feature_flags` JSON column (new migration).
- [ ] Server start handler reads the flag, routes ~10% of new sessions to MCTS, writes `variant` to `game_stats`.
- [ ] `/admin/experiments` shows live split + outcome comparison (win rate, avg questions, p-value).
- [ ] Kill-switch path: set flag to `0%` rolls back without redeploy.

### EN.3

**Title:** Coverage-aware question selection on the server
**Status:** ⬜
**Why:** Client already tracks coverage via `useQuestionCoverage`. Server-side selection ignores it, so the engine occasionally asks questions backed by sparse attribute data.

Done when:

- [ ] `functions/api/v2/_game-engine.ts` reads attribute coverage (via existing `question_coverage` table) per session start.
- [ ] Selection downweights questions whose attribute coverage < threshold.
- [ ] Threshold + downweight factor exposed as `engine_config` keys (no redeploy required to tune).

### EN.4

**Title:** Confusion-pair telemetry → `/admin/confusion` drill-down
**Status:** ⬜
**Why:** `pnpm simulate:confusion-pairs` emits pair-level data, but operators have no UI to browse it. Flagged pairs are a leading indicator of attribute-data gaps.

Done when:

- [ ] `/admin/confusion` lists top-N character pairs by confusion score with sparkline trend.
- [ ] Drill-down shows: shared attributes, divergent attributes, sample game transcripts.
- [ ] Pairs link out to `/admin/characters/<id>` for direct attribute correction.

---

## Wave PI — Platform & Infra

> KV removal aftershocks (migration 0047), wrangler config, R2 hygiene.

### PI.1

**Title:** `wrangler.toml` post-KV audit
**Status:** ⬜
**Why:** Migration 0047 removed all KV bindings; `wrangler.toml` and `.dev.vars.example` may still reference dead keys.

Done when:

- [ ] `wrangler.toml` contains zero references to `GUESS_KV`, `GUESS_ASSETS`, or their preview namespaces.
- [ ] `.dev.vars.example` updated to current env-var shape.
- [ ] `pnpm doctor` passes against the new config.
- [ ] [ARCHITECTURE.md](ARCHITECTURE.md) "Bindings" section reflects current state.

### PI.2

**Title:** D1 migration baseline squash (fresh-DB only)
**Status:** ⬜
**Why:** 47 migrations make local bootstrap slow and surface duplicate-naming issues (0011 / 0011b). A squashed baseline accelerates fresh-environment setup without touching prod migration history.

Done when:

- [ ] `migrations/0000_baseline.sql` reproduces the post-0047 schema deterministically.
- [ ] Migrations 0001–0047 stay in place (still run for upgraded environments).
- [ ] Baseline only runs when `schema_version` table is empty (guard logic documented).
- [ ] Local `pnpm db:seed` / `pnpm cf:dev` boots from the baseline in <5s.

### PI.3

**Title:** Tail Worker → structured `error_logs`
**Status:** ⬜
**Why:** `tail-worker/` exists but isn't wired into the error pipeline. Currently `functions/_middleware.ts` writes directly to `error_logs`, coupling request handling to D1 latency.

Done when:

- [ ] `_middleware.ts` emits structured error events (no direct D1 write).
- [ ] `tail-worker/` consumes the events and batch-writes to `error_logs`.
- [ ] Error-write failures no longer surface as 500s on the user request.

### PI.4

**Title:** R2 image orphan janitor cron
**Status:** ⬜
**Why:** `guess-images` bucket grows monotonically; no cleanup runs when characters are removed.

Done when:

- [ ] New cron under `functions/cron/` lists R2 keys, joins against `characters.id`, deletes orphans.
- [ ] Runs nightly; emits count of deletions to `automation_runs`.
- [ ] Dry-run mode supported via env var for safe first execution.

---

## Wave DX.v2 — DX, Contracts, Test Coverage

> Source: icebox DX pipe dreams + gaps surfaced by RF.6 work.

### DX.v2.1

**Title:** Generated typed API client from OpenAPI
**Status:** ⬜
**Why:** [docs/openapi.yaml](docs/openapi.yaml) is the contract source of truth, but client and admin code call APIs through hand-written fetch wrappers. Eliminates "did you update the schema?" bugs.

Done when:

- [ ] `openapi-fetch` installed; codegen wired via `pnpm api:generate` (writes `src/lib/api.generated.ts`).
- [ ] `src/hooks/useServerGame.ts` consumes the generated client (depends on or pairs with [RF.v2.1](#rfv2-1)).
- [ ] `src/lib/admin/adminApi.ts` consumes the generated client (depends on or pairs with [RF.v2.5](#rfv2-5)).
- [ ] CI step verifies generated client is in sync (`pnpm api:generate --check`).

### DX.v2.2

**Title:** Miniflare integration suite for every `functions/api/v2/*` route
**Status:** ⬜
**Why:** Current coverage relies on MSW handlers + unit tests; full request → response cycle against seeded D1 is missing.

Done when:

- [ ] Test harness boots Miniflare with seeded D1 fixture for each route.
- [ ] Every route under `functions/api/v2/` has at least one integration test exercising the success path and one validation-failure path.
- [ ] Suite runs in `pnpm validate` under <60s (parallelized).

### DX.v2.3

**Title:** Property-based tests for `@guess/game-engine`
**Status:** ⬜
**Why:** Engine invariants (probability sums to 1, monotonic info gain, NaN-free) are critical and easy to fuzz.

Done when:

- [ ] `fast-check` installed and wired into `packages/game-engine/`.
- [ ] Tests cover: `calculateProbabilities` sum invariant, `selectBestQuestion` monotonicity vs uniform pool, NaN-free on adversarial answer patterns.
- [ ] Runs under 10s; included in `pnpm validate`.

### DX.v2.4

**Title:** Pre-commit hook enforcing `pnpm validate:fast`
**Status:** ⬜
**Why:** `lint-staged.config.mjs` exists but doesn't enforce the fast validation lane; regressions ship.

Done when:

- [ ] Pre-commit hook installed (prefer `simple-git-hooks` if already in lockfile; else `husky`).
- [ ] Hook runs `pnpm validate:fast` on staged files; bypassable only via `--no-verify` (logged in pre-commit output).
- [ ] [AGENTS.md](AGENTS.md) "Tooling guardrails" updated to reference the hook.

### DX.v2.5

**Title:** OpenAPI ↔ handler drift detector
**Status:** ⬜
**Why:** [DX.v2.1](#dxv2-1) generates a typed client from [docs/openapi.yaml](docs/openapi.yaml), but nothing keeps the yaml in sync with the actual `functions/api/v2/` handlers. Drift = silently wrong types at every call site.

Done when:

- [ ] `pnpm api:check-drift` script compares declared OpenAPI operations vs. discovered handler files (route, method, request shape, response shape).
- [ ] Drift report emitted to `.ci-artifacts/openapi/drift.json` + `drift.md`.
- [ ] CI step fails when undocumented routes exist or handler signatures diverge from the yaml.
- [ ] [docs/openapi-generation.md](docs/openapi-generation.md) updated with the drift-detection workflow.

---

## Wave SE — Security Hardening

> Tighten existing primitives (CSP endpoint, admin auth) and add automated guards so the surface area cannot silently regress.

### SE.1

**Title:** CSP report pipeline → D1 + weekly digest
**Status:** ⬜
**Why:** `functions/api/csp-report.ts` accepts reports but nothing persists them. Violations are invisible until a user complains.

Done when:

- [ ] New migration adds `csp_violations` table (timestamp, directive, blocked_uri, document_uri, user_agent, count).
- [ ] Endpoint deduplicates by `(directive, blocked_uri)` within a rolling window and increments `count`.
- [ ] `/admin/security` page lists top violations with sparkline trend.
- [ ] Weekly cron emits a digest (top 10 directives) to `automation_runs` for visibility.

### SE.2

**Title:** Admin RBAC coverage audit + CI gate
**Status:** ⬜
**Why:** `functions/api/admin/` has ~15 sub-routes; auth-middleware coverage relies on convention, not enforcement. One forgotten gate exposes admin operations.

Done when:

- [ ] Automated test enumerates all `functions/api/admin/**/*.ts` route files and asserts each one invokes the shared admin-auth guard.
- [ ] Allowlist for intentional public admin endpoints (if any) declared explicitly in the test, with rationale comments.
- [ ] CI step fails when a new admin route lands without the guard or an explicit allowlist entry.
- [ ] [ARCHITECTURE.md](ARCHITECTURE.md) "Security" section documents the guard contract.

---

## Wave OB — Observability & SLOs

> Sequenced after [PI.3](#pi-3) so that `error_logs` is populated structured data before defining error budgets.

### OB.1

**Title:** SLO definitions + error-budget doc
**Status:** ⬜
**Why:** Today "is the service healthy?" has no quantitative answer. Need explicit p95 latency and error-rate targets for the two hot routes that define gameplay UX (`/api/v2/game/start` and `/api/v2/game/answer`).

Done when:

- [ ] `docs/slo.md` created with p95 latency target and error-rate target for `start` and `answer`.
- [ ] Burn-rate alert thresholds documented (fast burn: 2% of budget in 1h; slow burn: 10% in 6h).
- [ ] [ARCHITECTURE.md](ARCHITECTURE.md) cross-links the SLO doc.
- [ ] At least one query in [docs/sim-vs-real-queries.sql](docs/sim-vs-real-queries.sql) (or new `docs/slo-queries.sql`) computes the current burn from `error_logs` + `game_stats`.

---

## Wave PF — Performance Budgets

### PF.1

**Title:** Bundle-size budget enforced in CI
**Status:** ⬜
**Why:** No automated guard against first-load JS bloat. Past wins (code-splitting, dynamic admin imports) can be silently undone.

Done when:

- [ ] `size-limit` (or `rollup-plugin-visualizer` + assertion script) configured with per-route budgets: initial bundle, lazy admin chunk, lazy enrichment chunk.
- [ ] Current sizes captured as baseline; budgets set to baseline + 10% headroom.
- [ ] CI step fails when a budget is exceeded; PR comment shows the offending bundle and delta.
- [ ] [docs/ci-artifacts.md](docs/ci-artifacts.md) documents the size report artifact.

---

## Wave A11Y — Accessibility Floor

### A11Y.1

**Title:** Axe-core gate over critical phases
**Status:** ⬜
**Why:** No automated a11y checks today; manual audits drift. Establishing a no-regression floor unlocks confident iteration.

Done when:

- [ ] `@axe-core/playwright` integrated into `e2e/`.
- [ ] One spec runs axe over: Lobby, Question, Reveal, Result phases (each waited-for-stable).
- [ ] CI fails on `serious` or `critical` violations; `moderate` and `minor` reported as warnings in PR comment.
- [ ] [docs/ci-artifacts.md](docs/ci-artifacts.md) lists the a11y report artifact path.

---

## Wave MOB — Mobile Closeout (Carry-over from v1.8)

> Two carry-over items only; further mobile investment waits on App Store outcomes.

### MOB.1

**Title:** Challenge leaderboard perf validation for deeper rows
**Status:** ⚪ parked 2026-05-25 — needs physical-device evidence; no engineering blockers. Re-pull when device time is available.
**Carried from:** MY.2

Done when:

- [ ] Physical-device evidence captured for 25-row leaderboard expansion on at least one small-screen device.
- [ ] If perf budgets regress, fallback cap + rationale documented in `docs/mobile/ios-release-handoff-playbook.md`.

### MOB.2

**Title:** v1.9 scope lock + release-note contract refresh
**Status:** ⬜
**Carried from:** MY.3

Done when:

- [ ] `In Progress / Up Next` reflects locked v1.9 queue order (already partially done by this rewrite).
- [ ] Release handoff and changelog known-limitations language synchronized with the v1.9 wave structure (PI/DX/RF/DQ/EN tracks named explicitly).

---

## Shipped — Mobile Wave (May 2026)

Full details (Done-when criteria, source consolidation, evidence references) preserved in [docs/ROADMAP-archive-v1.8-mobile-may-2026.md](docs/ROADMAP-archive-v1.8-mobile-may-2026.md).

| ID | Title | Shipped |
|---|---|---|
| MR.1 | Release-documentation closeout + parity evidence normalization | ✅ 2026-05-11 |
| MR.2 | App Store / TestFlight submission readiness gate | ✅ 2026-05-11 |
| MR.3 | Post-MP.7 evidence debt cleanup | ✅ 2026-05-11 |
| MN.1 | Native quality gate automation hardening | ✅ 2026-05-11 |
| MN.2 | Mobile UI E2E gate (core flow automation) | ✅ 2026-05-11 |
| MN.3 | Crash + runtime telemetry baseline | ✅ 2026-05-11 |
| MX.1 | Describe Yourself (mobile) | ✅ 2026-05-11 |
| MX.2 | Team leaderboard + social comparison scope decision (deferred to v1.9+) | ✅ 2026-05-11 |
| MX.3 | Challenge leaderboard depth expansion (top-10 preview, expandable to 25) | ✅ 2026-05-11 |
| MY.1 | Team leaderboard contract-prep + blocker breakdown | ✅ 2026-05-11 |

Earlier mobile foundations (MB.1–MB.5, MP.1–MP.7) shipped 2026-05-05 → 2026-05-10. See archive for full list.

---

## Decision Log

| Date | Decision | Why |
|---|---|---|
| 2026-05-25 | Reframed `ROADMAP.md` from mobile-only back to full-product for v1.9. Mobile becomes one track among five (RF/DQ/EN/PI/DX). | Mobile parity + reliability + release readiness shipped. Remaining leverage is long-deferred code-health, data-quality, engine, platform, and DX/CI investments. |
| 2026-05-25 | Wave sequence ordered as PI.1 → DX.v2.4 → RF.v2.1 → DQ.v2.1 → RF.v2.4 → EN.1 → DX.v2.1 → … (small wins first). | Re-establish full-product velocity with low-risk infra/DX wins before touching engine constants or undertaking the OpenAPI codegen migration. |
| 2026-05-25 | Promoted two icebox items into v1.9: DQ.v2.4 (`/admin/disputes`) and DX.v2.1 (generated typed API client via `openapi-fetch`). | Both have concrete unblockers shipping in this wave (RF.v2.5 admin client unification, OpenAPI inventory). Removed from the icebox in the same commit as this roadmap edit. |
| 2026-05-25 | Chose `openapi-fetch` over `openapi-typescript` (types-only) or `orval` (heavyweight) for DX.v2.1. | Best ergonomics-to-weight ratio: typed client + minimal runtime + no React Query dependency. |
| 2026-05-25 | PI.2 migration squash limited to fresh-DB bootstrap; migrations 0001–0047 preserved for upgraded environments. | Squashing prod migration history is irreversible and removes audit trail; baseline-for-fresh-DB-only gives the speedup without the risk. |
| 2026-05-25 | Added four new waves (SE, OB, PF, A11Y) + DX.v2.5 after gap-scan of v1.9 surface. | v1.9 originally over-indexed on code-health and data-quality; security/observability/performance/a11y had no governed floor. Each added item enforces a no-regression guard rather than a one-off audit, so the floor compounds. |
| 2026-05-25 | OB wave sequenced after PI.3, not before. | SLOs without structured `error_logs` are guesswork; PI.3 supplies the data, OB.1 supplies the targets. |
| 2026-05-25 | DX.v2.5 (OpenAPI drift detector) added as a follow-on to DX.v2.1, not a precondition. | Generating the client first proves the yaml is usable; drift detection then prevents future skew. Reversing the order would block client codegen on tooling that doesn't exist yet. |
| 2026-05-25 | MOB.1 parked (⚪); active batch re-sequenced impact-first as SE.2 → DX.v2.4 → PI.1 → PI.3 → EN.1 → A11Y.1 + PF.1. | MOB.1 has no engineering blocker (needs physical-device evidence). Promoting SE.2 (admin auth blast radius) and DX.v2.4 (pre-commit multiplier) ahead of PI.1 trades one ordering position for two larger risk-reducers. Adds PI.3 + EN.1 (M-sized) because reliability decoupling and game-quality calibration outrank another batch of S items on user payoff. |

Earlier entries (2026-05-11 mobile-chapter decisions) preserved in [docs/ROADMAP-archive-v1.8-mobile-may-2026.md](docs/ROADMAP-archive-v1.8-mobile-may-2026.md#decision-log-mobile-only-chapter).
