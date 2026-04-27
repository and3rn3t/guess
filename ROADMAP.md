# Roadmap

> Portfolio project — the goal is a delightful, frictionless experience and a showcase of creative AI integration. Not monetized; not mass-scale. Every item here should make the game *more fun* or *less annoying*, not more complex.

**Current version**: 1.4.0 — See [CHANGELOG.md](../CHANGELOG.md) for what's shipped.  
**Archive**: The v1.4 roadmap (fully annotated with shipped items) is preserved at [docs/ROADMAP-archive-v1.4.md](ROADMAP-archive-v1.4.md).

---

## Contents

- **Guiding Principles**
- **Open Items in Flight** — carried from prior roadmap, not yet shipped
- **Infrastructure** — Cloudflare platform features, reliability, observability
- **Database** — new migrations, schema evolution, D1 improvements
- **AI & LLM Layer** — remaining prompt and model work
- **Gameplay Depth** — new mechanics (Phase 2)
- **Social & Replayability** — sharing, community (Phase 3)
- **Portfolio Polish** — showcase finishing touches (Phase 4)
- **UI/UX** — interaction polish, onboarding, emerging interaction paradigms
- **Modern Web Platform** — browser APIs, CSS features
- **Developer Experience** — tooling and test gaps
- **Admin Panel Pipe Dreams** — mission control extensions
- **Enrichment Pipe Dreams** — data pipeline extensions
- **Icebox** — good ideas, no rush
- **Moonshots** — alternate futures; no timelines
- **Decision Log**

---

## Guiding Principles

- **Remove friction first** — if a player has to stop and think about the UI, something's wrong
- **Reward curiosity** — surfacing the AI's reasoning is the core hook; lean into it
- **Small, shippable slices** — each item should be completable in a weekend session
- **Portfolio-quality polish** — the kind of detail that makes a recruiter say "whoa"

---

## Open Items in Flight

Items carried from the prior roadmap that are not yet shipped. Everything that shipped lives in [CHANGELOG.md](../CHANGELOG.md).

| # | Item | Area | Effort |
|---|------|------|--------|
| BX.5 | **Separate AI Gateway for preview vs. prod** | Infra | Low |
| B.4 | **Question deduplication via embeddings** | AI | Medium |
| C.4 | **Adaptive question strategy** — `playerStyle` hint into prompt | AI | Medium |
| C.6 | **Question quality scoring feedback loop** | AI | Medium |
| C.8 | **Semantic character search in teaching mode** | AI | Medium |
| EN.1 | **Live enrichment progress dashboard** (`/admin/enrich` SSE stream) | Admin | Medium |
| AN.1 | **Question skip & frustration funnel** | Analytics | Low |
| AN.3 | **Answer distribution dashboard** — "maybe" rate per question | Analytics | Medium |
| AN.6 | **Attribute coverage heatmap** — % non-null per attribute | Analytics | Medium |
| AN.7 | **Confusion matrix** — most-confused character pairs from `game_stats` | Analytics | Medium |
| AN.8 | **Real-world calibration overlay** — real vs. simulator metrics side-by-side | Analytics | Medium |
| DX.3 | **`@cloudflare/vitest-pool-workers`** for Workers handler tests | DX | Medium |
| DX.4 | **MSW for API-dependent component tests** | DX | Medium |
| DX.10 | **Automated CHANGELOG + release tagging** via changesets | DX | Low |

---

## Infrastructure

The Cloudflare platform has capabilities we're not fully leveraging. This section is ordered from "do it this weekend" to "do it when it matters."

### Near-Term (≤ 1 day each)

| # | Item | Files | Notes |
|---|------|-------|-------|
| I.1 | **Separate AI Gateway for preview** | `wrangler.toml` | Both `env.production` and `env.preview` share the same `CLOUDFLARE_AI_GATEWAY` URL. Preview LLM calls pollute production cost dashboards and share rate limits. Create a dedicated preview gateway in the Cloudflare AI Gateway dashboard and reference it in `[env.preview.vars]`. ~2 hours. |
| I.2 | **Workers Analytics Engine for LLM costs** | `functions/api/llm.ts` | The `costs:{userId}:{date}` pattern stores costs as KV records — hard to aggregate and query across users or time ranges. Replace with the Workers Analytics Engine (columnar, time-series, free up to 100K data points/day). Query cost trends by model/user/date directly in the CF dashboard without manually enumerating KV keys. |
| I.3 | **Enrichment pipeline SSE endpoint** | `functions/api/admin/` | `GET /api/admin/enrich/stream` pushes `{ character, status, tokensUsed, costSoFar, eta }` events. Pairs with `POST /api/admin/enrich/start` (KV flag + Cron/Queue dispatch) to make EN.1 (live enrichment dashboard) fully operational from the browser without a local terminal. |
| I.8 | **Workers Smart Placement** | `wrangler.toml` | Three lines: `[placement]\nmode = "smart"`. Smart Placement analyzes where requests originate and where D1 lives, then routes each invocation to the PoP with the lowest total round-trip latency — not necessarily the one nearest the user. For D1-heavy endpoints (`/api/v2/game/answer`, `/api/v2/characters`), the Worker currently executes in the PoP nearest the player, which may be a different continent from D1. Empirically: 50–200ms latency reduction for non-US players. Zero code changes; ships in a `wrangler.toml` commit. |
| I.9 | **AI Gateway Semantic Caching** | Cloudflare AI Gateway dashboard | AI Gateway now supports semantic caching: if a new LLM prompt is within a configurable cosine similarity threshold of a cached response, it returns the cache hit without a model call. For `dynamicQuestion_v1`, many prompts with the same attribute pool and difficulty level produce identical or near-identical questions. Enable in the AI Gateway dashboard (one toggle; threshold tunable per route). Monitor cache hit rate in the AI Gateway analytics tab. Expected: 20–40% cost reduction on question generation with zero code changes. |

### Medium-Term (1–3 days each)

| # | Item | Files | Notes |
|---|------|-------|-------|
| I.4 | **Tail Worker observability layer** | New Worker | Deploy a separate Tail Worker that receives every invocation from the main Worker — errors, CPU time, response status, request path. Writes structured rows to Workers Analytics Engine: `{ path, status, cpuMs, error, timestamp }`. Zero changes to existing endpoint code. The entire observability stack runs inside Cloudflare and costs nothing beyond what's already deployed. Surfaces in `/admin/logs` (see Admin Pipe Dreams). |
| I.5 | **R2 Event Notifications → dominant color extraction** | New Worker | When an admin uploads a character image to R2, an Event Notification fires a Worker. The Worker fetches the thumbnail, runs a 16-color median cut quantization over the pixel data in pure JS (no canvas API needed on Workers), and writes the dominant hex color to `characters.dominant_color` in D1. `GuessReveal` uses it for ambient card theming (P.3). Zero manual work per character — the upload pipeline becomes self-annotating. |
| I.6 | **Cloudflare Queues for async teaching mode** | `functions/api/v2/characters.ts`, new consumer | `POST /api/v2/characters` currently runs D1 write + LLM attribute fill + KV cache bust synchronously in the response path. Queue it instead: write a minimal D1 record and push a job to a Cloudflare Queue. A separate consumer Worker handles enrichment (LLM calls, attribute filling, image upload, cache bust) asynchronously. The player sees "submitted — we'll add it shortly" rather than waiting on 3+ LLM calls. Teaches producer/consumer architecture. |
| I.7 | **Durable Objects for game session state** | `functions/api/v2/game/` | Replace KV lean+pool session storage with a DO per game session. Every answer hits the same DO instance — strongly consistent, no KV serialization round-trip, no race condition on concurrent answer submissions. Trade-off: Workers Paid plan required ($5/mo). Teaches DO `state.storage`, `alarm()`, and the hibernation API. Revisit if session consistency bugs emerge; not urgent at current scale. |
| I.10 | **Service Bindings architecture** | `wrangler.toml`, `functions/` | Split the monolithic Worker into focused micro-Workers connected via [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) — zero-latency RPC with no HTTP overhead. Proposed decomposition: `guess-game` (session lifecycle, D1, Bayesian scoring), `guess-llm` (all LLM calls through AI Gateway — rate limiting and cost tracking centralized here), `guess-enrichment` (pipeline steps, Queue consumer), `guess-analytics` (Analytics Engine writes, daily Cron rollup). Each Worker deploys independently and has its own CPU budget. Swapping models or rewriting the prompt layer touches only `guess-llm` — `guess-game` ships unchanged. Type-safe stubs generated from each Worker's exported types. |
| I.11 | **OpenTelemetry distributed tracing** | `functions/api/v2/`, `packages/game-engine/` | Workers now support the OTEL SDK natively. Instrument the full request path with named spans: `game.answer` → `engine.score_candidates` → `d1.query` → `llm.dynamic_question`. Each span captures timing and attributes (character pool size, question count, model, error). Export to Workers Observability (already enabled in `wrangler.toml`) or any OTEL-compatible backend. In a portfolio context: a waterfall trace showing exactly how a 180ms response breaks down (D1: 40ms, scoring: 12ms, LLM: 115ms, serialize: 13ms) is a rare demonstration that a solo developer thinks like a platform team. |

### Infrastructure Explorations

> 🧊 **Icebox** — Learning-oriented; no implementation timeline. Listed for portfolio narrative value.

