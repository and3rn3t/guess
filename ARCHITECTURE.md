# Architecture

> Single source of truth for system design. For product spec and design direction, see [PRD.md](PRD.md).

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│  Client (React 19 SPA)                                  │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐  │
│  │ Game UI  │ │ Engine   │ │ Analytics │ │ Teaching │  │
│  │ screens  │ │ (server) │ │ dashboard │ │ mode     │  │
│  └────┬─────┘ └────┬─────┘ └─────┬─────┘ └────┬─────┘  │
│       │             │             │             │        │
│       └─────────────┴──────┬──────┴─────────────┘        │
│                            │                             │
│  localStorage (useKV)    IndexedDB (db.ts)               │
└────────────────────────────┼─────────────────────────────┘
                             │ HTTPS
┌────────────────────────────┼─────────────────────────────┐
│  Cloudflare Pages          │                             │
│  ┌─────────────────────────▼───────────────────────────┐ │
│  │  Workers (functions/api/)                           │ │
│  │  ┌──────────┐ ┌────────────┐ ┌───────────────────┐ │ │
│  │  │ v1 (KV)  │ │ v2 (D1)    │ │ LLM (OpenAI via  │ │ │
│  │  │ legacy   │ │ game engine│ │ AI Gateway)       │ │ │
│  │  └────┬─────┘ └──┬───┬────┘ └─────────┬─────────┘ │ │
│  └───────┼──────────┼───┼─────────────────┼───────────┘ │
│          │          │   │                 │             │
│    ┌─────▼──┐  ┌────▼┐ ┌▼────────┐ ┌─────▼──────────┐  │
│    │ KV     │  │ D1  │ │ R2      │ │ AI Gateway     │  │
│    │ store  │  │ SQL │ │ images  │ │ (cache/logs)   │  │
│    └────────┘  └─────┘ └─────────┘ └────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Tech stack**: React 19 · TypeScript (strict) · Vite 8 · Tailwind CSS v4 · shadcn/ui · motion/react · Cloudflare Pages/Workers/D1/R2

Mobile iOS track: React Native / Expo parity delivery with shared backend contracts and shared game semantics. See `docs/mobile/ios-architecture-map.md` and `docs/mobile/ios-feature-parity-plan.md`.

---

## Project Structure

