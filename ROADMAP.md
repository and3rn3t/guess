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

### Medium-Term (1–3 days each)

| # | Item | Files | Notes |
|---|------|-------|-------|
| I.4 | **Tail Worker observability layer** | New Worker | Deploy a separate Tail Worker that receives every invocation from the main Worker — errors, CPU time, response status, request path. Writes structured rows to Workers Analytics Engine: `{ path, status, cpuMs, error, timestamp }`. Zero changes to existing endpoint code. The entire observability stack runs inside Cloudflare and costs nothing beyond what's already deployed. Surfaces in `/admin/logs` (see Admin Pipe Dreams). |
| I.5 | **R2 Event Notifications → dominant color extraction** | New Worker | When an admin uploads a character image to R2, an Event Notification fires a Worker. The Worker fetches the thumbnail, runs a 16-color median cut quantization over the pixel data in pure JS (no canvas API needed on Workers), and writes the dominant hex color to `characters.dominant_color` in D1. `GuessReveal` uses it for ambient card theming (P.3). Zero manual work per character — the upload pipeline becomes self-annotating. |
| I.6 | **Cloudflare Queues for async teaching mode** | `functions/api/v2/characters.ts`, new consumer | `POST /api/v2/characters` currently runs D1 write + LLM attribute fill + KV cache bust synchronously in the response path. Queue it instead: write a minimal D1 record and push a job to a Cloudflare Queue. A separate consumer Worker handles enrichment (LLM calls, attribute filling, image upload, cache bust) asynchronously. The player sees "submitted — we'll add it shortly" rather than waiting on 3+ LLM calls. Teaches producer/consumer architecture. |
| I.7 | **Durable Objects for game session state** | `functions/api/v2/game/` | Replace KV lean+pool session storage with a DO per game session. Every answer hits the same DO instance — strongly consistent, no KV serialization round-trip, no race condition on concurrent answer submissions. Trade-off: Workers Paid plan required ($5/mo). Teaches DO `state.storage`, `alarm()`, and the hibernation API. Revisit if session consistency bugs emerge; not urgent at current scale. |

### Infrastructure Explorations

> 🧊 **Icebox** — Learning-oriented; no implementation timeline. Listed for portfolio narrative value.

| # | Exploration | What you'd learn |
|---|------------|-----------------|
| IX.1 | **Cloudflare Vectorize as character index** | Replace the O(N×Q) Bayesian probability loop with approximate nearest-neighbor search. Embed the current answer state as a vector (`yes/no/maybe/null` per attribute → `float[]`); store all characters as pre-computed vectors in Vectorize; `POST /api/v2/game/answer` does a single `vectorize.query()` instead of iterating 500 characters × 50 attributes. Teaches: vector databases, ANN search, Vectorize API. Trade-off: loses per-character probability transparency (though re-derivable from similarity distances). |
| IX.2 | **Cloudflare Workflows for the enrichment pipeline** | Rewrite `run-enrich.sh` as a Cloudflare Workflow: each character is a Workflow step; failures retry automatically with exponential backoff; the Workflow UI shows exactly where it stalled. Steps: `fetch → dedup → LLM enrich → image process → D1 upload → KV cache bust`. Teaches: durable execution patterns, Workflows API — concepts that transfer to any long-running job system. |
| IX.3 | **Self-Tuning Engine via Cron Trigger** | A Cron Trigger Worker runs nightly: reads last 7 days of `game_stats`, computes actual win rate per trigger type vs. calibration targets, and applies a gradient step to `SCORE_MATCH`, `SCORE_MISMATCH`, `SCORE_MAYBE` stored as KV flags. The live Worker reads scoring constants from KV on every game start instead of compiled-in constants. The engine tunes itself while you sleep — without a code deploy. Teaches: Cron Triggers, KV as a live config store, gradient-based hyperparameter optimization in a production loop. |
| IX.4 | **A/B Engine via KV Feature Flags** | Add a `variant` field to `game_stats`: `"control"` or `"experiment"`. On game start, read KV flag `ab:engine:experiment_pct` (e.g. `"20"`) and route that % of games to alternate scoring constants (also in KV). Both variants play live games; real-world win rates accumulate in D1 split by variant. After 500 games per arm, a calibration SQL query tells you which constants win in the real world. Zero-deploy A/B testing of the engine's core numerics. Teaches: feature flags as a system design pattern, statistical significance in A/B tests. |

---

## Database

Schema evolution and new migrations. The current latest is `0030_question_difficulty.sql`.