| # | Exploration | What you'd learn |
|---|------------|-----------------|
| IX.1 | **Cloudflare Vectorize as character index** | Replace the O(N×Q) Bayesian probability loop with approximate nearest-neighbor search. Embed the current answer state as a vector (`yes/no/maybe/null` per attribute → `float[]`); store all characters as pre-computed vectors in Vectorize; `POST /api/v2/game/answer` does a single `vectorize.query()` instead of iterating 500 characters × 50 attributes. Teaches: vector databases, ANN search, Vectorize API. Trade-off: loses per-character probability transparency (though re-derivable from similarity distances). |
| IX.2 | **Cloudflare Workflows for the enrichment pipeline** | Rewrite `run-enrich.sh` as a Cloudflare Workflow: each character is a Workflow step; failures retry automatically with exponential backoff; the Workflow UI shows exactly where it stalled. Steps: `fetch → dedup → LLM enrich → image process → D1 upload → KV cache bust`. Teaches: durable execution patterns, Workflows API — concepts that transfer to any long-running job system. |
| IX.3 | **Self-Tuning Engine via Cron Trigger** | A Cron Trigger Worker runs nightly: reads last 7 days of `game_stats`, computes actual win rate per trigger type vs. calibration targets, and applies a gradient step to `SCORE_MATCH`, `SCORE_MISMATCH`, `SCORE_MAYBE` stored as KV flags. The live Worker reads scoring constants from KV on every game start instead of compiled-in constants. The engine tunes itself while you sleep — without a code deploy. Teaches: Cron Triggers, KV as a live config store, gradient-based hyperparameter optimization in a production loop. |
| IX.4 | **A/B Engine via KV Feature Flags** | Add a `variant` field to `game_stats`: `"control"` or `"experiment"`. On game start, read KV flag `ab:engine:experiment_pct` (e.g. `"20"`) and route that % of games to alternate scoring constants (also in KV). Both variants play live games; real-world win rates accumulate in D1 split by variant. After 500 games per arm, a calibration SQL query tells you which constants win in the real world. Zero-deploy A/B testing of the engine's core numerics. Teaches: feature flags as a system design pattern, statistical significance in A/B tests. |
| IX.5 | **MCP Server — the character knowledge base as a composable AI tool** | The [Model Context Protocol](https://modelcontextprotocol.io) (Anthropic, 2024) is rapidly becoming the standard interface for exposing tools and data sources to LLM clients — Claude, Cursor, Windsurf, any MCP-compatible agent can call MCP servers as first-class tools. Deploy a Workers-based MCP server at `mcp.andernator.com` (or as a subdomain of the app). Expose: `search_character(query)` → fuzzy name + FTS search against D1; `get_character_attributes(id)` → full attribute profile with confidence scores; `find_confused_characters(a, b)` → the attributes that most distinguish two characters; `run_bayesian_game(answers[])` → run the full engine from a given answer state and return ranked candidates. Now Claude can play the guessing game as a tool call. Now Cursor can query the character DB mid-coding session when writing enrichment scripts. The entire knowledge base becomes AI-composable infrastructure — not just a web app. Workers are an excellent host for MCP servers: global edge deployment, D1 access, no cold starts. |
| IX.6 | **WebAssembly scoring engine** | The Bayesian probability loop in `packages/game-engine/src/engine.ts` iterates O(N×Q): 500 characters × 50 attributes = 25,000 floating-point operations per `answer()` call, in JavaScript. Compile the hot path to WASM: write the scoring kernel in Rust (`wasm-pack`) or AssemblyScript, compile to `.wasm`, import into the Worker via `import scoring from './scoring.wasm'`. Workers support WASM natively — the module loads once, subsequent calls are near-native speed. At 500 characters the speedup is academic (~5ms → ~0.8ms); at 5,000 characters it becomes material. The real value: benchmarking identical logic in JS vs. WASM under real production traffic, in a Workers environment, is a compelling technical story. WASM on the edge is still uncommon enough to stand out. |
| IX.7 | **Cloudflare AutoRAG** | AutoRAG is Cloudflare's fully managed RAG pipeline: point it at R2 objects or a URL list; it handles chunking, embedding via Workers AI, Vectorize indexing, and retrieval automatically — no Python script, no separate embedding service. Replace the manual Wikipedia enrichment pipeline (Enrichment Pipe Dreams section) with an AutoRAG configuration pointing at character description documents in R2. When the Bayesian engine is stuck (>10 candidates within 5% probability of each other), issue an AutoRAG query using the current answer set as the query string. AutoRAG retrieves the most semantically relevant characters from the full prose description space. Structured Bayesian scoring + AutoRAG semantic retrieval vote together — two complementary AI paradigms (symbolic + neural) collaborating in the same request. |
| IX.8 | **Cloudflare Containers** | Cloudflare Containers (2025) runs Docker containers inside the Cloudflare network, co-located with Workers, accessible via Service Bindings. Three workloads that can't fit in Workers CPU limits: (1) a local `sentence-transformers` model for embedding — no Workers AI API call, no network hop, sub-millisecond latency per embed; (2) DuckDB queries against R2 NDJSON exports — admin analytics without loading data into D1, ad-hoc SQL over months of `game_stats` in seconds; (3) full Python image processing (dominant color extraction, aesthetics scoring via PIL/numpy) with the complete ML stack. Architecture: the Workers-based API handles HTTP and auth; the Container handles CPU-heavy work, invoked via Service Binding RPC. The enrichment pipeline becomes: AI Gateway (LLM) → Container (embedding + image) → D1 (write). Full ML stack at the edge, with zero cold-start penalty for warm containers. |

---

## Database

Schema evolution and new migrations. The current latest is `0030_question_difficulty.sql`.

> **Note on 0033**: Migration `0022_admin_panel.sql` already created `pipeline_runs` (with `INTEGER AUTOINCREMENT` PK, `run_batch` grouping, and CHECK constraints on `step`/`status`). The planned 0033 slot in the prior roadmap was a duplicate. Migrations below skip 0033 and continue from 0031.

### Planned Migrations

| Migration | Table / Change | Purpose |
|-----------|---------------|---------|
| **0031** | `character_confusions(character_a TEXT, character_b TEXT, confusion_count INTEGER, last_seen TEXT)` | Track which characters the engine most frequently confuses with each other. A weekly Cron Worker aggregates runner-up pairs from `game_stats`. A compound index on `(character_a, confusion_count DESC)` makes top-N lookups fast. Powers the confusion matrix (AN.7) and question-selector up-weighting for known confusion pairs. |
| **0032** | `community_votes(id TEXT, character_id TEXT, attribute_key TEXT, vote INTEGER, user_hash TEXT, created_at TEXT)` | Per-attribute community yes/no votes (one per user hash per attribute). A nightly Cron Worker aggregates: ≥10 concordant votes → attribute auto-updated with `source: "community"`, `confidence: 0.85`. Unique constraint on `(character_id, attribute_key, user_hash)` prevents ballot stuffing. Foundational for the Crowdsourced Attribute Voting moonshot (M.2). |
| **0034** | `character_relationships(character_a TEXT, character_b TEXT, relationship_type TEXT, created_at TEXT)` | Relationships between characters: `same_universe`, `same_franchise`, `same_creator`, `rivals`, `allies`. Populated by an LLM batch pass over the character pool. Enables universe-aware questions ("Do they share a universe with Batman?") impossible to generate from attribute space alone. Underpins the Genealogy Map moonshot (M.3). |
| **0035** | `attribute_embeddings(attribute_key TEXT PRIMARY KEY, embedding BLOB, model TEXT, created_at TEXT)` | Workers AI embedding vectors per attribute key (`@cf/baai/bge-base-en-v1.5`). Enables semantic deduplication (Adaptive Attribute Taxonomy moonshot M.12) — nightly cosine similarity check flags near-duplicate attributes for merge review. Also powers B.4 question deduplication at write time and IX.1 (Vectorize character index). |
| **0036** | `question_attempts(id INTEGER AUTOINCREMENT, session_id TEXT, question_id TEXT, answer TEXT, probability_delta REAL, candidates_before INTEGER, candidates_after INTEGER, created_at INTEGER)` | Denormalize `game_stats.steps` (a JSON blob) into queryable rows — one per question per game. Unlocks SQL-native analytics for C.6 and AN.1: `SELECT q.text, AVG(qa.probability_delta) FROM question_attempts qa JOIN questions q ON qa.question_id = q.id GROUP BY q.id ORDER BY 2 DESC`. Index on `(question_id, created_at)`. Backfill from existing `game_stats.steps` JSON via a one-time script; new games write both. |
| **0037** | `daily_stats(date TEXT PRIMARY KEY, games INTEGER, wins INTEGER, forced_guesses INTEGER, avg_questions REAL, median_confidence REAL, llm_errors INTEGER)` | Pre-aggregated daily rollup written by a nightly Cron Trigger Worker from `game_stats`. Every admin analytics query currently full-scans the entire `game_stats` table. With this table the Health Vitals Board (Admin Pipe Dreams) reads a single row per day range instead of scanning thousands. Cron runs at 00:05 UTC, aggregates yesterday, upserts. |
| **0038** | `character_versions(id INTEGER AUTOINCREMENT, character_id TEXT, attribute_key TEXT, old_value INTEGER, new_value INTEGER, changed_by TEXT, changed_at INTEGER)` | Append-only audit log of every attribute value change — manual edits, LLM enrichment passes, community vote merges, dispute resolutions. One row per change. `changed_by` is the user_id, pipeline step name, or `"community"`. Required for: dispute resolution (what was the value before?), M.11 Temporal Character DB (reconstruct DB state at any date), and admin accountability. Index on `(character_id, changed_at DESC)`. |
| **0039** | `user_preferences(user_id TEXT PRIMARY KEY, difficulty TEXT, reduced_motion INTEGER, language TEXT, updated_at INTEGER)` | Server-persisted preference row keyed by the anonymous cookie user_id. Currently preferences live only in `localStorage` — clearing cookies or switching devices loses them entirely. With this table, preferences survive clears: on game load, if localStorage is empty, fetch `/api/v2/preferences` and hydrate. Write-through on every preference change. No auth required; same anonymous user_id already in cookies. |
| **0040** | `attribute_merge_log(id INTEGER AUTOINCREMENT, source_key TEXT, target_key TEXT, affected_count INTEGER, merged_by TEXT, merged_at INTEGER)` | Audit trail for M.12 Adaptive Attribute Taxonomy merges. When two near-duplicate attributes are consolidated (e.g. `isEvil` → `isVillain`), this table records what was merged, how many character rows were affected, and who approved it. Enables rollback (the old key's rows can be reconstructed from `character_versions`). |
| **0041** | `feature_flags(key TEXT PRIMARY KEY, value TEXT, description TEXT, enabled INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)` | D1 as the source of truth for feature flags (A/B variants, kill switches, gradual rollout percentages). The read path remains KV (fast, cached at the edge); a Cron Worker syncs D1 → KV on every change. The admin panel reads from D1 to show history and allow edits without touching KV manually. Tracks `updated_at` so the admin can see when a flag last changed and by what value. |
| **0042** | `schema_migrations(filename TEXT PRIMARY KEY, checksum TEXT, applied_at INTEGER)` | A self-describing migration ledger inside D1. The `create-migration.ts` script writes a row on each successful apply. Enables `pnpm db:status` — a command that reads this table from both prod and preview D1 and reports which migrations have and haven't been applied. Eliminates the current "did this migration run in preview?" ambiguity. |

### Schema Improvements

**`characters` table**

| Column | Detail |
|--------|--------|
| `dominant_color TEXT` | Populated automatically by the R2 Event Notification Worker (I.5). Used by `GuessReveal` ambient theming (P.3) and character knowledge graph node coloring in Admin Pipe Dreams. |
| `fingerprint TEXT` | A 3–5 word phrase that uniquely distinguishes a character from their nearest neighbor in attribute space. Generated by the enrichment pipeline (AI item A.7). Surfaced in `GuessReveal` below the character name. |
| `known_since INTEGER` | Year the character first appeared in source material. Required by the Temporal Character DB moonshot (M.11). Populated via enrichment LLM pass or source API metadata. |
| `archived_at INTEGER` | Soft-delete timestamp. `NULL` = active; set to `unixepoch()` when a character is removed. All game queries add `WHERE archived_at IS NULL`. Prevents hard-delete data loss — a wrongly removed character can be restored by clearing this field. |

**`questions` table**

| Column | Detail |
|--------|--------|
| `asked_count INTEGER DEFAULT 0` | Running total of how many times this question has been asked across all real games. Currently derived by parsing the `game_stats.steps` JSON blob — no denormalized count exists. Incremented server-side on every question selection. Required by C.6 (quality feedback loop: "asked 200+ times, near-zero info gain"). |
| `skip_count INTEGER DEFAULT 0` | How many times players skipped or abandoned a game while this question was active. Written from `client_events` data (AN.1). A high skip rate is a signal the question is confusing or boring, independent of its information gain. |
| `info_gain_avg REAL` | Rolling exponential moving average of information gain across the last N games. Currently C.6 has no place to persist this — it would have to recompute from `game_stats.steps` on every admin panel load. This column gives it a home. Updated by the same nightly Cron Worker that writes `daily_stats`. |
| `last_asked_at INTEGER` | Unix timestamp of the most recent game in which this question was asked. Combined with `asked_count`, identifies stale questions (never asked in 30 days despite being active). |

**`character_attributes` table**

| Column | Detail |
|--------|--------|
| `source TEXT` | Who set this value: `'manual'`, `'llm-gpt4o-mini'`, `'llm-gpt4o'`, `'community'`, `'ingest-tmdb'`, etc. Currently implicit (confidence=1.0 means manual, lower means AI) — ambiguous when multiple models have run enrichment passes. This makes the source explicit and queryable: `SELECT * FROM character_attributes WHERE source = 'community'`. |
| `updated_at INTEGER` | Timestamp of the last write to this row. Currently `character_attributes` has no timestamp column — there's no way to query "which attributes were changed in the last enrichment run." Required by `character_versions` (0038) backfill and by the admin Attribute DNA Matrix hover state. |

**`game_stats` table**

| Column | Detail |
|--------|--------|
| `final_confidence REAL` | Engine confidence score at the moment of the final guess. Not currently persisted — the calibration SQL queries in `docs/guess-readiness-queries.sql` proxy this using `questions_asked` as a stand-in. Storing it directly enables: `SELECT AVG(final_confidence) WHERE won = 1` (calibration accuracy), median confidence at guess time (Admin Health Vitals), and regression detection. |
| `variant TEXT` | A/B experiment variant label — `'control'`, `'experiment-a'`, etc. Required by IX.4 (KV Feature Flag A/B system). Without this column, variant attribution must be reconstructed from KV audit logs after the fact. With it: `SELECT variant, AVG(won) FROM game_stats GROUP BY variant`. |

### Query Performance & Maintenance

| Item | Detail |
|------|--------|
| **FTS expansion: `questions_fts`** | Migration 0018 added `characters_fts` for character name search. Extend to `questions_fts` — admin question search currently requires a LIKE scan. One `CREATE VIRTUAL TABLE questions_fts USING fts5(text, attribute_key, content='questions')` + `AFTER INSERT/UPDATE/DELETE` triggers. |
| **Composite FTS: `knowledge_fts`** | A single FTS virtual table spanning `characters.name`, `characters.description`, `attribute_definitions.display_text`, and `questions.text`. Admin global search (`/admin/search?q=`) returns characters, attributes, and questions from one query rather than three. |
| **`game_stats` archival** | `game_stats` grows unbounded. A monthly Cron Worker moves rows older than 6 months to `game_stats_archive` (identical schema) and writes a compressed NDJSON export to R2 (`exports/game_stats/YYYY-MM.ndjson.gz`). The live table stays small; `daily_stats` (0037) covers historical analytics. Ad-hoc older queries use DuckDB against R2 exports. |
| **Deprecate v1 KV endpoints** | `functions/api/characters.ts`, `questions.ts`, `corrections.ts`, `stats.ts`, `sync.ts` are legacy KV-backed endpoints from before D1. Add `Deprecation: true` + `Sunset: 2027-01-01` response headers. No new features should touch v1; plan a cleanup migration to drop the handlers after sunset. |
| **D1 → R2 nightly export** | A Cron Trigger Worker dumps `game_stats`, `sim_game_stats`, and `character_attributes` as NDJSON to R2 (`exports/YYYY-MM-DD/`). Enables ad-hoc analytics with DuckDB or Jupyter without live D1 queries. Schema evolution is visible in the export history. |

---

## AI & LLM Layer

Remaining open items from the B and C series, plus two new ideas.

### Open (carried)

| # | Item | Notes |
|---|------|-------|
| B.4 | **Question deduplication via embeddings** | Before storing a LLM-generated or user-submitted question, embed it (`@cf/baai/bge-base-en-v1.5`) and cosine-compare against existing embeddings in `attribute_embeddings`. Block if similarity > 0.92. Prevents semantic duplicates like "Is this character a villain?" / "Is this character evil?" — which waste the question budget without adding information. |
| C.4 | **Adaptive question strategy** | Track answer distribution across games in `IndexedDB`: players who answer "maybe" > 40% of the time are ambiguity-prone; players who answer in < 3 seconds are decisive. Pass `playerStyle: "decisive" \| "hesitant" \| "literal"` into `dynamicQuestion_v1`. The AI adjusts phrasing — fewer double-negative questions for literal players, more direct binary framing for hesitant ones. |
| C.6 | **Question quality feedback loop** | After each game, score every question by whether its answer changed the probability distribution meaningfully (information gain > threshold). Low-scoring questions (asked 200+ times, near-zero info gain) are surfaced monthly in the admin panel. An LLM pass suggests replacements. Self-improving question bank without manual curation. |
| C.8 | **Semantic character search in teaching mode** | When the player types a character name, embed it in real time and return the 3 most semantically similar existing characters: "Did you mean: *Black Widow*, *Black Panther*, or *Black Adam*?" Prevents duplicate submissions without requiring exact-match. Uses Workers AI embeddings against the Vectorize index (IX.1) or a local cosine scan. |

### New

| # | Item | Notes |
|---|------|-------|
| A.6 | **Multi-modal character identification** | A `/identify` route. The player uploads a photo or pastes an image URL. The image is passed to a Workers AI vision model (`@cf/llava-1.5-7b-hf`). The model returns a character description; that description is embedded and matched against the character knowledge base. The AI returns its top-3 guesses with confidence scores and reasoning. Reverse mode for the entire guessing mechanic — the human submits photographic evidence; the AI deduces. |
| A.7 | **Attribute fingerprint** | For each character, generate a 3–5 word phrase that uniquely distinguishes them from their nearest neighbor in attribute space: *"caped Gotham billionaire vigilante"* for Batman, *"web-slinging Queens high-schooler"* for Spider-Man. Stored in `characters.fingerprint` (D1 column, see DB section). Surfaced in `GuessReveal` below the character name — a one-glance summary of why the AI landed on this character. Generated in batch via the enrichment pipeline; cached indefinitely. |

---

## Gameplay Depth

Remaining unimplemented Phase 2 items. Completed items are in [CHANGELOG.md](../CHANGELOG.md).

| # | Item | Why |
|---|------|-----|
| G.1 | **Reverse mode** | The player picks a character from the DB and the AI *defends* it — player asks yes/no questions; AI answers based on stored attributes. Complete role reversal. Tests whether the attribute DB is rich enough to be interrogated from the other side. |
| G.2 | **Hint system** | Player requests a hint at any point: reveals one binary attribute ("this character can fly"). Costs 2 questions from the remaining budget. Adds strategy without breaking the core mechanic. |
| G.3 | **Multi-guess with drama** | Instead of one final guess, the AI gets 3 guesses with ascending confidence thresholds. Dramatic reveal sequence; the last guess plays the full typewriter + ring animation. |
| G.4 | **Speed mode** | 60-second countdown per session (not per question). Timer shown as a sweeping arc. Keyboard answers are essential — desktop-first. `Page Visibility API` pauses the countdown when the tab is hidden. |

---

## Social & Replayability

Remaining unimplemented Phase 3 items.

| # | Item | Why |
|---|------|-----|
| S.1 | **Challenge a friend link** | Encode a specific character ID + salt into a shareable URL. Friend plays the same character; results compared side-by-side. Uses existing `sharing.ts` base64 encoding. |
| S.2 | **Custom character lists** | Named lists of character IDs stored in `localStorage`. Play against only a curated list — great for family/friend groups with shared fandoms. |
| S.3 | **Improved teaching mode UX** | Redesign as a wizard: (1) character name, (2) confirm auto-detected attributes, (3) fill gaps manually, (4) submit. Progress indicator between steps. Pairs with I.6 (async queue) so submission is instant. |
| S.4 | **Bento grid stats dashboard** | Replace flat stat rows in `StatsDashboard` with a CSS grid bento layout — large "Win Rate" tile, smaller supporting tiles. Stronger as a portfolio piece. |
| S.5 | **Voice input (experimental)** | Web Speech API "Yes / No / Maybe" recognition — triggers only on user permission. Fully degradable if unsupported. A fun party trick with one clear use case. |

---

## Portfolio Polish

Remaining unimplemented Phase 4 items.

| # | Item | Why |
|---|------|-----|
| P.1 | **"How the AI thinks" explainer page** | A static `/how-it-works` route with a step-by-step Bayesian scoring walkthrough and a live embedded mini-demo. Strong for portfolio conversations with non-technical audiences. |
| P.2 | **Replay mode** | After a game, re-animate the full question sequence with probability scores updating in real time. Shareable link encodes the replay. Demonstrates the Bayesian engine visually without requiring a live game. |
| P.3 | **Ambient character color theming** | Use `characters.dominant_color` (populated by I.5) as the accent tint on `GuessReveal` — the card background, character name gradient, and ring animation all adapt to the character. The UI literally becomes the character. |
| P.4 | **Character suggestion page** | A `/suggest` route — visitors nominate characters via a simple form stored in D1. Review and merge from the admin panel. Passive visitor → passive contributor, no auth required. |
| P.5 | **Offline-first full game** | Bundle a representative 100-character subset into the service worker cache. Full game playable on a plane. Currently PWA-registered but not fully offline-capable. |
| P.6 | **AI-generated character portraits** | For characters missing an R2 image, call `@cf/stabilityai/stable-diffusion-xl-base-1.0` via Workers AI. Generate, resize via `sharp`, and cache a portrait to R2. Zero manual asset work per character. |

---

## UI/UX

Interaction quality, onboarding clarity, and emerging interaction paradigms. Distinct from the browser API catalog in Modern Web Platform — this section is organized around *user experience outcomes*, not underlying APIs.

---

### Near-Term Polish

Small, targeted improvements to friction points in the current interaction model. Each is 1–2 days of work with immediately visible payoff.

**Swipe gestures for Yes/No** — on mobile, swipe right for Yes, left for No (same axis as most card-based games). Implement with `pointer` events and a CSS `translate` + `rotate` transform — no library required. A spring-back animation cancels on release within the threshold; a committed swipe triggers the answer with the same haptic as the button tap. The question buttons stay visible as the fallback — swipe is an enhancement, not a replacement. First-time players see a one-shot animation hint ("← No / Yes →") that dismisses after one swipe.

**Haptic feedback via Vibration API** — short, distinct vibration patterns on mobile for: correct guess (70ms buzz), wrong guess (two 40ms pulses with a 60ms gap), question answered (10ms tap, nearly imperceptible). Gated behind `navigator.vibrate` availability and a `localStorage` opt-out toggle. Zero impact on desktop. Costs a handful of `navigator.vibrate()` calls wired to existing game events — no animation changes required.

**Skeleton loading states** — replace the spinner on game start with a skeleton layout matching the `QuestionCard` + `ReasoningPanel` structure: a pulsing shimmer rectangle where the question text goes, three probability bar placeholders below. The page layout doesn't shift when data arrives — the skeleton and the real content occupy the same space. Implemented with Tailwind's `animate-pulse` + placeholder divs; removed from the render tree once the first question loads.

**First-time onboarding overlay** — a `localStorage`-gated single-use tooltip sequence (not a blocking modal). On first visit: (1) the question card has a floating annotation "The AI asks yes/no questions"; (2) the reasoning panel has "See the AI's probability scores in real time"; (3) the answer buttons have "Answer honestly — or try to trick it." Each annotation auto-dismisses after 4 seconds or on any interaction. Never shown again. Uses the Popover API (`popover="manual"`) — zero JS positioning, no third-party library.

**Inline error states on each game phase** — currently errors bubble to the `ErrorFallback` full-page component. Instead, render inline contextual errors: a question fetch failure shows a retry button inside the `QuestionCard` frame (not a full page reset); a guess submission failure shows "Couldn't submit — try again" below the answer buttons with a spinner → error icon transition. The game session stays alive on transient errors. Errors that actually require a reset surface the full `ErrorFallback` as before.

**Keyboard navigation throughout** — map `Y` / `N` / `M` to Yes / No / Maybe answer buttons (hint tooltip on first game via CSS `:has()` targeting focused buttons). `?` opens the keyboard shortcut reference popover. `Esc` closes all overlays. `R` on the end-game screen starts a new game. `Enter` on the character input in teaching mode submits. Every interactive flow should be completable without a mouse — required for accessibility, and makes speed-running the game feel snappy.

**Probability bar micro-animations on update** — when a new answer narrows candidates, each probability bar in `ReasoningPanel` smoothly transitions its width using CSS `transition: width 400ms cubic-bezier(0.34, 1.56, 0.64, 1)` (a slight overshoot for a "settling" feel). Characters dropping out of the top list animate their bar to 0% before the row fades out. Characters jumping up animate in from their previous position. The reasoning panel becomes a living instrument — not a static list that replaces itself.

---

### Medium-Term UX Projects

Larger interaction model improvements. Each requires 2–4 days of design + implementation.

**View Transitions API for phase changes** — wrap `Welcome → Playing → GuessReveal` phase transitions in the [View Transitions API](https://developer.chrome.com/docs/web-platform/view-transitions/). Currently Framer Motion drives phase animations. `document.startViewTransition()` hands the crossfade entirely to the browser: screenshot the old state, render the new state, animate between them in the compositor thread with zero JS on the critical path. Add `view-transition-name` to the question card and the character portrait — the character image morphs from the possibility grid thumbnail to the full `GuessReveal` portrait as a shared element transition. The guess reveal becomes cinematic at zero animation library cost. Fully progressive: browsers without support get the existing Framer Motion fallback.

**Character portrait blur-up (LQIP from R2)** — the character portrait in the possibility grid and `GuessReveal` currently appears from nothing or flashes a broken-image icon while loading. Generate a 4×4 pixel placeholder thumbnail per character at enrichment time (8 bytes of base64 per image), store in `characters.lqip_base64`. On load: render the blurred placeholder at full size (CSS `filter: blur(20px) scale(1.1)` — the scale prevents blur edge artifacts) and crossfade to the full image when it loads. The portrait space is always occupied — no layout shift, no flash of emptiness. Sharp already runs during image processing; the LQIP is one additional `.resize(4,4).webp()` call.

**Progressive disclosure of reasoning panel** — on mobile, the `ReasoningPanel` is currently always visible and takes vertical space below the question. On small screens, collapse it into a compact "AI confidence" bar (a single horizontal meter showing the top candidate's probability) that expands into the full panel on tap. A "See AI reasoning" label with a chevron communicates affordance clearly. On desktop (≥768px) the panel stays fully open as today. `localStorage` persists the user's expanded/collapsed preference. The question card gets its vertical space back on mobile — the core game interaction is front and center.

**Personalized difficulty adaptation** — read the player's game history from `localStorage` (or `game_stats` if the session cookie is present): win rate, average questions to guess, number of forced guesses. Automatically suggest: "You've won 9 of your last 10 games on Standard — want to try Hard?" as a dismissible banner after a win streak. The banner uses `@starting-style` for a smooth entry, never interrupts the game, and stores its dismissal in `localStorage`. The UI responds to player skill instead of forcing manual difficulty selection. No backend changes — client-side logic reading existing stored stats.

**Themed game modes with distinct visual identities** — each difficulty level gets a visual signature beyond label text: Easy has softer card borders and a lighter backdrop; Hard has a higher-contrast, sharper aesthetic with a countdown tension arc. A future Anime Mode, Villains Mode, or Speedrun Mode could each carry their own color palette token swap — swapping a `data-theme` attribute on `<html>` is enough with the current Tailwind CSS variable architecture. The groundwork is one `data-theme` attribute + 3 CSS variable overrides per theme.

**Document Picture-in-Picture for multitasking** — the [Document Picture-in-Picture API](https://developer.chrome.com/docs/web-platform/document-picture-in-picture/) opens a real browser window (not a `<video>`) that stays on top while the user switches tabs. Eject the current `QuestionCard` + answer buttons into a PiP window — the game follows the user while they look something up. The PiP renders a self-contained mini-game view with the current question, answer buttons, and candidate count. Answer in the PiP; the main window's `ReasoningPanel` updates via `BroadcastChannel`. Progressive enhancement — the eject button only appears if `documentPictureInPicture` is supported.

**Animated "confidence meter" ambient background** — a very subtle animated gradient behind the game card whose hue and saturation encode AI confidence: cool blue at 40 candidates, shifting through purple to warm amber as the pool narrows to 1–3 characters. Implemented as a CSS custom property animating via JavaScript (`document.documentElement.style.setProperty('--confidence-hue', hue)`) on each answer. Zero canvas, zero library — just a CSS radial gradient updating at 60fps via `requestAnimationFrame`. `prefers-reduced-motion` disables the transition and snaps to the final color. The background becomes a passive ambient display of the AI's certainty without the player having to read a number.

---

### Experimental & Emerging Technologies

No implementation timeline. Some of these APIs are newly available, some are proposals, some are just fun to think about.

**WebXR character recognition** — point your phone's camera at a real-world character (a poster, figure, or cosplay). A WebXR session with `ARModule` overlay detects the character via image recognition (Workers AI `@cf/microsoft/resnet-50` or an AI Gateway call to a vision model) and starts a game pre-seeded to that character. The physical world becomes a game controller. Currently viable on Android Chrome — iOS WebXR support is maturing. A stunning demo for a portfolio context: "point your phone at a Batman toy to play Batman."

**AI Summarizer API (browser-native)** — Chrome's built-in [Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api) (`window.ai.summarizer`) runs a quantized LLM entirely on-device, no server call, no API key, no cost. Use it on the `GuessReveal` screen: feed it the answer history (questions + answers as a paragraph) and ask it to summarize why the AI guessed correctly (or where it went wrong). The summary appears as a "What gave it away?" panel below the reveal card — personalized, generated in milliseconds, completely offline. This is the only browser-native LLM API in production today.

**Prompt API for on-device hint generation** — Chrome's [Prompt API](https://developer.chrome.com/docs/ai/built-in) (`window.ai.languageModel`) lets you run arbitrary prompts on-device. Rather than calling the Workers API for the G.2 hint system, generate hints locally: "Given that the character is [top candidate], generate a subtle yes/no hint that doesn't reveal the answer." Zero latency, zero server cost, zero rate limit concern. Graceful degradation: if `window.ai` is unavailable, the hint falls back to a server-side call.

**Translator & Language Detector APIs** — Chrome's [Translation API](https://developer.chrome.com/docs/ai/translator-api) translates text on-device. Use it to localize question text and answer labels into the browser's preferred language without a translation service or locale bundle. `navigator.language` drives the target locale; the API handles the rest on-device. First-step toward the multilingual enrichment goal in the Enrichment section — players whose browser is set to Japanese automatically see Japanese question text, even if the attribute DB is English.

**Ambient sound design with Web Audio API** — procedurally generated background audio that responds to game state. Not music — ambient texture: a soft low-frequency hum that increases in pitch and intensity as candidates narrow. When the AI is about to guess (1–2 candidates left), a subtle rising tone signals anticipation. On a correct guess: a short resolution chord. Implemented with the Web Audio API `OscillatorNode` + `GainNode` — no audio assets, no HTTP requests for sound files, ~50 lines of code. `prefers-reduced-motion` (as a proxy for reduced sensory preference) disables it; a sound toggle in the UI lets players opt out explicitly.

**CSS Custom Highlight API for answer history** — use the [Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) to highlight keywords in the answer history panel (character traits, attribute names) without wrapping them in `<span>` elements — ranges applied directly to the DOM's text nodes. The markup stays clean; the visual treatment is pure CSS. A small demo of a genuinely esoteric browser API — the kind of thing that signals deep platform knowledge in a portfolio context.

**Eye tracking via WebGazeTracker (accessibility)** — [WebGazeTracker](https://webgazer.cs.brown.edu/) is an open-source JS library that estimates gaze position using the front-facing camera via `getUserMedia`. Map dwell time on the Yes/No buttons: 1.5 seconds of gaze on "Yes" triggers the answer. A compelling accessibility story (hands-free play for motor-impaired users) and a genuinely unusual interaction paradigm. Gated behind explicit permission flow: camera access dialog + opt-in toggle. No data ever leaves the device — all gaze estimation runs client-side.

**Spatial/3D card reveal with CSS 3D transforms** — the `GuessReveal` card flips from face-down (back of a playing card with the game logo) to face-up (character portrait + reveal) using a CSS `perspective` + `rotateY(180deg)` 3D flip. The flip takes 600ms with a `preserve-3d` container. The back face has a subtle holographic shimmer animation via a `conic-gradient` that rotates slowly — a pure CSS effect, no canvas. The character "appears" from behind the card. Pairs with View Transitions shared element: the card flies from the possibility grid position to center screen, then flips. A tactile, physical metaphor for an otherwise purely digital reveal.

**Window Management API for power users** — the [Window Management API](https://developer.chrome.com/docs/capabilities/web-apis/window-management) lets the app query all connected displays and open windows at precise screen coordinates. Offer a power mode: game on the primary display, `ReasoningPanel` floated as a frameless window on the secondary display. The probability visualization has all the room it needs; the game card is uncluttered. A multi-monitor setup becomes a dual-screen game system. A striking demo for a portfolio audience that has a two-monitor setup — "the AI's thinking is literally on another screen."

---

## Modern Web Platform

Underused browser capabilities with low implementation cost and high demo value.

### CSS & Layout

| Technique | Where | Benefit |
|-----------|-------|---------|
| **CSS Scroll-driven Animations** | Answer history pills, possibility grid rows | Entries animate in as they scroll into view — zero JS, respects `prefers-reduced-motion` automatically |
| **`@starting-style`** | Toasts, overlays, newly inserted DOM elements | Entry animations (fade, slide) without JS — reduces the number of `AnimatePresence` wrappers needed |
| **Container Queries** | `ReasoningPanel`, `QuestionCard` | These components should adapt to *their container*, not the viewport — container queries are the correct tool vs. breakpoints |
| **CSS Anchor Positioning** | Keyboard shortcut popover, hint tooltip | Popovers that follow their trigger element without JS position calculation |
| **`color-mix()`** | Theme tokens | Mix primary/accent colors at build time — cleaner than Tailwind opacity modifiers, more expressive |

### Browser APIs

| API | Use case | Notes |
|-----|---------|-------|
| **`scheduler.postTask()`** | Question scoring, candidate filtering | Run heavy Bayesian scoring off the main thread with priority hints; keeps the UI responsive during AI "thinking" |
| **`requestIdleCallback`** | Analytics flush, IndexedDB writes | Defer non-critical writes to idle time — free perceived performance |
| **Page Visibility API** | Speed mode timer (G.4) | Pause countdown when tab is hidden; resume when visible |
| **Speculation Rules API** | Welcome → Playing navigation | Prefetch `/api/v2/game/start` response speculatively when the user hovers "Start Game" |
| **Canvas confetti** | Win state | Replace the current CSS-div confetti with a single `<canvas>` element — same visual, significantly fewer DOM nodes at peak particle count |

### Accessibility Gaps

| Gap | Fix |
|-----|-----|
| Screen reader announcements | `aria-live="polite"` on question text so assistive tech reads new questions automatically |
| Focus management on phase change | `useEffect` to `focus()` the first interactive element when the game phase transitions |
| Color contrast on amber/rose buttons | Audit answer buttons against WCAG 2.1 AA — amber on dark backgrounds often fails |
| `prefers-reduced-motion` on sparklines | Disable the confidence sparkline entry animation when motion is reduced |

---

## Developer Experience

### Concrete Gaps

| # | Item | Effort | Notes |
|---|------|--------|-------|
| DX.3 | **`@cloudflare/vitest-pool-workers` for Workers handler tests** | Medium | Runs Vitest inside Miniflare — real Workers runtime, local KV + D1 bindings, no mocking required. Every file in `functions/api/v2/game/**`, `questions.ts`, `characters.ts` is currently excluded from coverage because they require the CF Workers runtime. This closes that dark coverage zone. |
| DX.4 | **MSW for API-dependent component tests** | Medium | Add `msw/node` in Vitest: intercept `fetch` at the network layer and return fixture responses. Component tests for `ReasoningPanel`, `QuestionCard`, and game hooks become self-contained and fast, with no server dependency. Fixtures generated from Zod schemas (DP pipe dream below). |
| DX.10 | **Automated CHANGELOG + release tagging** | Low | Add [changesets](https://github.com/changesets/changesets): PR authors drop a changeset file; on merge to `main`, a GitHub Action commits the changelog entry and creates a semantic version tag. No more manual "what did I ship this week?" archaeology. |
| DX.11 | **`pnpm validate` pre-push git hook** | Low | Add `lint-staged` + `simple-git-hooks` (already have `lint-staged.config.mjs`): run `pnpm validate` before every `git push`, not just in CI. Catches type errors and lint violations before they hit the remote. One `pnpm add -D simple-git-hooks` and a `prepare` script entry. |
| DX.12 | **D1 migration dry-run in CI** | Low | Add a GitHub Actions step that runs `wrangler d1 migrations apply --dry-run` against the local schema on every PR. Catches migrations that reference non-existent columns or violate CHECK constraints before they reach preview or production. Zero extra infrastructure — Wrangler already supports `--dry-run`. |
| DX.13 | **Strict Playwright test isolation** | Medium | Each E2E test currently shares implicit global state (cookies, KV rate-limit counters). Add a `beforeEach` fixture in `fixtures.ts` that seeds a fresh test session cookie and resets the rate-limiter Durable Object for the test's IP. Tests stop interfering with each other; parallel test runs become safe. |
| DX.14 | **`tsx --watch` scripts dev loop** | Low | The enrichment scripts (`enrich.ts`, `upload-enrichment.ts`, `create-migration.ts`) are run ad-hoc with `npx tsx`. Add them to `package.json` scripts with proper `--watch` variants for the scripts that are iteratively edited. Also add `pnpm migration:new` as an alias for `tsx scripts/create-migration.ts` — the current command is not documented anywhere discoverable. |
| DX.15 | **OpenTelemetry local trace viewer** | Medium | Instrument key Workers handlers with `@opentelemetry/api` spans (game start, question scoring, LLM call, D1 write). In local `wrangler dev`, pipe traces to a local Jaeger or Tempo instance via OTLP HTTP. Visualize the full request waterfall locally — where time actually goes in a game turn. Production traces already flow to CF Workers Observability (I.11); this extends the same instrumentation to the dev loop. |

### DX Pipe Dreams

> 🧊 **Icebox** — Best-in-class tooling; not currently scoped.

**Full Storybook Component Catalog** — `@storybook/react-vite` documenting every component in `src/components/` in isolation. Stories cover every meaningful variant: `QuestionCard` with easy vs. hard questions, `GuessReveal` with and without an R2 image, `ReasoningPanel` with 3 candidates vs. 80. Interaction tests (`@storybook/addon-interactions`) automate the same flows Playwright covers — faster, no server dependency. Storybook build deploys as a CF Pages preview on every PR.

**Zod API Contract Layer** — shared Zod schemas in `packages/game-engine/src/schemas.ts`. Workers handlers validate request/response shapes at the edge using `.parse()`. React hooks import the same schemas for response type inference — not `json as unknown as GameSession`, but `SessionSchema.parse(json)`. Schema mismatches between client and server caught at runtime + compile time from a single source of truth. Schemas also serve as MSW fixture generators for DX.4.

**Turborepo Task Graph** — define a task pipeline (`test` depends on `build`, `build` depends on `game-engine#build`). Tasks that haven't changed since the last run are cache-hits and return instantly. CI benefits most: if only `src/` changed, `packages/game-engine` lint/type-check/test is skipped. Warm-cache runs after a small change are near-instant.

**Playwright Visual Regression Baseline** — screenshot comparison after each phase transition. Any pixel-level layout regression fails CI with a visual diff uploaded as an artifact. Golden images live in `.playwright/snapshots/`; updated explicitly with `--update-snapshots`.

**Generated Type-Safe API Client** — a build script parses `functions/api/v2/` files, extracts request/response types, and emits `src/lib/api.generated.ts`. `api.game.answer({ answer: 'yes' })` is then fully type-safe end-to-end — the compiler catches URL, method, body, and response mismatches before runtime.

**Full Miniflare Integration Test Suite** — spins up the complete Worker with Miniflare (local D1, KV, R2), seeds test fixtures, and runs the full request-response cycle for every endpoint: session lifecycle (`start → answer × N → result`), rate limiting (11 LLM calls → 429), cookie signing (tampered cookie → 401), D1 contention (concurrent session writes → consistent state). Full coverage of the server-side logic without a deployed environment.

**Property-Based Testing for the Game Engine** — the Bayesian scorer in `packages/game-engine/` has a rich input space: any combination of boolean/null attribute values, any candidate pool size, any question order. [fast-check](https://fast-check.io/) generates thousands of random `(candidates[], answers[])` combinations and asserts invariants: total probability always sums to 1.0 ± epsilon, the top candidate's score never decreases after an answer that confirms one of its attributes, entropy never increases after a question. Fuzzing the engine's invariants finds edge cases no hand-written test would reach — degenerate pools of all-null attributes, single-candidate edge cases, contradictory answer histories.

**Contract Testing with Pact** — the React client and the Workers API are separate deploy units; nothing currently enforces that their contracts stay in sync across deploys. [Pact](https://docs.pact.io/) generates a consumer-driven contract from the React hooks' fetch calls and verifies it against the actual Workers handlers in CI. If `/api/v2/game/answer` changes its response shape, the Pact verification fails before either side ships. The contract file lives in `packages/game-engine/` as a first-class artifact — versioned, diffable, the canonical source of truth for what the API actually promises.

**Mutation Testing with Stryker** — [Stryker Mutator](https://stryker-mutator.io/) modifies the source code (flips `>` to `>=`, removes a `return` statement, negates a condition) and checks whether the existing test suite catches each mutation. A surviving mutant is untested logic. Running Stryker on `packages/game-engine/src/` once will surface the exact lines in the Bayesian scorer that tests don't actually exercise — not by coverage percentage (which measures lines reached) but by semantic correctness (which measures whether tests would catch a logic bug).

**Snapshot Testing for the Bayesian Engine** — for a fixed set of known-good game histories (5–10 representative games from `game_stats`), snapshot the full scoring output: every candidate's probability, the selected question, the information gain of that question. Committed to `__snapshots__/`. A PR that inadvertently changes the scoring algorithm fails these snapshots immediately — and the diff shows exactly which candidates moved and by how much. Not a replacement for unit tests; a regression net for the entire scoring pipeline as a unit.

**Local D1 Seed Scripts per Developer** — `scripts/seed-local.ts` creates a fresh local D1 database with: a representative 50-character subset (covering all categories), all attribute definitions, the latest question set, and a pre-baked game session for manual testing. Run with `pnpm db:seed`. Every developer starts with an identical, reproducible local state — no more "works on my machine" with a stale or empty local DB. The seed data is a checked-in JSON fixture in `scripts/fixtures/` updated as part of every migration PR.

**AI-Assisted PR Review Bot** — a GitHub Actions workflow runs on every PR: sends the diff to the OpenAI API (via AI Gateway, using the project's own key) with a prompt that checks for: (1) TypeScript `any` usage introduced; (2) missing `null` checks on D1 query results; (3) new API endpoints without rate-limiting middleware; (4) Tailwind classes that conflict with the cosmic purple theme. Posts inline PR comments for each finding. Not a blocker — an advisory. The bot's prompt is a checked-in file (`scripts/pr-review-prompt.txt`) so it's easily updated when the conventions change. Meta: the project uses AI to guard itself.

**GitHub Copilot Workspace Issues as a Backlog** — write every roadmap item that is concrete enough to implement as a GitHub Issue with a structured template: `## What`, `## Why`, `## Acceptance criteria`, `## Files likely affected`. The issue body is detailed enough that a [Copilot coding agent](https://docs.github.com/en/copilot/using-github-copilot/using-claude-sonnet-in-github-copilot) can attempt it with no additional context. The roadmap becomes an executable backlog, not just documentation. Items that Copilot can close autonomously (adding a `pnpm` script, fixing a lint rule, writing a migration) get done without a dev session. Items it can't close reveal the gaps in the issue descriptions — sharpening the backlog over time.

**Dev Container (`devcontainer.json`)** — a fully specified VS Code Dev Container: Node LTS + pnpm, Wrangler CLI, `better-sqlite3` native bindings pre-compiled, the local D1 seed pre-applied, all VS Code extensions (ESLint, Tailwind IntelliSense, Playwright, GitLens) pre-installed. Anyone can clone the repo and hit F1 → "Reopen in Container" to get a fully working environment in 90 seconds — no manual `pnpm install`, no native module compilation, no "which Node version do I need?" archaeology. GitHub Codespaces uses the same `devcontainer.json` automatically — the project works in-browser with zero local setup.

**Wrangler `--remote` integration test mode** — Wrangler supports `--remote` flag to run `wrangler dev` against the actual preview Cloudflare environment (real D1, real KV) rather than Miniflare. Add a `pnpm cf:test` script that runs the Playwright E2E suite against a `--remote` preview deployment. Catches the class of bugs that only appear in the real CF runtime (Worker CPU limits, D1 row size limits, KV consistency windows) that Miniflare silently ignores. Complement to the local test suite, not a replacement.

**Live `ARCHITECTURE.md` diagram generation** — a build script reads `wrangler.toml` bindings (D1, KV, R2, DO, Queues), `functions/api/v2/` route files, and `packages/game-engine/src/` exports, and generates the Architecture diagram in `ARCHITECTURE.md` as a [Mermaid](https://mermaid.js.org/) flowchart — automatically kept in sync with the actual codebase. When a new binding or route is added, the diagram updates on the next `pnpm build`. The architecture document stops drifting from reality. Mermaid is already renderable in GitHub markdown — zero extra tooling for readers.

---

## Admin Panel Pipe Dreams

> 🧊 **Icebox** — Transform the admin panel from developer tools into a live ops center. No implementation timeline.

**Real-Time Game Observatory** (`/admin/observatory`) — a Tail Worker captures game events and pipes them into a Cloudflare Queue. The admin panel SSE-streams a live ticker: *"User in 🇩🇪 answered 'Yes' to isHuman — 47 → 12 candidates remaining. Confidence: 84%."* Below the ticker: live counter of games in progress, answers per minute, current most-guessed character. The reasoning panel visualization plays out for every active game simultaneously — a grid of probability bars all moving at once. Zero impact on user-facing latency since Tail Workers run after the response is sent.

**Engine Health Vitals Board** (`/admin/health`) — six live sparklines from Workers Analytics Engine: win rate (7-day rolling), avg questions per game, forced-guess rate, contradiction rate, median confidence at guess time, LLM error rate. Each sparkline has a colored status indicator: green (within calibration targets), amber (drifting), red (out of bounds). Compares current real-game metrics against simulator last-run outputs side-by-side. If any metric crosses a threshold, a Cron Trigger Worker fires a notification (KV flag + optional webhook) before the problem is visible to players.

**Character Knowledge Graph** (`/admin/graph`) — a D3.js force-directed graph of every character. Three toggleable edge layers: `confused_with` (from `character_confusions`, migration 0031), `same_franchise` (from `character_relationships`, migration 0034), and `attribute_neighbors` (cosine similarity above a tunable threshold). Node size = popularity score; node color = category; node glow intensity = enrichment confidence. Clicking a node expands a floating panel with full attribute profile, image, and a "re-enrich" button. Lasso-select a cluster and batch-send to the enrichment queue.

**Attribute DNA Matrix** (`/admin/matrix`) — every character (rows) × every attribute (columns) rendered as a color-coded pixel grid: green for `true`, red for `false`, mid-grey for `null/unknown`. At 500 × 50 the entire knowledge base fits on a 1280px canvas. Hovering a cell shows character name + attribute key + value + confidence + model. Clicking opens an inline edit popover. Sorting rows by coverage % and columns by info gain puts the most discriminating attributes top-left. The shape of the knowledge base becomes visible at a glance. Once LLM Confidence is a first-class data type (EN medium-term), cell opacity encodes confidence — a fully saturated cell means high-confidence, washed-out means uncertain — making contested attributes visually obvious without hovering.

**Pipeline Visual DAG Orchestrator** (`/admin/pipeline`) — the enrichment pipeline rendered as an interactive directed acyclic graph: `[Fetch Sources] → [Dedup] → [LLM Enrich] → [Image Process] → [D1 Upload] → [Cache Bust]`. Each node is a card showing status (idle/running/error), throughput (characters/min), queue depth, and error rate. During a live run, a pulsing dot animates characters flowing node to node. Clicking a node drills into its log table from `pipeline_runs` (migration 0033). A "pause after this step" toggle lets you inspect intermediate results before committing.

**LLM Cost Observatory** (`/admin/cost`) — pulls from AI Gateway native cost metrics + Workers Analytics Engine. Shows: cost-per-game by day (bar chart), cost-per-enrichment-run (scatter plot), model comparison, projected monthly burn at current daily rate, and a "what-if" batch size slider with real-time cost projection. A "cost efficiency" score: cost per successful game win. Not a surprising monthly bill — a live instrument. Once model routing by attribute type is live (EN big projects), the model breakdown column splits cost by tier: Workers AI (free), GPT-4o-mini, GPT-4o — making cost savings from the routing layer immediately measurable.

**Enrichment Diff Reviewer** (`/admin/enrich/diff`) — surfaces the pre-upload diff report (EN near-term) in the browser instead of a JSON file on disk. Shows a three-column table: character name | attribute key | old value → new value. Color-coded: blue for `null → value` (new fill), amber for `value → different value` (changed), red for `true → false` (reversed). Checkboxes on each row let you approve or reject individual changes before committing. A "Push approved" button calls `POST /api/admin/upload-attrs` with only the selected rows. Prevents silent overwrites of manually corrected values without requiring a terminal session to inspect the diff JSON.

**Attribute Disputes Queue** (`/admin/disputes`) — surfaces `attribute_disputes` (migration 0026) as a prioritized review queue. Each card shows: character portrait, attribute label, model A answer + confidence, model B answer + confidence, and the evidence excerpt (from the agentic pipeline, EN big projects) that grounded each answer. Reviewer actions: "Accept A", "Accept B", "Mark genuinely contested" (sets `contested: true` permanently in `character_attributes`), or "Skip". The queue sorts by controversy score: large confidence delta + many games where this character was the final wrong guess. Disputed attributes that most affected game outcomes rise to the top. Pairs with the adversarial enrichment pass (EN medium-term).

**Image Quality Review Queue** (`/admin/images/review`) — after the image aesthetics scoring pass (EN medium-term) runs, low-scoring portraits appear here in a responsive grid. Each card shows the current `thumb.webp`, three aesthetics scores (face visibility, style consistency, recognizability), and a composite grade. Cards sorted by composite score ascending — the worst images first. Click a card to expand: full `profile.webp`, the source URL that produced it, and a drag-and-drop zone to upload a replacement image. The replacement triggers an immediate R2 upload + D1 update + KV cache bust. Manual image curation without touching the command line.

**Agent Reasoning Trace Viewer** (`/admin/enrich/traces`) — when the agentic enrichment pipeline (EN big projects) is live, each character's enrichment run produces an auditable trace: tool calls made, documents retrieved, per-attribute reasoning chain, and final answer with cited source URL. This viewer shows that trace as a collapsible timeline. Select any character from a searchable list; the panel renders: tool call → retrieved text excerpt → LLM reasoning → attribute value + source. Attributes with no evidence found are highlighted red. A "re-run this character" button triggers a fresh agent loop for that character only. The enrichment pipeline is no longer a black box — every attribute value has a chain of evidence visible to the admin.

**A/B Experiment Control Room** (`/admin/experiments`) — makes the KV Feature Flag A/B system (IX.4) fully browser-operational. Lists active/completed experiments with traffic split %, sample size per variant, win rate per variant with 95% confidence intervals, and a live p-value indicator that turns green at p < 0.05. Buttons: "Start", "Increase traffic to experiment arm", "Declare winner" (promotes winning constants to production KV, clears experiment flags), "Roll back". Experiment management without touching KV manually or writing SQL.

**Adversarial Stress Test Console** (`/admin/stress-test`) — type any character name, click Run. A `POST /api/admin/stress-test` endpoint runs the deterministic simulator in adversarial mode and streams results via SSE. The admin panel renders the game unfolding question by question — probability bars updating, candidates dropping. Confusion report at the end: highest-ranked wrong character at each step, the attribute that finally broke the tie, attributes that if added would have resolved the confusion earlier. A live debugger for the Bayesian engine.

**Tail Worker Activity Stream** (`/admin/logs`) — a live, filterable log of every Worker invocation rendered like a terminal in the browser. Color-coded status: green 2xx, amber 4xx, red 5xx, purple edge cache hits. Filters: by path prefix, by status code, by CPU time percentile. Click any row to expand full request context — headers, CF ray ID, country. Latency histogram at the top updates in real time.

---

## Enrichment

The enrichment pipeline today is a manual, local-machine process: `run-enrich.sh` calls `ingest/run.ts enrich`, which reads from a local `better-sqlite3` staging DB, sends character + attribute batches to GPT-4o-mini via the OpenAI API, stores results in `data/enrich-cache/`, then uploads to D1 via `upload-enrichment.ts`. Images are fetched, resized by `sharp`, and uploaded to R2 via the S3-compatible SDK. Five source adapters (AniList, TMDb, IGDB, ComicVine, Wikidata) feed the staging DB. Everything runs ad-hoc from a developer laptop.

This section covers: **concrete near-term improvements**, **larger architectural upgrades**, and **pipe-dream explorations**.

---

### Near-Term Enrichment Improvements

**Incremental re-enrichment on attribute schema changes** — when a new attribute is added to `attribute_definitions`, the enrichment pipeline currently requires manually filtering `--new-attrs-only` on the command line. A `needsReenrichment()` check in `enrich.ts` should auto-detect characters with `NULL` values for any newly active attribute (cross-join `attribute_definitions` with `character_attributes` left-join returning NULLs) and queue only those for the next run. New attributes fill in automatically overnight without any flag.

**Enrichment diff report before upload** — `upload-enrichment.ts` currently pushes all staged attributes unconditionally. Before each upload, query D1 for the current values and compute a diff: characters changing from `null → true`, `true → false`, etc. Write the diff to `data/enrich-diff-YYYY-MM-DD.json` and print a summary (`+312 filled, 14 changed, 2 disputed`). Prevents silent overwrites of manually corrected values and gives a paper trail for every upload. One additional D1 read before the upload loop.

**Retry budget with per-character error codes** — `enrichment_status.error` currently stores the raw error string. Extend it to store a structured JSON object: `{ code: "rate_limit" | "context_too_long" | "malformed_json" | "timeout", attempts: 3, last_at: 1714000000 }`. The `retryFailed()` function reads the code and skips characters whose error is `context_too_long` (a prompt engineering problem, not a transient failure) rather than retrying them forever. Run with `--retry-transient` to skip permanent failures; `--retry-all` to force.

**Source overlap audit as a scheduled script** — `source-overlap.ts` exists but runs manually. Add a `pnpm enrich:audit` command that: (1) cross-references all five sources for the same character by name/source_id, (2) flags conflicts where TMDb says `isHuman: true` but AniList says `false`, (3) writes a JSON report to `data/source-audit-YYYY-MM-DD.json`. Running it monthly catches enrichment regressions before they reach D1.

**Structured output via OpenAI's JSON schema mode** — `enrich.ts` currently uses a freeform `response_format: { type: "json_object" }` and then validates the shape manually. Switch to OpenAI's [structured outputs](https://platform.openai.com/docs/guides/structured-outputs) (`response_format: { type: "json_schema", json_schema: { ... } }`). Define the schema programmatically from the `AttributeDef[]` array: every key becomes a required field of type `boolean | null`. The model is constrained by the schema at the token-generation level — not post-hoc parsing. Malformed JSON responses drop to near zero. Parse failures in `enrich.ts` are eliminated rather than retried.

---

### Medium-Term Enrichment Architecture

**LLM Confidence as a First-Class Data Type** — replace `true/false/null` per attribute with a structured object: `{ value: true, confidence: 0.91, source: "llm-gpt4o-mini", contested: false }`. The staging DB already has `confidence` and `contested` columns in `enrichment_attributes` — this is about surfacing them through the upload path into D1's `character_attributes` table (the `source` and `updated_at` columns proposed in DB migration 0038 are the destination). When two enrichment passes disagree, `contested: true`. The game engine's Bayesian scorer weights contested attributes lower at runtime. The enrichment output becomes a first-class probabilistic dataset, not a boolean table.

**Adversarial enrichment pass (skeptic model)** — after the primary GPT-4o-mini pass, run a second pass with a different model (GPT-4o, or a different prompt framing) specifically designed to challenge the first model's answers: "The previous model said [character] is [attribute]. Do you agree? Explain your reasoning before answering." Disagreements go into `attribute_disputes` (migration 0026 — already exists in D1). A nightly admin review surfaces the top disputed attributes. Two models disagreeing on an attribute is a strong signal the question is ambiguous or the attribute is genuinely contested for this character.

**Multi-Language Attribute Enrichment** — run enrichment in English, then a second pass in Japanese (anime characters) and Spanish (Latin American characters). Some attributes are better answered in the source language — "Is this character a demon?" is clearer in Japanese for an anime character than in English. Confidence-weighted majority vote merges results. The pipeline becomes multilingual without the game surface needing to change.

**Popularity Decay Model via Real Game Data** — replace the static `[0,1]` popularity score from source APIs with a dynamic score blending API popularity + in-game engagement. A nightly Cron Worker recomputes: `popularity = 0.6 × api_popularity + 0.4 × game_pick_rate_30d`. Writes back to `characters.popularity` in D1. Characters players actually care about float up; obscure ones drift down. The DB becomes self-calibrating through play, not through external API signals. The `game_pick_rate_30d` is derivable from `game_stats` + `game_reveals` already in D1.

**Cross-Character Relationship Graph** — an LLM batch pass builds `character_relationships` (migration 0034): given a batch of characters, ask "which pairs share a fictional universe? same franchise? creator? are rivals or allies?" One pass per batch of 20–30 characters with a prompt that includes the full name list. Relationships are directional: `(character_a, character_b, relationship_type)`. Enables universe-aware questions ("Do they share a universe with Batman?") impossible to generate from attribute space alone. Underpins the Genealogy Map moonshot (M.3).

**Image Aesthetics Scoring via Vision Model** — after `images.ts` downloads and resizes each portrait, pass `thumb.webp` to a vision model via Workers AI or AI Gateway: "Rate this portrait: (1) face visibility 0–1, (2) art style consistency with the character's medium 0–1, (3) character recognizability 0–1. Return JSON." Store scores in D1. The possibility grid and GuessReveal prefer high-scoring portraits. Low-scoring images (blurry, group shots, logo-only) are flagged for manual replacement in the admin panel. Extends the existing `image_status` table in the staging DB.

**Wikipedia Full-Text Semantic Enrichment** — fetch each character's Wikipedia article (MediaWiki REST API — free, no key required). Chunk the article into ~500-token segments. Embed each chunk via Workers AI `@cf/baai/bge-base-en-v1.5` and store in Cloudflare Vectorize indexed by character ID. When the Bayesian engine is stuck (>8 candidates within 5% probability), embed the current answer history as a query vector and retrieve top-3 nearest character chunks. Structured Bayesian + semantic retrieval vote together — a character that *feels* right from prose, not just attribute tags.

---

### Big Projects & Future Technologies

**Migrate enrichment pipeline to Cloudflare Workflows (IX.2 expanded)** — the biggest single architectural improvement to the enrichment story. Today enrichment is a local shell script with manual retry. Cloudflare Workflows provides durable execution: each character is a Workflow instance; each pipeline step (`fetch → dedup → enrich → image → upload → cache-bust`) is a named step with automatic retry, exponential backoff, and step-level state persistence. If the LLM step fails after 8 hours of enrichment, the Workflow resumes from that step — not from scratch. The Workflow UI in the CF dashboard shows exactly which characters are in which step and which failed. The admin panel's Pipeline DAG (Admin Pipe Dreams) reads from `pipeline_runs` (migration 0022) which the Workflow writes. The `run-enrich.sh` script becomes a `POST /api/admin/enrich/start` HTTP call. No local machine required.

**Agentic enrichment pipeline** — instead of a single prompt asking "fill these 50 boolean attributes for this character," decompose enrichment into an autonomous agent loop. The agent is given a character name and a list of attribute definitions. It selects tools: `search_web(query)`, `fetch_wikipedia(title)`, `query_fandom_wiki(character, wiki)`, `verify_attribute(character, attribute, evidence)`. It reasons over retrieved evidence, fills attributes one at a time with cited sources, and flags any it cannot verify. The final output includes a `sources[]` array per attribute — a URL or document excerpt that justified the value. This is a [Cloudflare Agents](https://developers.cloudflare.com/agents/) use case: a long-running agentic loop hosted on Workers, with tool calls mediated by the CF Agent SDK. Each enrichment run becomes an auditable reasoning trace, not a black-box LLM call.

**Structured data extraction from Fandom/Wiki sources** — AniList, TMDb, IGDB, and ComicVine are great for metadata but thin on narrative attributes (`isVillainRedeemed`, `hasSidekick`, `betraysAlly`). Fandom wikis are the richest source of this data but have no clean API. Add a `sources/fandom.ts` adapter that: (1) finds the most likely Fandom wiki URL for a character by querying the Fandom search API; (2) fetches the character's infobox and first two sections of the article; (3) passes the HTML to an LLM with a structured extraction prompt. Unlike free-form enrichment, this pass has documentary evidence — the wiki text — to ground its answers. Confidence scores from evidence-grounded extraction should be systematically higher than ungrounded recall from model weights alone.

**Embedding-based attribute coverage gap detection** — instead of running enrichment on all characters for all attributes (O(N×A) LLM calls), identify the highest-value gaps first. Embed each `(character, attribute)` pair where the value is `null` as a vector: `[character_embedding, attribute_embedding]` concatenated. Train a lightweight binary classifier (logistic regression, 2KB of weights) on pairs where the value is known: does the model confidently know the answer (high confidence) or is this genuinely uncertain? Only run LLM enrichment on pairs the classifier predicts as "answerable." Reduces enrichment LLM cost by an estimated 30–50% by skipping attributes that are genuinely unknown for a character (the LLM would just guess). The classifier trains on `character_attributes` where `confidence < 0.7` as the "uncertain" class.

**Streaming enrichment with real-time D1 writes** — the current pipeline is batch: enrich all → upload all. Make it streaming: as each character's enrichment result arrives from the LLM, write it immediately to D1 via the admin upload endpoint. The admin panel's live enrichment dashboard (EN.1) becomes useful during the run — probability scores update in real time as characters complete. If the run is interrupted, partially enriched characters are already persisted; only incomplete ones need to be retried. The `enrichment_status` staging table already tracks per-character state — this change is mostly in `upload-enrichment.ts` (interleave upload with enrichment rather than separating the phases).

**AutoRAG as the enrichment knowledge base (IX.7 applied)** — instead of calling the OpenAI API with raw character names and hoping the model's training data is accurate, pre-load a knowledge base into Cloudflare AutoRAG: R2 objects containing structured character articles (Wikipedia dumps, Fandom exports, source API JSON), chunked and indexed automatically. The enrichment prompt changes from "you know about Batman, tell me these attributes" (memory recall, hallucination-prone) to "here are 3 retrieved passages about Batman — answer these attributes based only on this evidence" (retrieval-augmented, grounded). Confidence scores from evidence-grounded answers are more reliable than from recall alone. AutoRAG handles chunking, embedding, and retrieval — no Vectorize configuration needed.

**Model routing by attribute type** — not all attributes need GPT-4o-mini. Some are trivially answerable by a small, fast, cheap model (`isHuman`, `isFemale`, `isVillain` for well-known characters); others require deeper reasoning (`hasMoralAmbiguity`, `isRedeemed`, `betraysAlly`). Add a `complexity` field to `attribute_definitions` (`simple | moderate | complex`). The enrichment pipeline routes: `simple` attributes → Workers AI `@cf/meta/llama-3-8b-instruct` (zero cost within free tier, ~10ms); `moderate` → GPT-4o-mini; `complex` → GPT-4o. Expected cost reduction: 40–60% on a typical enrichment run. Workers AI handles 50–60% of attributes for zero marginal cost at edge. Implement as a `selectModel(attribute: AttributeDef): string` function in `enrich.ts`.

**Freeform character ingestion via AI agents** — today adding a new source requires a new `sources/xxx.ts` adapter file with hand-written API calls, pagination, and field mapping. Replace with an agent that, given a source URL or API documentation page, autonomously: (1) reads the API docs; (2) writes the TypeScript adapter; (3) runs it against a test endpoint; (4) diffs the staging DB for new characters; (5) submits a PR with the new source file and a sample of ingested characters. This is a [GitHub Copilot coding agent](https://docs.github.com/en/copilot/using-github-copilot/using-claude-sonnet-in-github-copilot) task — a sufficiently detailed issue asking for a new source adapter is actionable autonomously. The enrichment pipeline expands to new sources without a developer session.

---

## Icebox

> Good ideas with no current priority. Listed so they don't get lost.

**Gameplay & UX**

- Multiplayer party mode — real-time WebSocket game where players compete to guess the same character fastest (Cloudflare Durable Objects)
- Story mode / campaign — 10-character arc with a narrative wrapper ("Identify the villain across 10 rounds")
- Character of the week — curated pick manually set in a KV flag, "featured" badge on welcome screen
- Answer confidence slider — single horizontal slider (Definitely No ←→ Definitely Yes) instead of 4 buttons; maps to the same 4 answer buckets
- Leaderboard — global daily challenge (fewest questions to win); requires auth which adds complexity currently not worth the trade-off
- Localization — Spanish, French, Japanese character sets; requires translated attribute definitions
- Isometric character grid — CSS isometric variant of the possibility grid; visually novel but doesn't add information over the current probability-weighted grid
- Spatial answer history — SVG arc layout where pill height = info gain; too abstract for casual players; the current answer history weight (answer impact pills) achieves the same legibility goal more clearly
- Streaming probability updates — incremental per-answer Bayesian recalculation; meaningful optimization only at 10K+ characters; premature for the current 500-character pool

**Tech Explorations**

- Attribute embedding space (E.2) — PCA / t-SNE cluster visualization to reveal structural "blind spots" where no amount of threshold-tuning can distinguish characters
- Bandit-based question selection (E.3) — UCB or Thompson Sampling per question; reward = game win; the bandit learns which questions are most useful across games, adapting beyond static info-gain
- Bayesian network attribute model (E.4) — model conditional attribute dependencies instead of the current independent model; `isVillain` and `hasMagicPowers` are correlated; teaches probabilistic graphical models
- Self-play engine tournament (E.5) — current engine vs. a modified version; scored by win rate, avg questions, forced-guess rate; same framing as AlphaGo/AlphaZero evaluations
- LLM-assisted weight tuning (E.6) — feed grid search results into GPT-4o as a surrogate model for Bayesian optimization of scoring constants

---

## Moonshots

> 🧊 **Icebox** — Alternate futures for the project. No timelines, no current priority.

Ideas at a different scale — not features or improvements, but possible alternate identities for what this project could become.

---

**M.1 — A Game That Plays Itself**

An autonomous demo mode: the engine picks a character at random; an LLM plays the role of asker (generating questions from the existing question bank); the Bayesian engine updates probabilities on each answer; a second LLM call answers each question based on stored attributes. The full game plays out on screen — question by question, probability bars updating, dramatic reveal, confetti or silence — then loops to the next character. Leave it running at a conference booth, on a portfolio page, or open during a video interview. The game demonstrates its own sophistication without a human sitting down to play. Architecturally: two LLM calls per question with the existing engine wired between them. A `/demo` route that auto-plays after 30 seconds of inactivity.

---

**M.2 — Crowdsourced Attribute Voting**

After each completed game, surface one `null` or low-confidence attribute for the revealed character: *"Quick — is [Character Name] [attribute]?"* One tap. D1 stores the vote in `community_votes` (migration 0032). A nightly Cron Worker aggregates: ≥10 concordant votes → attribute auto-updated with `source: "community"`, `confidence: 0.85`. Zero LLM cost. Zero prompt engineering. Every completed game becomes a passive micro-crowdsourcing task — the player base collectively becomes the enrichment pipeline. Over time, the rarest and most obscure characters get filled in by the players most invested in them. The DB improves continuously through play, not through batch jobs.

---

**M.3 — The Character Genealogy Map**

An interactive `/explore` page: a D3.js force-directed graph where every character is a node. Three toggleable edge layers: `confused_with` (from `character_confusions`, migration 0031, edge weight = confusion count), `same_franchise` (from `character_relationships`, migration 0034), and `attribute_neighbors` (cosine similarity of attribute vectors above a tunable threshold). Node size scales with popularity score; node color maps to category (anime = indigo, movies = amber, etc.); clicking a node expands the full attribute profile and highlights nearest neighbors. The entire knowledge graph — 500+ characters — visible at once and navigable. The kind of visualization that makes someone stop and say *"I didn't know this was underneath a guessing game."*

---

**M.4 — Dual Engine Race**

Two AI architectures compete against each other on the same character, rendered side-by-side. The Detective: the current hybrid — structured Bayesian probability engine + LLM question phrasing, transparent probability scores visible at every step. The Oracle: pure GPT-4o — receives the full game history as context, reasons to its conclusion from first principles, no structured probability model, just emergent in-context reasoning. Both engines draw from the same question bank; the one that guesses correctly in fewer questions wins. Results feed into the simulator: over thousands of races, which paradigm is actually smarter? The answer is probably "it depends on character type" — which is itself interesting. In a portfolio context, this is the most honest and dramatic answer to "how does AI know?" you can show a non-technical audience.

---

**M.5 — Teaching Mode as a Community Platform**

Elevate Teaching Mode from a power-user form into a full community contribution system. Submitted characters enter a `/community` queue visible to all players. Others upvote, add missing attributes, or flag inaccuracies — one attribute at a time, no account required. Characters reaching ≥20 upvotes auto-trigger the enrichment pipeline: LLM attribute fill, image fetch, confidence scoring. An admin reviews the enriched result and merges in one click. Contribution loop: *submit → community validates → auto-enrich → admin merge*. Uses `getOrCreateUserId()` cookies throughout — no auth required. Over time, Teaching Mode becomes the primary growth mechanism for the game's content. Players become co-authors of the AI's world model.

---

**M.6 — The Self-Documenting Codebase**

An AI agent runs on a schedule (nightly Cron Trigger or GitHub Actions cron) that reads every file in `src/`, `functions/`, and `packages/game-engine/src/`, then produces three outputs: (1) a fresh `ARCHITECTURE.md` reflecting what the code *actually* does today; (2) a drift report listing every discrepancy between the current architecture doc and reality — renamed files, added endpoints, changed data flows; (3) a one-paragraph "what changed this week" summary derived from the git log. Architecture docs that stay synchronized with the code without manual maintenance — the kind of operational discipline that usually only exists in teams with dedicated technical writers.

---

**M.7 — Zero-Config New Character Category**

`pnpm ingest:new-category --name "anime-villains"` triggers a wizard: (1) provide 5 example characters in the category; (2) GPT-4o proposes a set of distinguishing attributes based on the examples; (3) writes the attribute schema; (4) generates a seed migration; (5) configures enrichment targets; (6) adds simulator weights extrapolated from the nearest existing category. Adding a new content type goes from "a day of scaffolding" to "a 5-minute conversation with a CLI." The AI designs its own expansion without manual prompt engineering — it understands the attribute system well enough to propose what distinguishes one category from another.

---

**M.8 — Multi-Modal Interrogation**

A `/identify` route. The player uploads a photo or pastes an image URL. A Workers AI vision model (`@cf/llava-1.5-7b-hf`) describes the character in the image; that description is embedded and matched against the character knowledge base. The AI returns its top-3 guesses with confidence scores and a reasoning chain. Reverse mode for the entire guessing mechanic — the human submits photographic evidence; the AI deduces. For well-known characters with consistent visual designs, this would be eerily accurate. For fan art or obscure characters, the reasoning chain becomes the entertainment. No gameplay changes required — a new route that plugs into the existing engine.

---

**M.9 — Federated Character Network**

Multiple independent deployments of this game share their enriched character knowledge via a signed REST protocol. When deployment A encounters a character it doesn't know, it queries its federation peers and receives the enriched attribute vector, confidence scores, and source attribution. Peers verify authenticity via Ed25519 signatures on response bodies. The knowledge graph grows across deployments without a central server — ActivityPub-style, but for fictional character ontologies. Each deployment is a node in a crowd-sourced knowledge network, contributing to and benefiting from the collective intelligence of all instances. Independent fan deployments (anime-only, MCU-only, video-games-only) specialize and federate — the result is a domain-specific knowledge web.

---

**M.10 — Real-Time Co-Op vs. AI**

Two players collaborate in the same game session via Durable Objects + WebSockets. Session state lives in a DO. Player 1 answers questions on their device; Player 2 sees each answer appear in real time on theirs, along with probability bars updating live. Both players can veto an answer before it's submitted — a "confer" mechanic that adds a social layer. The AI plays against a coordinated human team with shared information and deliberation time. Leaderboard: "Pairs who stumped the AI in the fewest questions." Architecturally: DO + WebSockets for synchronized session state; `useServerGame` extended to subscribe to DO events. The multiplayer infrastructure would be identical to the Icebox "multiplayer party mode" item — shipping one unlocks the other.

---

**M.11 — Temporal Character DB**

Every character gets a `known_since` date (year of first appearance in source material, via the `characters.known_since` column in the DB section). A "time machine" mode on the welcome screen lets the player pick a year. The character pool filters to only characters that existed by that date. `1995 mode`: no Shrek, no Jack Sparrow, no Edward Cullen. `1980 mode`: no internet-native characters at all. Each era has a completely different difficulty profile — questions about "fromVideoGame" become trivially hard in 1970 mode; questions about "fromBook" dominate in 1850 mode. Not just *who* is in the pool, but *what questions are even meaningful* by that date. The attribute space itself is temporally situated.

---

**M.12 — Adaptive Attribute Taxonomy**

A nightly Cron Trigger Worker computes cosine similarity across all vectors in `attribute_embeddings` (migration 0035). Attribute pairs with similarity > 0.95 are flagged as semantic duplicates (e.g. "isEvil" and "isVillain"). An admin review queue in `/admin/attributes` surfaces the flagged pairs with sample characters where they disagree. Approved merges consolidate the attribute key across `character_attributes`, `attribute_definitions`, and `questions`, then delete the redundant row. Over time the attribute space self-compacts — fewer, more orthogonal attributes means higher information gain per question asked. The knowledge representation improves continuously without manual curation. The DB curates itself.

---

**M.13 — The Living Meta API**

The character knowledge graph is exposed as a public, queryable API — JSON-LD and/or GraphQL. Developers can query: *"all anime characters who are villains with magic powers"*, *"characters from the same franchise as Naruto with confidence > 0.8"*, *"the 10 characters most often confused with Batman."* Every response includes enrichment provenance (source, model, confidence, `contested` flag). The portfolio piece becomes infrastructure — not just a game, but a semantic web data source that other apps and researchers can build on. Rate-limited via Cloudflare Workers; free tier for reasonable use.

---

**M.14 — Character DNA Sequencer**

Enter any two characters; the system merges their attribute vectors (boolean union with conflicts resolved by confidence weighting) and calls the LLM to synthesize a narrative identity for the hybrid entity. The crossover appears in the game's possibility space as a hypothetical character with a generated name, composite attribute profile, and a one-paragraph origin story. *"A caped, web-slinging Gotham orphan who fights crime while also being deeply neurotic about high school homework."* Shareable link encodes the pair. The game stops being purely deductive and becomes generative — a creative tool for producing new fictional entities from the intersection of existing ones. The most entertaining output of the DNA Sequencer will be pairs no one would ever think to combine.

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04 | No monetization, no auth | Portfolio project — simplicity and focus over growth mechanics |
| 2026-04 | Cloudflare-only infra | Zero cold starts, generous free tier, single vendor for deploy simplicity |
| 2026-04 | No leaderboard (yet) | Requires auth; complexity not worth it without an audience |
| 2026-04 | Bayesian engine, not LLM-only | LLM alone is too slow and expensive per question; hybrid is faster and cheaper |
| 2026-04 | DO for sessions = paid plan | Durable Objects require Workers Paid ($5/mo). KV session storage sufficient for portfolio scale; revisit if session consistency bugs become an issue |
| 2026-04 | Admin panel uses Basic auth (not Cloudflare Access) | Solo developer tool — shared secret in KV is sufficient and zero-cost. Swap to Cloudflare Access ($3/user/mo) only if collaborators are added |
| 2026-04 | StatsDashboard stays in main app | Player-facing data (own win/loss stats) is not a developer tool; only internal tooling lives in the admin panel |
| 2026-04 | v1 KV endpoints not removed yet | Still referenced by some client paths; document deprecation before removal in a future cleanup migration |
| 2026-04 | Infrastructure and Database elevated to top-level sections | These were buried in `BX/BI/BE/BP` sub-sections in the prior roadmap; they're a primary focus area going forward and deserve first-class treatment |
| 2026-04 | Roadmap v1.4 archived | The prior roadmap grew to ~800 lines with most items struck through. CHANGELOG handles what shipped; this roadmap covers only what's ahead. Archive preserved at `docs/ROADMAP-archive-v1.4.md` |

---

*Last updated: April 2026 · v1.4.0*