```
src/
├── App.tsx                    # Root — game phase state machine
├── main.tsx                   # Entry point
├── components/
│   ├── ui/                    # shadcn/ui primitives (DO NOT manually edit)
│   ├── WelcomeScreen.tsx      # Landing + one-click game start
│   ├── PlayingScreen.tsx      # Active Q&A gameplay
│   ├── GuessReveal.tsx        # Character guess with reasoning
│   ├── GameHistory.tsx        # Past games list
│   ├── TeachingMode.tsx       # User-guided character creation
│   ├── StatsDashboard.tsx     # Win/loss analytics
│   ├── CostDashboard.tsx      # LLM token usage tracking
│   ├── DataHygiene.tsx        # DB health checks
│   ├── CharacterComparison.tsx# Side-by-side attribute diff
│   ├── PossibilityGrid.tsx    # Visual candidate matrix
│   ├── CharacterImage.tsx         # Shimmer skeleton + avatar fallback for character images
│   ├── DescribeYourselfScreen.tsx # 10 first-person questions → character match
│   ├── PersonaSelector.tsx        # 3-card Poirot/Watson/Sherlock difficulty picker
│   ├── ProbabilityLeaderboard.tsx
│   ├── WeeklyRecapCard.tsx        # Weekly win/loss summary card
│   ├── QuestionManager.tsx        # Admin question CRUD
│   ├── MultiCategoryEnhancer.tsx  # Multi-category attribute enhancement
│   └── ...                    # ~30 feature components total
├── hooks/
│   ├── useGameState.ts        # Reducer: phase, answers, characters, currentQuestion
│   ├── useKV.ts               # localStorage + cross-tab sync
│   ├── useServerGame.ts       # Server game via /api/v2/game/*
│   ├── useDailyChallenge.ts   # Daily challenge status + completion recording
│   ├── useDailyStreak.ts      # Consecutive-day win streak from game history
│   ├── useGlobalStats.ts      # AI win rate stat from server
│   ├── useAchievements.ts     # Achievement unlock tracking
│   ├── usePersonalBest.ts     # Per-difficulty personal best tracking
│   ├── useWeeklyRecap.ts      # Weekly game summary
│   ├── useInstallPrompt.ts    # PWA install prompt (beforeinstallprompt)
│   ├── useSWUpdate.ts         # Service worker update detection
│   ├── useWakeLock.ts         # Screen wake lock during active games
│   ├── useOnlineStatus.ts     # navigator.onLine tracking
│   ├── useSound.ts            # Mute state (external store)
│   └── use-mobile.ts          # Responsive breakpoint (768px)
├── lib/
│   ├── types.ts               # Core types: Character, Question, Answer, Difficulty, etc.
│   ├── gameEngine.ts          # Bayesian scoring, info gain, question selection
│   ├── database.ts            # DEFAULT_CHARACTERS (57+), DEFAULT_QUESTIONS (50+)
│   ├── questionGenerator.ts   # LLM-driven question synthesis
│   ├── db.ts                  # IndexedDB helpers (gameHistory, analytics)
│   ├── sync.ts                # Server sync with cache invalidation
│   ├── llm.ts                 # OpenAI client with retry/backoff
│   ├── prompts.ts             # LLM prompt templates
│   ├── dataCleanup.ts         # Contradiction detection, question scoring
│   ├── analytics.ts           # Client-side event logging
│   ├── constants.ts           # Scoring weights, storage keys, retry config
│   ├── sounds.ts              # Web Audio API tone synthesis
│   ├── sharing.ts             # Base64url challenge encoding
│   ├── migrations.ts          # localStorage schema migrations
│   ├── attributeRecommender.ts# Attribute recommendation logic
│   ├── categoryRecommender.ts # Category recommendation logic
│   ├── idle.ts                # Idle detection helpers
│   ├── view-transitions.ts    # View Transition API helpers
│   └── utils.ts               # cn() — Tailwind class merging
└── styles/
    └── theme.css              # CSS variables, Space Grotesk font, glassmorphism

functions/api/                 # Cloudflare Workers
├── _helpers.ts                # Env interface, rate limiting, auth, D1 query builders
├── llm.ts                     # Non-streaming LLM (24h response cache in D1 `kv_cache`)
├── llm-stream.ts              # Streaming completions (SSE)
├── admin/upload-attrs.ts      # Bulk attribute upload (ADMIN_CREDENTIAL)
├── images/[[path]].ts         # R2 image serving (1yr CDN cache)
└── v2/
    ├── characters.ts          # D1-backed character CRUD
    ├── questions.ts           # Questions + attribute coverage stats
    ├── attributes.ts          # Attribute definitions + coverage %
    ├── stats.ts               # Database overview
    ├── daily/
    │   ├── index.ts           # GET/POST daily status + completion tracking
    │   ├── leaderboard.ts     # Daily top-20 leaderboard by win/efficiency
    │   └── _shared.ts         # Deterministic daily character selection helpers
    ├── events.ts              # Client→server analytics event pipeline (POST /api/v2/events)
    ├── history.ts             # Server-side game history (GET /api/v2/history)
    ├── _llm-rephrase.ts       # LLM question rephrasing with 24h D1 cache
    └── game/
        ├── _game-engine.ts    # Server-side Bayesian engine (ported from client)
        ├── start.ts           # Initialize session → first question
        ├── answer.ts          # Process answer → next question or guess
        ├── skip.ts            # Skip current question → next-best (no budget decrement)
        ├── reject-guess.ts    # Player rejects a guess → continue game
        ├── result.ts          # Record outcome to game_stats
        ├── resume.ts          # Restore interrupted session from D1 `session_state`
        └── reveal.ts          # User reveals answer on loss → backfill DB attributes

scripts/                       # Build & data tools
├── openapi/
│   ├── generate.ts            # Build deterministic OpenAPI artifacts from functions/api handler exports
│   ├── validate.ts            # Contract checks: refs, operation IDs, security, and endpoint coverage
│   ├── check-drift.ts         # CI drift gate against committed artifacts
│   └── lib.ts                 # Endpoint inventory + OpenAPI document assembly helpers
├── generate-seed-sql.ts       # database.ts → SQL INSERT statements
├── generate-attributes.ts     # LLM → expanded attribute taxonomy
├── backfill-attributes.ts     # LLM → classify existing characters
├── upload-enrichment.ts       # Staging → production via admin API
└── ingest/
    ├── run.ts                 # Orchestrator (AniList, WikiData, TMDB, etc.)
    ├── enrich.ts              # LLM enrichment pipeline
    ├── images.ts              # Image download → sharp → WebP → R2
    ├── dedup.ts               # Character deduplication
    └── sources/               # Per-source adapter modules

packages/
└── game-engine/               # @guess/game-engine — shared game logic workspace package
    └── src/
        ├── index.ts           # Public exports
        ├── types.ts           # Shared type definitions (Character, Question, Answer, Difficulty, etc.)
        ├── constants.ts       # Scoring weights, readiness thresholds, difficulty configs
        ├── scoring.ts         # Bayesian probability calculation & hard filters
        ├── question-selection.ts # Information gain optimization, best-question algorithm
        ├── question-selection-mcts.ts # MCTS alternative question selector (selectBestQuestionMCTS)
        └── guess-readiness.ts # Guess decision logic (confidence gates, entropy, forced-guess fallback)

migrations/                    # D1 SQLite migrations
├── 0001_initial.sql           # Schema: characters, attributes, questions, stats
├── 0002_seed.sql              # Seed DEFAULT_CHARACTERS & DEFAULT_QUESTIONS
├── 0003–0015_*.sql            # Expanded attributes, backfills, images, game stats, guess analytics
├── 0016_game_reveals.sql      # game_reveals table for user-disclosed answers
├── 0017_attribute_count.sql   # Attribute count denormalization
├── 0018_fts_search.sql        # Full-text search index
├── 0019_attributes_json.sql   # Attributes JSON column
├── 0020_sim_game_stats.sql    # Simulation game stats
├── 0021_remove_duplicate_has_glasses.sql  # Data cleanup
├── 0022_admin_panel.sql       # Admin panel tables
├── 0023_proposed_attributes.sql  # proposed_attributes table
├── 0024_dropped_at_phase.sql  # Session funnel: dropped_at_phase column
├── 0025_client_events.sql     # Client analytics event pipeline table
├── 0026_attribute_disputes.sql   # attribute_disputes table (adversarial validation)
├── 0027_error_logs.sql        # error_logs table (Worker observability; capped at 1 000 rows)
├── 0028_dedup_attributes.sql  # Deduplicate attribute pairs; deactivate zero-info attributes
├── 0029_fill_missing_questions.sql  # Fill questions rows for active attributes missing them
├── 0030_question_difficulty.sql     # difficulty column on questions (easy/medium/hard)
├── 0031_character_confusions.sql    # Character pair confusion tracking (from real games)
├── 0032_question_attempts.sql       # Per-question shown/answer-mix tracking
├── 0033_game_stats_variant.sql      # difficulty_variant column on game_stats
├── 0034_evidence_trail.sql          # Nullable evidence column on character_attributes (provenance tags)
├── 0035_agreement_score.sql         # agreement_score + agreement_signals columns on character_attributes
├── 0036_data_quality_snapshots.sql  # Daily data-quality snapshot capture
├── 0037_attribute_drift.sql         # Attribute value drift detection
├── 0038_alerts.sql                  # Anomaly alert table (nightly cron writes; optional webhook)
├── 0039_question_retirement.sql     # retired_at + retired_reason columns on questions
├── 0040_attribute_embeddings.sql    # attribute_embeddings + question_dedup_dismissed (Workers AI)
├── 0041_aha_moment.sql              # aha_attr + aha_jump columns on game_stats
├── 0042_triage_queue.sql            # Catastrophic-failure replay queue
├── 0043_character_trivia.sql        # Nullable trivia column on characters (JSON array)
├── 0043_question_metadata.sql       # Question metadata extension
├── 0044_daily_results.sql           # Daily challenge results (date + user_id PK)
├── 0045_closure_queue_snapshot_metrics.sql  # Closure queue lane counts in data_quality_snapshots
├── 0046_curation_queue.sql          # Curator closure queue table
├── 0047_kv_migration.sql            # KV → D1: kv_cache + session_state tables
└── chunks/                    # Split data imports (chunk_001–053.sql)
```

