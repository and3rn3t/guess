# Changelog

All notable changes to this project are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

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