### Planned Migrations

| Migration | Table / Change | Purpose |
|-----------|---------------|---------|
| **0031** | `character_confusions(character_a TEXT, character_b TEXT, confusion_count INTEGER, last_seen TEXT)` | Track which characters the engine most frequently confuses with each other. A weekly Cron Worker aggregates runner-up pairs from `game_stats`. A compound index on `(character_a, confusion_count DESC)` makes top-N lookups fast. Powers the confusion matrix (AN.7) and question-selector up-weighting for known confusion pairs. |
| **0032** | `community_votes(id TEXT, character_id TEXT, attribute_key TEXT, vote INTEGER, user_hash TEXT, created_at TEXT)` | Per-attribute community yes/no votes (one per user hash per attribute). A nightly Cron Worker aggregates: ≥10 concordant votes → attribute auto-updated with `source: "community"`, `confidence: 0.85`. Unique constraint on `(character_id, attribute_key, user_hash)` prevents ballot stuffing. Foundational for the Crowdsourced Attribute Voting moonshot (M.2). |
| **0033** | `pipeline_runs(id TEXT, character_id TEXT, step TEXT, status TEXT, duration_ms INTEGER, error TEXT, created_at TEXT)` | Full provenance trail for every enrichment pipeline step: `fetch → dedup → enrich → image → upload`. One row per character per step. Enables per-step retry in the Cloudflare Workflows version (IX.2). Powers the Pipeline Visual DAG in Admin Pipe Dreams. |
| **0034** | `character_relationships(character_a TEXT, character_b TEXT, relationship_type TEXT, created_at TEXT)` | Relationships between characters: `same_universe`, `same_franchise`, `same_creator`, `rivals`, `allies`. Populated by an LLM batch pass over the character pool. Enables universe-aware questions ("Do they share a universe with Batman?") impossible to generate from attribute space alone. Underpins the Genealogy Map moonshot (M.3). |
| **0035** | `attribute_embeddings(attribute_key TEXT PRIMARY KEY, embedding BLOB, model TEXT, created_at TEXT)` | Workers AI embedding vectors per attribute key (`@cf/baai/bge-base-en-v1.5`). Enables semantic deduplication (Adaptive Attribute Taxonomy moonshot M.12) — nightly cosine similarity check flags near-duplicate attributes for merge review. Also powers B.4 question deduplication at write time and IX.1 (Vectorize character index). |

### Schema Improvements

| Item | Detail |
|------|--------|
| **FTS expansion** | Migration 0018 added `characters_fts` for character name search. Extend to `questions_fts` — searching question text in the admin panel currently requires a LIKE scan. One `CREATE VIRTUAL TABLE` + trigger migration. |
| **`characters.dominant_color` column** | Add `dominant_color TEXT` (nullable) to the `characters` table. Populated automatically by the R2 Event Notification Worker (I.5). Used by `GuessReveal` ambient theming (P.3) and character knowledge graph node coloring in Admin Pipe Dreams. Pairs with I.5. |
| **`characters.fingerprint` column** | Add `fingerprint TEXT` (nullable) — a 3–5 word phrase that uniquely distinguishes a character from their nearest neighbor in attribute space. Generated by the enrichment pipeline (AI item A.7). Surfaced in `GuessReveal` below the character name. |
| **`characters.known_since` column** | Add `known_since INTEGER` — the year the character first appeared in source material. Required by the Temporal Character DB moonshot (M.11). Populated via enrichment LLM pass or source API metadata where available. |
| **Deprecate v1 KV endpoints** | `functions/api/characters.ts`, `questions.ts`, `corrections.ts`, `stats.ts`, `sync.ts` are legacy KV-backed endpoints from before D1. Add a `Deprecation: true` + `Sunset: 2027-01-01` header to responses. Document the v1 → v2 migration path. No new features should touch v1; plan removal in a future cleanup migration. |
| **D1 → R2 nightly export** | A Cron Trigger Worker dumps `game_stats`, `sim_game_stats`, and `character_attributes` as newline-delimited JSON to R2 (`exports/YYYY-MM-DD/`). Enables ad-hoc analytics with DuckDB or Jupyter outside the CF dashboard without live D1 queries. Schema evolution over time is visible in the export history. |

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

### DX Pipe Dreams

> 🧊 **Icebox** — Best-in-class tooling; not currently scoped.

