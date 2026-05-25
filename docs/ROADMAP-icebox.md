# Roadmap — Icebox & Moonshots

> Long-tail ideas extracted from the active [ROADMAP.md](../ROADMAP.md) so the main document stays focused on shippable near-term work. Nothing here has a timeline. Items are kept for portfolio narrative value, future inspiration, or because they're interesting enough not to lose.

For the full annotated history of these ideas, see [ROADMAP-archive-v1.5.md](ROADMAP-archive-v1.5.md).

---

## Contents

- [Infrastructure Explorations](#infrastructure-explorations)
- [DX Pipe Dreams](#dx-pipe-dreams)
- [Admin Panel Pipe Dreams](#admin-panel-pipe-dreams)
- [Enrichment Big Projects](#enrichment-big-projects)
- [Experimental UI / Emerging Web Tech](#experimental-ui--emerging-web-tech)
- [Gameplay & UX Icebox](#gameplay--ux-icebox)
- [Engine / Tech Explorations](#engine--tech-explorations)
- [Moonshots](#moonshots)

---

## Infrastructure Explorations

| # | Exploration | Notes |
|---|-------------|-------|
| IX.1 | **Cloudflare Vectorize as character index** | Replace O(N×Q) Bayesian loop with ANN search over per-character attribute vectors. Loses per-character probability transparency. |
| IX.2 | **Cloudflare Workflows for the enrichment pipeline** | Each character a Workflow step with automatic retry; durable execution; UI shows where it stalled. |
| IX.3 | **Self-Tuning Engine via Cron Trigger** | Nightly Worker reads `game_stats`, computes win rate vs. calibration targets, gradient-steps `SCORE_*` constants stored in KV. No deploys. |
| IX.4 | **A/B engine via KV feature flags** | Route % of games to alternate scoring constants stored in KV; split outcomes by `game_stats.variant` (already in schema as of 0033). |
| IX.5 | **MCP server** — character KB as a composable AI tool | Workers MCP server exposing `search_character`, `get_character_attributes`, `find_confused_characters`, `run_bayesian_game`. |
| IX.6 | **WebAssembly scoring engine** | Compile Bayesian hot path to WASM (Rust or AssemblyScript). Academic at 500 chars; material at 5K. |
| IX.7 | **Cloudflare AutoRAG** | Replace manual Wikipedia enrichment with managed RAG over R2 character docs; structured + semantic vote together. |
| IX.8 | **Cloudflare Containers** | Co-located Docker for embeddings, DuckDB analytics over R2, full Python image processing. |

---

## DX Pipe Dreams

- **Full Storybook component catalog** — every component, every meaningful variant; Pages preview per PR.
- **Zod API contract layer** — shared schemas in `packages/game-engine/`, validated edge + client; MSW fixtures generated.
- **Turborepo task graph** — cached per-package builds and tests.
- **Playwright visual regression baseline** — snapshot diffs on phase transitions.
- **Full Miniflare integration test suite** — full request-response cycle for every endpoint with seeded fixtures.
- **Property-based testing for the engine** — fast-check fuzzing of Bayesian invariants.
- **Contract testing with Pact** — consumer-driven contract between React client and Workers.
- **Mutation testing with Stryker** — surface untested logic in `packages/game-engine/`.
- **Snapshot testing for the Bayesian engine** — committed `__snapshots__/` for known game histories.
- **Local D1 seed scripts** — `pnpm db:seed` for reproducible local state.
- **AI-assisted PR review bot** — GitHub Action pipes diffs through AI Gateway with project-specific checks.
- **GitHub issues as an executable backlog** — structured templates; Copilot agent attempts where possible.
- **Dev container** — `devcontainer.json` with full toolchain pre-installed.
- **`wrangler --remote` integration test mode** — Playwright against real preview env.
- **Live `ARCHITECTURE.md` Mermaid generation** — diagram regenerated from `wrangler.toml` + `functions/api/v2/`.

---

## Admin Panel Pipe Dreams

- **Real-Time Game Observatory** (`/admin/observatory`) — Tail Worker → Queue → SSE ticker of live games.
- **Engine Health Vitals Board** (`/admin/health`) — six live sparklines from Workers Analytics Engine with calibration thresholds and alerting.
- **Character Knowledge Graph** (`/admin/graph`) — D3 force-directed graph; toggleable `confused_with` / `same_franchise` / `attribute_neighbors` edges.
- **Attribute DNA Matrix** (`/admin/matrix`) — characters × attributes pixel grid; opacity = confidence.
- **Pipeline Visual DAG Orchestrator** (`/admin/pipeline`) — interactive DAG of enrichment steps over `pipeline_runs`.
- **LLM Cost Observatory** (`/admin/cost`) — AI Gateway + Analytics Engine; cost-per-game, model breakdown, what-if slider.
- **Enrichment Diff Reviewer** (`/admin/enrich/diff`) — pre-upload diff with row-level approve/reject.
- **Image Quality Review Queue** (`/admin/images/review`) — low-scoring portraits with drag-and-drop replace.
- **Agent Reasoning Trace Viewer** (`/admin/enrich/traces`) — collapsible timeline of tool calls + retrieved evidence per attribute.
- **A/B Experiment Control Room** (`/admin/experiments`) — manage IX.4 experiments from the browser; live p-value indicator.
- **Adversarial Stress Test Console** (`/admin/stress-test`) — SSE-stream the deterministic simulator playing any character.
- **Tail Worker Activity Stream** (`/admin/logs`) — terminal-like live log viewer with filters and request drill-down.

---

## Enrichment Big Projects

- **Migrate enrichment to Cloudflare Workflows** (IX.2 applied) — durable execution, step-level retry, no local machine required.
- **Agentic enrichment pipeline** — autonomous loop: `search_web` / `fetch_wikipedia` / `verify_attribute` tools; per-attribute reasoning trace + cited source.
- **Structured data extraction from Fandom/Wiki** — `sources/fandom.ts`; LLM extraction over scraped infobox + lead.
- **Embedding-based attribute coverage gap detection** — lightweight classifier predicts which `(character, attribute)` pairs the LLM can answer; skip the rest. ~30–50% LLM cost reduction.
- **Streaming enrichment with real-time D1 writes** — interleave upload with enrichment; live admin dashboard becomes useful during the run.
- **AutoRAG as the enrichment knowledge base** (IX.7 applied) — retrieval-grounded answers over chunked R2 corpus; not memory recall.
- **Model routing by attribute type** — `simple` → Workers AI Llama; `moderate` → GPT-4o-mini; `complex` → GPT-4o. ~40–60% cost reduction.
- **Freeform character ingestion via AI agents** — Copilot coding agent writes new `sources/*.ts` adapters from API docs.

---

## Experimental UI / Emerging Web Tech

- **WebXR character recognition** — point camera at a poster/figure; Workers AI vision starts a game pre-seeded to that character.
- **AI Summarizer API** (`window.ai.summarizer`) — on-device "What gave it away?" panel on `GuessReveal`.
- **Prompt API for on-device hint generation** — `window.ai.languageModel` powers G.2 hints with zero latency.
- **Translator & Language Detector APIs** — on-device localization driven by `navigator.language`.
- **Web Audio ambient sound design** — procedural hum that intensifies as candidates narrow; resolution chord on win.
- **CSS Custom Highlight API** — keyword highlighting in answer history without `<span>` wrapping.
- **WebGazer eye tracking** — dwell-to-answer; accessibility story for motor-impaired play.
- **Spatial 3D card reveal** — CSS `perspective` + `rotateY(180deg)` flip on `GuessReveal`; holographic shimmer back face.
- **Window Management API** — multi-monitor power mode: game on primary, `ReasoningPanel` floated on secondary.
- **Document Picture-in-Picture** — eject `QuestionCard` + answer buttons into a PiP window; main updates via `BroadcastChannel`.

---

## Gameplay & UX Icebox

- **Multiplayer party mode** — real-time WebSocket race via Durable Objects.
- **Story / campaign mode** — 10-character narrative arc.
- **Character of the week** — KV-flagged featured pick with welcome badge.
- **Answer confidence slider** — single horizontal slider mapping to existing 4 buckets.
- **Leaderboard** — global daily challenge; requires auth.
- **Localization** — Spanish, French, Japanese character sets + translated attribute definitions.
- **Isometric character grid** — visual variant; doesn't add information value.
- **Spatial answer history** — SVG arc layout; current pills are clearer for casual players.
- **Streaming probability updates** — per-answer incremental Bayesian recalc; only relevant at 10K+ characters.

---

## Engine / Tech Explorations

- **Attribute embedding space** (E.2) — PCA / t-SNE cluster visualization to reveal structural blind spots.
- **Bandit-based question selection** (E.3) — UCB / Thompson Sampling; reward = game win.
- **Bayesian network attribute model** (E.4) — model conditional dependencies (`isVillain` × `hasMagicPowers`).
- **Self-play engine tournament** (E.5) — current vs. modified engine, AlphaZero-style evaluation framing.
- **LLM-assisted weight tuning** (E.6) — GPT-4o as surrogate model for Bayesian optimization of scoring constants.

---

## Moonshots

> Alternate identities for what this project could become.

**M.1 — A Game That Plays Itself** — autonomous demo mode: LLM asks, engine scores, second LLM answers from stored attributes. `/demo` route auto-plays after 30s idle. Architecturally: two LLM calls per question wrapped around the existing engine.

**M.2 — Crowdsourced attribute voting** — after each game, surface one `null`/low-confidence attribute for the revealed character. One tap. Aggregated nightly; ≥10 concordant votes auto-update with `source: "community"`. Every game becomes passive enrichment.

**M.3 — Character Genealogy Map** — `/explore` D3 force-directed graph of all characters with toggleable `confused_with` / `same_franchise` / `attribute_neighbors` edge layers.

**M.4 — Dual Engine Race** — current hybrid (Detective) vs. pure GPT-4o (Oracle) on the same character, side-by-side. Simulator tracks which paradigm wins by character type.

**M.5 — Teaching Mode as a community platform** — submitted characters enter a `/community` queue; upvotes + per-attribute crowd review; ≥20 upvotes auto-trigger enrichment; admin one-click merge.

**M.6 — Self-documenting codebase** — nightly agent regenerates `ARCHITECTURE.md` from current source; produces drift report and weekly change summary.

**M.7 — Zero-config new character category** — `pnpm ingest:new-category --name "anime-villains"` wizard: example characters → LLM proposes attribute schema → seeds migration → configures enrichment → extrapolates simulator weights.

**M.8 — Multi-modal interrogation** — `/identify` route: upload a photo; vision model describes; description matched against KB; AI returns top-3 guesses with reasoning.

**M.9 — Federated character network** — multiple deployments share enriched character data via signed REST + Ed25519. ActivityPub-style for fictional character ontologies.

**M.10 — Real-time co-op vs. AI** — two players in one DO-backed session over WebSockets; both veto answers before submission.

**M.11 — Temporal character DB** — `characters.known_since` filters the pool to characters that existed by a player-chosen year. 1995 mode, 1980 mode, etc.

**M.12 — Adaptive attribute taxonomy** — nightly cosine similarity over `attribute_embeddings` flags duplicate keys (`isEvil` ≈ `isVillain`); admin queue approves merges; DB self-compacts.

**M.13 — The Living Meta API** — public JSON-LD / GraphQL over the character knowledge graph with provenance metadata. Portfolio piece becomes infrastructure.

**M.14 — Character DNA sequencer** — merge two characters' attribute vectors; LLM synthesizes a hybrid identity ("caped, web-slinging Gotham orphan"). Shareable link encodes the pair.

---

*Snapshot of icebox + moonshot content extracted from ROADMAP.md during the v1.5 cleanup, April 2026.*
