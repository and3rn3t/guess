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

- 🟡 **In progress:** [DQ.v2.1](#dqv2-1) `pnpm dq:report` — orchestrator + CI wired warn-only on `reconcile-nightly`; flips to blocking after ≥7 clean nightly runs.
- 🟡 **In progress (parallel, docs-only):** [AI.0](#ai-0) AI surface audit — Phase 0 of the new [Wave AI](#wave-ai--ai-capabilities--skills). Pure docs; no file overlap with DQ.v2.1.
- 🟡 **In progress (parallel):** [AI.1](#ai-1) AI Gateway cache TTL — `cf-aig-cache-ttl` plumbed on `/api/llm` + two admin LLM endpoints. 7-day observation window for ≥30% cache-hit gate started this commit.
- 🟡 **In progress (parallel):** [AI.4](#ai-4) Prompt compression + JSON-mode audit — lossless trim shipped (~6% system-prompt shrink); golden:regression-gated aggressive trim deferred to follow-on.
- ⬜ **Next:** [DX.v2.1](#dxv2-1) generated typed API client (or RF.v2.3 if preferred — see Wave Sequence).
- ⚪ **Parked:** [MOB.1](#mob-1) — needs physical-device evidence; no engineering blockers. Re-pull when device time available.
- 📦 **Recently shipped:** RF.v2.4 (ungoverned-hotspot sweep — 32 files governed) · SE.1 (CSP violations pipeline + admin digest) · OB.1 (SLO doc + burn queries) · PF.1 (bundle-size budgets) · A11Y.1 (axe-core e2e gate) · PI.3 (`logError` hot-path decoupling) · PI.1 (wrangler post-KV audit) · DX.v2.4 (pre-commit `validate:fast`) · SE.2 (RBAC coverage gate) — see [Shipped — Mobile Wave (May 2026)](#shipped--mobile-wave-may-2026)

**Active batch (impact-ordered, see Decision Log 2026-05-25):** ~~SE.2~~ → ~~DX.v2.4~~ → ~~PI.1~~ → ~~PI.3~~ → ~~EN.1~~ (parked, see Decision Log 2026-05-25) → ~~A11Y.1~~ + ~~PF.1~~.

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
18. **Wave AI** (new, runs in parallel — docs-only Phase 0 then cost/quality/platform work): [AI.0](#ai-0) → [AI.1](#ai-1) → [AI.2](#ai-2) → [AI.3](#ai-3) → [AI.4](#ai-4) → [AI.5](#ai-5) → [AI.6](#ai-6) → [AI.7](#ai-7) → [AI.8](#ai-8) → [AI.9](#ai-9) → [AI.10](#ai-10) → [AI.11](#ai-11) → [AI.12](#ai-12) → [AI.13](#ai-13). See [Wave AI § Phasing](#wave-ai--ai-capabilities--skills) for gate ordering.
19. Deferred (re-evaluate when ceiling pressure returns): [RF.v2.1](#rfv2-1), [RF.v2.2](#rfv2-2).

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
**Status:** ✅ 2026-05-25
**Why:** `pnpm refactor:guard --report` auto-scans `{src,functions,scripts,packages}` for >400-line files not in the rules list. Each one is either an extraction candidate or needs an explicit governance rule + rationale.

Done when:

- [x] `pnpm refactor:guard --report` shows zero ungoverned hotspots.
- [x] For each hotspot: either extracted to ≤400 lines, or added to `rules` in `scripts/check-complexity.ts` with a rationale comment.
- [x] Outcome documented in [docs/refactor-boundaries.md](docs/refactor-boundaries.md) under "Governed files".

Shipped: 32 previously-ungoverned files across 7 categories added to `scripts/check-complexity.ts` with per-file rationale comments and ratcheted ceilings (+10% grace). All decisions recorded in [docs/refactor-boundaries.md § Governed Files](docs/refactor-boundaries.md). `pnpm refactor:guard --report` now exits clean with zero warnings.

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
**Status:** 🟡 in progress (warn-only CI gate; flip to blocking after ≥7 nightly runs)
**Why:** Today the attribute-completeness SLA, golden-image audit, and null-closure status each emit separate reports. Operators have no single source of truth for "is data quality OK to ship?".

Done when:

- [x] New `pnpm dq:report` script emits the union to `.ci-artifacts/data-quality/report.json` + a human-readable `report.md` summary.
- [x] Report includes: attribute-completeness SLA pass/fail, golden-image audit drift, null-closure queue depth, top-10 sparse attributes.
- [ ] Wired into CI as warning-only for ≥7 days, then blocking.
- [x] [docs/ci-artifacts.md](docs/ci-artifacts.md) updated with the new artifact path and contents.

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
**Status:** ⚪ parked 2026-05-25 — needs dedicated session (see Decision Log 2026-05-25)
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
**Status:** ✅ 2026-05-25
**Why:** Migration 0047 removed all KV bindings; `wrangler.toml` and `.dev.vars.example` may still reference dead keys.

Done when:

- [x] `wrangler.toml` contains zero references to `GUESS_KV`, `GUESS_ASSETS`, or their preview namespaces.
- [x] `.dev.vars.example` updated to current env-var shape.
- [x] `pnpm doctor` passes against the new config.
- [x] [ARCHITECTURE.md](ARCHITECTURE.md) "Bindings" section reflects current state.

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

**Title:** Decouple `error_logs` writes from request hot path
**Status:** ✅ 2026-05-25
**Why:** `_middleware.ts` already avoids direct D1 writes, but six handlers under `functions/api/v2/daily/**` and `functions/api/llm-stream.ts` were calling `await logError(...)` inside their request `catch` blocks, coupling response latency to D1 write latency and risking 500s if `error_logs` was slow or unavailable. The Tail Worker pipeline (AE telemetry) already runs off-hot-path.

Done when:

- [x] Audit all `functions/api/**` for `await logError(...)`; convert request-path call sites to `context.waitUntil(logError(...))`. Six call sites converted.
- [x] Regression test [functions/api/_log_error_hot_path.test.ts](functions/api/_log_error_hot_path.test.ts) walks `functions/api/**` and fails CI on new `await logError(...)` outside an explicit allowlist (cron/admin/hygiene only).
- [x] [ARCHITECTURE.md](ARCHITECTURE.md) gains an "Error Pipeline" section documenting the two-stream model (AE telemetry via Tail Worker; D1 forensic detail via fire-and-forget `logError`).
- [x] Tail-Worker-as-D1-writer split out as PI.3.b (deferred — see Decision Log 2026-05-25).

### PI.3.b

**Title:** Tail Worker assumes D1 `error_logs` writeback
**Status:** ⬜
**Why:** Even with PI.3's `waitUntil` shield, every `logError` call still issues an INSERT + DELETE batch from the main Worker. Moving the D1 writeback into the Tail Worker (which Cloudflare invokes off-hot-path automatically) would let `logError` shrink to a `console.error(JSON.stringify({kind:'guess_error_event',…}))` and remove the final D1 round-trip from `waitUntil` callbacks.

Done when:

- [ ] `logError` emits `console.error(JSON.stringify({kind:'guess_error_event',…}))` instead of touching D1.
- [ ] Tail Worker parses `event.logs` for `guess_error_event` entries and batch-inserts into `error_logs` via a `GUESS_DB` D1 binding.
- [ ] Tail-worker `wrangler.toml` declares the `GUESS_DB` binding (production + preview).
- [ ] Migration coordinated: Tail Worker deployed and verified writing rows BEFORE `logError` D1 write is removed (avoids gap in `error_logs`).
- [ ] No regression in admin error-logs UI (`/admin/error-logs`).

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
**Status:** ✅ 2026-05-25
**Why:** `lint-staged.config.mjs` exists but doesn't enforce the fast validation lane; regressions ship.

Done when:

- [x] Pre-commit hook installed (prefer `simple-git-hooks` if already in lockfile; else `husky`).
- [x] Hook runs `pnpm validate:fast` on staged files; bypassable only via `--no-verify` (logged in pre-commit output).
- [x] [AGENTS.md](AGENTS.md) "Tooling guardrails" updated to reference the hook.

Shipped:

- Husky was already installed (used by `commit-msg` for commitlint and `pre-push` for `validate:fast`); extended the existing [.husky/pre-commit](.husky/pre-commit) to run `pnpm validate:fast` after `lint-staged`. Bypass via `git commit --no-verify`; pre-push retains the same gate as a safety net for bypassed commits.
- [AGENTS.md](AGENTS.md) "Tooling guardrails" updated to reflect that both pre-commit and pre-push enforce the lane.

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
**Status:** ✅ 2026-05-25
**Why:** `functions/api/csp-report.ts` accepts reports but nothing persists them. Violations are invisible until a user complains.

Done when:

- [x] New migration adds `csp_violations` table (timestamp, directive, blocked_uri, document_uri, user_agent, count).
- [x] Endpoint deduplicates by `(directive, blocked_uri)` within a rolling window and increments `count`.
- [x] `/admin/security` page lists top violations with sparkline trend.
- [x] Weekly cron emits a digest (top 10 directives) to `kv_cache` (`admin:csp:last-digest`) for visibility.

Shipped:

- Migration [0048_csp_violations.sql](migrations/0048_csp_violations.sql) — dedup on `(directive, blocked_uri)` via UNIQUE INDEX; secondary indexes on `count DESC` + `last_seen DESC` for admin queries.
- [functions/api/csp-report.ts](functions/api/csp-report.ts) rewritten as an `INSERT … ON CONFLICT DO UPDATE` upsert; PI.3-compliant (write off the hot path via `context.waitUntil`); `logError` fallback (fire-and-forget) preserves signal if the D1 write fails.
- Admin reader [functions/api/admin/security/csp-violations.ts](functions/api/admin/security/csp-violations.ts) — paginated, windowed (1–90d), with per-directive aggregation.
- Weekly digest [functions/cron/_csp_digest.ts](functions/cron/_csp_digest.ts) (`0 13 * * 1`) snapshots top-10 + per-directive totals into `kv_cache` under `admin:csp:last-digest`; dispatcher wired in [functions/cron/index.ts](functions/cron/index.ts).
- Admin route [src/components/admin/routes/SecurityRoute.tsx](src/components/admin/routes/SecurityRoute.tsx) registered under `monitor` (`/admin/security`) — digest panel + windowed table with directive-bucket badges.
- Tests: [functions/api/__tests__/csp-report.test.ts](functions/api/__tests__/csp-report.test.ts) (8 cases — upsert, dedup, dedup-by-uri, directive parsing, body limit, malformed JSON, missing D1) and [functions/cron/_csp_digest.test.ts](functions/cron/_csp_digest.test.ts) (3 cases — cron gating, missing D1, aggregation + persistence).

### SE.2

**Title:** Admin RBAC coverage audit + CI gate
**Status:** ✅ 2026-05-25
**Why:** `functions/api/admin/` has ~15 sub-routes; auth-middleware coverage relies on convention, not enforcement. One forgotten gate exposes admin operations.

Done when:

- [x] Automated test enumerates all `functions/api/admin/**/*.ts` route files and asserts each one invokes the shared admin-auth guard.
- [x] Allowlist for intentional public admin endpoints (if any) declared explicitly in the test, with rationale comments.
- [x] CI step fails when a new admin route lands without the guard or an explicit allowlist entry.
- [x] [ARCHITECTURE.md](ARCHITECTURE.md) "Security" section documents the guard contract.

Shipped:

- Predicate extracted to [functions/_admin_paths.ts](functions/_admin_paths.ts) for re-use.
- Coverage test at [functions/api/admin/__tests__/rbac-coverage.test.ts](functions/api/admin/__tests__/rbac-coverage.test.ts) (64 routes audited, all gated).
- New "Security" section in [ARCHITECTURE.md](ARCHITECTURE.md) documents the centralized Basic-Auth model and the RBAC gate.

---

## Wave OB — Observability & SLOs

> Sequenced after [PI.3](#pi-3) so that `error_logs` is populated structured data before defining error budgets.

### OB.1

**Title:** SLO definitions + error-budget doc
**Status:** ✅ 2026-05-25
**Why:** Today "is the service healthy?" has no quantitative answer. Need explicit p95 latency and error-rate targets for the two hot routes that define gameplay UX (`/api/v2/game/start` and `/api/v2/game/answer`).

Done when:

- [x] [docs/slo.md](docs/slo.md) created with p95 latency target and error-rate target for `start` and `answer`.
- [x] Burn-rate alert thresholds documented (fast burn: ≥ 14× over 1 h ≈ 2 % of monthly budget; slow burn: ≥ 6× over 6 h ≈ 5 % of monthly budget — chose 5 % instead of the row's original 10 % so the alert fires on first sustained drift rather than after half the budget is gone; rationale recorded inline in docs/slo.md).
- [x] [ARCHITECTURE.md](ARCHITECTURE.md) cross-links the SLO doc under "Error Pipeline → Service-level objectives".
- [x] [docs/slo-queries.sql](docs/slo-queries.sql) (new) ships three queries computing the current burn from `error_logs` + `game_stats`: per-route 1 h / 6 h burn rate, 28-day budget consumption, and a top-error-sources triage view.

Follow-ups (noted as proposed in docs/slo.md): OB.2 wires AE SQL queries + alert delivery (paging is what makes the SLO useful); OB.3 re-baselines the targets after four weeks of `worker_tail` data.

---

## Wave PF — Performance Budgets

### PF.1

**Title:** Bundle-size budget enforced in CI
**Status:** ✅ 2026-05-25
**Why:** No automated guard against first-load JS bloat. Past wins (code-splitting, dynamic admin imports) can be silently undone.

Done when:

- [x] `size-limit` configured with per-route budgets: initial bundle (`app`), shared vendor chunks, lazy admin chunk (`lazy-admin`), lazy enrichment chunk (`lazy-enrichment`).
- [x] Current sizes captured as baseline; budgets set to baseline + ~10% headroom (`lazy-admin` 18 kB vs. 17.16 kB observed; `lazy-enrichment` 4 kB vs. 3.19 kB observed).
- [x] CI step fails when a budget is exceeded (the `Check named chunk budgets` step in the `build` job runs `pnpm size` and `tee`s the log into `.ci-artifacts/build/named-chunk-budgets.log`; failures surface in the build step summary).
- [x] [docs/ci-artifacts.md](docs/ci-artifacts.md) documents the size report artifact and lists the tracked named chunks.

Notes:

- Existing `app` / `vendor-react` / `vendor-ui` / `vendor-charts` / `vendor-motion` budgets remained unchanged.
- Inline PR comment with the offending bundle + delta deferred — the failing CI step + the `named-chunk-budgets.log` artifact already identify the regressing chunk. Wiring `andresz1/size-limit-action` (or an equivalent) can be added later if comment-level signal is needed.

---

## Wave A11Y — Accessibility Floor

### A11Y.1

**Title:** Axe-core gate over critical phases
**Status:** ✅ 2026-05-25
**Why:** No automated a11y checks today; manual audits drift. Establishing a no-regression floor unlocks confident iteration.

Done when:

- [x] `@axe-core/playwright` integrated into `e2e/`.
- [x] One spec runs axe over: Lobby, Question, Reveal, Result phases (each waited-for-stable).
- [x] CI fails on `serious` or `critical` violations; `moderate` and `minor` reported as warnings in the artifact summary.
- [x] [docs/ci-artifacts.md](docs/ci-artifacts.md) lists the a11y report artifact path.

Notes:

- Initial run surfaced two real WCAG AA failures: `aria-prohibited-attr` on the sync-status `<span>` in `AppHeader.tsx` (fixed by adding `role="status"`, which also provides live-region semantics) and `color-contrast` on the Yes/No/Maybe answer buttons in `QuestionCard.tsx`, `AnswerStrip.tsx`, and the “Yes, Correct!” button in `GuessReveal.tsx` (bumped Tailwind backgrounds from `-500` to `-700` with `-600` hover; shadow tints remain at `-500/30` to preserve the brand hue).
- Per-phase JSON + an aggregate `summary.json` are written under `.ci-artifacts/a11y/` and uploaded as the `a11y-report` artifact.
- PR comment delivery deferred — surfacing warnings via the artifact summary is sufficient for the v1.9 floor; an inline PR comment can be added later if the warning volume grows.

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

## Wave AI — AI Capabilities & Skills

> Phased adoption of additional AI surfaces (Cloudflare Workers AI, Vectorize, AI Gateway features, MCP, AutoRAG) and revival of high-impact archived items (DQ.2 vision attrs, EN.23 tiered routing, H.12 moderation, IX.5 MCP). Full plan: session memory `/memories/session/plan.md`. Three lenses: **cost/latency on existing AI**, **data quality**, **platform/DX**. New gameplay surfaces (identify mode, voice, generated portraits) intentionally catalogued as moonshots only.
>
> **Phase gates:** P0 (Discover) → P1 (Quick Wins, items AI.1–AI.4 in parallel) → P2 (Quality, AI.5–AI.8) ‖ P3 (Platform, AI.9–AI.13). P2 and P3 can interleave once P1 baseline is captured.

### AI.0

**Title:** AI surface audit + baseline metrics (Phase 0)
**Status:** 🟡 in progress
**Why:** Every later AI item is measured against today's cost / latency / cache numbers. Without a single inventory + baseline, "did the routing change save money?" is unanswerable. Pure docs; no production change.

Done when:

- [x] [docs/ai-surface.md](docs/ai-surface.md) lists every AI call site (path, model, provider route, cache strategy, fallback, JSON mode, prompt size guard) — server endpoints, admin endpoints, enrichment scripts, golden/vision regression scripts.
- [ ] [data/ai-baseline-2026-05.json](data/ai-baseline-2026-05.json) populated with last-30-day `LLM_COSTS` totals (per `route` × `model`), AI Gateway cache hit ratio, p50/p95 latency per hot route, and current Workers AI neurons/day usage. (Scaffolded with TODO placeholders; needs CF dashboard pull to fill.)
- [ ] [ARCHITECTURE.md](ARCHITECTURE.md) AI-related sections cross-link the new audit doc.

### AI.1

**Title:** AI Gateway cache TTL on deterministic routes
**Status:** 🟡 in progress
**Why:** Attribute recommendations and free-text answer parsing are deterministic for the same `(character, attribute)` / `(question, answer)` input pair, but every request still round-trips to the upstream model. Gateway-side cache TTL is a one-header change.

Done when:

- [x] `cf-aig-cache-ttl` plumbed via `getLlmHeaders(env, ttl)` in [functions/api/_helpers.ts](functions/api/_helpers.ts); applied to `/api/llm` (24 h, matches existing edge-cache TTL) plus the two clearly-cacheable admin endpoints `coverage-priority` and `analytics/insights` (6 h each, matches their D1 cache TTL). Other admin LLM endpoints flagged as follow-on candidates in [docs/ai-surface.md](docs/ai-surface.md) pending per-route audit. Streaming routes excluded.
- [ ] Gateway dashboard shows ≥30% cache hit on `/api/llm` after a 7-day window (observation gate; starts on next deploy).
- [ ] Audit doc + [data/ai-baseline-2026-05.json](data/ai-baseline-2026-05.json) refreshed with post-change cache-hit numbers.

### AI.2

**Title:** AI Gateway fallback chain
**Status:** ⬜
**Why:** Today a 5xx from OpenAI bubbles to the user after the bespoke retry in [functions/api/llm.ts](functions/api/llm.ts) exhausts. Gateway-native fallback chains let us degrade to a second model on transient upstream outages.

Done when:

- [ ] Gateway dashboard configured with fallback chain (gpt-4o-mini → gpt-4o → `@cf/meta/llama-3.1-8b-instruct`); chain documented in [ARCHITECTURE.md](ARCHITECTURE.md).
- [ ] Bespoke 5xx retry in [functions/api/llm.ts](functions/api/llm.ts) trimmed to network-error-only; gateway retries handle upstream model failures.
- [ ] Synthetic chaos test (mock 5xx upstream) confirms user-visible response stays 2xx.

### AI.3

**Title:** Tiered model routing in enrichment (EN.23 revival)
**Status:** ⬜
**Why:** Every attribute pays GPT-4o-mini cost even when the question is `isFemale` for a well-known character that Workers AI free-tier llama-3.1-8b can answer. Routing simple attrs to Workers AI (free quota) is the biggest single cost lever.

Done when:

- [ ] New migration `0049_attribute_complexity.sql` adds `complexity TEXT CHECK (complexity IN ('simple','moderate','complex'))` to `attribute_definitions` (default `'moderate'` so existing rows are conservative).
- [ ] One-time backfill: LLM classification pass populates `complexity` for all 224 attributes; admin override surface added to `/admin/attributes` (or wherever attr defs are edited today).
- [ ] `selectModel(attr)` in [scripts/ingest/enrich/llm-client.ts](scripts/ingest/enrich/llm-client.ts) routes simple → `@cf/meta/llama-3.1-8b-instruct`, moderate → `gpt-4o-mini`, complex → `gpt-4o`. **Cost model A (locked, see Decision Log 2026-05-25):** Workers AI capped at the daily free-tier neuron quota; any overflow falls back to `gpt-4o-mini` rather than paying for Workers AI overage. Predictable spend > marginal routing savings.
- [ ] `pnpm golden:regression` deviation stays within the existing 3% threshold against the post-routing model mix.
- [ ] LLM_COSTS dataset shows ≥30% $/character drop on a 1000-char re-enrichment sample vs. pre-routing baseline.

### AI.4

**Title:** Prompt compression + JSON-mode audit
**Status:** 🟡 in progress
**Why:** Several call sites parse JSON from a free-text response when they could enforce `response_format: { type: 'json_object' }` (or schema) and drop the "reply with valid JSON only" preamble. Token reduction compounds across enrichment.

Done when:

- [x] Every prompt builder in [scripts/ingest/enrich/prompts.ts](scripts/ingest/enrich/prompts.ts) and [functions/api/llm.ts](functions/api/llm.ts) callers either enforces JSON mode + schema, or has a comment explaining why free-text is required. Audit landed 2026-05-25: enrichment client already enforced `json_object`; `functions/api/v2/_llm-rephrase.ts` had a JSON-parsing path without `response_format` (now fixed); `functions/api/admin/analytics/insights.ts` is the lone intentional free-text endpoint and carries an inline justification comment.
- [x] Redundant system preambles removed where JSON schema is enforced. Trimmed `RESPONSE FORMAT: {…}` example blocks from `enrich/prompts.ts::buildSystemPrompt` and `bulk-enrich-characters.ts::buildSystemPromptForChunk`; dropped the `Return ONLY valid JSON: { "text": … }` preamble from `_llm-rephrase.ts` system prompt now that json_object is enforced. New regression tests guard against re-introduction.
- [ ] Sample enrichment batch shows ≥15% prompt-token reduction vs. baseline. Current safe trim achieves ~6% on the enrichment system prompt (lossless re: schema). The remaining gap needs a more aggressive RULES-block rewrite, which requires a `pnpm golden:regression` run (≤3% deviation gate) to verify no quality regression — deferred to a follow-on PR with API budget for the regression sweep.

### AI.5

**Title:** Vision-derived visual attributes (DQ.2 revival)
**Status:** ⬜
**Why:** Highest-impact archived data-quality item. Text-only enrichment fabricates `hairColor`, `eyeColor`, `wearsGlasses`, `hasBeard`, `hasMustache`, `hasMask`, `isWearingHat`, `hasAnimalFeatures`, `apparentAgeRange`, `isHumanoid` with high error rates. Vision models answer these zero-shot from the character's `thumb.webp`.

Done when:

- [ ] New `scripts/ingest/vision-enrich.ts` runs `thumb.webp` through `@cf/llava-1.5-7b-hf` (cheap path) with GPT-4o-mini vision escalation when llava confidence < 0.7. **Vision provider C (locked, see Decision Log 2026-05-25):** Llava primary + GPT-4o-mini escalation chosen over Llava-only or 4o-only to mirror the established golden / `pnpm vision:validate` workflow while keeping Llava as the cost lever.
- [ ] Writes via existing `enrichment_attributes` table with `source = 'vision'` + confidence tracking; conflicts with text enrichment open disputes via the EN.6 adversarial pipeline (no new admin UI).
- [ ] `pnpm vision:validate` agreement rises to ≥95% on the visual subset of the golden set.
- [ ] Cost note added to audit doc: $/character vision-enrich + Workers AI neuron impact.

### AI.6

**Title:** Llama-Guard moderation (H.12 revival)
**Status:** ✅ 2026-05-25
**Why:** `POST /api/v2/characters` (user submissions), `POST /api/admin/proposed-attributes` (LLM-discovered attrs), and `POST /api/v2/game/feedback` (free-text feedback) accept arbitrary strings with no moderation gate. Workers AI `@cf/meta/llama-guard-3-8b` is free-tier and purpose-built.

Done when:

- [x] New [functions/api/_moderation.ts](functions/api/_moderation.ts) exposes `moderate(env, text)` + `moderateAndLog(env, text, source, actorId)` with LDNOOBW regex fast-path + Llama-Guard escalation on grey-area strings. Fail-open on missing AI binding or runtime errors.
- [x] Gate wired into the three write endpoints; rejected payloads return 422 with `{ reason }`. Rejections persisted to new `moderation_rejections` table (migration 0049) for audit + admin review.
- [x] New admin route [functions/api/admin/community/rejected.ts](functions/api/admin/community/rejected.ts) — `GET` lists rejected submissions (pending/reviewed/all + source filter + pagination); `PATCH` marks reviewed with `reviewed_by` + `reviewed_at`. Admin UI page is a follow-on (API satisfies the human-review loop).
- [x] Test suite covers empty input, happy safe, LDNOOBW hit, Llama-Guard unsafe (with + without S-codes), missing AI binding, runtime error fail-open, and defensive empty-response handling (8 tests in [functions/api/_moderation.test.ts](functions/api/_moderation.test.ts)).

### AI.7

**Title:** `bge-reranker-base` on top of vector recall
**Status:** ⬜ (depends on [AI.9](#ai-9))
**Why:** Embedding cosine similarity is a coarse first-pass; reranking the top-K with `@cf/baai/bge-reranker-base` improves precision without retraining or new infra. ~1 neuron per pair.

Done when:

- [ ] Reranker helper added to [functions/api/admin/_embed.ts](functions/api/admin/_embed.ts).
- [ ] Admin question-duplicate finder re-ranks top 50 candidates → shows top 10.
- [ ] (Optional) Vectorize-backed character search (from AI.9) consumes the same reranker.

### AI.8

**Title:** Adversarial vision pass (DQ.18, scoped)
**Status:** ⬜ (depends on [AI.5](#ai-5))
**Why:** When vision (AI.5) and text enrichment disagree, a different-family second vision model (Claude Haiku via OpenRouter) catches model-class blind spots.

Done when:

- [ ] Second-pass vision call wired into the dispute pipeline; only runs on vision↔text disagreements.
- [ ] Disagreements file into `attribute_disputes` with `source = 'adversarial-vision'`.
- [ ] `/admin/disputes` (DQ.v2.4) shows non-zero adversarial-vision entries.

### AI.9

**Title:** Cloudflare Vectorize index for characters
**Status:** ⬜
**Why:** Migration 0035 anticipated Vectorize ("Powers M.12 and IX.1 eventually"). Time to land it. Enables semantic character merge detection (admin) and stuck-state gameplay hints.

Done when:

- [ ] New binding `VECTORIZE` (`character_vectors` index, 768-dim, cosine) added to [wrangler.toml](wrangler.toml) under both envs.
- [ ] One-time backfill embeds `name + description + top-attribute summary` per character via `@cf/baai/bge-base-en-v1.5`; upserts into Vectorize with `id = character_id` and metadata `{ category, popularity }`.
- [ ] New internal endpoint `POST /api/v2/characters/search` returns top-K by vector similarity (admin-only initially).
- [ ] [ARCHITECTURE.md](ARCHITECTURE.md) Cloudflare Bindings table updated.

### AI.10

**Title:** MCP server exposing character DB (IX.5 revival)
**Status:** ⬜
**Why:** The Model Context Protocol is the de facto standard for tool-exposing LLM apps. A Workers-based MCP server lets Claude / Cursor / Copilot Workspace call the character DB as first-class tools.

Done when:

- [ ] New `mcp-worker/` package (separate Worker, not Pages Functions) deployed to `mcp.andernator.com`.
- [ ] Tools exposed: `search_character(query)` (FTS + Vectorize hybrid), `get_character_attributes(id)`, `find_confused_characters(a, b)`, `run_bayesian_game(answers[])`.
- [ ] Auth via Cloudflare Access in front of the worker. **Auth model B (locked, see Decision Log 2026-05-25):** leverages the existing Cloudflare identity stack; no new secret management; per-identity audit log comes for free.
- [ ] `npx @modelcontextprotocol/inspector` round-trips at least one tool call end-to-end.
- [ ] [ARCHITECTURE.md](ARCHITECTURE.md) gains an MCP section with the four tool signatures.

### AI.11

**Title:** AI Gateway Evals + Logpush
**Status:** ⬜
**Why:** Today golden + vision regression run pre-merge; nothing runs continuously against production prompts. Gateway-native evals + R2 log shipping close that gap and give us replay for any prompt.

Done when:

- [ ] Gateway Evals configured on enrichment + answer-parsing routes with factuality / JSON-validity / latency rubric.
- [ ] Logpush job streams Gateway logs to R2 (`r2://guess-images/ai-gateway-logs/<date>/`).
- [ ] New `pnpm ai:eval` smoke gate wired into CI **warn-only** for 2 weeks before flipping to blocking.

### AI.12

**Title:** AutoRAG over docs + character knowledge base
**Status:** ⬜ (depends on [AI.9](#ai-9))
**Why:** Internal admin chat ("why does the engine think Spider-Man is a robot?") needs RAG over `docs/`, character descriptions, and game-history `reasoning` strings. AutoRAG removes the per-doc ingestion code.

Done when:

- [ ] AutoRAG instance configured against the Vectorize index from AI.9 (or AutoRAG-managed index if cleaner).
- [ ] New internal `/admin/ask` route surfaces a chat UI gated by admin Basic Auth.
- [ ] Top 5 "why does the engine…" questions answered correctly in manual smoke test, transcript pasted into the audit doc.

### AI.13

**Title:** Browser Rendering for citation screenshots
**Status:** ⬜
**Why:** Migration 0034 (`evidence_trail`) tracks where each attribute came from, but currently only as a URL string. Capturing a one-time screenshot per source gives a tamper-evident audit trail.

Done when:

- [ ] Browser Rendering binding added to [wrangler.toml](wrangler.toml).
- [ ] Optional capture step in enrichment pipeline writes `evidence/<character_id>.png` to R2 alongside the source URL row in `evidence_trail`.
- [ ] `/admin/characters/<id>` evidence panel renders the screenshot inline with the source URL.

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
| 2026-05-25 | PI.3 scope refined on contact with code: `_middleware.ts` already avoids direct D1 writes, so the original "no direct D1 write from middleware" criterion was vacuously true. Reframed PI.3 as the hot-path decoupling work that was actually needed (six `await logError(...)` call sites under `functions/api/v2/daily/**` and `llm-stream.ts` converted to `context.waitUntil`) plus a regression test. The full Tail-Worker-as-D1-writer migration split out as PI.3.b. | PI.3.b requires Tail Worker deploy → verify → `logError` D1 write removal in that order to avoid an `error_logs` write gap, which is outside this batch's coordinated-deploy risk budget. Shipping the `waitUntil` shield + regression test now removes the user-visible latency coupling immediately; PI.3.b removes the last D1 round-trip later. |
| 2026-05-25 | EN.1 parked mid-batch. Needs a dedicated session: requires `pnpm simulate:export --env production` (live Cloudflare D1 credentials), a multi-hour Phase-1 + Phase-2 grid run, and human review of weight changes that directly affect every player's win rate. | Pushing wrong constants is hard to detect post-deploy (win-rate signal is noisy). The change deserves a focused review cycle rather than being bundled with CI/infra work. A11Y.1 + PF.1 (both S, pure CI gates) take its place in this batch. |
| 2026-05-25 | DQ.v2.1 → SE.1 → RF.v2.4 pulled as a sequential 3-phase batch, each shipping as its own PR. | Each item gates on different infra (live D1 / D1 schema migration / per-file judgement) and shouldn't be interleaved. Sequential delivery keeps each PR reviewable and lets the warn-only DQ.v2.1 gate accumulate evidence before flipping to blocking. |
| 2026-05-25 | Added new **Wave AI** (AI.0 → AI.13) covering cost/latency on existing AI, data quality, and platform/DX. Phased Discover → Quick Wins → Quality / Platform interleaved. Net-new gameplay surfaces (identify mode, voice, generated portraits) catalogued as moonshots only. AI.0 (docs-only audit) started in parallel with DQ.v2.1 because the two items share zero file ownership. | Gap-scan of v1.9 surface showed the AI track had no governed floor: gateway features (cache TTL, fallbacks, evals), Workers AI tiers, and revivable archived items (DQ.2 vision attrs, EN.23 routing, H.12 moderation, IX.5 MCP) were all unplanned. Phase 0 establishes the baseline every later item is measured against. |
| 2026-05-25 | **Locked three Wave-AI parameter choices:** AI.3 cost model = **A** (cap Workers AI at free-tier neurons, overflow → `gpt-4o-mini`); AI.5 vision provider = **C** (Llava primary + GPT-4o-mini escalation on low-confidence); AI.10 MCP auth = **B** (Cloudflare Access in front of `mcp.andernator.com`). | A: predictable spend > marginal routing savings; overage billing on Workers AI surprised us in B.4 simulations. C: mirrors the golden / `vision:validate` workflow we already trust and keeps Llava as the cost lever — Llava-only risks accuracy regression on the visual subset, 4o-only forfeits the Workers AI cost advantage entirely. B: reuses existing CF identity stack (no new secret manager), gives per-identity audit log for free, and integrates with the same SSO Copilot Workspace / Cursor already speak. |
| 2026-05-25 | AI.1 pulled in parallel with AI.0 + DQ.v2.1. Code-only change (new `cacheTtlSeconds` arg on `getLlmHeaders`, applied to three deterministic routes); no file overlap with the other two 🟡 items. | The 7-day cache-hit observation window only starts ticking after deploy, so kicking AI.1 off now buys a week of measurement that we'd otherwise pay for later. The change is single-header, gateway-side reversible, and the existing edge cache means a regression in gateway behaviour is bounded by the 24 h app cache anyway. |
| 2026-05-25 | AI.4 pulled (lossless trim only) while AI.2 is blocked on a Cloudflare dashboard config from the operator. AI.4 done-when #3 (≥15% reduction) intentionally left open: hitting it requires re-writing the RULES block, which is a behaviour change that needs a `pnpm golden:regression` run to confirm ≤3% quality drift. That run costs API budget and operator availability, so we ship the safe trim now and queue the aggressive trim for a follow-on PR. | Two principles: (1) AGENTS.md says ship a smaller verified change over a bigger unverified one — the system-prompt example block is lossless to drop because the attribute-key list already defines the schema and `json_object` mode handles the format constraint; (2) keeping AI.4 🟡 (not ✅) makes the open gap visible in the roadmap header instead of buried in a checkbox. |
| 2026-05-25 | AI.6 (Llama-Guard moderation) shipped with a two-tier design: deterministic LDNOOBW regex fast-path (zero-cost, no network) then Llama-Guard escalation on grey-area strings. Moderation helper is **fail-open** on missing AI binding or runtime errors — does not block legitimate users on a Workers AI outage, nor break local dev without an AI binding. All rejections persisted to `moderation_rejections` (migration 0049) so the fail-open posture is observable. Admin route shipped as API-only (`GET`/`PATCH /api/admin/community/rejected`); React UI page deferred. AI.6 marked ✅ because the done-when criterion is "lists rejected submissions for human review" — the API satisfies that contract and the UI is a presentation-layer follow-on. | Fast-path on LDNOOBW = cost: every user write would otherwise pay a Workers AI neuron round-trip even for obviously-bad strings. Fail-open = availability: Cloudflare Workers AI is best-effort and a 5xx from it shouldn't 422 a character submission. API-only admin route = ship the contract, defer the UI: AGENTS.md prefers a smaller verified change over a bigger unverified one, and the JSON API is what the eventual React page will consume anyway. |

Earlier entries (2026-05-11 mobile-chapter decisions) preserved in [docs/ROADMAP-archive-v1.8-mobile-may-2026.md](docs/ROADMAP-archive-v1.8-mobile-may-2026.md#decision-log-mobile-only-chapter).