---

## Mobile Architecture (iOS)

The active iOS implementation is React Native / Expo (SwiftUI was an earlier exploration). Player-facing screens live in `apps/mobile/src/screens/**`; the app shell is `apps/mobile/app/index.tsx`.

- Use native presentation and interaction patterns for player-facing screens.
- Reuse backend/API contracts and shared game semantics, not web UI primitives.
- Keep architecture boundaries aligned with `docs/mobile/native-surface-policy.md`.

Primary references:

- `docs/mobile/ios-architecture-map.md` for layers, boundaries, and implementation sequence.
- `docs/mobile/ios-feature-parity-plan.md` for MP milestone gates.
- `docs/mobile/parity-matrix.md` for feature-level parity truth and evidence links (all MP.1–MP.7 milestones closed ✅ 2026-05-10).

---

## Game Engine

The core deduction algorithm lives in `src/lib/gameEngine.ts` (client) and `functions/api/v2/_game-engine.ts` (server port).

### Probability Calculation

`calculateProbabilities(characters, answers, options?)` uses a multiplicative Bayesian scoring model. Each character starts with a popularity prior and each answer multiplies its score by a factor:

| Answer | Attribute value | Factor |
|---|---|---|
| `yes` | `true` (match) | 1.0 (`SCORE_MATCH`) |
| `yes` | `false` (mismatch) | 0.05 (`SCORE_MISMATCH`) |
| `yes` / `no` | `null` (unknown) | 0.35 (`SCORE_UNKNOWN`) |
| `no` | `false` (match) | 1.0 |
| `no` | `true` (mismatch) | 0.05 |
| `maybe` | `true` | 0.7 (`SCORE_MAYBE`) |
| `maybe` | `false` | 0.3 (`SCORE_MAYBE_MISS`) |
| `unknown` | any | 1.0 (no effect) |

`SCORE_MISMATCH = 0.05` (non-zero) means a single wrong attribute doesn't eliminate a character — resilient to 1–2 bad attribute values or user errors. The popularity prior decays with game progress (full weight early → neutral at the final question). Scores are normalised to 0–1 probabilities across the candidate pool.

`filterPossibleCharacters` hard-filters with `MAX_MISMATCHES = 1` — a character survives if it has at most 1 definite mismatch, preventing premature elimination from one bad answer while still narrowing the field.

### Question Selection

`selectBestQuestion(characters, answers, questions, options?)` optimizes for **information gain** (entropy reduction):

1. For each unused question, simulate yes/no/maybe splits across the candidate pool
2. Calculate weighted entropy of each split
3. Boost questions that differentiate the top candidates
4. Penalize back-to-back questions from the same attribute category (diversity tracking)
5. Pre-compute null ratios per question to avoid redundant scans
6. In the endgame, prefer questions that explicitly separate the strongest remaining suspects
7. Select the question with maximum expected information gain, with reduced late-game randomness

`coverageMap` (attribute → coverage %) is pre-computed at session start and passed via `ScoringOptions` to avoid recomputing it on every answer. Rephrased question text is cached in D1 (`kv_cache` keyed `question-rephrase:{id}`) with a 24h TTL.

### Guess Decision

`evaluateGuessReadiness()` and `shouldMakeGuess()` now use a stricter readiness model. A guess is made when the posterior is genuinely concentrated, not just because one candidate is slightly ahead.

- Hard budget is exhausted, **or**
- Confidence, top-2 gap, viable-candidate count, and entropy all satisfy the readiness gate, **or**
- Overwhelming high-certainty conditions are met

After a rejected guess, the engine becomes stricter and enforces a short cooldown before another guess is allowed.

### Reasoning Generation

`generateReasoning()` builds human-readable explanations of the AI's strategy — why it asked each question, how answers affected probabilities, and what it's considering for its next move.

---

## Game Phases & State

The app is a state machine driven by the `GamePhase` union type:

```
welcome → playing → guessing → gameOver
                       ↓            ↓
                   teaching     (restart)
```

Additional phases: `manage`, `demo`, `stats`, `compare`, `coverage`, `recommender`

**State management**:

- `useGameState` — useReducer managing `phase`, `answers[]`, `characters[]`, `currentQuestion`, `reasoning`
- `useServerGame` — Routes gameplay through `/api/v2/game/*` endpoints
- `useKV<T>(key, default)` — localStorage persistence with JSON serialization + cross-tab `storage` event sync

**KV storage keys** (prefixed `kv:` in localStorage):

- `characters` — User-added characters
- `questions` — User-added questions
- `game-history` — Past game results

---

## Data Layer

### Cloudflare Bindings

Current bindings declared under `[env.production]` and mirrored in `[env.preview]` (`wrangler.toml`):

