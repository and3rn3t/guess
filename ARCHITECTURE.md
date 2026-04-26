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

**Tech stack**: React 19 · TypeScript (strict) · Vite 7 · Tailwind CSS v4 · shadcn/ui · Framer Motion · Cloudflare Pages/Workers/D1/KV/R2

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
├── llm.ts                     # Non-streaming LLM (24h response cache)
├── llm-stream.ts              # Streaming completions (SSE)
├── characters.ts              # v1: KV-based character CRUD
├── questions.ts               # v1: KV-based question CRUD
├── corrections.ts             # Crowdsourced attribute voting
├── stats.ts                   # Player statistics
├── sync.ts                    # Settings & history sync
├── admin/upload-attrs.ts      # Bulk attribute upload (ADMIN_SECRET)
├── images/[[path]].ts         # R2 image serving (1yr CDN cache)
└── v2/
    ├── characters.ts          # D1-backed character CRUD
    ├── questions.ts           # Questions + attribute coverage stats
    ├── attributes.ts          # Attribute definitions + coverage %
    ├── stats.ts               # Database overview
    ├── daily.ts               # Daily challenge — deterministic character selection + completion tracking
    ├── events.ts              # Client→server analytics event pipeline (POST /api/v2/events)
    ├── history.ts             # Server-side game history (GET /api/v2/history)
    ├── _llm-rephrase.ts       # LLM question rephrasing with 24h KV cache
    └── game/
        ├── _game-engine.ts    # Server-side Bayesian engine (ported from client)
        ├── start.ts           # Initialize session → first question
        ├── answer.ts          # Process answer → next question or guess
        ├── skip.ts            # Skip current question → next-best (no budget decrement)
        ├── reject-guess.ts    # Player rejects a guess → continue game
        ├── result.ts          # Record outcome to game_stats
        ├── resume.ts          # Restore interrupted session from KV
        └── reveal.ts          # User reveals answer on loss → backfill DB attributes

scripts/                       # Build & data tools
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
└── chunks/                    # Split data imports (chunk_001–053.sql)
```

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

`coverageMap` (attribute → coverage %) is pre-computed at session start and passed via `ScoringOptions` to avoid recomputing it on every answer. Rephrased question text is cached in KV (`question-rephrase:{id}`) with a 24h TTL.

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

### D1 (SQLite)

Primary database for the server-side engine and character catalog.

**Tables**: `characters`, `character_attributes`, `questions`, `question_coverage`, `attribute_definitions`, `game_stats`, `game_plays`, `game_sessions`, `game_reveals`, `attribute_disputes`, `proposed_attributes`, `error_logs`, `client_events`

- 187 DEFAULT_CHARACTERS seeded via migrations
- 53K+ ingested characters from AniList, WikiData, TMDB, IGDB, ComicVine
- Character pool for server games: top 500 by popularity with ≥5 non-null attributes

### KV

Key-value store for game sessions and user data.

- `game:{sessionId}` — Active game session (character pool, questions, answers; 1hr TTL)
- `daily:character:{date}` — Today's challenge character (cached until UTC midnight)
- `daily:done:{date}:{userId}` — User's completion record for a given day (TTL: end of next day)
- v1 API endpoints store characters, questions, stats, corrections

### R2

Object storage for character images.

- Bucket: `guess-images`
- Formats: thumbnail (64×64 WebP), profile (256×256 WebP)
- Served via `functions/api/images/[[path]].ts` with 1-year CDN cache
- Upload pipeline: `scripts/ingest/images.ts` → sharp → WebP → R2 (S3-compatible API)

### Client-Side Storage

- **localStorage** (`useKV` hook): Characters, questions, game history, settings
  - `kv:pref:difficulty` — persisted difficulty selection (Easy/Medium/Hard)
  - `kv:pref:categories` — persisted category filter array
- **IndexedDB** (`db.ts`): Game history, analytics events (structured data)

---

## API Endpoints

### v1 — KV-Based (Legacy)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/characters` | GET, POST | List/create user characters |
| `/api/questions` | GET, POST | List/create user questions |
| `/api/corrections` | GET, POST | Attribute correction voting |
| `/api/stats` | GET, POST | Player statistics |
| `/api/sync` | GET, POST | Settings & history sync |

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
| `/api/admin/error-logs` | GET | Worker error log viewer |
| `/api/admin/pipeline` | GET | Enrichment pipeline status |

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
| Animations | Framer Motion, respect `prefers-reduced-motion` |
