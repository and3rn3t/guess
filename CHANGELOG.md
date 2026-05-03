# Changelog

All notable changes to this project are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

- **MSW-first test infrastructure + lane scripts (DX.4)** — standardized API-dependent client tests on network-layer interception by wiring shared MSW lifecycle hooks in `src/test/setup.ts` (enabled for browser-like test environments), expanding reusable default handlers in `src/test/mocks/handlers.ts` (including game/admin routes such as history, live ops, feedback, skip, and reject-guess), and adding shared response builders in `src/test/mocks/gameResponses.ts` for server-game scenarios. Migrated key hook/component/lib suites from ad-hoc `globalThis.fetch` stubs to MSW overrides (`useServerGame`, `useGlobalStats`, `useQuestionCoverage`, `HealthBadge`, `sync`) while preserving targeted call-count assertions via `fetch` spies. Added focused test lanes in `package.json`: `pnpm test:hooks`, `pnpm test:lib`, `pnpm test:api`, and `pnpm test:workers` for faster local diagnosis and CI triage.

- **Server-backed admin recommender + hygiene endpoints** — added dedicated admin APIs for AI attribute recommendations and hygiene analysis: `POST /api/admin/recommender`, `POST /api/admin/hygiene-attributes`, `POST /api/admin/hygiene-categories`, `POST /api/admin/hygiene-duplicates`, and `POST /api/admin/hygiene-question-scores` plus client wrappers in `src/lib/admin/recommenderApi.ts` and `src/lib/admin/hygieneApi.ts`. Admin surfaces now call these server routes instead of browser-direct LLM helpers, and save flows in `AttributeRecommender`/`CategoryRecommender` persist diffs through `saveAdminCharacterAttributeDiff(...)` in `src/lib/admin/adminApi.ts`. Added round-trip coverage for all new admin routes (`functions/api/admin/__tests__/recommender.test.ts`, `hygiene-attributes.test.ts`, `hygiene-categories.test.ts`, `hygiene-duplicates.test.ts`, `hygiene-question-scores.test.ts`).

- **Admin cost rollup endpoint** — added `GET /api/admin/costs` (`functions/api/admin/costs.ts`) with query clamping (`days=1..90`), per-day aggregation across `costs:{user}:{date}` KV keys, and a normalized summary payload (`today`, `totals`, `history`). Added route tests in `functions/api/admin/__tests__/costs.test.ts`, including pagination-path coverage and date-robust assertions.

- **Post-game reflection feedback capture (Phase 4 slice)** — completed games can now submit structured reflection feedback via new endpoint `POST /api/v2/game/feedback` (`functions/api/v2/game/feedback.ts`) with request validation in `FeedbackRequestSchema` (`functions/api/_schemas.ts`) and response parsing via `FeedbackResponseSchema` (`src/lib/schemas.ts`). Client transport `submitGameFeedback(sessionId, rating, feedbackText?)` was added in `src/lib/gameApi.ts`, and `useServerGame` now preserves the just-finished session id and exposes `submitPostGameFeedback(rating, feedbackText?)` to prevent feedback from being attached to an active or missing session. `GameOver` now renders a 1–5 rating control + optional comment field with loading/success/error states, wired through `GamePhaseRouter` and `GameContext` from `App`.

- **Feedback-flow test coverage expansion** — added `src/components/__tests__/GameOver.test.tsx` (feedback controls visibility, rating/comment submit, trimmed/blank comment behavior), extended `src/hooks/useServerGame.test.ts` (missing-session guard + successful feedback POST payload assertions), and extended `src/components/__tests__/GamePhaseRouter.test.tsx` to assert `handleSubmitFeedback` is forwarded to `GameOver` props.

- **"Did you know?" trivia card on reveal (EN.29)** — after the guess is revealed, a styled "Did you know?" card appears beneath the character name (when trivia data is available) showing up to 3 short, surprising facts about the character. Migration `0043_character_trivia.sql` adds a nullable `trivia TEXT` column (JSON array) to `characters`. The column is threaded through `CharactersRow`, `ServerCharacter`, `CharacterRow` (start query), both guess response paths in `answer.ts`, `AnswerResponseSchema`, `CharacterSchema`, `Character`, `AnswerResponse`, and `useServerGame`. `parseTrivia()` in `start.ts` normalises the DB value — handles non-JSON, non-array, empty strings, and trims/caps at 3 items. The reveal card in `GuessReveal.tsx` deduplicates facts via `useMemo + Set` and animates in with a 0.75s delay (skipped under `prefers-reduced-motion`). New script `scripts/generate-trivia.ts` batches characters by popularity, calls gpt-4o-mini with a structured prompt requesting ≤ 120-char surprising facts, validates/trims output, and writes to D1 via incremental SQL flushes; supports `--env`, `--limit`, `--batch-size`, `--concurrency`, `--flush-every`, `--dry-run`, and `--force` flags. All 969 tests continue to pass.

- **"Aha moment" detector (AN.11)** — each game now records which question produced the largest posterior probability jump and surfaces a ⚡ "Breakthrough at Q{n}" highlight directly on the confidence sparkline in the reasoning panel. `posteriorHistory: number[]` and `stepTopTen: Array<Array<{id,name}>>` added to `GameSession`; `answer.ts` records both after every answer. Pure helper `computeAhaMoment(posteriorHistory)` in `functions/api/admin/_aha.ts` (15 unit tests) returns `{ index, jump }` for the argmax positive jump (null when < 3 steps or no positive jump). `result.ts` writes `aha_attr` (question ID) + `aha_jump` (fractional probability jump, 4dp) to `game_stats` via migration `0041_aha_moment.sql`. Nightly aggregator gains `aggregateAhaMoments()` which groups by attribute → count/median/avg jump, writes to KV `kv:aha-moments`. `GET /api/admin/analytics/aha-moments` exposes the summary. `AnalyticsRoute` renders a top-10 "Aha moment attributes" card with count, median Δ%, and avg Δ%. `ReasoningPanel` sparkline (`confidenceHistory.length ≥ 3`) adds a recharts `ReferenceDot` in amber at the aha step and a `⚡ Breakthrough at Q{n}` label alongside the "Confidence trend" header. Test count 914 → 929.
- **Catastrophic-failure replay queue (AN.21)** — every game where the player's actual target never appeared in the engine's step-by-step top-10 is automatically snapshotted to a `triage_queue` table for admin review. Pure helpers `detectCatastrophicFailure(actualCharId, stepTopTen)` and `buildStepsJson(answers, questions, stepTopTen)` in `functions/api/admin/_triage.ts` (15 unit tests). `result.ts` enqueues the failure row (character id/name, min rank, full step-by-step JSON) via `context.waitUntil` so it never slows the player response. Migration `0042_triage_queue.sql` creates the table with DESC + character-id indexes. `GET /api/admin/triage` (list with `limit`/`offset` + detail by `?id=N`) serves the queue; returns 404 for unknown ids. Round-trip test `functions/api/admin/__tests__/triage.test.ts` (5 cases) covers empty queue, insertion order, step-JSON parsing, 404, and pagination against the in-memory D1 harness. New `TriageRoute` renders expandable rows with a per-step `StepReplay` view — top-10 ranked candidates with the actual character highlighted in amber — paginated 50/page with a refresh button. `AdminShell` sidebar gains a "Failure Triage" entry under Pipeline using the Phosphor `WarningOctagonIcon`. e2e admin-smoke sweep updated to include `/triage`. Test count 929 → 968.

### Changed

- **Question-scoring constants tuned (invariant-safe pass)** — updated engine scoring constants in `packages/game-engine/src/constants.ts` to `SCORE_MATCH=1.0` (unchanged), `SCORE_MISMATCH=0.03`, `SCORE_MAYBE=0.8`, `SCORE_MAYBE_MISS=0.4` based on constrained Phase-1 grid search candidates that preserve selector/test invariants. Regression gate remained green (`pnpm simulate:regression`: win-rate Δ -0.67pp vs baseline, avg-questions Δ -0.167), followed by full `pnpm validate` pass.