**Full Storybook Component Catalog** — `@storybook/react-vite` documenting every component in `src/components/` in isolation. Stories cover every meaningful variant: `QuestionCard` with easy vs. hard questions, `GuessReveal` with and without an R2 image, `ReasoningPanel` with 3 candidates vs. 80. Interaction tests (`@storybook/addon-interactions`) automate the same flows Playwright covers — faster, no server dependency. Storybook build deploys as a CF Pages preview on every PR.

**Zod API Contract Layer** — shared Zod schemas in `packages/game-engine/src/schemas.ts`. Workers handlers validate request/response shapes at the edge using `.parse()`. React hooks import the same schemas for response type inference — not `json as unknown as GameSession`, but `SessionSchema.parse(json)`. Schema mismatches between client and server caught at runtime + compile time from a single source of truth. Schemas also serve as MSW fixture generators for DX.4.

**Turborepo Task Graph** — define a task pipeline (`test` depends on `build`, `build` depends on `game-engine#build`). Tasks that haven't changed since the last run are cache-hits and return instantly. CI benefits most: if only `src/` changed, `packages/game-engine` lint/type-check/test is skipped. Warm-cache runs after a small change are near-instant.

**Playwright Visual Regression Baseline** — screenshot comparison after each phase transition. Any pixel-level layout regression fails CI with a visual diff uploaded as an artifact. Golden images live in `.playwright/snapshots/`; updated explicitly with `--update-snapshots`.

**Generated Type-Safe API Client** — a build script parses `functions/api/v2/` files, extracts request/response types, and emits `src/lib/api.generated.ts`. `api.game.answer({ answer: 'yes' })` is then fully type-safe end-to-end — the compiler catches URL, method, body, and response mismatches before runtime.

**Full Miniflare Integration Test Suite** — spins up the complete Worker with Miniflare (local D1, KV, R2), seeds test fixtures, and runs the full request-response cycle for every endpoint: session lifecycle (`start → answer × N → result`), rate limiting (11 LLM calls → 429), cookie signing (tampered cookie → 401), D1 contention (concurrent session writes → consistent state). Full coverage of the server-side logic without a deployed environment.

---

## Admin Panel Pipe Dreams

> 🧊 **Icebox** — Transform the admin panel from developer tools into a live ops center. No implementation timeline.

**Real-Time Game Observatory** (`/admin/observatory`) — a Tail Worker captures game events and pipes them into a Cloudflare Queue. The admin panel SSE-streams a live ticker: *"User in 🇩🇪 answered 'Yes' to isHuman — 47 → 12 candidates remaining. Confidence: 84%."* Below the ticker: live counter of games in progress, answers per minute, current most-guessed character. The reasoning panel visualization plays out for every active game simultaneously — a grid of probability bars all moving at once. Zero impact on user-facing latency since Tail Workers run after the response is sent.

**Engine Health Vitals Board** (`/admin/health`) — six live sparklines from Workers Analytics Engine: win rate (7-day rolling), avg questions per game, forced-guess rate, contradiction rate, median confidence at guess time, LLM error rate. Each sparkline has a colored status indicator: green (within calibration targets), amber (drifting), red (out of bounds). Compares current real-game metrics against simulator last-run outputs side-by-side. If any metric crosses a threshold, a Cron Trigger Worker fires a notification (KV flag + optional webhook) before the problem is visible to players.

**Character Knowledge Graph** (`/admin/graph`) — a D3.js force-directed graph of every character. Three toggleable edge layers: `confused_with` (from `character_confusions`, migration 0031), `same_franchise` (from `character_relationships`, migration 0034), and `attribute_neighbors` (cosine similarity above a tunable threshold). Node size = popularity score; node color = category; node glow intensity = enrichment confidence. Clicking a node expands a floating panel with full attribute profile, image, and a "re-enrich" button. Lasso-select a cluster and batch-send to the enrichment queue.

**Attribute DNA Matrix** (`/admin/matrix`) — every character (rows) × every attribute (columns) rendered as a color-coded pixel grid: green for `true`, red for `false`, mid-grey for `null/unknown`. At 500 × 50 the entire knowledge base fits on a 1280px canvas. Hovering a cell shows character name + attribute key + value + confidence + model. Clicking opens an inline edit popover. Sorting rows by coverage % and columns by info gain puts the most discriminating attributes top-left. The shape of the knowledge base becomes visible at a glance.