| Binding | Type | Production resource | Preview resource | Purpose |
|---|---|---|---|---|
| `GUESS_DB` | D1 | `guess-db` | `guess-db-preview` | Primary SQLite database |
| `GUESS_IMAGES` | R2 | `guess-images` | `guess-images` | Character image storage |
| `LLM_COSTS` | Analytics Engine | `llm_costs` | `llm_costs_preview` | Per-request LLM cost telemetry (I.2) |
| `WORKER_TAIL` | Analytics Engine | `worker_tail` | `worker_tail_preview` | Worker observability rows (I.4) |
| `AI` | Workers AI | shared | shared | Question dedup embeddings (B.4) |
| `RATE_LIMITER` | Durable Object | (dashboard) | (dashboard) | Per-IP rate limiting (`functions/_rate-limiter-do.ts`) |

KV bindings (`GUESS_KV`, `GUESS_ASSETS`) were removed in v1.7 — see [KV (Removed)](#kv-removed). Tail Worker consumer is wired via the Cloudflare dashboard (Pages projects do not support `tail_consumers` in `wrangler.toml`).

### D1 (SQLite)

Primary database for the server-side engine and character catalog.

**Tables**: `characters`, `character_attributes`, `questions`, `question_coverage`, `attribute_definitions`, `game_stats`, `game_plays`, `game_sessions`, `game_reveals`, `attribute_disputes`, `proposed_attributes`, `error_logs`, `client_events`, `attribute_embeddings`, `question_dedup_dismissed`, `alerts`, `character_confusions`, `question_attempts`, `data_quality_snapshots`, `attribute_drift`, `question_retirement`, `aha_moment` (columns on `game_stats`), `triage_queue`, `character_trivia` (column on `characters`), `question_metadata`, `daily_results`, `closure_queue_snapshot_metrics`, `curation_queue`, `kv_cache`, `session_state`

- 187 DEFAULT_CHARACTERS seeded via migrations
- 53K+ ingested characters from AniList, WikiData, TMDB, IGDB, ComicVine
- Character pool for server games: top 500 by popularity with ≥5 non-null attributes

### KV (Removed)

All game-session and automation-report data previously stored in KV has been migrated to D1 (`kv_cache` and `session_state` tables via migration `0047_kv_migration.sql`). The `_d1_cache.ts` helper provides `d1CacheGet`/`d1CachePut`/`d1ConfigGet*` utilities for D1-backed cache access. `GUESS_KV` and `GUESS_ASSETS` bindings have been removed from `wrangler.toml`.

Legacy v1 API endpoints (`/api/characters`, `/api/questions`, `/api/corrections`, `/api/stats`, `/api/sync`) have been fully removed (RF.3). Their last form was 410 Gone stubs; the route files no longer exist. All callers must use the `/api/v2/*` successors.

### Daily challenge persistence

- `daily_results` (D1, migration `0044_daily_results.sql`) stores one row per `(date, user_id)` with `won`, `questions_asked`, and `completed_at`
- `GET /api/v2/daily` returns date + deterministic daily character id + caller completion state
- `POST /api/v2/daily` writes completion idempotently (first write wins)
- `GET /api/v2/daily/leaderboard` returns top-20 rows ordered by `won DESC, questions_asked ASC, completed_at ASC`

### R2

Object storage for character images.

- Bucket: `guess-images`
- Formats: thumbnail (64×64 WebP), profile (256×256 WebP)
- Served via `functions/api/images/[[path]].ts` with 1-year CDN cache
- Upload pipeline: `scripts/ingest/images.ts` → sharp → WebP → R2 (S3-compatible API)

### Workers AI (`AI` binding)

Optional Cloudflare Workers AI binding (`[ai] binding = "AI"` under both
`[env.production]` and `[env.preview]` in `wrangler.toml`). Used by B.4
question deduplication via `@cf/baai/bge-base-en-v1.5` (768-dim embeddings,
~1 neuron per call, 10k neurons/day on the free tier). The binding is
declared optional in `Env` (`AI?: Ai`) so local dev without the binding still
type-checks; endpoints that require it (e.g. `POST /api/admin/questions/duplicates/backfill`)
return `503 Workers AI binding not configured` rather than crashing. Vectors
are persisted as `Float32Array`-backed BLOBs in `attribute_embeddings`,
keyed by `attribute_key`, alongside the model name and an FNV-1a `text_hash`
so re-embeds are skipped when the question copy hasn't drifted.

### Client-Side Storage

- **localStorage** (`useKV` hook): Characters, questions, game history, settings
  - `kv:pref:difficulty` — persisted difficulty selection (Easy/Medium/Hard)
  - `kv:pref:categories` — persisted category filter array
- **IndexedDB** (`db.ts`): Game history, analytics events (structured data)

---

## Security

### Admin Auth (Basic Auth, centralized in middleware)

Admin surface area — both the SPA shell (`/admin*`) and the JSON API
(`/api/admin*`) — is gated by HTTP Basic Auth enforced centrally in
[functions/_middleware.ts](functions/_middleware.ts). There is **no
per-handler `requireAdmin()` call**; gating is a path-prefix predicate.

The predicate lives in [functions/_admin_paths.ts](functions/_admin_paths.ts)
(`isAdminPath(path)`) so it can be re-used by tests. Credentials are read from
the `ADMIN_CREDENTIAL` Cloudflare secret in either `sha256:<hex>` (preferred)
or plaintext `user:pass` (legacy) form, compared in constant time.

Failed attempts are rate-limited per-IP via `kv_cache` (15-minute window,
10-attempt cap). An internal `X-Internal-Chain-Token` bypass exists for the
enrichment chain — single-use tokens stored in `enrich_job`, consumed on
first use.

### SE.2 — RBAC coverage gate

[functions/api/admin/__tests__/rbac-coverage.test.ts](functions/api/admin/__tests__/rbac-coverage.test.ts)
walks the on-disk file tree under `functions/api/admin/**` and asserts every
discovered route file produces a URL that `isAdminPath()` would gate. A new
admin route placed outside the gated tree fails this test unless it is
explicitly listed in `INTENTIONAL_PUBLIC_ADMIN_ROUTES` (currently empty)
with a justifying comment. The test is part of `pnpm validate`.

---

## Error Pipeline

Two parallel observability streams keep the hot path off D1:

1. **Workers Analytics Engine (telemetry)** — the [tail-worker/](tail-worker/)
   Worker receives every main-Worker invocation as a Cloudflare Tail event
   and writes one structured AE data point per request
   (`worker_tail` / `worker_tail_preview` datasets) via
   [tail-worker/src/_tail_metrics.ts](tail-worker/src/_tail_metrics.ts). This
   powers the AN.29 latency budget panel and AN.30 live-ops strip. The
   consumer is wired through the Cloudflare dashboard
   (Pages → guess → Settings → Functions → Tail consumers) because Pages
   projects don't accept `tail_consumers` in `wrangler.toml`.

2. **D1 `error_logs` table (forensic detail)** — handlers call
   `logError(env.GUESS_DB, source, level, message, err, ctx)` from
   [functions/api/_helpers.ts](functions/api/_helpers.ts), which executes a
   batched `INSERT INTO error_logs` + ring-buffer `DELETE` (capped at 1 000
   rows). `logError` returns `Promise<void>` and is `.catch(() => {})`-ed
   internally so it never throws.

   **PI.3 hot-path contract:** request handlers MUST NOT `await
   logError(...)`. The call site is either fire-and-forget
   (`context.waitUntil(logError(...))`) or a bare statement; awaiting it
   couples response latency to D1 write latency and risks bubbling failures
   as 500s. Cron / admin hygiene jobs may await — they aren't on a user
   request path. The contract is enforced by
   [functions/api/_log_error_hot_path.test.ts](functions/api/_log_error_hot_path.test.ts)
   which walks `functions/api/**` and rejects new `await logError(...)`
   outside an explicit allowlist.

A future PI.3.b will move the D1 writeback into the Tail Worker so
`logError` only emits structured `console.error` JSON and the Tail consumer
batches the inserts — eliminating the last D1 round-trip from
`waitUntil` callbacks. Deferred from this batch because it requires
coordinated multi-deploy sequencing (Tail Worker must be live before
middleware changes ship) outside the current change budget.

---

## API Endpoints

### v1 — Removed

The legacy KV-backed endpoints (`/api/characters`, `/api/questions`, `/api/corrections`, `/api/stats`, `/api/sync`) have been removed entirely as of RF.3. Use the `/api/v2/*` successors below.

### v2 — D1-Backed

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v2/characters` | GET, POST, PUT | Full CRUD on characters table |
| `/api/v2/questions` | GET | Questions + attribute coverage stats |
| `/api/v2/attributes` | GET | Attribute definitions + coverage % |
| `/api/v2/stats` | GET | Database overview (counts, categories) |
| `/api/v2/daily` | GET | Today's challenge character + user completion status |
| `/api/v2/daily` | POST | Record daily challenge completion (idempotent) |

### v2 Game Engine

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v2/game/start` | POST | Initialize session → first question |
| `/api/v2/game/answer` | POST | Process answer → next Q or guess |
| `/api/v2/game/skip` | POST | Skip current question → return next-best question (free; no budget decrement) |
| `/api/v2/game/reject-guess` | POST | Player rejects guess → continue asking questions |
| `/api/v2/game/resume` | GET | Restore interrupted session |
| `/api/v2/game/result` | POST | Record outcome + stats |
| `/api/v2/game/reveal` | POST | User-disclosed answer on loss → backfill null attributes, queue corrections |

### Guess Analytics

`game_stats` now stores dedicated guess-readiness analytics:

- `confidence_at_guess`
- `entropy_at_guess`
- `remaining_at_guess`
- `guess_trigger`
- `forced_guess`
- `gap_at_guess`
- `alive_count_at_guess`
- `questions_remaining_at_guess`

Calibration queries live in [docs/guess-readiness-queries.sql](docs/guess-readiness-queries.sql) and can be run via:

- `pnpm analytics:readiness:preview`
- `pnpm analytics:readiness:prod`

### Other

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/llm` | POST | Non-streaming LLM call (cached 24h) |
| `/api/llm-stream` | POST | Streaming completions (SSE) |
| `/api/images/{id}/{size}.webp` | GET | R2 image serving |
| `/api/v2/events` | POST | Client→server analytics event pipeline |
| `/api/v2/history` | GET | Server-side game history |
| `/api/admin/upload-attrs` | POST | Bulk attribute upload (ADMIN_SECRET) |
| `/api/admin/attribute-disputes` | GET, PATCH | Adversarial validation dispute review |
| `/api/admin/proposed-attributes` | GET, POST, PATCH | Community-proposed attribute management |
| `/api/admin/analytics` | GET | Admin analytics dashboard data |
| `/api/admin/automation-status` | GET | Latest cron automation run report for Mission Control |
| `/api/admin/error-logs` | GET | Worker error log viewer |
| `/api/admin/pipeline` | GET | Enrichment pipeline status |

### Cron Triggers

| Schedule (UTC) | Handler | Purpose |
|---|---|---|
| `5 0 * * *` (00:05 daily) | `functions/cron/index.ts` → `runScheduled` | Nightly housekeeping. Logs a `cron.tick`, runs AN.33 anomaly checks (`functions/cron/_anomaly_check.ts`), then runs guarded admin automation (`functions/cron/_automation.ts`): daily data-quality snapshot capture, duplicate-embedding backfill, one-step enrichment kick, and optional auto-retirement for low-signal questions. |

Cron Triggers for the Pages project must be enabled via the Cloudflare dashboard
(Workers & Pages → guess → Settings → Triggers → Add Cron Trigger). `wrangler.toml`
`[triggers]` is read by Workers projects, not Pages.

**AN.33 anomaly alerts** — the nightly cron computes a 14-day baseline (mean ± 2σ)
per metric over `data_quality_snapshots` (`data_health_score`, `coverage_pct`,
`evidence_pct`, `agreement_avg`, `open_disputes`). Crossings are written to the
`alerts` table (migration 0038) and, when `ALERTS_WEBHOOK_URL` is configured,
POSTed as a Slack/Discord-compatible `{ text }` payload. `ALERTS_DASHBOARD_URL`
optionally appends a "view chart" link. Webhook failures are recorded inline on
the alert row and never fail the cron run.

**Admin automation switches** — the same cron tick also runs conservative
maintenance workloads behind env flags so operators can stage rollout safely:

- `AUTO_CAPTURE_DQ_SNAPSHOT` (default on): writes one `data_quality_snapshots`
  row/day when one does not already exist for UTC "today".
- `AUTO_DUPLICATES_BACKFILL` (default on) + `AUTO_DUPLICATES_LIMIT` (default 40,
  clamp 1..200): runs duplicate-question embedding backfill using Workers AI.
- `AUTO_ENRICH_ONE` (default on): runs one server-side enrichment step per tick
  when `OPENAI_API_KEY` is present and no enrich run is currently flagged.
- `AUTO_RETIRE_ENABLED` (default off): optional strict auto-retirement path using
  AN.17 scoring. Tuned by `AUTO_RETIRE_LIMIT` (default 3),
  `AUTO_RETIRE_MIN_SCORE` (default 0.9), `AUTO_RETIRE_MIN_SHOWN` (default 20),
  and `AUTO_RETIRE_WINDOW_DAYS` (default 30).

Each run writes a summary report to D1 (`kv_cache` table, key `admin:automation:last-run`)
and logs a `cron.automation` event for `wrangler tail` observability.

### Data Quality Gate (DQ.1)

A regression gate guards the enrichment pipeline against accuracy drift. The
golden set lives at `data/data-quality-golden.json` (50 hand-curated characters,
~750 high-confidence attribute assertions) and the harness lives at
`scripts/golden-regression.ts`. Both reuse the production `buildSystemPrompt`
and `buildUserPrompt` exported from `scripts/ingest/enrich.ts`, so any change
to the prompt templates, model selection, or `attribute_definitions.json` runs
through the same code path the catalog enrichment uses.

| Command | Purpose |
|---|---|
| `pnpm golden:check` | Schema-only — no network. Validates the JSON, asserts every attribute key exists, catches duplicates. Used as the first CI step. |
| `pnpm golden:regression` | Full LLM run against `gpt-4o-mini` (override with `GOLDEN_MODEL=…`). Requires `OPENAI_API_KEY` in `.dev.vars`/`.env.local` or environment. Exits non-zero if deviation > `thresholdPct` (default 3%). |
| `pnpm golden:regression --json out.json` | Same as above, plus writes a machine-readable per-character report. |

The CI gate (`.github/workflows/golden-regression.yml`) triggers only on PRs that
touch the golden set, attribute definitions, the enrichment script, the harness
itself, or the workflow file. The schema job always runs; the LLM job runs only
when (a) the PR comes from the same repo (forks lack the secret) and (b) the
`OPENAI_API_KEY` repo secret is configured. The full per-character mismatch
report is uploaded as a workflow artifact regardless of pass/fail.

### Vision Validation Gate (DQ.2)

A complementary gate validates that visual attributes (`wearsCape`, `hasBeard`,
`isFemale`, etc.) match what a vision model sees in each character's portrait.
The harness `scripts/vision-validate.ts` runs each golden character's image
through GPT-4o-mini vision and compares the model's answers to the golden set
for a fixed set of 25 visual boolean attributes. The gate fails if overall
agreement drops below 90%.

Image URLs are sourced from Wikipedia's REST summary endpoint and cached in
`data/golden-image-sources.json` (committed) so the validation is fully
reproducible — CI does not call Wikipedia at run time. Characters whose
Wikipedia page has no infobox image are skipped.

| Command | Purpose |
|---|---|
| `pnpm vision:check` | Schema-only — verifies the image cache covers the golden set and every vision-target attribute exists in the schema. No network. |
| `pnpm vision:cache-images` | Refresh `data/golden-image-sources.json` from Wikipedia. Run when adding new golden characters or when an existing entry's URL has rotted. |
| `pnpm vision:validate` | Full vision run. Requires `OPENAI_API_KEY`. Exits non-zero if agreement < 90%. Override the model with `VISION_MODEL=…`. |
| `pnpm vision:validate --json out.json` | Same as above, plus writes a per-character / per-attribute report. |

The CI gate (`.github/workflows/vision-validate.yml`) follows the same pattern
as DQ.1: schema-only job runs on every matching PR; the vision job runs only
when the OpenAI secret is present and the PR is same-repo. Per-character
mismatches and per-attribute agreement percentages are uploaded as a workflow
artifact.

### Schema Drift Detector (DQ.21)

A network-free CI step that asserts the canonical attribute schema and every
place that names attributes stays in lockstep. The harness lives at
`scripts/schema-drift.ts` and is wired up at
`.github/workflows/schema-drift.yml`.

Source of truth: `data/enrich-cache/attribute_definitions.json` (mirror of the
D1 `attribute_definitions` table). The detector validates:

1. Schema shape — every entry has a camelCase `key`, non-empty `displayText`,
   and `categories` is null, a JSON-encoded string array, or an array. Each
   category string must be a member of the canonical `Category` union.
2. No duplicate keys.
3. Every `INSERT INTO attribute_definitions` row across `migrations/*.sql`
   declares a key in the schema, and every schema key has at least one
   migration declaring it.
4. Every key in `data/data-quality-golden.json` `expected` blocks exists in
   the schema (DQ.1).
5. Every key in the `VISION_TARGET_ATTRS` literal of
   `scripts/vision-validate.ts` exists in the schema (DQ.2).

Run locally with `pnpm schema:check`. Exits non-zero with a per-error report
on drift. The workflow triggers on PRs touching the schema cache, golden set,
migrations, the vision script, the drift script itself, or the workflow file.

### Per-Attribute Evidence Trail (DQ.28)

Migration `0034_evidence_trail.sql` adds a nullable `evidence TEXT` column to
`character_attributes`. Every new attribute write records a colon-delimited
provenance tag identifying its source. Existing rows are left `NULL` because
their provenance cannot be reconstructed.

The canonical tag format and helper builders live in
`functions/api/_evidence.ts`:

| Tag                                                  | Producer                                            |
|------------------------------------------------------|-----------------------------------------------------|
| `admin:manual:<unix-ms>`                             | Admin clicks an attribute pill (PATCH)              |
| `admin:create:<unix-ms>`                             | Admin POSTs a new character via `/api/v2/characters`|
| `community:vote:<unix-ms>`                           | `/api/admin/community` applies a majority vote      |
| `correction:<unix-ms>`                               | `/api/corrections` accepts a user correction        |
| `csv-upload:<unix-ms>`                               | `/api/admin/upload-attrs` bulk import               |
| `reveal:user=<userId>:<unix-ms>`                     | `/api/v2/game/reveal` backfill from confident answers |
| `enrichment:openai:<model>:run=<iso8601>`            | `scripts/ingest/enrich.ts` LLM enrichment run       |
| `seed:default`                                       | `scripts/generate-seed-sql.ts` default seed         |

Admin `GET /api/admin/characters/:id` returns an `evidence` map alongside
`attributes`; the character editor in `CharactersRoute` renders the source
tag in the attribute pill tooltip so curators can see exactly where each
value came from. Richer per-attribute citations (e.g. quoted Wikipedia
paragraphs) are a follow-up; this trail is the surface DQ.4 (explainable
disputes) and future provenance work hangs off.

### Cross-Source Agreement Scorecard (DQ.3)

Migration `0035_agreement_score.sql` adds two columns to
`character_attributes`:

| Column              | Type    | Meaning                                                                  |
|---------------------|---------|--------------------------------------------------------------------------|
| `agreement_score`   | REAL    | `null` when no signals exist; otherwise `[0, 1]` (1.0 = full agreement). |
| `agreement_signals` | INTEGER | Count of independent signals that fed into the score.                    |

A partial index on `agreement_score WHERE NOT NULL` keeps admin sort-by-score
queries cheap.

The pure scorer lives in `functions/api/_agreement.ts`. It accepts an array of
`AgreementSignal` records and reduces them with per-source weights:

| Source              | Weight | Source of signal                                              |
|---------------------|-------:|---------------------------------------------------------------|
| `reveal`            |   1    | Confident yes/no answer in `game_reveals` for the same attr   |
| `dispute-open`      |   2    | Open row in `attribute_disputes` (skeptic LLM still flags it) |
| `dispute-dismissed` |   2    | Reviewer rejected the dispute → corroborates stored value    |
| `dispute-resolved`  |   1    | Stored value changed → positive vote on the new value        |
| `community-vote`    |   2    | Reserved for upcoming community-vote integration              |

A row is treated as **contested** when `agreement_score < 0.6` and
`agreement_signals ≥ 3` (`CONTESTED_THRESHOLD` in the helper). The admin pill
renders an orange ring and ⚠ glyph for these rows.

The scorer is invoked offline by `scripts/compute-agreement.ts`:

```bash
pnpm agreement:dry-run     # preview env, no writes
pnpm agreement:preview     # apply to preview D1
pnpm agreement:prod        # apply to production D1
```

The script shells out to `wrangler d1 execute --remote`, buckets signals per
(character, attribute) pair, calls `computeAgreementScore`, writes a
transactional `UPDATE` batch to `data/agreement/agreement-<env>.sql`, then
applies it. Designed to run nightly via the existing adaptive-data-refresh
cron (DQ.6 / H.3) once that wiring lands.

### Logical-Constraint Validator (DQ.4)

The constraint DSL lives in `data/attribute-constraints.json` (JSON, not YAML,
so we don't ship a runtime parser dep). Three rule types are supported:

| Type            | Shape                                                           | Semantics                                              |
|-----------------|-----------------------------------------------------------------|--------------------------------------------------------|
| `mutex`         | `{ keys: string[] }`                                            | At most one of `keys` may be `true`.                    |
| `requiresOneOf` | `{ keys: string[] }`                                            | When *every* key is decided (non-null), at least one must be `true`. |
| `implies`       | `{ if: {key, value}, then: { allOf | anyOf: KeyValue[] } }`     | If antecedent decided & matches, consequent must hold.  |

The pure validator in `functions/api/_constraints.ts` (`validateAttributes`)
takes an attribute map and a constraint set and returns a list of
`Violation` records. It is partial-enrichment-friendly: missing/null keys do
not trip rules; `anyOf` clauses are skipped when every consequent is unknown.

The enrichment pipeline (`scripts/ingest/enrich.ts.storeEnrichmentResults`)
loads the rule set once per batch and inserts every violation into the
existing `enrichment_disputes` staging table at confidence `0.95` with a
reason prefixed `[constraint:<id>]`. The existing `disputes-upload` step
promotes them to `attribute_disputes` in D1 — no extra wiring needed. The
admin disputes queue + `runSkeptic` second-pass already consume that table,
so constraint failures land in the same review surface as LLM-flagged ones.

Auto-repair (re-prompt the model with the constraint and re-write the value)
remains a follow-up; routing constraint failures into the existing dispute
queue covers the acceptance criterion in DQ.4.

### Continuous Quality Dashboard (DQ.7)

`/admin/data-quality` rolls every data-quality signal into a single
`data_health_score` (0–100) plus per-component KPIs and trend lines. Pure
scoring lives in `functions/api/_data_health.ts` (`computeDataHealthScore`)
so the formula is unit-tested and reviewable:

```
data_health = 100 × (
  0.30 × coverage_pct        // filled / (chars × active attrs)
+ 0.30 × evidence_pct        // attribute_rows with non-null evidence / rows
+ 0.25 × agreement_avg       // AVG(agreement_score) on non-null rows
+ 0.15 × (1 − dispute_density) // 1 − clamp(open / max(rows,1), 0, 1)
)
```

`GET /api/admin/data-quality` always computes a fresh "live" snapshot from
D1 (so the dashboard never silently shows stale numbers) and additionally
returns the last `?days=30` rows from `data_quality_snapshots` (migration
0036) for the trend lines. Snapshot rows are written by
`scripts/snapshot-data-quality.ts` (`pnpm dq:snapshot:{dry-run|preview|prod}`),
which shells out to wrangler the same way `compute-agreement.ts` does.
`--golden-pass-rate` / `--vision-pass-rate` flags let CI attach the most
recent DQ.1 / DQ.2 gate results so the trend charts show external signals
the API can't see by itself. Designed to be wired into the H.3 cron.

---

## LLM Pipeline

```
Client request
  → POST /api/llm or /api/llm-stream
    → Cloudflare AI Gateway (OpenAI proxy)
      → Built-in: caching, rate limiting, logging, cost analytics
    → Response cached 24h (non-streaming)
  → Client
```

- Model: GPT-4o via AI Gateway
- Retry: exponential backoff with jitter (3 attempts)
- Rate limiting: per-IP, enforced in Workers
- Cost tracking: `CostDashboard` component reads AI Gateway analytics
- Prompt templates: `src/lib/prompts.ts` (question generation, data cleanup, attribute enrichment)

---

## Data Ingestion Pipeline

```
External sources (AniList, WikiData, TMDB, IGDB, ComicVine)
  → scripts/ingest/run.ts (orchestrator)
    → Source adapters → raw_characters (staging SQLite)
    → dedup.ts → merge duplicates
    → enrich.ts → LLM classifies 224 boolean attributes
    → images.ts → download → sharp → WebP → R2
    → upload.ts → generate SQL → apply to D1
```

- Staging DB: `data/staging.db` (local SQLite)
- CLI: `pnpm ingest`, `pnpm ingest:stats`, `pnpm ingest:dedup`, `pnpm ingest:upload`
- Admin upload: `scripts/upload-enrichment.ts` → `/api/admin/upload-attrs`
- Rate limits: Cloudflare REST API ~3 req/s; use S3-compatible API for R2 bulk ops

---

## CI/CD Pipeline

Defined in `.github/workflows/ci.yml`. Runs on push to `main` and PRs (skips `*.md` and `LICENSE` changes).

```
            ┌── lint ──────┐
            ├── typecheck ─┤
push/PR  ──►├── test ──────┼──► build ──► test-e2e
            └── size ──────┘
```

| Stage | What it does |
|---|---|
| lint | `eslint .` |
| typecheck | `tsc -b` |
| test | `vitest run` (unit + hooks + components) |
| size | `du`-based bundle size check (700KB limit per chunk) |
| build | `vite build` |
| test-e2e | Playwright (Chromium + Firefox + Mobile) against built artifact |

> Deploy is handled by Cloudflare Pages' built-in Git integration (no CI workflow needed).

**Coverage targets** (vitest.config.ts): 80% lines, 65% branches, 75% functions

---

## Local Dev Shell Setup

### One-time setup (zsh)

```zsh
# Shell completions
pnpm completion >> ~/.zshrc
wrangler completion >> ~/.zshrc

# Project aliases (gdev, gval, gtest, gtail, gdoctor, …)
echo "source $(pwd)/scripts/aliases.sh" >> ~/.zshrc
source ~/.zshrc
```

### Environment files

| File | Purpose |
|---|---|
| `.dev.vars` | Cloudflare Pages Functions secrets for local dev (`pnpm cf:dev`). Copy from `.dev.vars.example`. |
| `.env` | Script-only credentials (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) used by ingest + image upload scripts. |

Required keys are documented in `.dev.vars.example`. Run `pnpm doctor` to verify the environment.

### Useful commands

| Command | What it does |
|---|---|
| `pnpm doctor` | Green/red checklist: Node, pnpm, wrangler auth, `.dev.vars` keys, gitleaks |
| `pnpm tail` | Pretty-print live Pages Function logs (preview env, colored, header-redacted) |
| `pnpm tail --env=production` | Same for production |
| `pnpm tail --filter=status>=400` | Only show error responses |
| `pnpm tail --filter=path~/api/v2` | Only show matching paths (regex) |

---

## Key Conventions

| Topic | Convention |
|---|---|
| Path alias | `@/` → `src/` |
| Components | PascalCase, one per file, in `src/components/` |
| UI primitives | `src/components/ui/` — shadcn/ui, do NOT manually edit |
| TypeScript | Strict null checks, explicit types in signatures, no `any` |
| Attributes | `Record<string, boolean \| null>` — `null` = unknown |
| Character IDs | Unique lowercase strings |
| Attribute keys | camelCase booleans |
| Styling | Tailwind utilities + `cn()` helper, `cva` for variants |
| Theme | Cosmic purple/indigo palette, Space Grotesk font, glassmorphism |
| State | `useKV` for persistence, `useReducer` for game state, local React state for ephemeral UI |
| Icons | Phosphor Icons (`@phosphor-icons/react`), Lucide for shadcn defaults |
| Charts | Recharts + D3 |
| Animations | motion/react (`motion/react`), respect `prefers-reduced-motion` |