- **Admin cost dashboard now uses server rollups** — `src/components/admin/CostDashboard.tsx` now reads usage from `fetchAdminCosts(...)` instead of localStorage history, handles loading/error states from the API, and uses explicit server-provided `today` usage values (fixing the prior edge case where the most recent non-today history row could be shown as today's usage).

- **Admin endpoint hardening (request correlation + defensive limits + richer logs)** — hardened the new admin migration routes (`/api/admin/recommender`, `/api/admin/hygiene-attributes`, `/api/admin/hygiene-categories`, `/api/admin/hygiene-duplicates`, `/api/admin/hygiene-question-scores`, `/api/admin/costs`) to attach `X-Request-Id` to every response and include request context (`requestId`, `actorId`, `path`, `method`, status when available) in `logError(...)` details. Added `_helpers.ts` utilities `getRequestId`, `getActorId`, `withRequestId`, and `checkRateLimitBestEffort` so route-level limits are enforced when KV/DO bindings exist, while degrading safely in local/test environments without those bindings.

- **Server-side enrichment batch runner** — `POST /api/admin/enrich/start` now triggers actual LLM-based attribute enrichment directly inside the Worker via `context.waitUntil()`, replacing the previous KV-flag-only approach that required an external CLI script to poll and execute. New `functions/api/admin/enrich/run.ts` exports `runServerEnrichBatch(env, batchId, limit)`: loads active `attribute_definitions` from D1, queries characters with no `character_attributes` rows (ordered by popularity, up to `limit`), fires a single GPT-4o-mini batch call through the AI Gateway, parses the JSON response, and writes `character_attributes` rows with `evidence = 'enrichment:openai:gpt-4o-mini:run=<ISO>'`. Results are recorded in `pipeline_runs` (running → success | error); the KV flag `admin:enrich-start` is cleared in a `finally` block so the SSE stream correctly reflects job completion. Handler defaults to `limit=5`, max `10`; returns `503` when `OPENAI_API_KEY` is absent. Pure helper functions (`buildSystemPrompt`, `buildUserPrompt`, `parseOpenAIContent`) are independently unit-tested; 11 round-trip tests in `functions/api/admin/__tests__/enrich-run.test.ts` cover the early-exit paths, happy path, LLM error path, evidence tagging, and limit clamping. Test count 930 → 941.

- **Maintenance sweep** — retired deprecated `getUserId(request)` server helper; all three call sites (`functions/api/llm.ts`, `functions/api/llm-stream.ts`, `functions/api/v2/characters.ts`) now use `getOrCreateUserId` + `withSetCookie`, which also fixes the existing omission of `Set-Cookie` on LLM cache-HIT and POST-character success responses. Converted `migrations/0011b_composite_indexes.sql` to a no-op comment explaining it is a historical duplicate of `0011_optimize_indexes.sql`. Replaced the stray `React` default import in `CharactersRoute.tsx` with a named `Fragment` import (React 19 automatic JSX runtime). Added `// reason:` comments to all bare `// eslint-disable react-hooks/exhaustive-deps` suppressions so each intentional omission is self-documenting.

- **Question deduplication via embeddings (B.4)** — closes the loop on AN.17 by surfacing *near-duplicate* questions before they pollute the catalog. Migration `0040_attribute_embeddings.sql` adds two tables: `attribute_embeddings(attribute_key PRIMARY KEY, embedding BLOB, dim, model, text_hash, created_at)` (one 768-dim vector per question, packed as a `Float32Array`-backed BLOB; `text_hash` is an FNV-1a 32-bit hex used to skip re-embedding when the question copy hasn't drifted) and `question_dedup_dismissed(pair_key PRIMARY KEY, attribute_key_a, attribute_key_b, similarity, dismissed_by, dismissed_at)` (canonical pair keys ordered lexicographically as `keyA::keyB` so the same pair from either direction collapses to one row). New Cloudflare Workers AI binding `[ai] AI` (added under both `[env.production]` and `[env.preview]`) wraps `@cf/baai/bge-base-en-v1.5` for embeddings (~1 neuron/call, 10k/day free quota); the binding is optional in `Env` so local dev without Workers AI still type-checks. Pure helper `functions/api/admin/_dedup.ts` (16 unit tests) owns `cosineSimilarity` (handles zero-magnitude + length-mismatch returning 0), `serializeEmbedding` / `deserializeEmbedding` (round-trips through D1's `ArrayBuffer` *and* the harness's `Uint8Array`, copying into an aligned buffer when the input isn't 4-byte aligned), `findDuplicatePairs(vectors, threshold, dismissed?)` (O(n²), descending similarity, drops dismissed pair_keys), `canonicalPairKey` (lex-ordered "a::b"), and `shortTextHash` (FNV-1a, 8 hex chars). Wrapper `functions/api/admin/_embed.ts` exports `EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'`, `EMBEDDING_DIM = 768`, `embedText(env, text)` (returns null on missing binding/empty text/wrong shape), and `embedBatch(env, texts)` (preserves alignment with input). Endpoints under `functions/api/admin/questions/duplicates/`: `GET /` returns `{ threshold, generatedAt, totalEmbedded, totalQuestions, pairs }` joining `questions` (`WHERE retired_at IS NULL`) ⨝ `attribute_embeddings` (filtering out rows where `dim != 768` so a future model swap can't poison the queue) and excluding rows in `question_dedup_dismissed`; threshold clamped to `[0.5, 0.999]`, default `0.85`. `POST /backfill` (limit `[1, 200]`, default 50) two-stage: SELECT candidates with no embedding row OR drifted `text_hash`, re-fetch existing rows by `IN (?…)`, recompute hashes client-side, embed only the genuinely-stale set via `embedBatch`, then `db.batch([...])` upsert with `ON CONFLICT(attribute_key) DO UPDATE`. Returns 503 when `env.AI` is absent. `POST /dismiss` (body `{ pairKey, similarity?, reason? }`) canonicalises pair_key, upserts on conflict. `POST /merge` (body `{ sourceKey, targetKey, reason? }`) verifies both questions exist (404 if not), reuses the AN.17 `retired_at` + `retired_reason` machinery on the source (no new column), auto-inserts the dismissed row so the pair never resurfaces, and best-effort `KV.delete('meta:questions')` so the engine drops the merged question on next start. Reason capped at 500 chars, default `Merged into ${target}`. 14 round-trip tests in `functions/api/admin/__tests__/duplicates.test.ts` cover all four endpoints against the in-memory harness with a stubbed `env.AI` (canned 768-dim vectors) — GET (empty / pairs above threshold / dismissed pair filtered / threshold clamping), backfill (503 no-AI / embeds missing rows / skips unchanged hashes / clamps limit), dismiss (400 missing pairKey / canonicalises lex order), merge (400 source==target / 404 missing key / retires + auto-dismisses + busts KV cache). Admin route `/admin/questions/duplicates` (lazy-loaded `DuplicatesRoute.tsx`) renders a sortable table — Question A · Question B · Similarity% · Actions (Merge A→B, Merge B→A, Dismiss) — with a numeric threshold input (clamped client-side to match the server), a `Backfill embeddings` button (limit 100), a status pill for in-flight ops, and a confirmation prompt for merge that asks for a retire reason. Sidebar nav adds `Duplicate Queue` under `Questions` with the Phosphor `CopySimpleIcon`. Test count 884 → 914.

- **Question quality feedback loop in selector (C.6)** — the engine now consumes the same retirement signals AN.17 surfaces in `/admin/questions/retire` and uses them to *down-weight* low-quality questions at runtime, so a question's odds of being asked degrade smoothly as it accumulates skip / maybe / answer-imbalance signals — rather than waiting for an admin to flip the binary `retired_at` switch. New pure helper `packages/game-engine/src/quality-penalty.ts` (11 unit tests) inverts the AN.17 composite into a per-attribute multiplier `clamp(1 - α × retirementScore, floor=0.3, 1)` (α=1 default; floor stops a "bad" question from going to zero so it remains a last-resort selectable option) and exposes `computeQualityPenalty(signals, opts)` + `buildQualityPenaltyMap(bySignals, opts)`; the map omits attributes scoring 1.0 to keep the KV blob small. New `questionQualityPenaltyMap?: Record<string, number>` field on `QuestionSelectionOptions` is applied in `selectBestQuestion` immediately after the empirical-gain blend (`infoGain *= multiplier` only when `0 < multiplier < 1`, defending against a corrupt KV blob zeroing out the whole pool); 4 selector tests in `question-selection.test.ts` cover no-penalty / strong-penalty-flips-choice / missing-key-is-no-op / out-of-range-guard. Engine adaptive-data fetch in `functions/api/v2/_game-engine.ts` adds `kv:question-quality-penalty` to the `Promise.allSettled` block (failure non-fatal, like every other adaptive signal) and threads the map through `AdaptiveData → buildQuestionOptions`. Nightly aggregator `scripts/aggregate-real-game-signals.ts` gains `aggregateQuestionQualityPenalty()` that joins `question_attempts` (yes/no/maybe counts, unix-second cutoff) with `client_events` `question_skip` events (unix-ms cutoff, joined through `questions.id` to map `data.questionId` → `attribute_key`), feeds the per-attribute signals into `buildQualityPenaltyMap`, and writes `data/real/question-quality-penalty.json`. Workflow `.github/workflows/real-data-aggregate.yml` adds an upload step + summary entries for `kv:question-quality-penalty`. Test count 869 → 884.

- **Question retirement queue (AN.17)** — closes the AN.1 → AN.7 → AN.17 loop with a one-click way to retire questions that consistently kill momentum. Migration `0039_question_retirement.sql` adds nullable `retired_at` (unix-ms) + `retired_reason` (TEXT, ≤500 chars) columns to `questions`, plus partial indexes on the live set (`WHERE retired_at IS NULL`, ordered by `priority DESC`) and the retired set (`WHERE retired_at IS NOT NULL`, ordered by `retired_at DESC`) so neither view ever scans the other half. New endpoint `GET /api/admin/questions/retirement-queue?source=live|retired&windowDays=1..365&minShown=1..10000&limit=5..500` joins `question_attempts` (shown + answer mix, unix-second cutoff) to `client_events` `question_skip` events keyed by `data.questionId` (unix-ms cutoff — both timestamps live in different units in this schema, so each cutoff is computed per table) and ranks live questions by a composite `retirementScore = 0.4 × skipRate + 0.3 × maybeRate + 0.3 × imbalance` where `imbalance = |0.5 − yes/(yes+no)| × 2` flags questions that almost always answer the same way regardless of character. Pure scorer + param parser live in `functions/api/admin/_retirement.ts` (14 unit tests covering minShown floor, limit clamping, windowDays clamping, null-id drop, skip-rate dominance, tie-break by shown, and limit slicing); both branches are exercised by 10 round-trip tests in `functions/api/admin/__tests__/retirement.test.ts` against the in-memory D1 harness. New POST endpoints `POST /api/admin/questions/:key/retire` (optional `{ reason?: string }` body, ≤500 chars) and `POST /api/admin/questions/:key/unretire` set/clear `retired_at` + `retired_reason` keyed on `attribute_key`, return 404 when no rows match, and best-effort `KV.delete('meta:questions')` so retirement takes effect on the next game start instead of waiting up to the 1h `QUESTIONS_CACHE_TTL`. Engine integration: `functions/api/v2/game/start.ts`, `resume.ts`, and `questions.ts` (both the plain SELECT and the `coverage=true` join) now filter `WHERE retired_at IS NULL` so retired questions immediately stop being asked. New admin route `/admin/questions/retire` (lazy-loaded `RetirementQueueRoute.tsx`) renders a sortable table — Question / Shown / Skip% / Maybe% / Imbalance / Score — with a colored score badge (red ≥40%, amber ≥20%, muted otherwise) and a per-row Retire button that prompts for an optional reason, plus a shadcn `Tabs` toggle bound to `?source=` for the retired-list view (with relative-time "Retired Xd ago" + Unretire button). Sidebar nav adds a `Retirement Queue` entry under `Questions` using the Phosphor `TrashIcon`. Test count 845 → 869.

- **Confusion matrix from real games (AN.7)** — `/admin/confusion` now sources its primary view from `character_confusions` (real games), with the existing `sim_game_stats` view demoted to a secondary tab. `GET /api/admin/confusion` accepts `?source=real|sim` (default `real`) and returns a unified envelope `{ source, pairs, total, generatedAt, message? }`. New pure helper `functions/api/admin/_confusion.ts` (8 unit tests) owns `parseConfusionParams` (clamps `limit` to [5, 200], floors `minConfusions` at 1, defaults `source=real`, falls back to `real` for unknown sources) and the `formatRealPair` / `formatSimPair` projections so `winPct` is null + `lastSeen` populated for real (undirected, canonical `character_a < character_b`), and the directional `winPct` is preserved for sim (`lastSeen` null). Real-source query LEFT JOINs `characters` for human-readable names and falls back to the id when the join misses (so newly-deleted characters don't blank out the table). Round-trip integration test in `functions/api/admin/__tests__/confusion.test.ts` (6 cases) seeds the in-memory D1 harness with both sources and asserts default empty-state messaging, sort order, `minConfusions` filtering, the id fallback, and the legacy sim shape with `winPct = 66.7`. UI `ConfusionRoute.tsx` adds a shadcn `Tabs` toggle (Real games / Simulation) bound to a `?source=` URL search param so deep-links work, switches the trailing column between "Last seen" (relative time, real) and "Win %" (color-toned, sim), updates the source-aware subtitle/heatmap labels/empty-state copy, and rekeys the table on `${targetId}::${confusedWithId}` so React reconciliation survives the source toggle. The data already flows nightly via `scripts/aggregate-real-game-signals.ts` (game_stats losses ⨝ game_reveals.actual_character_id within ±60s) — no new migration or aggregator change required. Test count 831 → 845.

- **Question skip & frustration funnel (AN.1)** — `/admin/funnel` now surfaces a sortable per-question table that ranks questions by a composite "momentum killer" score, feeding the future AN.17 retirement queue. `GET /api/admin/funnel` returns a new `perQuestion` array joining `question_attempts` (shown counts + yes / no / maybe / unknown answer mix) to `client_events` `question_skip` events keyed on `data.questionId` over the same 30-day window (the answer table uses unix-second timestamps; the events table uses unix-ms — both filters compute their own cutoff). Pure aggregation lives in `functions/api/admin/_funnel.ts → computePerQuestionFunnel(attempts, skips, { minShown })` and is fully unit-tested (12 cases) without a DB: `skipRate = skipped / (shown + skipped)`, `maybeRate = maybe / shown`, `frustrationScore = 0.6 × skipRate + 0.4 × maybeRate` (skip rate dominates because an explicit skip is a stronger negative signal than a "maybe"), all clamped to `[0, 1]` and rounded to 4 decimals; rows below `minShown = 5` are dropped to keep single-impression noise out of the leaderboard; ties on score break by `shown DESC` so well-attested questions outrank one-off spikes; null `question_id` (legacy attribute-only attempts) is dropped; duplicate skip rows for the same question are summed. Round-trip integration test in `functions/api/admin/__tests__/funnel.test.ts` seeds the in-memory D1 harness with two questions (`q-easy` calm, `q-hard` 5/10 maybe + 3 skips) and asserts q-hard sorts first with `frustrationScore ≈ 0.34`. `FunnelRoute` adds a new "Per-question frustration funnel" card under the existing skip leaderboard chart: sortable column headers (Question / Shown / Skipped / Skip rate / Maybe rate / Frustration) with click-to-toggle direction, `aria-sort` set on the active column, and a `FrustrationBadge` that colors the score red (≥ 40%), amber (≥ 20%), or muted. Test count 816 → 831.
- **Health badge in shell header (AP.20)** — top-right green/amber/red pill in the admin sidebar header that gives the 1-second "is everything fine?" glance. Lifted the AN.30 polling into a shared `src/components/admin/LiveOpsContext.tsx` provider exposing `{ data, status, error, refreshing, refresh }` so the existing `LiveOpsStrip` and the new `HealthBadge` share a single `GET /api/admin/live-ops` poller (30s interval, `AbortController` cleanup, single immediate fetch on mount). The pure `computeStatus(data)` helper was extracted from the strip and is now the single source of truth for thresholds: errorRate > 5% → `critical`, > 1% (or any warns) → `warn`, else `healthy`, null data → `unknown`. New `HealthBadge` renders as a rounded pill (`OK` / `WARN` / `DOWN` / `—`) with a colored 6px dot, descriptive `title` (e.g. `WARN · 12 games / 1 errors (last 1h) · 8.33% errors`), `data-status` attribute for E2E selectors, and an accessible aria-label. Renders an unknown placeholder when used outside the provider so isolated previews/tests don't crash. Mounted top-right of the sidebar header (next to the `Admin` link) inside a new `LiveOpsProvider` wrapper around `AdminShell`. 9 unit tests in `src/components/admin/__tests__/HealthBadge.test.tsx` cover the four status states + the no-provider fallback + the fetch-failure title path. Click target reserved for the AN.29 latency budget panel; documented inline.
- **Anomaly-trigger alerts (AN.33)** — nightly cron now compares each `data_quality_snapshots` metric against a rolling 14-day baseline (mean ± 2σ) and fires a webhook on any crossing. New migration `migrations/0038_alerts.sql` adds the `alerts` table (metric, value, baseline_mean/std, signed delta + z-score, direction, sample_size, webhook_status/error, created_at) plus indexes on `(metric, created_at)` + `(created_at)`. Pure module `functions/cron/_anomaly_detector.ts` (13 unit tests) owns `computeBaseline` (sample stddev with n−1 denominator, skips non-finite values, returns std=0 for n=1), `detectAnomaly` (custom sigma + minSamples; std=0 collapses the band so any departure is flagged with z=0; returns null for in-band, undersized, or non-finite inputs), and `formatWebhookPayload` (Slack/Discord-compatible `{ text }` body with up/down arrow, metric name, value, z-score, baseline ± stddev, sample count, optional `<URL|view chart>` link). Runner `functions/cron/_anomaly_check.ts` (5 integration tests via the in-memory D1 harness) reads the last 15 snapshots, treats the most recent as today, computes a baseline from the prior 14, and for each metric in `TRACKED_METRICS` (`data_health_score`, `coverage_pct`, `evidence_pct`, `agreement_avg`, `open_disputes`) inserts an `alerts` row + posts to `ALERTS_WEBHOOK_URL` when set. `ALERTS_DASHBOARD_URL` adds the chart link. Webhook failures are recorded inline (`webhook_status='failed'`, `webhook_error='HTTP 500'`) and never throw out of the cron. Wired into `runScheduled` in `functions/cron/index.ts` so the existing 00:05 UTC nightly trigger picks it up; harmless when there are <8 snapshots (logs `anomaly.skip` with `reason: 'insufficient_history'`). ARCHITECTURE.md updated with the new cron-row description + env-var contract.
- **Live ops strip in admin header (AN.30)** — rolling 1h health snapshot rendered above every admin route's `<Outlet />`. Pure module `functions/api/admin/_live_ops.ts` (9 unit tests) computes the summary shape — games/min (`games1h / 60`, 2dp), win rate (`wins1h / games1h`, 4dp, null when no games), error rate (`errors1h / games1h`, null when no games), errors/min, and p95 latency in ms (rounded, null when AE creds absent) — with explicit clamp + non-finite handling. Endpoint `GET /api/admin/live-ops` runs two parallel D1 COUNT queries (`game_stats` last 1h grouped by `won`, `error_logs` last 1h grouped by `level` — note `error_logs.created_at` is in ms while `game_stats.created_at` is in seconds; the handler converts the cutoff per table) plus an optional Workers Analytics Engine SQL call against the I.4 `worker_tail` dataset (`quantileWeighted(0.95, double2, _sample_interval)` filtering `blob4 != 'exception'`); the AE call is best-effort, swallows errors, and returns `null` when `CF_ACCOUNT_ID` + `CF_API_TOKEN` aren't both set so the strip degrades gracefully. Response sets `Cache-Control: private, max-age=15` so back-to-back admin navigations don't re-hit D1. Round-trip test in `functions/api/admin/__tests__/live-ops.test.ts` seeds 4 in-window + 1 ancient game and 3 in-window + 1 ancient log, asserts the cutoff is enforced and the rates round correctly. UI `src/components/admin/LiveOpsStrip.tsx` polls every 30s (with `AbortController` cleanup on unmount + a single immediate fetch on mount), renders a green/amber/red dot (≤1% / ≤5% / >5% error rate, plus warn-only → amber), three tabular metrics (Games/min · Error rate · p95) backed by `tabular-nums` to stop the strip jittering on each refresh, a `4 games · 3W/1L · 2 errors (last 1h)` roll-up, and an "updated Xs ago" indicator with a spinning `RefreshCw` while a refresh is in flight. Inline error path renders a `role="alert"` message instead of swallowing failures. Mounts inside the existing scroll container of `AdminShell` (`flex-1 overflow-auto flex flex-col`) so the strip stays sticky-feeling without a sticky positioning hack.
- **Per-route error boundary with Retry (AP.5)** — new `src/components/admin/RouteErrorBoundary.tsx` wraps the `AdminShell` `<Outlet />` with a `react-error-boundary` keyed on `useLocation().pathname` so navigating away from a failing route automatically clears the boundary. When a route throws, the sidebar and shell stay mounted and the failing slot renders an inline `Alert` + error pre block + two buttons: **Retry** (resets the boundary so the route subtree remounts) and **Copy error** (writes `${message}\n\n${stack}` to the clipboard, with a 1.5s "Copied" confirmation). Production telemetry still routes through `trackUncaughtError`; DEV shows the full stack inline so you don't have to open devtools. 4 unit tests in `src/components/admin/__tests__/RouteErrorBoundary.test.tsx` cover (a) happy path renders children, (b) throwing child surfaces the fallback with both buttons, (c) Retry remounts the child cleanly when the underlying issue clears, (d) Copy hits `navigator.clipboard.writeText` with the error message. Replaces the old all-or-nothing global `ErrorFallback` for the admin surface — one bad route can no longer take down the whole panel.
- **Admin action round-trip tests (AP.2)** — new `functions/api/admin/__tests__/harness.ts` provides an in-memory D1 facade over `better-sqlite3` that loads every migration in `migrations/*.sql` except the heavy character/seed inserts (`0002_seed.sql`, `0004_backfill_new_attrs.sql`, `0005_ingest_characters.sql`, `0009_seed_default_attrs.sql`), exposes a `D1Database`-shaped `prepare/bind/run/all/first/raw/batch/exec` (with a synchronous `runSync` so `db.batch([...])` can wrap statements in a `better-sqlite3` transaction — async transaction callbacks are rejected by the driver), and ships stub `KVNamespace`, `Fetcher`, and `R2Bucket` bindings, an OpenAI `fetch` mock, an `invokeHandler` adapter that bypasses Pages middleware (Basic auth lives in `_middleware.ts`, not in handlers), and `seedCharacter` / `seedAttributeDefinition` helpers. New `admin-mutations.test.ts` exercises **52 round-trips across all 21 admin POST/PATCH/DELETE handlers** under `functions/api/admin/**`: error-logs delete (purge + bad timestamp), character PATCH (upsert / null delete / 404 / out-of-range) + DELETE (cascade / 404) + validate (LLM happy path / 503 when OpenAI absent), proposed-attributes POST (single / skip-missing-fields / empty-array reject) + PATCH status (valid / unknown) + `:id` approve/reject/409 + `:id/score` (clamped LLM / missing-fields), attribute-disputes PATCH (resolve / unknown status), attribute-disputes-ai POST (LLM verdict / missing-fields), community POST (dismiss / apply majority / unknown action), coverage-priority POST (no-sparse skip-LLM / 503 when OpenAI absent), enrich/start POST (start / stop), enrichment retry POST (default-all / specific-IDs), experiments POST (update / out-of-range / unknown selector), analytics insights POST (cache write / cache hit), pipeline POST (insert run / unknown step), questions `:key` PATCH (update / too-short / 404) + score POST (clamped / empty), resolve-stack POST (no-SHA 404 / no-map fallback / oversized reject), upload-attrs POST (401 / 403 / batch insert / oversized reject). Catches the "button does nothing in prod" class of bug end-to-end without needing wrangler. Picked up automatically by `pnpm test` / `pnpm validate` / CI — no workflow changes. 52/52 pass; 778/778 in the full suite.

### Changed

- **Release workflow rewritten as tag-driven (DX.10)** — the prior changesets-based `.github/workflows/release.yml` had never run successfully (the root `guess` package isn't in `pnpm-workspace.yaml`, so `changeset version` always errored with "package guess which is not in the workspace"; v1.4.0 / v1.5.0 / v1.6.0 were all hand-tagged). Replaced with a tag-triggered workflow that fires on `v*.*.*` pushes (or manual `workflow_dispatch` with a tag input), extracts the matching `## [X.Y.Z]` section from `CHANGELOG.md` via `awk`, and creates/updates the GitHub release with those notes. New helper script `scripts/cut-release.ts` (`pnpm release <patch\|minor\|major\|X.Y.Z> [--dry-run]`) automates the local side: bumps `package.json`, slots the `[Unreleased]` heading under a dated `[X.Y.Z]` heading, commits `chore: release vX.Y.Z`, tags, pushes both. `@changesets/cli` devDependency and `.changeset/` directory removed.

## [1.6.0] - 2026-04-30

### Added

- **Admin route smoke-test sweep (AP.1)** — new `e2e/admin-smoke.spec.ts` mounts every one of the 25 admin routes (LandingRoute index + 24 named routes mirroring `src/components/admin/AdminApp.tsx`) against a stubbed `**/api/admin/**` surface (`{}` for all calls) and asserts each route renders the `AdminShell` sidebar without surfacing the global `ErrorFallback` ("Something went wrong") and without emitting any `pageerror` events during mount. Catches the "the admin route silently broke" regression class — a typo'd import, a renamed route component, or a syntax error in any one of the lazy-loaded route bundles will now fail CI on the PR that introduces it. Picked up automatically by the existing `npx playwright test` step in `.github/workflows/ci.yml` — no workflow changes required. 25/25 routes pass on first run; ~7.5s wall-clock with 7 parallel workers locally.
- **Inline request observability for Pages (I.4 fallback)** — Cloudflare Pages doesn't support `tail_consumers` in `wrangler.toml`, so `functions/_middleware.ts` now wraps `next()` with a wall-clock timer and writes one Workers Analytics Engine data point per request to the `WORKER_TAIL` binding (prod `worker_tail` / preview `worker_tail_preview`). New pure module `functions/_request_metrics.ts` (9 unit tests) emits the same blob/double schema as the standalone Tail Worker so dashboards/SQL don't care which path produced the row. Outcome is auto-classified (`ok` / `client_error` / `server_error` / `exception`); uncaught errors are recorded then re-thrown so Pages still surfaces the 500. The standalone `guess-tail` Worker scaffolding under `tail-worker/` stays in the repo and remains deployed for the eventual Pages → Workers migration when `tail_consumers` becomes available to Pages.
- **Tail Worker observability (I.4)** — new standalone `guess-tail` Worker under `tail-worker/` receives every main Pages-Function invocation as a batch of `TraceItem` events and writes one Workers Analytics Engine data point per event. Pure mapper `tail-worker/src/_tail_metrics.ts` (10 unit tests) emits `{blobs: [scriptName, path, method, outcome, errorMessage, trigger], doubles: [status, cpuMs, wallMs, logCount, exceptionCount], indexes: [path|scriptName|trigger]}` so per-route p50/p95/p99 latency, error rates, and CPU usage are queryable via the CF Analytics Engine SQL API — zero changes to existing endpoints, no hot-path overhead. New `WORKER_TAIL` AE binding (`worker_tail` prod / `worker_tail_preview` preview) plus `[[env.*.tail_consumers]]` blocks in the root `wrangler.toml` so Pages picks up the consumer on next deploy. New `pnpm deploy:tail` and `pnpm deploy:tail:preview` scripts. Per-item write failures are swallowed so a single malformed trace can't drop the rest of the batch. Powers AN.29 latency budget panel and AN.30 live ops strip.
- **Workers Analytics Engine for LLM costs (I.2)** — replaces the brittle `costs:{userId}:{date}` KV pattern with one Analytics Engine data point per LLM call. New pure module `functions/api/_llm_metrics.ts` (10 unit tests) exports `recordLLMUsage(dataset, input)` (no-op when binding absent, swallows AE errors so telemetry never breaks user requests), `buildLLMUsageDataPoint()` (deterministic schema: blobs `[model, userId, cacheStatus, endpoint]`, doubles `[promptTokens, completionTokens, totalTokens, estCostUsd]`, indexes `[userId]`), and `estimateCostUsd(model, usage)` with a hard-coded price table (`gpt-4o`: \$2.50/1M in + \$10/1M out; `gpt-4o-mini`: \$0.15/1M in + \$0.60/1M out). Wired into `functions/api/llm.ts` on both the cache HIT path (zero tokens, `cacheStatus='HIT'` so HIT/MISS ratio is queryable) and the OpenAI MISS path. New `LLM_COSTS` binding added to `wrangler.toml` for both `production` (dataset `llm_costs`) and `preview` (dataset `llm_costs_preview`) so cost dashboards stay separated. Free up to 100K data points/day; queryable in the CF dashboard via SQL without enumerating KV keys. The KV writer (`trackTokenUsage`) is kept short-term as a back-compat shim so the existing `/admin/system-health` cost panel keeps working until AN.31 ships the AE-sourced cost-per-game ribbon.
- **Sparse-attribute auto-fill cron (DQ.22)** — nightly hunter that closes attribute gaps starting with the most-asked-about characters. Pure module `functions/api/_sparse_fill.ts` (10 unit tests) exposes `selectGaps(candidates, attributeKeysByCategory, opts)` which ranks candidates by popularity DESC (ties → alphabetical id) and emits per-character missing-key lists honouring `totalGapBudget`, `maxGapsPerCharacter`, and `minPopularity`; `groupGapsByCategory` and `unionMissingKeys` keep batches single-prompt so each LLM call carries one tightly-scoped attribute payload. CLI `scripts/sparse-fill-attributes.ts` (`pnpm sparse-fill:dry-run` / `:preview` / `:prod`, defaults `--budget 200 --max-per-char 30 --days 30 --batch-size 5`) computes popularity inline from `game_stats.won=1` + `game_reveals` over the last 30 days (mirrors `aggregate-real-game-signals.ts`), loads non-null `character_attributes` to derive each character's stored-key set, runs the canonical `buildSystemPrompt`/`buildUserPrompt` against `gpt-4o-mini` (override via `SPARSE_FILL_MODEL=`) scoped to only the missing keys, and writes `INSERT OR REPLACE` rows tagged `enrichment:openai:<model>:run=<iso>` (DQ.28 evidence convention) at confidence 0.85 under `data/sparse-fill/`. New workflow `.github/workflows/sparse-fill-nightly.yml` runs daily at 00:45 UTC against production (15 min after `reconcile-nightly.yml` to stagger wrangler API token usage), uploads fill SQL + run log as 30-day artifacts, and supports manual dispatch with custom env / budget / per-char cap / lookback. Pairs with EN.7: when DQ.21 admits a brand-new attribute, this cron progressively fills it across the catalog starting with the popular characters players actually meet.
- **Nightly attribute reconciliation cron (DQ.6)** — migration `0037_attribute_drift.sql` adds an `attribute_drift` table (4 indexes on `detected_at DESC`, `character_id+attribute_key`, `batch_id`, and `source+detected_at DESC`) that captures every contradiction or discovery between stored attribute values and a fresh LLM re-eval. Pure module `functions/api/_drift.ts` (13 unit tests) exposes `computeDrift(stored, fresh, opts)` with category-aware allow-lists and per-event-class toggles (`emitDiscovered`, `emitLost`) so callers can decide which signals are noise. New CLI `scripts/reconcile-attributes.ts` (`pnpm reconcile:dry-run` / `:preview` / `:prod`, defaults `--sample 50 --batch-size 5`) samples random characters with non-trivial descriptions, groups them by category, and re-runs the canonical `buildSystemPrompt` / `buildUserPrompt` from the ingestion pipeline against `gpt-4o-mini` (override via `RECONCILE_MODEL=`). Each run gets a `randomUUID()` `batch_id` written into every row so EN.28 (provenance-aware rollback) can later scope reverts. Output SQL lands under `data/reconcile/drift-<env>-<batchid8>.sql` and applies via wrangler in one transaction. New workflow `.github/workflows/reconcile-nightly.yml` runs daily at 00:30 UTC against production (15 min after `real-data-aggregate.yml` so we don't contend on wrangler API tokens), uploads both the drift SQL and the run log as 30-day artifacts, and supports manual dispatch with custom env / sample / batch-size. Lives in GitHub Actions rather than the H.3 Cron Worker because OpenAI calls aren't wired into the Worker env. Estimated cost: ~$0.05/night with the default 50-character sample.
- **Player-answer corroboration loop (DQ.5)** — pure evaluator `functions/api/_corroboration.ts` (12 unit tests) implements the 20-vote / 70%-disagreement gate plus a `disagreementToConfidence` helper that maps the disagreement rate linearly into `attribute_disputes.confidence` across [0.7, 0.99] so the dispute queue sorts by player conviction. New CLI `scripts/corroborate-player-answers.ts` (`pnpm corroborate:dry-run` / `:preview` / `:prod`) reads `game_reveals.answers` JSON for the last 180 days (configurable via `--days`, `--min-votes`, `--threshold`), buckets confident yes/no votes per (character, attribute) pair, and emits an `INSERT OR IGNORE` batch under `data/corroboration/` tagged `disputed_by='player-corroboration'`. Idempotent via the existing `UNIQUE(character_id, attribute_key, status)` constraint on `attribute_disputes`, so repeated nightly runs are safe. The script narrows the `character_attributes` load to only revealed characters to keep wrangler payloads under the 500MB buffer ceiling. Designed to run nightly via the H.3 cron alongside `compute-agreement.ts`.
- **Continuous quality dashboard (DQ.7)** — new admin route `/admin/data-quality` rolls up a single `data_health_score` (0–100, weighted 30/30/25/15 across coverage, evidence, agreement, dispute-health) plus 5 trend charts (data-health, golden pass rate, vision pass rate, agreement avg, open disputes). Pure scorer in `functions/api/_data_health.ts` (7 unit tests) keeps the formula transparent. `GET /api/admin/data-quality` computes a live snapshot on every load (so the dashboard never lies by being stale-by-default) and returns N days of history from the new `data_quality_snapshots` table (migration 0036). Nightly `scripts/snapshot-data-quality.ts` (`pnpm dq:snapshot:{dry-run|preview|prod}`) writes one row; `--golden-pass-rate` / `--vision-pass-rate` flags let CI inject the most-recent DQ.1 / DQ.2 gate results. Designed to wire into the H.3 cron alongside `compute-agreement.ts`.
- **Logical-constraint validator (DQ.4)** — constraint DSL ships as `data/attribute-constraints.json` (JSON instead of YAML to avoid a runtime parser dep). Pure validator `functions/api/_constraints.ts` (15 unit tests, including a smoke-load of the bundled file) supports three rule types: `mutex` (at most one true), `requiresOneOf` (when all keys decided), and `implies` with `allOf` / `anyOf` consequents. Hooked into `scripts/ingest/enrich.ts.storeEnrichmentResults`: every batch loads the rule set once, validates each result's attribute map, and inserts violations into the existing `enrichment_disputes` staging table at confidence 0.95 with a `[constraint:<id>]` reason prefix. The existing `disputes-upload` step promotes them to `attribute_disputes` in D1 with no extra wiring. Initial rules cover alignment mutex (hero/villain/anti-hero/neutral), species mutex (human vs alien/robot/animal), gender mutex, vampire/canFly/robot implications. Auto-repair via second LLM pass deferred to follow-up; constraint-induced disputes already feed the skeptic queue.
- **Cross-source agreement scorecard (DQ.3)** — migration `0035_agreement_score.sql` adds `agreement_score REAL` + `agreement_signals INTEGER` columns to `character_attributes` (plus a partial index for sorting). Pure scorer in `functions/api/_agreement.ts` (11 unit tests) reduces weighted signals from `game_reveals` and `attribute_disputes` to a [0, 1] score; null when no signals exist. New CLI `scripts/compute-agreement.ts` (`pnpm agreement:dry-run`, `pnpm agreement:preview`, `pnpm agreement:prod`) buckets signals per (character, attribute) pair, emits a transactional UPDATE batch under `data/agreement/`, and applies it via wrangler. Admin `GET /api/admin/characters/:id` now returns an `agreement` map; the attribute pill in `CharactersRoute` renders an orange ring + ⚠ glyph when the row is contested (score < 0.6 with ≥3 signals) and surfaces `Agreement: 38% (5 signals)` in the tooltip. Designed to run nightly via the existing adaptive-data-refresh cron.
- **Per-attribute evidence trail (DQ.28)** — migration `0034_evidence_trail.sql` adds a nullable `evidence TEXT` column to `character_attributes`. New helper module `functions/api/_evidence.ts` (8 unit tests) standardises a colon-delimited provenance tag (`admin:manual:<ts>`, `admin:create:<ts>`, `community:vote:<ts>`, `correction:<ts>`, `csv-upload:<ts>`, `reveal:user=<id>:<ts>`, `enrichment:openai:gpt-4o-mini:run=<iso8601>`, `seed:default`). Every attribute writer is threaded: admin manual PATCH (`/api/admin/characters/:id`), admin character create (`POST /api/v2/characters`), community vote apply (`/api/admin/community`), user corrections (`/api/corrections`), CSV upload (`/api/admin/upload-attrs`), game-end reveal backfill (`POST /api/v2/game/reveal`), the enrichment staging table + upload SQL generator (`scripts/ingest/enrich.ts`), and the default seed generator (`scripts/generate-seed-sql.ts`). Admin `GET /api/admin/characters/:id` now returns an `evidence` map; the attribute pill tooltip in `CharactersRoute` renders the source tag inline (`Evidence: enrichment:openai:gpt-4o-mini:run=…`). Existing rows remain `NULL` (legacy provenance unknown); all new writes are guaranteed non-empty.
- **Schema drift detector (DQ.21)** — new `scripts/schema-drift.ts` enforces that the canonical attribute schema (`data/enrich-cache/attribute_definitions.json`) stays in lockstep with everywhere else attributes are named: validates schema shape (camelCase keys, non-empty `displayText`, valid `Category` strings), rejects duplicates, requires every `INSERT INTO attribute_definitions` row across `migrations/*.sql` to round-trip with the schema, and asserts the golden set (`data/data-quality-golden.json` `expected`) and the `VISION_TARGET_ATTRS` literal in `scripts/vision-validate.ts` are subsets of the schema. New `pnpm schema:check` script + `.github/workflows/schema-drift.yml` runs the check (network-free) on every PR touching the schema cache, golden set, migrations, vision script, drift script, or workflow file. Initial run: 224/224 schema↔migration parity, 88 golden + 25 vision keys all valid.
- **Vision validation gate (DQ.2)** — new harness `scripts/vision-validate.ts` runs each golden character's Wikipedia portrait through `gpt-4o-mini` vision and compares the model's answers to the curator's golden values for 25 visual boolean attributes (`wearsCape`, `hasBeard`, `isFemale`, etc.). First run: **92.04% agreement** (185/201 cells across 46 chars with images), passing the ≥90% gate. Image source URLs are cached in `data/golden-image-sources.json` (committed) so CI is fully reproducible without calling Wikipedia. New scripts: `pnpm vision:check` (network-free schema validation) and `pnpm vision:validate` (full LLM run, requires `OPENAI_API_KEY`; override the model with `VISION_MODEL=`). New workflow `.github/workflows/vision-validate.yml` runs the schema job on every matching PR and the LLM job when the OpenAI secret is present, failing PRs that drop below 90% agreement. Per-character / per-attribute report uploaded as a workflow artifact.
- **Golden character regression set + CI gate (DQ.1)** — 50 hand-curated characters with 755 high-confidence attribute assertions live in `data/data-quality-golden.json`. New `scripts/golden-regression.ts` harness reuses the production `buildSystemPrompt` and `buildUserPrompt` (now exported from `scripts/ingest/enrich.ts`) so prompt-template, model, or attribute-schema changes are caught against ground truth. `pnpm golden:check` runs a network-free schema validation; `pnpm golden:regression` runs the full LLM gate (default `gpt-4o-mini`, override with `GOLDEN_MODEL=`). New workflow `.github/workflows/golden-regression.yml` runs the schema job on every matching PR and the LLM job when `OPENAI_API_KEY` is present, failing PRs that exceed the configured 3% deviation threshold. Per-character mismatch report uploaded as a workflow artifact.
- **Source map upload to R2 (H.4)** — `scripts/upload-sourcemaps.ts` runs between `pnpm build` and `wrangler pages deploy` (wired into `deploy` and `deploy:preview`); ships `dist/assets/*.map` to `GUESS_IMAGES/maps/{commit_sha}/`, scrubs the maps from `dist/` so they don't ship publicly, and records the active SHA in KV `deploy:current-sha`. New `POST /api/admin/resolve-stack` endpoint takes a raw `error_logs.detail` stack, fetches the relevant maps from R2, and resolves each frame via `source-map-js`. The `Resolve stack` button on each `/admin/error-logs` row pretty-prints frames inline so production stacks are readable instead of minified gibberish.
- **Cron Worker entry (H.3)** — `functions/cron/index.ts` exports a `scheduled()` handler plus a pure `runScheduled` dispatcher (unit-tested) for nightly housekeeping at `5 0 * * *` (00:05 UTC). Currently a logging no-op; documented as the prerequisite hook for `daily_stats` rollup (migration 0036), `info_gain_avg` EMA, `feature_flags` D1→KV sync, DQ.6 attribute reconciliation, and DQ.22 sparse-attribute auto-fill. Trigger registered via the Cloudflare dashboard (Pages doesn't read `[triggers]` from `wrangler.toml`).
- **Open Graph + Twitter card (H.1)** — `public/og-image.png` (1200×630, cosmic gradient + Andernator wordmark + tagline) generated reproducibly via `scripts/build-og-image.ts` (`pnpm build:og-image`). `index.html` now ships the full set of `og:*` and `twitter:card` meta tags so shared links unfurl as a card on Slack, iMessage, Twitter, and Discord.
- **`robots.txt` + `sitemap.xml` (H.2)** — `public/robots.txt` allows `/`, disallows `/admin/` and `/api/`, points at the sitemap; `public/sitemap.xml` lists the home route. Stops search engines from indexing the admin panel.
- **Pre-commit secret scanning (DX.17)** — `.husky/pre-commit` now runs `gitleaks protect --staged --redact` after `lint-staged`. Blocks commits containing recognized credential patterns (Slack/Stripe/GitHub PAT/private keys/etc.); skips silently with a hint when `gitleaks` isn't installed locally so contributors aren't blocked.
- **AGENTS.md (DX.42)** — repo-root entry point for AI coding agents (Copilot, Claude, Cursor, Aider). Points at `ROADMAP.md` → In Progress block as the canonical "what should I work on?", encodes the pull-loop, universal Definition of Done, tooling guardrails, and commit conventions. Companion to the new `How to use this roadmap` section in ROADMAP.md

### Changed

- **ROADMAP.md promoted to runbook** — added `How to use this roadmap` section, `In Progress / Up Next` callout at the top of Now, `Status` column on all 4 wave tables (⬜/🟡/✅), `Done when` acceptance-criterion column on all 35 wave rows, and stable HTML anchors on every themed-section item referenced by a wave (Cmd-click an ID in a wave row to jump to its full description)
- **Wave 1 audit-flip** — marked **DX.11** (`pnpm validate` pre-push hook, already wired via `husky` in `.husky/pre-push`), **DX.12** (D1 migration dry-run in CI, already running in `db-checks` job via `pnpm migrate:dry-run:preview`), and **I.8** (Workers Smart Placement, already enabled via `[placement] mode = "smart"` in `wrangler.toml`) as ✅ shipped. Promoted **I.1** and **I.9** to 🟡 in-progress (verification windows: 24h preview-vs-prod gateway separation; 7-day semantic-cache hit ≥20%)

---

## [1.5.0] — 2026-04-28

### Added

- **Blur-to-reveal on GuessReveal (U.6)** — both character images in `GuessReveal` now animate from `blur(20–24px) scale(1.15)` to sharp over 1.5s using Framer Motion, paired with the existing spring-physics scale entrance
- **Thinking animation search pulse (U.9)** — `ThinkingCard` in `QuestionCard.tsx` replaces the 4 generic shimmer blocks with a 4×8 dot grid that pulses in left-to-right waves, visually suggesting the engine sweeping through candidates
- **Undo ripple (U.10)** — when the player clicks Undo in `PlayingScreen`, the last answer pill flashes a 200ms red glow before `UNDO_LAST_ANSWER` dispatches; undo button is disabled during the flash to prevent double-undos

### Changed

- **Win intensity celebration (U.7)** — `ConfettiBurst` in `GameOver` now scales particle count and spread by `questionsAsked`: ≤5 questions → full burst (50 desktop particles, wider spread) + **"Uncanny!"** heading; ≤10 questions → medium burst + "I Got It Right!"; >10 / last question → 3 particles + **"Just in time."** heading; `maxQuestions` prop added to `GameOverProps` and wired from `App.tsx`

### Fixed

- **Coverage report crash "Cannot convert undefined or null to object"** — `fetchGlobalCharacters` in `src/lib/sync.ts` now parses the `attributes_json` denormalized column returned by `GET /api/v2/characters` (format `{key: 0|1}`) into `Character.attributes` (`true`/`false`/`null`); previously the blind cast left `attributes` as `undefined`; `AttributeCoverageReport` also guards with `?? {}` defensively

---

## [1.4.0] — 2026-04-24

### Added

- **Skip question** — `POST /api/v2/game/skip` returns the next best question without decrementing the budget; `skippedQuestions[]` tracked on the session; Skip link rendered below the question card in `PlayingScreen`; `SKIP_QUESTION` reducer action; `handleServerSkip` in `useServerGame`
- **Give up** — subtle "I give up" link appears after ≥5 answers in `PlayingScreen`; dispatches `GIVE_UP` (alias for `SURRENDER`), posts result, and tracks analytics
- **Wordle-style emoji share card** — `buildShareEmoji()` in `sharing.ts` generates a 🟩🟥🟨⬜ grid + result line + URL; displayed as a `<pre>` block in `GameOver` above the share buttons
- **`navigator.share()` on mobile** — Share Result button in `GameOver` calls the OS native share sheet when available; falls back to clipboard copy on desktop
- **`PROMPT_VERSION` constant** — `"2026-04-A"` exported from `prompts.ts` and prefixed into `SYSTEM_PREAMBLE`; all 8 prompt functions carry the version string automatically
- **Bundle size CI gate** — `size-limit` with three chunk budgets (`vendor-radix ≤ 130 KB`, `vendor-motion ≤ 50 KB`, `vendor-charts ≤ 65 KB`); `pnpm size` step added to the `checks` CI job
- **`tsc` in pre-commit** — `lint-staged.config.mjs` runs `tsc -b --noCheck` (via function wrapper to suppress file paths) alongside `eslint --fix` on every `*.ts`/`*.tsx` staged file

### Changed

- **Non-blocking `game_stats` write** — `INSERT INTO game_stats` in `result.ts` moved into `context.waitUntil(…)` matching the existing `UPDATE game_sessions` call; removes ~20–50ms from every game-end response
- **Cookie-based LLM rate limiter** — `enforceRateLimit` in `llm.ts` now uses `getOrCreateUserId(request, env)` (cookie-based) instead of `getUserId()` (IP-only); 429 responses include `Set-Cookie` when a new cookie is issued; prevents unfair throttling for users behind shared NAT

---

## [1.3.0] — 2026-04-24

### Added

- **Swipe-up for Maybe** — `useSwipeAnswer` now detects upward drag (dragY < −80px) and returns `'maybe'`; amber MAYBE overlay with opacity animation in `QuestionCard` (`dragY`, `maybeOverlayOpacity`, `maybeLabelOpacity`)
- **Daily streak counter** — new `useDailyStreak` hook reads consecutive-day wins from game history; `WelcomeScreen` shows a flame badge (Phosphor `FireSimpleIcon`) when streak ≥ 2; `App.tsx` wires hook and passes `streak` prop
- **`CharacterImage` component** — shimmer skeleton while loading, initial-letter avatar fallback on error; replaces raw `<img>` + `UserCircle` conditionals in `ReasoningPanel`, `ProbabilityLeaderboard`, and `GuessReveal`
- **Keyboard shortcut overlay** — pressing `?` or clicking the Keyboard icon in `QuestionCard`'s hint bar toggles a native Popover API cheatsheet listing all shortcuts; no React state required
- **Auto-focus answer buttons** — `QuestionCard` focuses the first answer button on every question render via `firstAnswerRef` + `useEffect`, so keyboard users can answer immediately
- **Detective persona** — `SYSTEM_PREAMBLE` in `src/lib/prompts.ts` replaced with a unified Sherlock Holmes–style detective character applied across all LLM prompt functions
- **Workers Observability** — `[observability] enabled = true` added to `wrangler.toml`; tail logs now visible in the Cloudflare dashboard
- **Mobile Playwright projects** — Mobile Safari (iPhone 15) and Mobile Chrome (Pixel 7) added to `playwright.config.ts`; swipe gestures and touch layout now exercised in CI
- **`eslint-plugin-jsx-a11y`** — `recommended` rule set added to `eslint.config.js`; `src/components/ui/`, Workers files, and `coverage/` exempted; pre-existing a11y issues fixed (`CharacterComparison`, `TeachingMode`)

### Changed

- **`@typescript-eslint/no-explicit-any`** — elevated to `"error"` in `eslint.config.js`; existing escape hatches annotated with `// eslint-disable-next-line`
- **`compatibility_date`** — updated from `"2025-04-01"` to `"2026-04-01"` in `wrangler.toml`
- **Static import for `getBestGuess`** — moved from dynamic `await import('../_game-engine')` inside the handler to a top-level static import in `functions/api/v2/game/result.ts`
- **`Cache-Control` headers** — `public, max-age=60, stale-while-revalidate=300` added to `GET /api/v2/questions` and `GET /api/v2/characters` responses
- **KV cache for characters list** — unfiltered character list in `characters.ts` cached for 5 minutes in KV; write via `waitUntil` to avoid blocking the response

### Fixed

- **Request body size guard** — `parseJsonBody` in `functions/api/_helpers.ts` checks `Content-Length` and rejects bodies over 64 KB with a `413` before calling `.json()`
- **`COOKIE_SECRET` startup guard** — `getSigningKey()` throws immediately if `env.COOKIE_SECRET` is falsy; the silent `DEV_SECRET` fallback is removed
- **Legacy session format branch removed** — `loadSession()` in `_game-engine.ts` simplified to lean+pool only; expired `'characters' in data` branch removed; tests rewritten

---

## [1.2.0] — 2026-04-21

### Added

- **Difficulty selector** — Easy (20q) / Medium (15q) / Hard (10q) picker on welcome screen; selection is passed to `POST /api/v2/game/start`; description hint shown below picker with `aria-live="polite"`; active difficulty label shown in footer
- **Category filter chips** — 8 multi-select chips on welcome screen (Video Games, Movies, Anime, Comics, Books, Cartoons, TV Shows, Pop Culture); selected categories are passed to `POST /api/v2/game/start` to narrow the candidate pool; daily challenge always uses the full pool regardless of filter
- **Persistent preferences** — difficulty and category selections are stored in `localStorage` via `useKV` (`kv:pref:difficulty`, `kv:pref:categories`) and restored on next visit; synced across tabs
- **Filtered pool size estimate** — welcome screen footer shows `~N of 500+ characters` (accent-coloured, `~` prefix signals estimate) when categories are filtered, computed from `globalStats.byCategory`; shows `500+ characters` when no filter is active
- **Questions-remaining counter** — `{N} left` badge shown beside the confidence percentage in `PlayingScreen`'s sticky header
- **Mobile UX polish** — comprehensive touch-optimised interface across all game phases
  - `QuestionCard`: gradient answer buttons (yes=emerald, no=rose, maybe=amber, unknown=slate), `ThinkingCard` rebuilt with CSS shimmer animation (no `Skeleton` component), `motion.div` wrapping buttons with `whileTap` scale feedback
  - `PlayingScreen`: custom `div` progress bar (`role="progressbar"`, smooth transition), answer history pills with Framer Motion stagger entrance, removed redundant badge/readiness box
  - `GuessReveal`: animated concentric rings with radial pulse on guess reveal, gradient character name, spring-physics reveal animation
  - `GameOver`: win heading gradient, increased confetti count (12/24 → 20/40), icon scale animation
  - `StatsDashboard` / `GameHistory`: icon badges in stat rows, gradient win numbers, border-left accent stripes, semantic colours for answer history (emerald yes, rose no, amber maybe)
  - Design tokens added to `index.css`: `animate-shimmer`, `@keyframes shimmer`, `animate-ring-pulse`, `animate-pulse-ring`, `animate-float`
  - Respects `prefers-reduced-motion` throughout
- **Daily challenge mode** — everyone thinks of the same deterministic character each UTC day
  - `GET /api/v2/daily` returns today's character ID + user completion status (character name/image only revealed after completing)
  - `POST /api/v2/daily` records completion outcome (idempotent; first write wins)
  - Character selected via `dateHash(date) % eligibleCharacters`, stable across all users; cached in KV until UTC midnight
  - `useDailyChallenge` hook — fetches status, exposes `recordCompletion(won, questionsAsked)`
  - Welcome screen card shows play button (if not completed) or result with character name + question count (if completed)
  - `POST /api/v2/game/start` accepts optional `characterId` to pin a specific character into the pool (used by daily challenge)
- **Keyboard shortcuts** — Y / N / M / U answer the current question without clicking; ignored when focus is inside an input; desktop-only hint label shown below answer buttons
- **AI win rate stat** — welcome screen footer now shows "AI wins X% of N games" once ≥10 games are recorded
- **User answer reveal on loss** — when the AI fails to guess, `GameOver` now shows a "Who were you thinking of?" input field
- `POST /api/v2/game/reveal` endpoint — accepts the character name + session Q&A answers:
  - Fuzzy-matches the name against `characters` table (exact then LIKE)
  - Backfills `null` attribute values with confidence 0.5 from confident yes/no answers
  - Queues `system:reveal:` correction votes in KV for any contradicting attribute values
  - Stores a `game_reveals` audit row regardless of whether the character was found
- `game_reveals` D1 table — stores `actual_character_name`, `actual_character_id`, `answers` (JSON), `attributes_filled`, `discrepancies`, `created_at`
- Migration `0016_game_reveals.sql` applied to both production and preview databases

### Changed

- **Soft scoring resilience** — `SCORE_MISMATCH` raised from `0.0` → `0.05`; a single wrong/inconsistent answer no longer permanently zeros out the correct character
- **Fuzzy hard-filter** — `filterPossibleCharacters` now tolerates 1 mismatch (`MAX_MISMATCHES=1`) before eliminating a character, preventing premature elimination from one bad answer
- **Singleton guard** — AI no longer guesses on a singleton candidate until at least 5 questions have been asked (was 0), avoiding false-confident guesses early in the game
- **Zero-candidates fallback** — if all candidates are eliminated (contradictory answers), the engine now forces a guess rather than stalling
- **`detectContradictions` accuracy** — fixed to use the hard-filter count rather than soft probability scores, so contradiction detection is consistent with filtering logic
- Deleted 3 duplicate questions from production DB (`q176` isFromMovie, `q171` isVideoGameCharacter, `q177` isFromBook) that caused double-elimination when the same question appeared twice

### Fixed

- **CI `test-e2e` job** — `npx playwright install --with-deps chromium` was skipped entirely on browser cache hits, leaving system dependencies (apt packages: libglib, libnss, etc.) uninstalled; separated into `npx playwright install chromium` (conditional on cache miss) + `npx playwright install-deps chromium` (always runs)

---

## [1.1.0] — 2025-07-21

### Changed

- Simplified home screen — removed difficulty selector, category picker, AI-Enhanced toggle, and Server Mode toggle
- Hardcoded game settings: server mode always on, AI-enhanced always on, 15 questions (medium difficulty)
- Free-text answer input now always visible (no longer gated behind LLM mode toggle)
- Streamlined WelcomeScreen to hero section + single "Start Game" button + collapsible "How It Works"

### Removed

- `useLocalGame` hook and client-side game engine integration (all games now use server engine)
- Settings UI: difficulty selector, category picker, AI-Enhanced toggle, Server Mode toggle
- Lazy-loaded visualization components from PlayingScreen (ProbabilityLeaderboard, PossibilitySpaceChart, PossibilityGrid)
- Server/AI mode badges from gameplay header
- "Top candidate" hint from local-mode gameplay
- `serverMode` and `llmMode` props from all components

---

## [1.0.0] — 2026-04-19

### Added

- Rename project from "Mystic Guesser" to **Andernator**
- Server mode integration into App.tsx — toggle between local and server engine
- Session resume capability for interrupted server games
- `imageUrl` on `topCandidates` in guess results
- Admin bulk attribute upload endpoint
- Comprehensive test suite across modules

### Changed

- Refactor game logic and server interactions for consistency
- Enhanced UI components for better touch targets and responsive design
- Improved test accuracy and consistency

### Fixed

- Cloudflare AI Gateway endpoint for production and preview environments

---

## [0.9.0] — 2026-04-18 — Server Engine & Infrastructure

### Added

- **Phase 6: Server-side game engine** — Bayesian engine ported to Workers (`functions/api/v2/_game-engine.ts`)
  - `POST /api/v2/game/start` — creates KV session, queries D1 character pool (500 chars, ≥5 attributes)
  - `POST /api/v2/game/answer` — processes answer, returns next question or guess
  - `POST /api/v2/game/result` — records win/loss stats in `game_stats` table
  - `useServerGame` hook for client integration
- **Phase 5: Character images via R2** — download → sharp → WebP → R2 (S3 API)
- AI attribute enrichment pipeline (`scripts/ingest/enrich.ts`)
- Character ingestion pipeline (`scripts/ingest/`) — AniList, WikiData, TMDB, IGDB, ComicVine adapters
- Expanded attribute taxonomy (150+ attributes) with generation script
- Seed SQL generation from `DEFAULT_CHARACTERS` and `DEFAULT_QUESTIONS`
- D1 migrations: `game_stats` table, `DEFAULT_CHARACTERS` attributes seed, image URLs
- Security headers and caching rules for static assets
- Pre-commit hook (Husky)
- Playwright and Context7 MCP configurations
- Performance optimizations: lazy loading, improved caching, new API endpoints

### Changed

- Enhanced CI workflow: improved Node version, caching, deployment steps, smoke tests, bundle size check
- `packageManager` field added to `package.json` for CI pnpm setup

### Fixed

- CI typecheck errors for lucide-react deep imports and `ErrorFallback`
- pnpm setup in deploy jobs for `wrangler-action`

---

## [0.8.0] — 2026-04-18 — Polish & Data Pipeline

### Added

- `PossibilityGrid` component for visual representation of character status
- Onboarding overlay and coach marks for first-time users
- Game over narrative with win streak tracking
- Enhanced `GuessReveal` with confidence display and animation + suspense sound effects
- Centralized storage keys and constants (`src/lib/constants.ts`)
- Pop-culture character category
- Theme toggle and offline notifications with service worker caching
- Bundle size check in CI (700KB limit)
- New character entries: Princess Leia, Luigi, Optimus Prime, and others
- Questions prop to `TeachingMode` with gameplay attributes mapping

### Changed

- Enhanced gameplay logic: improved attribute handling, soft evidence scoring, top candidates in reasoning
- Refactored analytics to lazy loading
- Enhanced error handling and response codes in LLM API
- Improved user feedback in API error handling
- Collapsible sections for game instructions and settings

---

## [0.7.0] — 2026-04-18 — Visualization & UX

### Added

- `PossibilitySpaceChart` — Recharts visualization of candidate pool over game
- `ProbabilityLeaderboard` — Top characters by Bayesian probability
- Middleware support for API endpoints

### Changed

- Removed 7 unused dependencies
- Removed unused functions and cleaned up sync logic
- Code structure refactoring for readability

---

## [0.6.0] — 2026-04-17 — Wave Features

### Added

- **Wave 1**: Engine bug fixes, sharing fix, types cleanup, characters API, config
- **Wave 1b**: Questions, stats, corrections, sync APIs
- **Wave 2**: IndexedDB persistence, sync service, worker hardening, streaming LLM
- **Wave 3**: Hook robustness + session recovery
- **Wave 4**: Navigation, teaching flow, game-over, accessibility, progress indicators
- **Wave 5**: LLM gameplay — dynamic questions, narrative, conversational
- **Wave 6**: Data cleanup library + cost & hygiene dashboards
- **Wave 7**: Tests, cleanup, accessibility, PWA polish
- Configured `GUESS_KV` namespace ID

---

## [0.5.0] — 2026-04-16 — Core Platform

### Added

- Game history feature with state management
- Challenge sharing with URL encoding and sharing options
- Sound effects and mute functionality with analytics tracking
- PWA support: service worker, manifest, icons
- Testing framework with initial tests for game engine and question generator
- Character categories and difficulty settings (easy/medium/hard)
- Developer tools toggle and character name validation in `TeachingMode`
- LLM API integration and ESLint configuration
- Enhanced question selection: boosted differentiating questions for top-2 candidates + contradiction detection

### Changed

- Replaced `@github/spark` `useKV` with localStorage implementation
- Refactored code structure for readability and maintainability

---

## [0.1.0] — 2026-04-16 — Initial Release

### Added

- **Core game**: AI-powered guessing game with Bayesian deduction engine
- Teaching mode to add characters when AI guesses incorrectly
- Question generation from user-taught characters
- 57+ character attributes covering physical traits, abilities, relationships, origins, personality
- Stats dashboard: question usage, character pool diversity
- Character comparison tool: attribute overlaps analysis
- Attribute coverage report
- Rule-based attribute recommendations by character type
- AI-powered recommendations (GPT-4o) with complete and focused analysis modes
- Category filters: environment, equipment, habitat, abilities, personality
- Multi-category attribute enhancer
- Spark configuration and initial project setup