**Pipeline Visual DAG Orchestrator** (`/admin/pipeline`) — the enrichment pipeline rendered as an interactive directed acyclic graph: `[Fetch Sources] → [Dedup] → [LLM Enrich] → [Image Process] → [D1 Upload] → [Cache Bust]`. Each node is a card showing status (idle/running/error), throughput (characters/min), queue depth, and error rate. During a live run, a pulsing dot animates characters flowing node to node. Clicking a node drills into its log table from `pipeline_runs` (migration 0033). A "pause after this step" toggle lets you inspect intermediate results before committing.

**LLM Cost Observatory** (`/admin/cost`) — pulls from AI Gateway native cost metrics + Workers Analytics Engine. Shows: cost-per-game by day (bar chart), cost-per-enrichment-run (scatter plot), model comparison, projected monthly burn at current daily rate, and a "what-if" batch size slider with real-time cost projection. A "cost efficiency" score: cost per successful game win. Not a surprising monthly bill — a live instrument.

**A/B Experiment Control Room** (`/admin/experiments`) — makes the KV Feature Flag A/B system (IX.4) fully browser-operational. Lists active/completed experiments with traffic split %, sample size per variant, win rate per variant with 95% confidence intervals, and a live p-value indicator that turns green at p < 0.05. Buttons: "Start", "Increase traffic to experiment arm", "Declare winner" (promotes winning constants to production KV, clears experiment flags), "Roll back". Experiment management without touching KV manually or writing SQL.

**Adversarial Stress Test Console** (`/admin/stress-test`) — type any character name, click Run. A `POST /api/admin/stress-test` endpoint runs the deterministic simulator in adversarial mode and streams results via SSE. The admin panel renders the game unfolding question by question — probability bars updating, candidates dropping. Confusion report at the end: highest-ranked wrong character at each step, the attribute that finally broke the tie, attributes that if added would have resolved the confusion earlier. A live debugger for the Bayesian engine.

**Tail Worker Activity Stream** (`/admin/logs`) — a live, filterable log of every Worker invocation rendered like a terminal in the browser. Color-coded status: green 2xx, amber 4xx, red 5xx, purple edge cache hits. Filters: by path prefix, by status code, by CPU time percentile. Click any row to expand full request context — headers, CF ray ID, country. Latency histogram at the top updates in real time.

---

## Enrichment Pipe Dreams

> 🧊 **Icebox** — Technically deep data pipeline extensions. No implementation timeline.

**LLM Confidence as a First-Class Data Type** — replace `true/false/null` per attribute with a structured object: `{ value: true, confidence: 0.91, source: "llm-gpt4o-mini", contested: false }`. When two enrichment passes disagree, `contested: true`. The game engine's Bayesian scorer weights contested attributes lower at runtime. The enrichment output becomes a first-class probabilistic dataset, not a boolean table.

**Cross-Character Relationship Graph** — an LLM batch pass builds `character_relationships` (migration 0034): "List every character in this batch who shares a fictional universe with another character in your database." Enables universe-aware questions ("Do they share a universe with Batman?") impossible to generate from attribute space alone.

**Wikipedia Full-Text Semantic Enrichment** — fetch each character's Wikipedia article (MediaWiki REST API — free, no key). Chunk-embed via Workers AI `@cf/baai/bge-base-en-v1.5` and store in Cloudflare Vectorize. When the Bayesian engine is stuck (10 similar-probability candidates), embed recent answers as a query vector and retrieve top-3 nearest characters from Vectorize. Structured Bayesian engine and semantic retrieval vote together — a character that *feels* similar based on prose description, not just attribute tags.

**Popularity Decay Model via Real Game Data** — replace static `[0,1]` popularity from source APIs with a dynamic score blending API popularity + in-game pick frequency. A nightly Cron Worker recomputes from `game_stats` and writes back to D1. Characters players care about float up; obscure ones drift down. The DB becomes self-calibrating through play.

**Image Aesthetics Scoring via Vision Model** — after downloading each character image, pass `thumb.webp` to a vision model: "Rate this portrait for: (1) face visibility, (2) art style consistency, (3) character recognizability. Return JSON `{ faceScore, styleScore, recognitionScore }` each 0–1." Store scores in D1. Prefer high-scoring portraits for the possibility grid and GuessReveal. Low-scoring images (blurry, group shots, logo-only) get flagged for replacement.

**Multi-Language Attribute Enrichment** — run enrichment in English, then a second pass in Japanese (anime characters) and Spanish (Latin American characters). Some attributes are better answered in the source language. Confidence-weighted majority vote merges results. The pipeline becomes multilingual without the game surface needing to change.

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
