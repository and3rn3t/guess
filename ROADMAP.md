# Roadmap

> Portfolio project — the goal is a delightful, frictionless experience and a showcase of creative AI integration. Not monetized; not mass-scale. Every item here should make the game *more fun* or *less annoying*, not more complex.

**Current version**: 1.6.0 — see [CHANGELOG.md](CHANGELOG.md) for what's shipped.

**Companion docs**

- [docs/ROADMAP-icebox.md](docs/ROADMAP-icebox.md) — long-tail explorations, pipe dreams, and moonshots (no timelines).
- [docs/ROADMAP-archive-v1.5.md](docs/ROADMAP-archive-v1.5.md) — full prior roadmap snapshot before this cleanup.
- [docs/ROADMAP-archive-v1.4.md](docs/ROADMAP-archive-v1.4.md) — earlier annotated archive.

---

## Contents

- [Roadmap](#roadmap)
  - [Contents](#contents)
  - [Guiding Principles](#guiding-principles)
  - [How to use this roadmap](#how-to-use-this-roadmap)
    - [Pick the next item](#pick-the-next-item)
    - [Track status in-flight](#track-status-in-flight)
    - [Definition of done (universal)](#definition-of-done-universal)
    - [Where things live](#where-things-live)
    - [Commit conventions for roadmap edits](#commit-conventions-for-roadmap-edits)
  - [Data Quality (Priority One)](#data-quality-priority-one)
    - [Continuous Validation Loop](#continuous-validation-loop)
    - [Multi-Source Triangulation](#multi-source-triangulation)
    - [Vision-Backed Visual Truth](#vision-backed-visual-truth)
    - [Active Learning from Players](#active-learning-from-players)
    - [Adversarial \& Constraint Hardening](#adversarial--constraint-hardening)
    - [Catalog Curation Automation](#catalog-curation-automation)
    - [Trust \& Transparency Surfaces](#trust--transparency-surfaces)
  - [Now](#now)
    - [In Progress / Up Next](#in-progress--up-next)
    - [Wave 1 — Foundation (start here, ~1 week of focused work)](#wave-1--foundation-start-here-1-week-of-focused-work)
    - [Wave 2 — Data Quality Foundation (priority one, ~2 weeks)](#wave-2--data-quality-foundation-priority-one-2-weeks)
    - [Wave 3 — Operational Readiness (~1 week)](#wave-3--operational-readiness-1-week)
    - [Wave 4 — Insight \& Refinement (~2 weeks)](#wave-4--insight--refinement-2-weeks)
    - [Wave 5 — Polish, Sharing \& Depth (open-ended)](#wave-5--polish-sharing--depth-open-ended)
    - [Cut line — actively considered, not yet scheduled](#cut-line--actively-considered-not-yet-scheduled)
  - [Infrastructure](#infrastructure)
    - [Near-Term (≤ 1 day each)](#near-term--1-day-each)
    - [Medium-Term (1–3 days each)](#medium-term-13-days-each)
  - [Database](#database)
    - [Planned Migrations](#planned-migrations)
    - [Schema Improvements](#schema-improvements)
    - [Query Performance \& Maintenance](#query-performance--maintenance)
  - [AI \& LLM Layer](#ai--llm-layer)
  - [Gameplay Depth](#gameplay-depth)
  - [Social \& Replayability](#social--replayability)
  - [Portfolio Polish](#portfolio-polish)
  - [Hardening \& Hygiene](#hardening--hygiene)
    - [SEO \& Sharing](#seo--sharing)
    - [Observability \& Operations](#observability--operations)
    - [Resilience \& Safety](#resilience--safety)
    - [Accessibility \& Inclusion](#accessibility--inclusion)
  - [UI / UX](#ui--ux)
    - [Near-Term Polish (1–2 days each)](#near-term-polish-12-days-each)
    - [Medium-Term UX Projects (2–4 days each)](#medium-term-ux-projects-24-days-each)
  - [Modern Web Platform](#modern-web-platform)
    - [CSS \& Layout](#css--layout)
    - [Browser APIs](#browser-apis)
    - [Accessibility Gaps](#accessibility-gaps)
  - [Developer Experience](#developer-experience)
    - [Test, Lint \& Verification](#test-lint--verification)
    - [Release \& Versioning](#release--versioning)
    - [Developer Loop \& Tooling](#developer-loop--tooling)
    - [Code Generation \& Type Safety](#code-generation--type-safety)
    - [Visualization \& Insight](#visualization--insight)
    - [Productivity \& Quality of Life](#productivity--quality-of-life)
  - [Enrichment](#enrichment)
    - [Near-Term Improvements](#near-term-improvements)
    - [Medium-Term Architecture](#medium-term-architecture)
    - [Pipeline Quality \& Observability](#pipeline-quality--observability)
    - [Confidence, Provenance \& Self-Healing](#confidence-provenance--self-healing)
    - [Catalog Discovery \& Expansion](#catalog-discovery--expansion)
    - [Multimodal \& Vision](#multimodal--vision)
    - [Pipeline Architecture](#pipeline-architecture)
    - [Player-Facing Enrichment Surfaces](#player-facing-enrichment-surfaces)
  - [Admin Panel](#admin-panel)
    - [Polish \& Wiring Audit](#polish--wiring-audit)
    - [Near-Term Analytics](#near-term-analytics)
    - [Player-Behavior Insights](#player-behavior-insights)
    - [Engine Self-Tuning Loops](#engine-self-tuning-loops)
    - [Catalog \& Question Quality](#catalog--question-quality)
    - [Operations \& Live Telemetry](#operations--live-telemetry)
    - [Experimentation Platform](#experimentation-platform)
  - [Decision Log](#decision-log)

---

## Guiding Principles

- **Remove friction first** — if a player has to stop and think about the UI, something's wrong.
- **Reward curiosity** — surfacing the AI's reasoning is the core hook; lean into it.
- **Small, shippable slices** — each item should be completable in a weekend session.
- **Portfolio-quality polish** — the kind of detail that makes a recruiter say "whoa".

---

## How to use this roadmap

This is a **living document** and the canonical source of truth for what's next. Read it; don't re-derive it. Future Copilot sessions and humans alike should follow this loop:

### Pick the next item

1. Start at the top of the [In Progress / Up Next](#in-progress--up-next) block in the [Now](#now) section. If something is `🟡 in progress`, finish it before pulling new work.
2. Otherwise pull the topmost `⬜` row from the active wave. **Do not skip ahead** — waves are ordered so each unblocks the next. If you genuinely need to skip, record why in the Decision Log first.
3. Wave 1 → Wave 2 → Wave 3 → Wave 4 → Wave 5. Wave 5 is unordered; pick by mood within a cluster.

### Track status in-flight

- When you start an item, change its `⬜` to `🟡` **and** add it to the [In Progress / Up Next](#in-progress--up-next) block. Same commit as the first code change.
- When you ship it, change `🟡` to `✅ YYYY-MM-DD`, remove it from the In Progress block, and promote the next `⬜` into Up Next. Same commit as the merge / deploy.
- If scope expands, splits, or moves between waves, add a one-line Decision Log row with the date and reason.

### Definition of done (universal)

An item is `✅` only when **all** of these are true:

- [ ] Code shipped to `main` and deployed (or, for non-code items: artifact committed, doc merged, dashboard live).
- [ ] `pnpm validate` passes locally (type-check + lint + test).
- [ ] Both builds green: `pnpm build && pnpm build:worker`.
- [ ] CHANGELOG.md updated under the next unreleased version (or current if patch).
- [ ] Roadmap row updated to `✅ YYYY-MM-DD` in the same commit as the work.
- [ ] Any new env var, binding, secret, or migration is documented in [ARCHITECTURE.md](ARCHITECTURE.md) (or the relevant doc) **and** mirrored in `wrangler.toml` / `.dev.vars.example`.

### Where things live

- **Active execution path** → [Now](#now) (the 5 waves). Pull from here.
- **Reference catalog** → the themed sections below Now (Infrastructure, Database, AI & LLM, Hardening, DX, Enrichment, Admin, etc.). These hold the full description of every numbered item; the wave tables only carry the short rationale. Click an item ID (e.g. `DX.11`) and search the doc for it to get full context.
- **Not scheduled / parked / wild ideas** → [docs/ROADMAP-icebox.md](docs/ROADMAP-icebox.md). Promote into a section here when an idea earns scheduling.
- **Why we did or didn't do something** → [Decision Log](#decision-log). Append-only, most recent at bottom. One row per non-obvious choice.

### Commit conventions for roadmap edits

- Roadmap-only edits: `docs(roadmap): <verb> <what>` — e.g. `docs(roadmap): mark DX.11 in progress`, `docs(roadmap): ship I.1 ✅`.
- When a code commit also flips a roadmap row, keep them in **the same commit** so status and reality never diverge.
- Decision Log entries belong with the commit that triggered the decision, not in a separate cleanup pass.

---

## Data Quality (Priority One)

The catalog is the foundation. Every other system — the engine, the question selector, the analytics, the UI — multiplies whatever quality (or lack thereof) lives in `characters` + `character_attributes`. A wrong `isHuman` flag on one popular character poisons hundreds of games. Sparse attributes silently shrink the engine's effective question set.

Today's pipeline ships a single LLM pass with no cross-validation, no vision corroboration for visually obvious attributes, no logical constraint checking, and no continuous re-verification. Players are the first line of QA — that's backwards.

**Goal:** every attribute in `character_attributes` should have a measurable confidence score, a citable evidence trail, and a self-healing path when it drifts. Sparse attributes should fill themselves in. Wrong attributes should surface within days, not months.

The work is organized below into seven loops, each closing a specific hole in the data layer. The five flagged items in the [Now](#now) shortlist are the highest-leverage starting points.

### Continuous Validation Loop

| # | Item | Effort | Notes |
|---|------|--------|-------|
| <a id="dq-1"></a>**DQ.1** | **Golden character regression set + CI gate** | Medium | 50 hand-curated characters with verified attribute values committed to `data/data-quality-golden.json`. Every PR that touches enrichment code, prompt templates, or `attribute_definitions` runs the pipeline against the golden set; >3% deviation fails the build. The "ground truth that never moves" — without this, no other DQ improvement can be measured. Foundational for DQ.2–DQ.5. |
| <a id="dq-6"></a>DQ.6 | **Nightly attribute reconciliation Cron** | Medium | Once daily, sample 50 random characters, re-fetch from all 5 source APIs (TMDb, AniList, IGDB, ComicVine, Wikidata), and compare to stored values. Flips logged to `attribute_drift` (per AN.26); confidence drops on conflicts; admin sees a "today's drift" widget. Catches upstream source changes (Wikidata edits, IGDB re-classifications) within 24h instead of never. |
| <a id="dq-7"></a>DQ.7 | **Continuous quality dashboard** | Low | Single `/admin/data-quality` page: % of attributes filled per character, per-attribute coverage %, per-attribute agreement %, drift events last 7d, disputes open / resolved, golden-set pass rate trend. The "is the data getting better or worse over time?" view. One number rolls up everything: a `data_health_score` between 0–100. |
| DQ.8 | **Per-attribute SLA & alerting** | Low | Each attribute gets a target coverage % (e.g. `isHuman: 100%`, `personality: 60%`). When coverage drops below SLA (new characters added without that attribute filled), an alert fires via AN.33 anomaly system. Coverage gaps stop being silent. |

### Multi-Source Triangulation

| # | Item | Effort | Notes |
|---|------|--------|-------|
| <a id="dq-3"></a>**DQ.3** | **Cross-source agreement scorecard per attribute** | Medium | For each (character, attribute) pair, compute agreement across the 5 source APIs + LLM. Store as `agreement_score REAL` on `character_attributes`. Score < 0.6 = contested → engine down-weights, admin queue surfaces, second LLM pass with explicit conflict context attempts resolution. Today, a single source can silently override consensus from four others. |
| DQ.9 | **Source-strength weighting per attribute class** | Medium | Empirical study (one-time, 200-character sample): which source is most accurate for which attribute? TMDb wins on movie character ages; AniList on anime moralities; ComicVine on comic-character first-appearance years. Encode as `source_weights[attr_key][source]` in `enrich.ts`. Weighted vote replaces "first source wins." Pairs with EN.11; this is the data behind it. |
| DQ.10 | **Wikidata SPARQL secondary cross-check** | Medium | For each character with a `wikidata_id`, run a SPARQL query asking for the same attributes via structured facts (P31 = instance of, P21 = sex/gender, P509 = cause of death, etc.). Compare to LLM extraction. SPARQL never hallucinates. Costs nothing (Wikidata is free). |
| DQ.11 | **Disagreement triage queue** | Low | New `/admin/data-quality/conflicts` view: every open `agreement_score < 0.6` case, sorted by character popularity × attribute importance. One-click "accept majority", "accept minority + provide evidence", "mark genuinely ambiguous (lock value)". Replaces ad-hoc dispute review. |

### Vision-Backed Visual Truth

| # | Item | Effort | Notes |
|---|------|--------|-------|
| <a id="dq-2"></a>**DQ.2** | **Vision-derived visual attributes** | Medium | Pass each character's `thumb.webp` through a vision model (`@cf/llava-1.5-7b-hf` via Workers AI, or GPT-4o-mini vision). Extract: `hairColor`, `eyeColor`, `wearsGlasses`, `hasBeard`, `hasMustache`, `hasMask`, `isWearingHat`, `dominantOutfitColor`, `isHumanoid`, `hasAnimalFeatures`, approximate `apparentAgeRange`. These are visually obvious to humans and currently fabricated by text-only enrichment with high error rates. Vision model has zero-shot accuracy advantage; replaces a known-bad data source with a known-good one. **The single highest-impact DQ item.** Pairs with DQ.3 — vision becomes the tiebreaker source for visual attributes. |
| DQ.12 | **Image-attribute consistency audit** | Medium | For every character, vision model re-evaluates whether the stored attribute matches the image. `hasGlasses: true` but no glasses visible? Surface in admin as either (a) wrong attribute or (b) wrong image. The "your image and your data disagree" finder. Low-frequency Cron — runs through full catalog over a month. |
| DQ.13 | **Multi-image vision consensus** | Medium | When multiple source URLs exist for a character (TMDb, IGDB, ComicVine all return images), run vision on each independently and majority-vote. Eliminates "the one weird picture where they're not wearing their costume" as a data source. |
| DQ.14 | **Style-of-art classifier** | Low | Vision model tags each image: `live_action | 3d_animation | 2d_animation | comic_art | game_render | photo`. Stored on`characters.image_style`. Powers grid filters, future "guess the medium" game modes, and a quality signal (mismatched art styles in the catalog look bad). |

### Active Learning from Players

| # | Item | Effort | Notes |
|---|------|--------|-------|
| <a id="dq-5"></a>**DQ.5** | **Player-answer corroboration loop** | Medium | Every time a player answers a question during a real game, that answer is a (weak) human label. After N=20 player answers per (character, attribute) pair, compare aggregate to stored value; >70% disagreement auto-files an `attribute_disputes` row. Players become a continuous QA workforce — for free. Builds on existing `question_attempts` (migration 0032). Closes the loop AN.26 / EN.9 open. |
| DQ.15 | **One-tap "report wrong attribute" affordance** | Low | After every game, a tiny "🚩 something wrong about this character?" link surfaces a 3-tap form: which attribute, what should it be, optional 1-line reason. Submissions hit `attribute_disputes`. Currently the only feedback channel is a GitHub issue. Pairs with H.14 privacy controls (anonymous user_id is enough). |
| DQ.16 | **Reputation-weighted player labels** | Medium | Players whose corrections (DQ.15) consistently get accepted get higher weight; serial false-flaggers get muted. `user_reputation(user_id, accepted_count, rejected_count, score)`. Same player_id cookie that already powers stats. Gamification follow-on: "data steward" badge. |
| DQ.17 | **Implicit corrections from game outcomes** | Medium | When the engine guesses wrong because a single attribute was pivotal, log the (attribute, character, expected_answer, observed_answer) into `implicit_corrections`. After 10 implicit corrections in agreement, auto-update the stored value and credit the contributing players. Catches errors no one explicitly reports. |

### Adversarial & Constraint Hardening

| # | Item | Effort | Notes |
|---|------|--------|-------|
| <a id="dq-4"></a>**DQ.4** | **Logical-constraint validator + auto-repair pass** | Medium | Define a constraints DSL (`isHuman ∧ isAlien = false`, `isVillain ∨ isHero ∨ isAntiHero ∨ isNeutral = true`, `hasMagic ⇒ ¬isHuman ∨ isMythical`, `firstAppearedYear ≤ currentYear`). Validator runs on every enrichment write; violations trigger a second constrained LLM pass that must satisfy the constraint or escalate to dispute. Catches contradictions the model emits with high confidence. Constraints in `data/attribute-constraints.yaml`. |
| DQ.18 | **Adversarial enrichment pass (skeptic model)** | Medium | Second pass with a different model family (current pass = GPT-4o-mini → skeptic = Claude Haiku, or vice versa) sees the first pass's output and is prompted: "The previous model claimed X about <character>. Identify weaknesses in this claim before agreeing or disagreeing." Disagreements file disputes. Diversity of failure modes catches what self-consistency can't. |
| DQ.19 | **Counter-factual probe set** | Medium | For each character, a small set of edge-case probes: "If <character> were stripped of their powers, would they still be `isHero`?" "Without the suit, is <Iron Man> still `isHumanoid`?" Tests robustness rather than facts. Catches over-fit attribute extraction (model labels everyone with a cape `isHero: true`). 5-question probe per character; flags inconsistent reasoning. |
| DQ.20 | **Chain-of-verification (CoVe) prompt template** | Low | Replace single-shot extraction with the [Chain-of-Verification](https://arxiv.org/abs/2309.11495) pattern: model drafts → model generates verification questions for its own draft → model answers verification questions independently → model revises draft. Roughly 2.5× tokens, but published to reduce hallucination ~40% on factual tasks. A/B against DQ.1 golden set; ship if delta is real. |
| <a id="dq-21"></a>DQ.21 | **Schema drift detector (constraints + prompt)** | Low | CI step compares `attribute_definitions` table against the prompt template + constraint DSL. Fails if the prompt asks for attributes not in DB, the constraints reference missing attributes, or the DB has attributes neither prompted nor constrained. Eliminates the "added an attribute, forgot half the pipeline" failure mode. |

### Catalog Curation Automation

| # | Item | Effort | Notes |
|---|------|--------|-------|
| <a id="dq-22"></a>DQ.22 | **Sparse-attribute auto-fill Cron** | Medium | Nightly, find the top-N (character, attribute) pairs where attribute is NULL and character is popular. Re-run enrichment scoped to just those gaps. The catalog gets denser without anyone running a script. Pairs with EN.7 schema drift detector — when a new attribute is added, this fills it across the catalog automatically. |
| DQ.23 | **Duplicate character detector** | Medium | Embed character name + brief description via `@cf/baai/bge-base-en-v1.5`; cosine similarity > 0.92 = likely duplicate. Surfaces in admin as merge candidates ("Spider-Man" vs "Peter Parker", "Mr. Robot" vs "Elliot Alderson"). Catches dupes that exact-string matching misses. |
| DQ.24 | **Stale character detection** | Low | Cron flags characters where source APIs return 404 / null for ≥3 consecutive checks. Stored as `characters.upstream_status`. Admin reviews — usually means wrong source ID or upstream removal. Currently fails silently. |
| DQ.25 | **Catalog gap analysis vs. cultural lists** | Low | Cron compares catalog against IMDb Top 250 lead characters, IGN Top 100 video game characters, MyAnimeList top 100, Wikipedia "List of fictional X" pages. Generates `data/catalog-gaps-YYYY-MM.md` weekly. The "obvious omissions" report. Same engine as EN.16. |
| DQ.26 | **Era / decade balance audit** | Low | Distribution of characters by `firstAppearedYear`. If 80% of catalog is post-2000, surfaces in admin as a balance warning. Drives intentional curation decisions. |

### Trust & Transparency Surfaces

| # | Item | Effort | Notes |
|---|------|--------|-------|
| DQ.27 | **Public data quality page** | Low | `/about/data-quality` shows live: catalog size, attribute coverage %, golden-set pass rate, median time to resolve disputes, last reconciliation Cron run, total player corrections accepted. Holds the project publicly accountable to its own quality standards — and is a strong portfolio proof point ("this isn't a demo, it's measured"). |
| <a id="dq-28"></a>DQ.28 | **Per-attribute evidence trail** | Medium | Extend `character_attributes` (migration 0037 adds `source` + `updated_at`; this completes the picture) with `evidence TEXT`: the exact source quote or URL the model cited. Click an attribute in admin → see "Wikipedia paragraph 3 of 'Frodo Baggins': ‹quoted text›". Removes "trust the model" from the data layer. Prerequisite for DQ.4 explainable disputes. |
| DQ.29 | **Confidence visible in admin tables** | Low | Every attribute cell in admin tables renders with a small confidence badge (green ≥0.9, amber 0.6–0.9, red <0.6). One-glance "what's well-known vs what's a coin flip" view. Sorting by confidence reveals where to focus manual curation. |
| DQ.30 | **Show your work to players (optional)** | Low | "Nerd mode" toggle in player settings. When on, the reasoning panel includes attribute confidences ("I think they're human because: 4 sources agree, vision confirmed, confidence 0.97") instead of just the value. Educates players on what's underneath the game and builds trust in the tech. |

---

## Now

The active execution plan, sequenced by **priority × ease**. Pull items top-down — each wave's foundation unblocks the next. Items below the cut line are tracked in their owning sections but aren't ready to start (blocked, lower leverage, or out of scope for the current focus).

**Effort key:** **S** ≤ ½ day · **M** ½–2 days · **L** 2–5 days

**Status key:** ⬜ not started · 🟡 in progress · ✅ shipped (with date)

### In Progress / Up Next

> **Maintain this block first.** It's the single answer to "what should I work on?" — agents and humans check it before scanning tables. Update in the same commit as the work it describes.

- 🟡 **In progress:** [I.1](#i-1) preview AI Gateway 24h verification window · [I.9](#i-9) AI Gateway semantic caching 7d cache-hit window
- ▶ **Up next:** Wave 4 #34 — [AN.11](#an-11) "aha moment" detector
- 🧫 **Blocked / waiting on:** _none_
- 🎯 **Current wave focus:** Wave 3 — Operational Readiness. Live ops strip in admin header gives the 1-glance health view; CI gates wiring (AP.1) + handler round-trips (AP.2) + per-route isolation (AP.5).
- ✅ **Recently shipped (last 5):** [AN.17](#an-17) question retirement queue (2026-05-01) · [AN.7](#an-7) confusion matrix from real games (2026-05-01) · [AN.1](#an-1) question skip & frustration funnel (2026-04-30) · [AP.20](#ap-20) health badge in shell header (2026-04-30) · [AN.33](#an-33) anomaly-trigger alerts (2026-04-30) · …see [CHANGELOG.md](CHANGELOG.md) for the full v1.6.0 list.

### Wave 1 — Foundation (start here, ~1 week of focused work)

Quick wins that unblock everything else, cost almost nothing, and make the rest of the work measurable. Do these in order.

| Status | Order | # | Item | Effort | Why first | Done when |
|---|---|---|------|--------|-----------|-----------|
| 🟡 | 1 | [I.1](#i-1) | Separate AI Gateway for preview vs. prod | S | Today, preview LLM calls pollute prod cost dashboards. Fix before any other LLM work — every cost number after this becomes trustworthy. | Production AI Gateway dashboard shows zero preview-environment requests over a 24h window. (Code shipped in `wrangler.toml`; awaiting 24h verification window.) |
| ✅ 2026-04-30 | 2 | [DX.11](#dx-11) | `pnpm validate` pre-push git hook | S | `lint-staged.config.mjs` already exists. 30 min to wire `simple-git-hooks`. Catches every type/lint regression before it leaves your laptop. | `git push` aborts on a fresh `pnpm validate` failure; passes silently when clean. (Shipped via `husky` in `.husky/pre-push`.) |
| ✅ 2026-04-30 | 3 | [DX.17](#dx-17) | Pre-commit secret scanning (`gitleaks`) | S | Same hook as DX.11. Costs minutes, prevents catastrophic leaks. | Committing a fake AWS key locally is blocked; clean commits unaffected. (Shipped via `gitleaks protect --staged` in `.husky/pre-commit`.) |
| ✅ 2026-04-30 | 4 | [DX.12](#dx-12) | D1 migration dry-run in CI | S | One step in `.github/workflows/ci.yml`. Catches migration regressions for free. | CI fails when a malformed migration is added to a PR; passes for valid ones. (Shipped in `db-checks` job, `pnpm migrate:dry-run:preview`.) |
| ✅ 2026-04-30 | 5 | [H.3](#h-3) | Cron Worker entry (`functions/cron/index.ts`) | S | Prerequisite for migrations 0036–0039 and most DQ Cron items. Three lines in `wrangler.toml` + a stub `scheduled()` handler. Unblocks DQ.6, DQ.22, EN.13. | `wrangler tail` shows the cron handler firing on its schedule. (Shipped: `functions/cron/index.ts` exports `scheduled()` + pure `runScheduled` dispatcher; trigger configured via CF dashboard — see ARCHITECTURE.md.) |
| ✅ 2026-04-30 | 6 | [H.4](#h-4) | Source map upload | S | Without this, every `error_logs` row is unreadable minified gibberish. Fix before any production debugging session. | A thrown error in prod surfaces with original file/line in `error_logs`. (Shipped: `scripts/upload-sourcemaps.ts` ships `.map` files to R2 `maps/{sha}/`, scrubs them from `dist/`, records sha in KV `deploy:current-sha`. Admin `Resolve stack` button on `/admin/error-logs` POSTs to new `/api/admin/resolve-stack` endpoint which uses `source-map-js` against the R2 map.) |
| ✅ 2026-04-30 | 7 | [I.8](#i-8) | Workers Smart Placement | S | Three lines in `wrangler.toml`. 50–200ms latency win for non-US players. Zero risk. | Smart Placement enabled in `wrangler.toml`; CF dashboard confirms placement decisions. (Shipped via `[placement] mode = "smart"`.) |
| 🟡 | 8 | [I.9](#i-9) | AI Gateway semantic caching | S | Toggle in CF dashboard. 20–40% LLM cost cut for question generation. Zero code. | AI Gateway dashboard shows ≥20% cache hit rate over a rolling 7-day window. (Awaiting CF dashboard toggle + 7d window.) |
| ✅ 2026-04-30 | 9 | [H.1](#h-1) | OG + Twitter card image and meta | S | One PNG + 6 meta tags. Required for any sharing surface (Wave 4). | Pasting the prod URL into Twitter/Slack/iMessage renders the OG card preview. (Shipped via `public/og-image.png` + `og:*` and `twitter:card` meta in `index.html`; regen with `pnpm build:og-image`.) |
| ✅ 2026-04-30 | 10 | [H.2](#h-2) | `robots.txt` + `sitemap.xml` | S | Two static files. Stops search engines from indexing `/admin`. | `curl /robots.txt` and `/sitemap.xml` return valid content; Google Search Console accepts the sitemap. |

### Wave 2 — Data Quality Foundation (priority one, ~2 weeks)

Catalog quality multiplies through every downstream system. Wave 2 is non-negotiable before Wave 3 — analytics on bad data is theater.

| Status | Order | # | Item | Effort | Why this order | Done when |
|---|---|---|------|--------|----------------|-----------|
| ✅ 2026-04-30 | 11 | [**DQ.1**](#dq-1) | Golden character regression set + CI gate | M | Ground truth that nothing else can be measured without. 50 hand-curated characters, committed JSON, CI step. Foundational for DQ.2–DQ.5. | `data/data-quality-golden.json` exists with 50 characters; CI step blocks any PR that regresses >3% vs. the golden set. (Shipped: 50 characters / 755 asserted cells in `data/data-quality-golden.json`. Harness `scripts/golden-regression.ts` reuses production `buildSystemPrompt`/`buildUserPrompt`. CI workflow `.github/workflows/golden-regression.yml` runs schema check on every matching PR + LLM gate when `OPENAI_API_KEY` secret is present. `pnpm golden:check` / `pnpm golden:regression`.) |
| ✅ 2026-04-30 | 12 | [**DQ.2**](#dq-2) | Vision-derived visual attributes | M | **Single highest-impact DQ item.** Replaces fabricated `hairColor`/`wearsGlasses`/etc. with vision-model truth. Measurable against the golden set built in step 11. | Vision pass writes `hairColor`/`wearsGlasses`/etc. for top 100 characters; agreement vs. golden set ≥90%. (Shipped: harness `scripts/vision-validate.ts` runs `gpt-4o-mini` vision on each golden character's Wikipedia portrait. 25 visual boolean attributes targeted. First run: **92.04% agreement** (185/201 cells, 46 chars with images). Image cache committed at `data/golden-image-sources.json` for reproducible CI. CI workflow `.github/workflows/vision-validate.yml` gates merges; `pnpm vision:check` / `pnpm vision:validate`. Top-100 catalog write deferred to a follow-up commit.) |
| ✅ 2026-04-30 | 13 | [DQ.21](#dq-21) | Schema drift detector | S | Cheap CI step; ensures the prompt template, constraints, and `attribute_definitions` table never diverge. Pairs with EN.7. | CI fails a PR that adds an attribute to the prompt without a matching constraint or DB row (and vice versa). (Shipped: `scripts/schema-drift.ts` validates schema cache shape + duplicate keys, asserts `INSERT INTO attribute_definitions` rows across `migrations/*.sql` round-trip with the schema, and that golden expected keys + `VISION_TARGET_ATTRS` are subsets of the schema. `pnpm schema:check`. Workflow `.github/workflows/schema-drift.yml` runs network-free on every matching PR. Initial run: 224/224 schema↔migration parity, 88 golden + 25 vision keys all valid.) |
| ✅ 2026-04-30 | 14 | [DQ.28](#dq-28) | Per-attribute evidence trail | M | Adds `evidence TEXT` to `character_attributes`. Every later DQ item ("why is this disputed?") needs the citation. | Every new attribute write includes a non-empty `evidence` field; admin row click renders the cited quote. (Shipped: migration `0034_evidence_trail.sql` adds nullable `evidence TEXT`. New helper module `functions/api/_evidence.ts` (8 unit tests) standardises the colon-tag format. Every writer threaded: admin manual PATCH, admin v2 character create, community vote apply, user corrections, CSV upload, game-end reveal backfill, and the enrichment pipeline (staging table + upload SQL). Default-seed generator emits `seed:default`. Admin character editor `GET /api/admin/characters/:id` returns an `evidence` map; the attribute pill tooltip now shows the source tag (`admin:manual:1714509000000`, `enrichment:openai:gpt-4o-mini:run=…`, etc.). Richer per-attribute citations remain a follow-up; this unblocks DQ.4.) |
| ✅ 2026-04-30 | 15 | [**DQ.3**](#dq-3) | Cross-source agreement scorecard | M | Stores `agreement_score REAL`. The numerical input that powers DQ.4 dispute prioritization, DQ.11 triage queue, and engine confidence weighting. | `agreement_score` populated on every `character_attributes` row; admin tables sortable by it. (Shipped: migration `0035_agreement_score.sql` adds nullable `agreement_score REAL` + `agreement_signals INTEGER` columns, plus a partial index. Pure scorer in `functions/api/_agreement.ts` (11 unit tests) reduces weighted signals from `game_reveals`, `attribute_disputes`, and (future) community votes to `[0, 1]`. New `scripts/compute-agreement.ts` (`pnpm agreement:dry-run` / `:preview` / `:prod`) shells out to wrangler, buckets signals per (character, attribute) pair, emits a transactional UPDATE batch. Admin `GET /api/admin/characters/:id` now returns an `agreement` map; the attribute pill renders an orange ring + warning glyph when contested (score < 0.6, ≥3 signals) and exposes `Agreement: 38% (5 signals)` in the tooltip. Designed to run nightly via the existing adaptive-data-refresh cron once H.3 promotes it.) |
| ✅ 2026-04-30 | 16 | [**DQ.4**](#dq-4) | Logical-constraint validator + auto-repair | M | Catches contradictions the model emits with high confidence. Constraints live in `data/attribute-constraints.yaml`. | Constraints YAML enforced on every enrichment write; violations either auto-repaired or filed as disputes. (Shipped: constraint DSL ships as `data/attribute-constraints.json` (JSON instead of YAML to avoid a runtime parser dep — same shape ROADMAP sketches; documented in commit). Pure validator `functions/api/_constraints.ts` (15 unit tests, including a smoke-load of the bundled file) supports `mutex`, `requiresOneOf`, and `implies` (with `allOf` / `anyOf`). Hooked into `scripts/ingest/enrich.ts.storeEnrichmentResults`: every batch loads the rule set once, validates each result's attribute map, and inserts violations into the existing `enrichment_disputes` staging table at confidence 0.95 with a `[constraint:<id>]` reason prefix. Existing `disputes-upload` step promotes them to `attribute_disputes` in D1 with no extra wiring. Auto-repair via second LLM pass deferred to follow-up; constraint-induced disputes already feed the skeptic queue.) |
| ✅ 2026-04-30 | 17 | [DQ.7](#dq-7) | Continuous quality dashboard (`/admin/data-quality`) | S | The "is the data getting better or worse?" view. Required to make DQ work visible. Rolls up into a single `data_health_score`. | `/admin/data-quality` route renders `data_health_score` plus 4 trend charts; refreshes daily. (Shipped: migration `0036_data_quality_snapshots.sql` (8 metric columns); pure scorer `functions/api/_data_health.ts` (7 unit tests) with documented 30/30/25/15 weighted formula; `GET /api/admin/data-quality` returns a live snapshot computed from D1 plus history; admin route `/admin/data-quality` shows the rolled-up KPI, 4 KPI tiles, plus 5 trend charts (data-health, golden, vision, agreement, open disputes); nightly snapshot writer `scripts/snapshot-data-quality.ts` (`pnpm dq:snapshot:{dry-run|preview|prod}`) accepts optional `--golden-pass-rate` / `--vision-pass-rate` flags so CI can attach the latest gate results.) |
| ✅ 2026-04-30 | 18 | [**DQ.5**](#dq-5) | Player-answer corroboration loop | M | Turns every game answer into a free QA signal via existing `game_reveals`. Long-running compounding return. | After 20 player answers per (character, attribute) pair, >70% disagreement auto-files an `attribute_disputes` row. (Shipped: pure evaluator `functions/api/_corroboration.ts` (12 unit tests) implements the 20-vote / 70%-disagreement gate plus `disagreementToConfidence` mapping the rate into `attribute_disputes.confidence` linearly across [0.7, 0.99]. CLI `scripts/corroborate-player-answers.ts` (`pnpm corroborate:{dry-run|preview|prod}`) reads `game_reveals.answers` JSON for the last 180d, buckets confident yes/no votes per (character, attribute) pair, and emits an `INSERT OR IGNORE` batch tagged `disputed_by='player-corroboration'` (idempotent via existing `UNIQUE(character_id, attribute_key, status)` constraint). Initial prod dry-run: 13 reveals → 273 pairs with player signal, 0 yet at min-volume — system primed to fire as the catalog accumulates. Designed to run nightly via the H.3 cron alongside `compute-agreement.ts`.) |
| ✅ 2026-04-30 | 19 | [DQ.6](#dq-6) | Nightly attribute reconciliation Cron | M | Depends on H.3. Catches upstream source changes within 24h. | Cron runs nightly; `attribute_drift` rows accumulate with reconciliation events. (Shipped: `.github/workflows/reconcile-nightly.yml` runs at 00:30 UTC; `scripts/reconcile-attributes.ts` re-runs the canonical enrichment prompt against a 50-char random sample and writes diffs into the new `attribute_drift` table from migration 0037, tagged with a per-run UUID `batch_id` for EN.28 rollback. Lives in GH Actions instead of the H.3 Cron Worker because OpenAI calls aren't wired into the Worker env.) |
| ✅ 2026-04-30 | 20 | [DQ.22](#dq-22) | Sparse-attribute auto-fill Cron | M | Depends on H.3 and DQ.21. Catalog gets denser overnight without anyone running a script. | Cron runs nightly; sparse-attribute coverage % measurably increases week over week. (Shipped: `.github/workflows/sparse-fill-nightly.yml` runs at 00:45 UTC; `scripts/sparse-fill-attributes.ts` ranks characters by recent-30d popularity, scopes the canonical enrichment prompt to just the missing keys via `selectGaps()` from the new `_sparse_fill.ts` module — 10 tests — and writes `INSERT OR REPLACE` rows tagged `enrichment:openai:<model>:run=<iso>` per DQ.28.) |

### Wave 3 — Operational Readiness (~1 week)

Once data is trustworthy, you need to know when it (or anything else) breaks.

| Status | Order | # | Item | Effort | Why now | Done when |
|---|---|---|------|--------|---------|-----------|
| ✅ 2026-04-30 | 21 | [I.2](#i-2) | Workers Analytics Engine for LLM costs | M | Replace the brittle `costs:{userId}:{date}` KV pattern. Powers AN.31 cost-per-game ribbon. | Every LLM call writes one Analytics Engine row; KV `costs:*` keys deprecated. (Shipped: pure `functions/api/_llm_metrics.ts` (10 tests) emits one AE data point per call with `[model, userId, cacheStatus, endpoint]` blobs and `[promptTokens, completionTokens, totalTokens, estCostUsd]` doubles. `LLM_COSTS` binding added to wrangler.toml for prod (`llm_costs` dataset) and preview (`llm_costs_preview`). Wired into both HIT and MISS paths in `functions/api/llm.ts`. KV writer kept short-term as a back-compat shim until AN.31 lands.) |
| ✅ 2026-04-30 | 22 | [I.4](#i-4) | Tail Worker observability | M | Structured rows for every invocation. Powers AN.29 latency budget panel and AN.30 live ops strip. | Tail Worker emits structured JSON for every Worker invocation; queryable in CF dashboard. (Shipped: Pages doesn't support `tail_consumers` today, so observability is split: (a) standalone `guess-tail` Worker under `tail-worker/` with pure `_tail_metrics.ts` (10 tests) ready for Pages→Workers migration, (b) inline fallback in `functions/_middleware.ts` + pure `functions/_request_metrics.ts` (9 tests) writing the same blob/double schema directly to the `WORKER_TAIL` AE binding (prod `worker_tail`, preview `worker_tail_preview`) on every request. Outcome auto-classified ok/client_error/server_error/exception. Admin /admin/logs surfacing deferred to a follow-up once SQL queries are dialled in.) |
| ✅ 2026-04-30 | 23 | [AP.1](#ap-1) | Admin route smoke-test sweep (Playwright) | M | Single spec catches "the admin route silently broke" regressions across all 24 routes. Covers wiring before polish. | Playwright spec covers all 24 admin routes; CI fails if any route returns 500 or renders an error boundary. (Shipped: `e2e/admin-smoke.spec.ts` mounts all 25 admin routes (LandingRoute index + 24 named) against a stubbed `**/api/admin/**` surface and asserts the `AdminShell` sidebar mounts, the global `ErrorFallback` is not visible, and zero `pageerror` events fire during mount. Picked up by the existing `npx playwright test` CI step — no workflow changes.) |
| ✅ 2026-04-30 | 24 | [AP.2](#ap-2) | Admin action round-trip tests | M | Vitest integration tests for every admin POST/DELETE. Catches the "button does nothing in prod" class of bug. | Vitest spec exercises every admin POST/DELETE end-to-end against a test D1; CI gates merges. (Shipped: `functions/api/admin/__tests__/harness.ts` provides an in-memory D1 facade over `better-sqlite3` — loads every migration except the heavy character/seed inserts (0002/0004/0005/0009), exposes `D1Database`-shaped `prepare/bind/run/all/first/raw/batch/exec`, plus stub KV + R2 + assets bindings, an `invokeHandler` adapter that bypasses Pages middleware, and an OpenAI fetch mock. `admin-mutations.test.ts` exercises **52 round-trips across all 21 admin POST/PATCH/DELETE handlers** in `functions/api/admin/**` (error-logs delete, character PATCH/DELETE/validate, proposed-attributes CRUD + score, attribute-disputes resolve + AI verdict, community apply, coverage-priority, enrich/start, enrichment retry, experiments, analytics insights, pipeline runs, questions PATCH + score, resolve-stack, upload-attrs auth + insert + size cap). Picked up automatically by `pnpm test` / `pnpm validate` / CI; no workflow changes.) |
| ✅ 2026-04-30 | 25 | [AP.5](#ap-5) | Per-route error boundary with Retry | S | Stops one route's failure from unmounting the sidebar. | Throwing inside one admin route renders a Retry boundary, not a white screen; sidebar stays mounted. (Shipped: new `src/components/admin/RouteErrorBoundary.tsx` wraps the `AdminShell` `<Outlet />` with a `react-error-boundary` keyed on `useLocation().pathname` so navigating to a different route auto-resets. Inline fallback renders an `Alert` + error pre + Retry button (resets the boundary, re-mounts the route subtree) + Copy-to-clipboard button (writes `message\n\nstack`). Production telemetry routes via `trackUncaughtError`; DEV shows the full stack inline. 4 unit tests in `src/components/admin/__tests__/RouteErrorBoundary.test.tsx` cover happy path, throwing child renders fallback, Retry remounts, Copy writes to clipboard.) |
| ✅ 2026-04-30 | 26 | [AN.30](#an-30) | Live ops strip in admin header | M | Rolling 1h counters auto-refreshing every 30s. The "is the site healthy right now" view. | Admin header shows games/min, error rate, p95 latency over the last 1h, refreshing every 30s. (Shipped: pure module `functions/api/admin/_live_ops.ts` (9 unit tests) computes the summary shape — games/min, win rate, error rate, p95 latency — with rounding + null-handling rules. Endpoint `GET /api/admin/live-ops` runs 2 D1 COUNT queries (`game_stats` last 1h grouped by `won`, `error_logs` last 1h grouped by `level`) plus an optional Workers Analytics Engine SQL query against the I.4 `worker_tail` dataset for `quantileWeighted(0.95, wallMs, _sample_interval)`; AE call is best-effort and returns null without `CF_ACCOUNT_ID` + `CF_API_TOKEN`. Round-trip test in `__tests__/live-ops.test.ts`. UI `src/components/admin/LiveOpsStrip.tsx` mounts above every admin `<Outlet />`; polls every 30s with `AbortController` cleanup; renders a green/amber/red dot (≤1% / ≤5% / >5% error rate), three tabular metrics, a 1h roll-up, and a refresh indicator. Cache-Control: `private, max-age=15` so back-to-back navigations don't hammer D1.) |
| ✅ 2026-04-30 | 27 | [AN.33](#an-33) | Anomaly-trigger alerts | M | Statistical baselines per metric; webhook on cross. Catches "win rate dropped 30% overnight" without staring at charts. | Crossing a baseline threshold fires a webhook to Slack/Discord with metric name + delta + link to chart. (Shipped: migration `0038_alerts.sql` adds the `alerts` table; pure module `functions/cron/_anomaly_detector.ts` (13 unit tests) computes sample-stddev baselines + sigma-band detection + a Slack/Discord-compatible `{ text }` payload formatter. `functions/cron/_anomaly_check.ts` (5 integration tests via the in-memory D1 harness) reads the last 15 `data_quality_snapshots` rows, treats the most recent as today, computes a 14-day baseline per tracked metric (`data_health_score`, `coverage_pct`, `evidence_pct`, `agreement_avg`, `open_disputes`), inserts an `alerts` row per crossing, and POSTs to `ALERTS_WEBHOOK_URL` when configured. `ALERTS_DASHBOARD_URL` adds a `view chart` link. Wired into `runScheduled` in `functions/cron/index.ts` so it runs on the existing 00:05 UTC nightly trigger; failures are logged but never throw. ARCHITECTURE.md updated with the cron-row + env-var docs.) |
| ✅ 2026-04-30 | 28 | [AP.20](#ap-20) | Health badge in shell header | S | Top-right green/amber/red dot. The 1-second glance. | Top-right dot in admin shell reflects live health (green/amber/red) tied to AN.30 metrics. (Shipped: lifted the AN.30 polling into a shared `LiveOpsContext` provider so the strip + the new `HealthBadge` share a single 30s `GET /api/admin/live-ops` poller. New `HealthBadge` component renders top-right of the sidebar header as a pill (`OK` / `WARN` / `DOWN` / `—`) with a colored 1.5px dot, full descriptive `title` (e.g. "WARN · 12 games / 1 errors (last 1h) · 8.33% errors"), `data-status` attribute for E2E selectors, and an accessible aria-label. Status thresholds: errorRate >5% → critical (red), >1% or any warns → warn (amber), else healthy (green). Renders an unknown placeholder when used outside the provider so isolated previews/tests don't crash. 9 unit tests in `src/components/admin/__tests__/HealthBadge.test.tsx` cover all four status states + the no-provider fallback + fetch-failure title path. Click target reserved for AN.29 latency budget panel — documented inline.) |

### Wave 4 — Insight & Refinement (~2 weeks)

Now that data and ops are sound, extract insight and tune the loops.

| Status | Order | # | Item | Effort | Why now | Done when |
|---|---|---|------|--------|---------|-----------|
| ✅ 2026-04-30 | 29 | [AN.1](#an-1) | Question skip & frustration funnel | M | Surfaces questions that consistently kill momentum. Feeds AN.17 retirement queue. | `/admin/funnel` page shows skip rate + frustration signals per question, sortable. (Shipped: extended `GET /api/admin/funnel` with a `perQuestion` array joining `question_attempts` (shown counts + answer mix) to `client_events` `question_skip` events keyed by `questionId`. New pure module `functions/api/admin/_funnel.ts` exposes `computePerQuestionFunnel` (12 unit tests) which derives `skipRate = skipped / (shown + skipped)`, `maybeRate = maybe / shown`, and a composite `frustrationScore = 0.6 × skipRate + 0.4 × maybeRate` clamped to `[0, 1]` and rounded to 4dp; rows below `minShown=5` are dropped to keep noise out, and ties on score break by `shown DESC`. New round-trip test in `functions/api/admin/__tests__/funnel.test.ts` (3 cases) seeds the in-memory D1 with attempts + skip events and asserts the response sorts q-hard above q-easy. `FunnelRoute` got a new "Per-question frustration funnel" card under the existing skip leaderboard — a sortable table with click-to-toggle headers (Question / Shown / Skipped / Skip rate / Maybe rate / Frustration), `aria-sort` on the active column, and a colored frustration badge (red ≥ 40%, amber ≥ 20%). Test count 816 → 831.) |
| ✅ 2026-05-01 | 30 | [AN.7](#an-7) | Confusion matrix from `game_stats` runner-ups | M | Direct fuel for question-selector up-weighting on confusion pairs. | `/admin/confusion` page renders matrix of confused-pair counts derived from `game_stats`. (Shipped: `GET /api/admin/confusion?source=real\|sim` (default `real`) with new pure helper `functions/api/admin/_confusion.ts` (8 unit tests); real source reads `character_confusions` (populated nightly by `scripts/aggregate-real-game-signals.ts` from `game_stats` losses ⨝ `game_reveals.actual_character_id` within ±60s) joined to `characters` for names, returns `winPct=null` + `lastSeen` populated since pairs are canonical-undirected; sim source preserves the legacy directional shape with `winPct`. Round-trip test `functions/api/admin/__tests__/confusion.test.ts` (6 cases) covers both sources via the in-memory D1 harness. UI `ConfusionRoute.tsx` adds a shadcn `Tabs` toggle bound to `?source=` so deep-links work; trailing column switches between "Last seen" relative time and "Win %" with the existing color tones. Test count 831 → 845.) |
| ✅ 2026-05-01 | 31 | [AN.17](#an-17) | Question retirement queue | M | Composite score (skip rate × maybe rate × low rating × low info gain). Closes the loop. | `/admin/questions/retire` queue ranks questions by composite score; one-click retire writes back to DB. (Shipped: migration `0039_question_retirement.sql` adds `retired_at` (unix-ms) + `retired_reason` (TEXT, ≤500 chars) to `questions` plus partial indexes on the live + retired sets. Pure scorer in `functions/api/admin/_retirement.ts` (14 tests) computes `retirementScore = 0.4 × skipRate + 0.3 × maybeRate + 0.3 × imbalance` from `question_attempts` (yes/no/maybe/unknown counts; unix-second cutoff) joined to `client_events` `question_skip` events keyed by `data.questionId` (unix-ms cutoff). New `GET /api/admin/questions/retirement-queue?source=live\|retired&windowDays=&minShown=&limit=` endpoint plus `POST /api/admin/questions/:key/retire` (optional `{reason}`) and `POST /api/admin/questions/:key/unretire` that flip the columns and best-effort `KV.delete('meta:questions')` so the engine picks up the change immediately rather than waiting for the 1h cache TTL. Engine integration: `WHERE retired_at IS NULL` filter added to `functions/api/v2/game/start.ts`, `resume.ts`, and `questions.ts` (both the plain SELECT and the `coverage=true` join). New admin route `/admin/questions/retire` with sortable Score/Skip%/Maybe%/Imbalance columns, color-toned badge (red ≥40% / amber ≥20%), one-click retire-with-reason, and a `?source=retired` tab for the retired list with Unretire. Sidebar nav adds a `Retirement Queue` entry under `Questions`. 10 round-trip tests in `__tests__/retirement.test.ts` exercise the full GET + POST surface against the in-memory D1 harness. Test count 845 → 869.) |
| ✅ 2026-05-01 | 32 | [C.6](#c-6) | Question quality scoring feedback loop (engine side) | M | Pairs with AN.17; the engine consumes the same signals. | Engine selector consumes the same retirement signals to down-weight low-quality questions at runtime. (Shipped: pure helper `packages/game-engine/src/quality-penalty.ts` (11 tests) inverts the AN.17 retirement composite into a per-attribute multiplier `clamp(1 - α × retirementScore, floor=0.3, 1)` so questions trending toward retirement are picked less often *before* an admin retires them. New `questionQualityPenaltyMap?: Record<string, number>` on `QuestionSelectionOptions` is applied in `selectBestQuestion` immediately after the empirical-gain blend (`infoGain *= multiplier` when `0 < multiplier < 1`); 4 selector tests cover the no-penalty / strong-penalty / missing-key / out-of-range guards. Engine adaptive-data fetch in `functions/api/v2/_game-engine.ts` adds `kv:question-quality-penalty` to the `Promise.allSettled` block and threads it through `AdaptiveData` → `buildQuestionOptions`. Nightly aggregator `scripts/aggregate-real-game-signals.ts` gains `aggregateQuestionQualityPenalty()` that joins `question_attempts` (yes/no/maybe counts, unix-second cutoff) with `client_events` `question_skip` events (unix-ms cutoff, joined through `questions.id` to map `questionId` → `attribute_key`), feeds the per-attribute signals into `buildQualityPenaltyMap`, and writes `data/real/question-quality-penalty.json`; map keeps only entries where penalty `< 1` to keep the KV blob small. Workflow `.github/workflows/real-data-aggregate.yml` adds an upload step + summary entries for the new KV key. Test count 869 → 884.) |
| ✅ 2026-05-01 | 33 | [B.4](#b-4) | Question deduplication via embeddings | M | Pairs with AN.20 embedding-based duplicate finder. | Embedding cosine similarity flags duplicate questions in an admin dedup queue; merge action available. (Shipped: migration `0040_attribute_embeddings.sql` adds `attribute_embeddings(attribute_key PK, embedding BLOB, dim, model, text_hash, created_at)` + `question_dedup_dismissed(pair_key PK, ...)` (canonical lex-ordered `keyA::keyB` so the same pair from either direction collapses to one row). New Cloudflare Workers AI binding `[ai] AI` (`@cf/baai/bge-base-en-v1.5`, 768-dim, ~1 neuron/call) added under `[env.production]` + `[env.preview]`. Pure helper `functions/api/admin/_dedup.ts` (16 tests) owns `cosineSimilarity`, `serializeEmbedding`/`deserializeEmbedding` (round-trips through D1's `ArrayBuffer` and the harness's `Uint8Array`, copying into an aligned buffer when input isn't 4-byte aligned), `findDuplicatePairs`, `canonicalPairKey`, `shortTextHash` (FNV-1a, 8 hex). Wrapper `_embed.ts` exports `embedText` + `embedBatch` (returns null on missing binding/empty/wrong shape). Endpoints under `functions/api/admin/questions/duplicates/`: `GET /` joins live questions ⨝ embeddings (filtering out rows where `dim != 768`) and excludes dismissed pairs, threshold clamped `[0.5, 0.999]` default 0.85; `POST /backfill` (limit `[1, 200]` default 50) skips rows whose `text_hash` hasn't drifted, batches upserts via `db.batch([...])` with `ON CONFLICT(attribute_key) DO UPDATE`, returns 503 when `env.AI` absent; `POST /dismiss` canonicalises pair_key + upserts; `POST /merge` reuses AN.17 `retired_at` + `retired_reason` on the source (no new column), auto-dismisses the pair, best-effort `KV.delete('meta:questions')`. 14 round-trip tests in `__tests__/duplicates.test.ts` cover all four endpoints with a stubbed `env.AI`. New admin route `/admin/questions/duplicates` (lazy-loaded `DuplicatesRoute.tsx`) renders sortable Question A · Question B · Similarity% · Actions (Merge A→B / Merge B→A / Dismiss) with a backfill button + threshold input. Sidebar nav adds `Duplicate Queue` under `Questions` with Phosphor `CopySimpleIcon`. Test count 884 → 914.) |
| ⬜ | 34 | [AN.11](#an-11) | "Aha moment" detector | M | Surfaces which questions consistently produce the posterior jump. The selector's real value. | Each game's reasoning panel highlights the question that produced the largest posterior jump. |
| ⬜ | 35 | [AN.21](#an-21) | Catastrophic-failure replay queue | M | Auto-snapshots every game where the player's target wasn't in the engine's top 10. The most actionable training set. | Failure-replay queue auto-snapshots every game where the target wasn't in engine top 10; replayable in admin. |

### Wave 5 — Polish, Sharing & Depth (open-ended)

Pull from these once the foundation is solid. Ordered by ease within each cluster, not by absolute priority — pick whatever feels good.

**Admin polish (cheap wins, do alongside other work):** AP.6 freshness pills · AP.11 breadcrumbs + page titles · AP.17 toast standardization · AP.10 `⌘K` palette · AP.14 universal CSV/JSON export · AP.22 `/admin/about` build card

**DX leverage (each pays back fast):** DX.27 `.vscode/` settings · DX.18 coverage diff PR comments · DX.22 per-PR preview URL · DX.30 generated D1 types · DX.34 dependency-cruiser auto-diagram

**Player-facing portfolio gloss:** P.7 `/about` + `/credits` · P.8 light theme + toggle · EN.29 trivia card on reveal · P.9 daily challenge leaderboard · S.1 challenge-a-friend (pairs with H.5 PWA share target)

**Infra graduation (when scale or polish demands):** I.7 Durable Objects for sessions · I.10 service-bindings split · I.11 OpenTelemetry tracing

### Cut line — actively considered, not yet scheduled

Everything in the sections below is real work, just not in the current execution path. Pull into a wave when its dependencies clear or its priority shifts. The Decision Log records why anything moves up or down.

---

## Infrastructure

The Cloudflare platform has capabilities we're not fully leveraging. Larger explorations (Vectorize, Workflows, MCP server, WASM, AutoRAG, Containers, etc.) are in [docs/ROADMAP-icebox.md](docs/ROADMAP-icebox.md#infrastructure-explorations).

### Near-Term (≤ 1 day each)

| # | Item | Files | Notes |
|---|------|-------|-------|
| <a id="i-1"></a>I.1 | **Separate AI Gateway for preview** | `wrangler.toml` | `env.production` and `env.preview` share the same `CLOUDFLARE_AI_GATEWAY` URL. Preview LLM calls pollute production cost dashboards and share rate limits. Create a dedicated preview gateway in the CF dashboard and reference it in `[env.preview.vars]`. |
| <a id="i-2"></a>I.2 | **Workers Analytics Engine for LLM costs** | `functions/api/llm.ts` | Replace the `costs:{userId}:{date}` KV pattern with Workers Analytics Engine (columnar, time-series, free up to 100K data points/day). Aggregate by model/user/date in the CF dashboard without enumerating KV keys. |
| I.3 | **Enrichment pipeline SSE endpoint** | `functions/api/admin/` | `GET /api/admin/enrich/stream` pushes `{ character, status, tokensUsed, costSoFar, eta }` events. Pairs with `POST /api/admin/enrich/start` (KV flag + Cron/Queue dispatch) so the live enrichment dashboard works fully from the browser. |
| <a id="i-8"></a>I.8 | **Workers Smart Placement** | `wrangler.toml` | Three lines: `[placement]\nmode = "smart"`. Routes each invocation to the PoP with the lowest total round-trip latency to D1. Empirically: 50–200ms reduction for non-US players. Zero code changes. |
| <a id="i-9"></a>I.9 | **AI Gateway semantic caching** | CF AI Gateway dashboard | Toggle on; tune cosine similarity threshold per route. Many `dynamicQuestion_v1` prompts with the same attribute pool produce near-identical outputs. Expected 20–40% cost reduction on question generation with zero code changes. |

### Medium-Term (1–3 days each)

| # | Item | Files | Notes |
|---|------|-------|-------|
| <a id="i-4"></a>I.4 | **Tail Worker observability** | New Worker | Receives every invocation from the main Worker; writes structured rows to Workers Analytics Engine: `{ path, status, cpuMs, error, timestamp }`. Zero changes to existing endpoints. Surfaces in `/admin/logs`. |
| I.5 | **R2 Event Notifications → dominant color extraction** | New Worker | On admin image upload, a Worker fetches the thumbnail, runs 16-color median cut quantization in pure JS, and writes `characters.dominant_color` to D1. Powers `GuessReveal` ambient theming (P.3). Self-annotating upload pipeline. |
| I.6 | **Cloudflare Queues for async teaching mode** | `functions/api/v2/characters.ts`, new consumer | `POST /api/v2/characters` writes a minimal D1 record and queues a job; consumer Worker handles enrichment + image + cache bust async. Player sees "submitted — we'll add it shortly" instead of waiting on 3+ LLM calls. |
| I.7 | **Durable Objects for game session state** | `functions/api/v2/game/` | One DO per session — strongly consistent, no KV serialization, no race on concurrent answer submissions. Trade-off: Workers Paid required ($5/mo). Revisit if session consistency bugs emerge. |
| I.10 | **Service Bindings architecture** | `wrangler.toml`, `functions/` | Split into focused micro-Workers (`guess-game`, `guess-llm`, `guess-enrichment`, `guess-analytics`) connected via [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/). Each deploys independently; swapping models touches only `guess-llm`. Type-safe stubs from each Worker's exported types. |
| I.11 | **OpenTelemetry distributed tracing** | `functions/api/v2/`, `packages/game-engine/` | Workers support OTEL natively. Spans: `game.answer` → `engine.score_candidates` → `d1.query` → `llm.dynamic_question`. Export to Workers Observability. A waterfall trace breaking down a 180ms response is a rare demonstration that a solo developer thinks like a platform team. |

---

## Database

Schema evolution and new migrations. Latest applied is `0033_game_stats_variant.sql` (adds `variant` and `selector` columns to `game_stats` for IX.4 A/B experiments).

### Planned Migrations

| Migration | Table / Change | Purpose |
|-----------|---------------|---------|
| **0034** | `character_relationships(character_a TEXT, character_b TEXT, relationship_type TEXT, created_at TEXT)` | Relationships between characters: `same_universe`, `same_franchise`, `same_creator`, `rivals`, `allies`. Populated by an LLM batch pass. Enables universe-aware questions ("Do they share a universe with Batman?") impossible from attribute space alone. |
| **0035** | `attribute_embeddings(attribute_key TEXT PRIMARY KEY, embedding BLOB, model TEXT, created_at TEXT)` | Workers AI embedding vectors per attribute key (`@cf/baai/bge-base-en-v1.5`). Powers B.4 question dedup, semantic deduplication of attributes (M.12), and (eventually) Vectorize-based character lookups (IX.1). |
| **0036** | `daily_stats(date TEXT PRIMARY KEY, games INTEGER, wins INTEGER, forced_guesses INTEGER, avg_questions REAL, median_confidence REAL, llm_errors INTEGER)` | Pre-aggregated daily rollup written by a nightly Cron Worker from `game_stats`. Admin analytics reads one row per day instead of full-scanning `game_stats`. Cron runs at 00:05 UTC. |
| **0037** | `character_versions(id INTEGER AUTOINCREMENT, character_id TEXT, attribute_key TEXT, old_value INTEGER, new_value INTEGER, changed_by TEXT, changed_at INTEGER)` | Append-only audit log of every attribute value change — manual edits, LLM passes, community votes, dispute resolutions. Required for dispute resolution and admin accountability. Index on `(character_id, changed_at DESC)`. |
| **0038** | `user_preferences(user_id TEXT PRIMARY KEY, difficulty TEXT, reduced_motion INTEGER, language TEXT, updated_at INTEGER)` | Server-persisted preferences keyed by the anonymous cookie user_id. Survives `localStorage` clears and device switches. No auth required — same anonymous cookie already in place. |
| **0039** | `feature_flags(key TEXT PRIMARY KEY, value TEXT, description TEXT, enabled INTEGER DEFAULT 1, created_at INTEGER, updated_at INTEGER)` | D1 as the source of truth for feature flags; KV stays the read path (Cron syncs D1 → KV). Admin panel reads D1 to show history and edit without touching KV. |
| **0040** | `schema_migrations(filename TEXT PRIMARY KEY, checksum TEXT, applied_at INTEGER)` | Self-describing migration ledger. Enables `pnpm db:status` reading prod and preview to show which migrations have been applied. Eliminates "did this migration run in preview?" ambiguity. |

> The original "0032 community_votes" planned table is held until the M.2 Crowdsourced Attribute Voting moonshot is pursued. The original "0040 attribute_merge_log" table is held until M.12 Adaptive Attribute Taxonomy is pursued.

### Schema Improvements

**`characters`**

| Column | Detail |
|--------|--------|
| `dominant_color TEXT` | Populated automatically by I.5. Used by `GuessReveal` ambient theming (P.3). |
| `fingerprint TEXT` | 3–5 word phrase distinguishing a character from their nearest neighbor in attribute space. Generated by enrichment (A.7). Surfaced under the character name in `GuessReveal`. |
| `known_since INTEGER` | Year of first appearance in source material. Required for the M.11 Temporal Character DB moonshot. |
| `archived_at INTEGER` | Soft-delete timestamp. `NULL` = active. All game queries add `WHERE archived_at IS NULL`. Wrongly removed characters can be restored by clearing this field. |

**`questions`**

| Column | Detail |
|--------|--------|
| `asked_count INTEGER DEFAULT 0` | Running total across all real games. Currently derived by parsing `game_stats.steps` JSON. Required by C.6 ("asked 200+ times, near-zero info gain"). |
| `skip_count INTEGER DEFAULT 0` | Times players skipped while this question was active (from `client_events`, AN.1). High skip rate = confusing/boring, independent of info gain. |
| `info_gain_avg REAL` | Rolling EMA of information gain. Updated by the same nightly Cron that writes `daily_stats`. |
| `last_asked_at INTEGER` | Combined with `asked_count`, identifies stale questions (active but never asked in 30 days). |

**`character_attributes`**

| Column | Detail |
|--------|--------|
| `source TEXT` | `'manual'`, `'llm-gpt4o-mini'`, `'llm-gpt4o'`, `'community'`, `'ingest-tmdb'`, etc. Currently implicit via `confidence`. Makes provenance queryable: `SELECT * FROM character_attributes WHERE source = 'community'`. |
| `updated_at INTEGER` | Last write timestamp. No timestamp column exists today; required by `character_versions` (0037) backfill and the admin Attribute DNA Matrix hover state. |

**`game_stats`**

| Column | Detail |
|--------|--------|
| `final_confidence REAL` | Engine confidence at the moment of the final guess. Calibration queries currently proxy via `questions_asked`. Storing it directly enables `SELECT AVG(final_confidence) WHERE won = 1` (calibration accuracy) and median-confidence-at-guess-time analytics. |

> `variant` and `selector` columns shipped in migration 0033.

### Query Performance & Maintenance

| Item | Detail |
|------|--------|
| **FTS expansion: `questions_fts`** | Migration 0018 added `characters_fts`. Extend to `questions_fts` — admin question search currently does a LIKE scan. One `CREATE VIRTUAL TABLE questions_fts USING fts5(text, attribute_key, content='questions')` + `AFTER INSERT/UPDATE/DELETE` triggers. |
| **Composite FTS: `knowledge_fts`** | A single FTS table spanning `characters.name`, `characters.description`, `attribute_definitions.display_text`, and `questions.text`. Admin global search (`/admin/search?q=`) returns characters, attributes, and questions from one query. |
| **`game_stats` archival** | Monthly Cron moves rows older than 6 months to `game_stats_archive` and writes a compressed NDJSON export to R2 (`exports/game_stats/YYYY-MM.ndjson.gz`). The live table stays small; `daily_stats` (0036) covers historical analytics. Older queries use DuckDB against R2 exports. |
| **Deprecate v1 KV endpoints** | `functions/api/{characters,questions,corrections,stats,sync}.ts` are legacy KV-backed endpoints from before D1. Add `Deprecation: true` + `Sunset: 2027-01-01` response headers; plan a cleanup migration to drop the handlers after sunset. |
| **D1 → R2 nightly export** | Cron Worker dumps `game_stats`, `sim_game_stats`, and `character_attributes` as NDJSON to R2 (`exports/YYYY-MM-DD/`). Enables ad-hoc analytics with DuckDB or Jupyter without live D1 queries. |

---

## AI & LLM Layer

| # | Item | Notes |
|---|------|-------|
| <a id="b-4"></a>B.4 | **Question deduplication via embeddings** | Before storing a generated/submitted question, embed it (`@cf/baai/bge-base-en-v1.5`) and cosine-compare against `attribute_embeddings`. Block if similarity > 0.92. Prevents semantic dupes ("Is this character a villain?" / "Is this character evil?"). |
| C.4 | **Adaptive question strategy** | Track answer style in IndexedDB: players who answer "maybe" > 40% are ambiguity-prone; players who answer in < 3s are decisive. Pass `playerStyle: "decisive" \| "hesitant" \| "literal"` into `dynamicQuestion_v1` so phrasing adapts (fewer double negatives for literal players, more direct framing for hesitant ones). |
| <a id="c-6"></a>C.6 | **Question quality feedback loop** | After each game, score every question by information gain. Low-scoring questions (asked 200+ times, near-zero info gain) surfaced monthly in admin; LLM pass suggests replacements. Self-improving question bank without manual curation. |
| C.8 | **Semantic character search in teaching mode** | When the player types a name, embed in real time and return the 3 most similar existing characters: "Did you mean: *Black Widow*, *Black Panther*, or *Black Adam*?" Prevents duplicate submissions without requiring exact match. |
| A.7 | **Attribute fingerprint** | Per-character 3–5 word phrase generated at enrichment time, stored in `characters.fingerprint`: *"caped Gotham billionaire vigilante"*, *"web-slinging Queens high-schooler"*. Surfaced in `GuessReveal` as a one-glance summary of why the AI landed there. Generated in batch; cached indefinitely. |

> **Multi-modal `/identify`** (uploading a photo so the AI deduces the character) is tracked as moonshot M.8 in [docs/ROADMAP-icebox.md](docs/ROADMAP-icebox.md#moonshots).

---

## Gameplay Depth

| # | Item | Why |
|---|------|-----|
| G.1 | **Reverse mode** | Player picks a character; the AI defends it — player asks yes/no questions, AI answers from stored attributes. Tests whether the attribute DB is rich enough to be interrogated from the other side. |
| G.2 | **Hint system** | Player requests a hint at any point: reveals one binary attribute ("this character can fly"). Costs 2 questions from the budget. Strategy without breaking the core mechanic. |
| G.3 | **Multi-guess with drama** | Instead of one final guess, the AI gets 3 guesses with ascending confidence thresholds. Last guess plays the full typewriter + ring animation. |
| G.4 | **Speed mode** | 60-second per-session countdown (not per question). Sweeping arc timer; keyboard answers essential — desktop-first. `Page Visibility API` pauses when the tab hides. |

---

## Social & Replayability

| # | Item | Why |
|---|------|-----|
| S.1 | **Challenge a friend link** | Encode a specific character ID + salt in a shareable URL. Friend plays the same character; results compared side-by-side. Uses existing `sharing.ts` base64 encoding. |
| S.2 | **Custom character lists** | Named lists of character IDs in `localStorage`. Play against only a curated list — great for family/friend groups with shared fandoms. |
| S.3 | **Improved teaching mode UX** | Wizard: (1) name, (2) confirm auto-detected attributes, (3) fill gaps, (4) submit. Pairs with I.6 (async queue) so submission is instant. |
| S.4 | **Bento grid stats dashboard** | Replace flat stat rows in `StatsDashboard` with a CSS bento layout — large "Win Rate" tile, smaller supporting tiles. Stronger as a portfolio piece. |
| S.5 | **Voice input (experimental)** | Web Speech API "Yes / No / Maybe" recognition; permission-gated; fully degradable. A fun party trick. |

---

## Portfolio Polish

| # | Item | Why |
|---|------|-----|
| P.1 | **"How the AI thinks" explainer** | Static `/how-it-works` route with a Bayesian walkthrough and a live mini-demo. Strong for portfolio conversations with non-technical audiences. |
| P.2 | **Replay mode** | After a game, re-animate the full question sequence with probability scores updating in real time. Shareable link encodes the replay. Demonstrates the engine visually without requiring a live game. |
| P.3 | **Ambient character color theming** | `characters.dominant_color` (from I.5) tints `GuessReveal` — card background, name gradient, ring animation. The UI literally becomes the character. |
| P.4 | **Character suggestion page** | `/suggest` route — visitors nominate characters via a simple D1-backed form. Review and merge from admin. Passive contributor, no auth required. |
| P.5 | **Offline-first full game** | Bundle a representative 100-character subset into the service worker cache. Full game playable on a plane. PWA already registered but not fully offline-capable. |
| P.6 | **AI-generated character portraits** | For characters missing an R2 image, call `@cf/stabilityai/stable-diffusion-xl-base-1.0` via Workers AI. Generate, resize via `sharp`, cache to R2. Zero manual asset work per character. |
| P.7 | **`/about` + `/credits` pages** | Static routes: a one-screen project story (stack, design choices, links to repo + ARCHITECTURE.md) and an attribution page crediting character image sources, the five ingestion APIs (TMDb, AniList, IGDB, ComicVine, Wikidata), and the open-source dependencies. Required for ethical reuse of source-API images and a strong portfolio touch. |
| P.8 | **Light theme + theme toggle** | `next-themes` is already in `dependencies` but unwired. Add a 3-state toggle (system / dark / light) in `AppHeader`; mirror cosmic palette to a light variant via Tailwind CSS variables; persist in `localStorage`. Required for accessibility (some users find dark UIs unreadable) and demonstrates the design system holds up under inversion. |
| P.9 | **Daily challenge global leaderboard** | `useDailyChallenge` exists but results aren't shared. New `daily_results(date, user_id, won, questions_asked, completed_at)` table; `GET /api/v2/daily/leaderboard?date=YYYY-MM-DD` returns the top 20 fastest wins. Anonymous user_id, no auth — same cookie that already powers stats. Today-only, resets daily; collisions on user_id (incognito visitors) are a non-issue at portfolio scale. |

---

## Hardening & Hygiene

Real gaps in observability, security posture, sharing surface, and operational drills. Lower headline value than gameplay items, but each closes a specific hole that's currently open.

### SEO & Sharing

| # | Item | Files | Notes |
|---|------|-------|-------|
| <a id="h-1"></a>H.1 | **Open Graph + Twitter card** | `index.html`, new `public/og-image.png`, build script | Current `index.html` only has the basic description meta. Generate a 1200×630 portfolio-style OG image (Andernator wordmark + tagline + character grid backdrop) once via Figma or a build-time script; add `og:title`, `og:description`, `og:image`, `og:url`, `og:type=website`, `twitter:card=summary_large_image`. Required so a shared challenge link renders as a card, not a naked URL, on Slack / iMessage / X. |
| <a id="h-2"></a>H.2 | **`robots.txt` + `sitemap.xml`** | `public/robots.txt`, `public/sitemap.xml` | `robots.txt` allows `/`, disallows `/admin/` and `/api/`. Static `sitemap.xml` lists `/`, `/about`, `/credits`, `/how-it-works`, `/suggest` (once added). Without these, search engines index the admin panel and skip semantic priority — basic hygiene for a portfolio site. |
| H.5 | **Web App Manifest share target** | `public/manifest.json`, new `functions/api/share-target.ts` | Add `"share_target": { "action": "/share", "method": "GET", "params": { "url": "shared_url" } }` so the installed PWA appears in the OS share sheet. A friend shares a challenge URL → user picks Andernator → game opens pre-seeded. Pairs with S.1 challenge-a-friend. |
| H.6 | **Print stylesheet for game results** | `src/styles/print.css` | A `@media print` block that strips the chrome (header, nav, reasoning panel) and renders `GuessReveal` as a printable card: large character portrait, question history, final stats. Free wallpaper / share-to-paper. Few players will use it — those who do will remember it. |

### Observability & Operations

| # | Item | Files | Notes |
|---|------|-------|-------|
| <a id="h-3"></a>H.3 | **Cron Worker entry** | `functions/cron/index.ts`, `wrangler.toml` `[triggers]` | Several planned migrations and features assume a Cron Worker (`daily_stats` rollup, popularity decay, `game_stats` archival, D1→KV `feature_flags` sync, `info_gain_avg` updates). None of these can ship until a `[triggers] crons = ["5 0 * * *"]` entry and a `scheduled()` handler exist. Make this the prerequisite for migrations 0036–0039. |
| <a id="h-4"></a>H.4 | **Source map upload for `error_logs`** | `vite.config.ts`, deploy script | Build emits source maps already; Cloudflare Pages doesn't ingest them by default. Either upload to Sentry (free tier) on each deploy and rewrite `error_logs.stack` server-side via the Sentry API, or persist `dist/assets/*.map` in R2 (`maps/{commit_sha}/`) and add an admin viewer that fetches the map and pretty-prints stacks on-demand. Without this, every entry in `/admin/error-logs` is unreadable minified gibberish. |
| H.7 | **D1 backup restore drill** | `scripts/restore-from-r2.ts`, `docs/disaster-recovery.md` | The nightly D1 → R2 export (Database section) is only as good as the restore path. Write the inverse script: stream NDJSON from R2 back into a fresh D1 database; verify row counts match the export manifest. Document a quarterly drill in `docs/disaster-recovery.md`. Run it once on `guess-db-preview` to prove the path works. |
| H.8 | **Admin action audit log** | `functions/api/admin/_helpers.ts`, new `admin_audit_log` table | `character_versions` (migration 0037) tracks data changes; admin actions themselves (delete character, approve attribute dispute, push enrichment, rotate the basic-auth secret, run the deterministic simulator) currently leave no trace. New table: `admin_audit_log(id, actor, action, target_id, payload_json, ip, ua, created_at)`. A wrapper around all `/api/admin/*` POST/DELETE handlers writes one row per action. Surfaces in `/admin/audit`. |
| H.9 | **CSP report viewer** | `/admin/csp-reports` | The `/api/csp-report` endpoint exists and accepts violations; nothing surfaces them. Persist incoming reports to a new `csp_reports(directive, blocked_uri, source_file, line, column, ua, created_at)` table; add `/admin/csp-reports` to view recent violations grouped by directive + blocked URI. Validates that the existing CSP isn't silently blocking legitimate resources. |
| H.10 | **Lighthouse CI on every PR** | `.github/workflows/lighthouse.yml` | `size-limit` covers bundle bytes; doesn't catch LCP / CLS / INP regressions. Use `treosh/lighthouse-ci-action`: budget LCP ≤ 2.0s mobile, CLS ≤ 0.05, INP ≤ 200ms. Fail the PR check on regression beyond ±5%. Reports posted as a PR comment. |

### Resilience & Safety

| # | Item | Files | Notes |
|---|------|-------|-------|
| H.11 | **Engine self-recovery from corrupt session** | `functions/api/v2/game/_session.ts` | If KV session JSON deserialization fails (truncated write, schema drift between deploys, manual KV edit), all game endpoints return 500. Catch the parse error, log to `error_logs`, return a 410 Gone with `{ error: "session_corrupted", action: "restart" }`; the client treats it as a graceful new-game prompt instead of an error fallback. |
| H.12 | **Teaching mode content moderation** | `functions/api/v2/characters.ts` | `POST /api/v2/characters` validates shape via Zod but accepts any name string. Add a moderation pass: regex against the [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) word list per detected language, plus an LLM moderation call (`@cf/meta/llama-guard-3-8b` via Workers AI, free tier) for gray-area submissions. Rejected names return 422 with a helpful message; the submission is logged for admin review at `/admin/community/rejected`. |
| H.13 | **Per-IP submission throttle for teaching mode** | `functions/api/v2/characters.ts`, `_rate-limiter-do.ts` | Teaching-mode `POST` is currently behind only the global LLM rate limiter (intended for question generation). Add a dedicated `teaching:submit` bucket: 5 submissions per IP per hour, 20 per day. Prevents a single bad actor from polluting the community queue between admin reviews. |
| H.14 | **Privacy controls: data export + delete** | New `/api/v2/me/{export,delete}.ts`, `/settings` page | Anonymous user_id makes both trivial. `GET /api/v2/me/export` returns a JSON bundle: game history, achievements, preferences. `DELETE /api/v2/me` clears `game_stats`, `user_preferences`, `daily_results`, etc. for the cookie's user_id. A small `/settings` page exposes both with one-click downloads. Good citizenship and a strong portfolio talking point about privacy-by-design. |

### Accessibility & Inclusion

| # | Item | Notes |
|---|------|-------|
| H.15 | **End-to-end WCAG 2.1 AA audit** | One pass through every screen with axe DevTools + manual screen-reader testing (VoiceOver on macOS / iOS, NVDA on Windows). Catalog issues with severity; fix blockers; file the rest as discrete items. Distinct from the spot-fixes already listed under Modern Web Platform. |
| H.16 | **Question difficulty exposure** | Migration 0030 added `difficulty` (Easy/Medium/Hard) to `questions`; `scripts/classify-difficulty.ts` populates it; nothing surfaces it. Two surfaces: admin question list shows + filters by difficulty; player-facing difficulty setting biases question selection toward matching tier (Easy biases Easy questions, etc.) so the difficulty setting actually affects question feel, not just count. |

---

## UI / UX

Larger experimental items (View Transitions API, Document PiP, WebXR, ambient sound, on-device LLM APIs, etc.) are in [docs/ROADMAP-icebox.md](docs/ROADMAP-icebox.md#experimental-ui--emerging-web-tech).

### Near-Term Polish (1–2 days each)

- **Swipe gestures for Yes/No** — `pointer` events + CSS `translate` + `rotate`; spring-back on cancel; one-shot first-time hint. Buttons stay as the fallback.
- **Haptic feedback via Vibration API** — short distinct patterns: correct guess (70ms), wrong guess (40/60/40ms), question answered (10ms). Gated on `navigator.vibrate`; `localStorage` opt-out.
- **Skeleton loading states** — replace the game-start spinner with a skeleton matching `QuestionCard` + `ReasoningPanel` structure. Tailwind `animate-pulse`. No layout shift on data arrival.
- **First-time onboarding overlay** — `localStorage`-gated tooltip sequence using the Popover API (`popover="manual"`). Auto-dismiss after 4s or any interaction. Shown once.
- **Inline error states per phase** — question fetch failure → retry inside `QuestionCard`; guess submission failure → message + spinner-to-error transition below answer buttons. Session stays alive on transient errors.
- **Keyboard navigation throughout** — `Y` / `N` / `M` answers, `?` shortcut popover, `Esc` closes overlays, `R` restarts from end-game, `Enter` submits in teaching mode. Required for accessibility; makes speed-running snappy.
- **Probability bar micro-animations** — `transition: width 400ms cubic-bezier(0.34, 1.56, 0.64, 1)` slight overshoot. Dropping characters animate to 0% before fading; jumpers animate from prior position. The reasoning panel becomes a living instrument.

### Medium-Term UX Projects (2–4 days each)

- **View Transitions API for phase changes** — wrap `Welcome → Playing → GuessReveal` in `document.startViewTransition()`. Add `view-transition-name` to the question card and character portrait — the portrait morphs from grid thumbnail to `GuessReveal` as a shared element. Framer Motion fallback for unsupported browsers.
- **Character portrait blur-up (LQIP from R2)** — generate a 4×4 placeholder per character at enrichment time (8 bytes base64), store in `characters.lqip_base64`. Render blurred at full size; crossfade on load. Portrait space is always occupied; no flash of empty.
- **Progressive disclosure of `ReasoningPanel`** — on mobile, collapse to a compact "AI confidence" bar that expands on tap. Desktop (≥768px) stays open. `localStorage` persists the preference. Question card gets its vertical space back.
- **Personalized difficulty adaptation** — read game history; suggest difficulty bumps after a win streak as a dismissible banner. `@starting-style` for entry. No backend changes — client-side from existing stored stats.
- **Themed game modes with distinct visual identities** — `data-theme` attribute on `<html>` + 3 CSS variable overrides per theme. Easy / Hard / Anime / Villains / Speedrun each carry their own palette swap.
- **Animated "confidence meter" ambient background** — subtle CSS radial gradient whose hue/saturation encodes AI confidence. Cool blue at 40 candidates → warm amber at 1–3. `requestAnimationFrame` updates a CSS custom property. `prefers-reduced-motion` snaps to the final color.

---

## Modern Web Platform

Underused browser capabilities with low implementation cost and high demo value.

### CSS & Layout

| Technique | Where | Benefit |
|-----------|-------|---------|
| **CSS scroll-driven animations** | Answer history pills, possibility grid rows | Entries animate in on scroll; respects `prefers-reduced-motion` automatically |
| **`@starting-style`** | Toasts, overlays, newly inserted DOM | Entry animations without JS — fewer `AnimatePresence` wrappers |
| **Container queries** | `ReasoningPanel`, `QuestionCard` | These should adapt to their container, not the viewport |
| **CSS anchor positioning** | Keyboard shortcut popover, hint tooltip | Popovers that follow their trigger without JS positioning |
| **`color-mix()`** | Theme tokens | Cleaner than Tailwind opacity modifiers |

### Browser APIs

| API | Use case | Notes |
|-----|---------|-------|
| **`scheduler.postTask()`** | Question scoring, candidate filtering | Run heavy Bayesian work off the main thread with priority hints |
| **`requestIdleCallback`** | Analytics flush, IndexedDB writes | Defer non-critical writes to idle time |
| **Page Visibility API** | Speed mode timer (G.4) | Pause countdown when the tab is hidden |
| **Speculation Rules API** | Welcome → Playing | Prefetch `/api/v2/game/start` on hover of "Start Game" |
| **Canvas confetti** | Win state | Single `<canvas>` element instead of CSS-div particles — fewer DOM nodes at peak |

### Accessibility Gaps

| Gap | Fix |
|-----|-----|
| Screen reader announcements | `aria-live="polite"` on question text |
| Focus management on phase change | `useEffect` to focus the first interactive element |
| Color contrast on amber/rose buttons | Audit answer buttons against WCAG 2.1 AA |
| `prefers-reduced-motion` on sparklines | Disable confidence sparkline entry animation when motion is reduced |

---

## Developer Experience

Larger DX explorations (Storybook catalog, Zod contracts, Pact, Stryker, dev container, Turborepo, etc.) are in [docs/ROADMAP-icebox.md](docs/ROADMAP-icebox.md#dx-pipe-dreams).

### Test, Lint & Verification

| # | Item | Effort | Notes |
|---|------|--------|-------|
| DX.3 | **`@cloudflare/vitest-pool-workers` for handler tests** | Medium | Vitest inside Miniflare — real Workers runtime, local KV + D1 bindings, no mocking. Closes the coverage dark zone in `functions/api/v2/game/**`, `questions.ts`, `characters.ts`. |
| DX.4 | **MSW for API-dependent component tests** | Medium | `msw/node` intercepts `fetch` at the network layer. Component tests for `ReasoningPanel`, `QuestionCard`, and game hooks become self-contained and fast. |
| <a id="dx-11"></a>DX.11 | **`pnpm validate` pre-push git hook** | Low | `lint-staged` + `simple-git-hooks` (`lint-staged.config.mjs` already exists). Catches type/lint failures before they hit the remote. |
| <a id="dx-12"></a>DX.12 | **D1 migration dry-run in CI** | Low | `wrangler d1 migrations apply --dry-run` step on every PR. Catches migrations that reference non-existent columns or violate CHECK constraints. |
| DX.13 | **Strict Playwright test isolation** | Medium | `beforeEach` in `fixtures.ts` seeds a fresh test session cookie and resets the rate-limiter DO for the test's IP. Parallel runs become safe. |
| DX.16 | **Component test coverage backfill** | Medium | 19 components have no tests: `AnswerStrip`, `BottomNav`, `ChallengeView`, `CharacterComparison`, `CharacterImage`, `CoachMark`, `ConfettiBurst`, `DescribeYourselfScreen`, `GameHistory`, `GameOver`, `GuessReveal`, `InlineError`, `OnboardingOverlay`, `PersonaSelector`, `PossibilityGrid`, `PossibilitySpaceChart`, `QuestionManager`, `TeachingMode`, `WeeklyRecapCard`. Backfill at minimum: render-without-crash + one happy-path interaction per component. Pairs with DX.4 (MSW) for the API-dependent ones. |
| <a id="dx-17"></a>DX.17 | **Pre-commit secret scanning** | Low | Add `gitleaks` to `lint-staged` so committing `.env`, API keys, KV `admin:basic-auth` strings, or R2 credentials fails locally before push. Catches credential leaks at the only point they're cheap to fix. |
| DX.18 | **Coverage diff in PR comments** | Low | `vitest --coverage` already runs; surface the delta. Use `davelosert/vitest-coverage-report-action` to post a PR comment showing coverage change per file. Red/green at a glance, no need to dig through the lcov report. |
| DX.19 | **Type-coverage reporting** | Low | `type-coverage` package emits "98.4% of expressions are typed" with a per-file breakdown of `any`/`unknown`. Fail CI if it drops below baseline. Anti-`any` ratchet without a manual lint rule. |
| DX.20 | **Markdown link checker** | Low | `lychee` action validates every link in `*.md` (ROADMAP, ARCHITECTURE, CHANGELOG, README, docs/) on every PR. Catches dead doc links — surprisingly common after rename refactors. |

### Release & Versioning

| # | Item | Effort | Notes |
|---|------|--------|-------|
| DX.10 | ~~**Automated CHANGELOG + release tagging**~~ | — | ✅ 2026-04-30 — Replaced the dead changesets workflow (root pkg never registered with pnpm workspace, every release was manual) with a tag-driven `.github/workflows/release.yml` plus `pnpm release <patch\|minor\|major\|X.Y.Z>` (`scripts/cut-release.ts`) that bumps `package.json`, slots the `[Unreleased]` CHANGELOG section under a dated `[X.Y.Z]` heading, commits, tags, and pushes. The workflow then extracts the matching CHANGELOG section as the GitHub release notes via awk. `@changesets/cli` and `.changeset/` removed. |
| DX.21 | **Auto-generated release notes from commits** | Low | `release-please` reads conventional commits since the last tag and opens a PR with grouped notes (Features / Fixes / Docs / Chore). Zero manual changelog maintenance. Pairs with DX.10 — pick one or the other. |
| DX.22 | **Preview deployment per PR with shareable URL** | Low | `pnpm deploy:preview` already exists; wire to a GitHub Action that runs on every PR, deploys to a unique Cloudflare Pages preview URL (e.g. `pr-123.guess.pages.dev`), and posts a comment with the link, screenshot, and Lighthouse scores. Reviewers can poke at the actual UI in 30 seconds. |

### Developer Loop & Tooling

| # | Item | Effort | Notes |
|---|------|--------|-------|
| DX.14 | **`tsx --watch` scripts dev loop** | Low | Add `pnpm migration:new` etc. as documented `package.json` scripts; `--watch` variants for iterated scripts. |
| DX.15 | **OpenTelemetry local trace viewer** | Medium | Pipe `wrangler dev` traces to local Jaeger / Tempo via OTLP. Extends I.11's prod instrumentation to the dev loop. |
| DX.23 | **`pnpm doctor` health check** | Low | Single command that verifies node version, pnpm version, wrangler login, D1 binding reachability, KV binding, R2 binding, all required env vars in `.dev.vars`. Prints a green/red checklist. New-machine setup goes from "an hour of cryptic errors" to one command. |
| DX.24 | **Seed-from-prod-snapshot for local dev** | Medium | `pnpm db:seed-local` script that pulls the latest D1 nightly export from R2 (the one H.7 produces), strips PII, and loads it into a local `wrangler d1 execute --local` instance. Real data shape, real edge cases, no production credentials. |
| DX.25 | **Wrangler tail with structured grep** | Low | `pnpm tail` wraps `wrangler tail --format=json` and pipes through a `tsx` filter that pretty-prints by route, redacts cookies/auth, and supports `--filter='status>=400'` and `--filter='path~/api/v2/game'`. Tail is borderline unreadable today. |
| DX.26 | **Hot-reload for `functions/`** | Medium | `wrangler pages dev` reloads the SPA on edit but not Worker handlers — current loop requires manual restart. Wire `chokidar` watcher → `wrangler` SIGTERM + restart, or migrate to `wrangler dev` with the new `[pages]` config that supports HMR. |
| DX.27 | **VS Code workspace settings + recommended extensions** | Low | Commit `.vscode/settings.json` (format on save, ESLint fix on save, Tailwind class regex, file nesting for `*.test.tsx`) and `.vscode/extensions.json` (recommended: ESLint, Tailwind, Vitest, Playwright, Wrangler). Onboarding is "open folder, click Install Recommended, done." |
| DX.28 | **Dependabot / Renovate noise reduction** | Low | `renovate.json` exists; tune it: group all non-major dev deps into one weekly PR, auto-merge passing patches, separate group for `cloudflare/*` and `react`/`vite` majors. Right now ~half of weekly PRs are 1-line bumps. |

### Code Generation & Type Safety

| # | Item | Effort | Notes |
|---|------|--------|-------|
| DX.29 | **End-to-end type safety: handler → client** | Medium | Today the client hand-writes types for every API response; drift is silent. Use [hono](https://hono.dev) + RPC mode (or a thin `as const` typed-fetch wrapper) so `useGameSession` infers types directly from the handler's return. Eliminates a whole class of "renamed a field, forgot a call site" bugs. Migration is per-route — start with `functions/api/v2/game/*`. |
| DX.30 | **Generated D1 types from schema** | Low | `kysely-codegen` or `drizzle-kit introspect` against `migrations/init-squashed.sql` emits `src/lib/db-types.ts`. Every handler that reads from D1 gets autocomplete + compile-time column checks. Re-run on each migration via a `postmigration` script. |
| DX.31 | **OpenAPI spec auto-derived from handlers** | Medium | If DX.29 lands, derive OpenAPI from the same Zod schemas. Publish to `/admin/api-docs` (Swagger UI) and `docs/openapi.yaml`. Pays off the moment you write the first integration. Stretch: ship a typed JS SDK (`@guess/sdk`) generated from the spec. |
| DX.32 | **`game-engine` API contract snapshot tests** | Low | One test that snapshots the public exports of `@guess/game-engine` (function signatures, type names). Any unintentional API surface change fails CI with a diff. Free guardrail since the engine is shared between client + worker. |

### Visualization & Insight

| # | Item | Effort | Notes |
|---|------|--------|-------|
| DX.33 | **Bundle visualizer in CI artifact** | Low | `rollup-plugin-visualizer` already common; emit `stats.html` to GitHub Actions artifact on every PR build. Click → see exactly which dep added 12 KB. Complements `size-limit`'s pass/fail with the "why." |
| DX.34 | **Architecture diagram auto-generated from imports** | Medium | `dependency-cruiser` scans `src/` + `functions/` + `packages/` and emits a `mermaid` diagram of module relationships. Render in `ARCHITECTURE.md` via the existing markdown mermaid block. Auto-updates on every commit via a CI job. Catches accidental cycles too. |
| DX.35 | **Migration timeline visualizer** | Low | `pnpm db:timeline` reads `migrations/*.sql`, parses CREATE/ALTER statements, and renders an ASCII or HTML timeline of when each table/column was introduced. Directly answers "when did `attributes_json` show up?" without `git log`. |
| DX.36 | **Engine decision flame-graph** | Medium | Wrap `selectQuestion`, `scoreCharacters`, `runMCTS` with `console.time` collected into a Chrome devtools `performance.measure` API trace. `pnpm engine:profile` runs a full game and opens the trace in `chrome://tracing`. Visual answer to "why did this turn take 400ms?" |

### Productivity & Quality of Life

| # | Item | Effort | Notes |
|---|------|--------|-------|
| DX.37 | **`pnpm scratch` REPL with bindings preloaded** | Low | Spawns a `tsx` REPL with a live D1 client, KV, R2, and `@guess/game-engine` already imported. One-liner exploratory queries against local or preview without cargo-culting wrangler invocations. |
| DX.38 | **Conventional commit linter** | Low | `commitlint` + husky `commit-msg` hook enforces `feat: / fix: / docs: / refactor: / test: / chore:` prefixes. Already a stated preference (per user memory) — make it mechanical. Required for DX.21 release-please to work. |
| DX.39 | **PR template + auto-labeler** | Low | `.github/pull_request_template.md` with sections for Summary / Why / Testing / Migrations / Rollback. `actions/labeler` auto-applies labels based on changed paths (`area:engine`, `area:admin`, `area:enrichment`, `area:db`). Filters and metrics for free. |
| DX.40 | **Codespaces / dev container** | Low | `.devcontainer/devcontainer.json` boots a ready-to-code environment in GitHub Codespaces: node 22, pnpm, wrangler, all extensions. "I'd love to contribute but I'm on Windows" friction → zero. Listed in icebox before; recategorize as low-effort win. |
| DX.41 | **Inline TODO indexer** | Low | `pnpm todos` greps `TODO`/`FIXME`/`HACK` across the repo and writes a sorted markdown table to `docs/todos.md` with file links + line numbers + author from blame. CI fails if a TODO is older than 90 days without a tracking issue. |
| <a id="dx-42"></a>DX.42 | **AGENTS.md for AI pair programming** ✅ 2026-04-30 | Low | Shipped: [AGENTS.md](AGENTS.md) at repo root mirrors `.github/copilot-instructions.md`, points at ROADMAP.md → In Progress block as the canonical entry point for Cursor/Claude/Aider/Copilot. |
| DX.43 | **Deterministic engine playground** | Medium | `pnpm engine:play <seed>` opens a TUI (via `ink`) where you can step through a game one question at a time against the real engine, see the full reasoning panel inline, and replay any `game_id` from `game_history_details`. Debugging a tricky engine call in the actual UI takes 20 clicks; this takes one command. |
| DX.44 | **`@guess/eslint-config` shared config** | Low | Extract the project's ESLint setup into a tiny internal package. Pre-emptive — only worth it if a second app ever shares this codebase, but trivial to do now and demonstrates monorepo discipline. |
| DX.45 | **Performance budget per route** | Medium | `playwright` collects per-route LCP / TTI / JS payload size and writes to `metrics/{route}.json`. Compare against budget; CI annotation on regression. Pairs with H.10 Lighthouse CI but at finer granularity (each player route + each admin route). |

---

## Enrichment

The enrichment pipeline today is a manual, local-machine process: `run-enrich.sh` → `ingest/run.ts enrich` → local `better-sqlite3` staging DB → GPT-4o-mini → `data/enrich-cache/` → `upload-enrichment.ts` → D1 + R2.

Larger architectural moves (Cloudflare Workflows migration, agentic enrichment, Fandom adapter, model routing, AutoRAG) live in [docs/ROADMAP-icebox.md](docs/ROADMAP-icebox.md#enrichment-big-projects).

### Near-Term Improvements

- **Incremental re-enrichment on attribute schema changes** — `needsReenrichment()` in `enrich.ts` auto-detects characters with `NULL` for any newly active attribute (cross-join `attribute_definitions` × `character_attributes`). New attributes fill in overnight without `--new-attrs-only` flags.
- **Enrichment diff report before upload** — query D1 for current values, compute the diff, write `data/enrich-diff-YYYY-MM-DD.json`, print a summary (`+312 filled, 14 changed, 2 disputed`). Prevents silent overwrites of manually corrected values.
- **Retry budget with per-character error codes** — store structured `{ code, attempts, last_at }` in `enrichment_status.error`. Skip permanent failures (`context_too_long`) instead of retrying forever. Flags: `--retry-transient`, `--retry-all`.
- **Source overlap audit as a scheduled script** — `pnpm enrich:audit` cross-references all five sources by name/source_id, flags conflicts (TMDb says `isHuman: true`, AniList says `false`), writes `data/source-audit-YYYY-MM-DD.json`. Run monthly.
- **Structured output via OpenAI JSON schema mode** — switch from freeform `json_object` to `json_schema` derived programmatically from `AttributeDef[]`. Model is constrained at the token level; malformed JSON drops to near zero.
- **Live enrichment progress dashboard** (EN.1) — pairs with I.3 SSE endpoint. `/admin/enrich` streams `{ character, status, tokensUsed, costSoFar, eta }` for the running pipeline.

### Medium-Term Architecture

- **LLM confidence as a first-class data type** — replace `true/false/null` with `{ value, confidence, source, contested }`. Staging DB already has `confidence` and `contested` columns; surface them through upload into `character_attributes` (the `source` and `updated_at` columns from migration 0037 are the destination). Bayesian scorer weights contested attributes lower.
- **Adversarial enrichment pass (skeptic model)** — second pass with a different model challenges the first: "The previous model said X. Do you agree? Explain before answering." Disagreements go into `attribute_disputes` (already exists in migration 0026). Surfaces in admin for review.
- **Multi-language attribute enrichment** — second pass in Japanese (anime) / Spanish (LATAM characters); confidence-weighted majority vote merges results. Some attributes are clearer in source language ("Is this character a demon?" in Japanese for an anime character).
- **Popularity decay model from real games** — nightly Cron blends `0.6 × api_popularity + 0.4 × game_pick_rate_30d` into `characters.popularity`. DB self-calibrates through play.
- **Cross-character relationship graph** — LLM batch pass populates `character_relationships` (migration 0034) by asking "which pairs share a universe / franchise / creator? are rivals or allies?" Enables universe-aware questions.
- **Image aesthetics scoring via vision model** — pass `thumb.webp` to a vision model: face visibility / style consistency / recognizability scores. Possibility grid prefers high-scoring portraits; low-scoring flagged for manual replace.
- **Wikipedia full-text semantic enrichment** — chunk + embed via `@cf/baai/bge-base-en-v1.5`, store in Vectorize. When the engine is stuck (>8 candidates within 5%), embed the answer history as a query and retrieve nearest character chunks. Structured Bayesian + semantic vote together.

### Pipeline Quality & Observability

| # | Item | Notes |
|---|------|-------|
| EN.2 | **Token-level cost ledger per character** | Every LLM call logs `(character_id, attr_key, model, prompt_tokens, completion_tokens, cents, cache_hit)` to a new `enrichment_costs` table. Per-character ROI report: which characters are 10× more expensive to enrich and why (long Wikipedia sources / repeated retries). Surfaces hot-spots before the bill does. |
| EN.3 | **Prompt versioning + replay harness** | Hash every prompt template; store as `prompt_version` alongside each `enrichment_status` row. New prompt rev = `pnpm enrich:replay --since v0.7.2 --sample 50` runs the new prompt against a fixed character sample, diffs results vs. baseline, and reports answer flip rate before any production rollout. Catches regressions in prompt edits. |
| EN.4 | **Golden character regression set** | 30 hand-curated characters with verified attribute values committed to `data/enrichment-golden.json`. CI runs the pipeline against them on every prompt or schema change; >5% deviation fails the build. The "we know the answer for these" baseline. |
| EN.5 | **Cache hit-rate dashboard** | `data/enrich-cache/` size, hit %, miss %, and savings per source over time. Shows whether tightening the cache key (currently `${name}:${source}:${attrSet}`) would meaningfully reduce LLM cost. Pairs with EN.2. |
| EN.6 | **Per-attribute reliability score** | For each attribute, compute its historical agreement across sources (TMDb/AniList/IGDB/ComicVine/Wikidata + LLM). Low-agreement attributes (e.g. `isAntiHero`) get down-weighted in scoring; high-agreement attributes (e.g. `isHuman`) trusted at face value. Surfaces in admin as a "data quality scorecard." |
| EN.7 | **Schema drift detector** | CI step compares `migrations/init-squashed.sql` `attribute_definitions` against `enrich.ts`'s prompt template. Fails if the prompt asks for attributes that don't exist in DB or omits attributes that do. Eliminates the "added an attribute, forgot to update enrichment" failure mode. |

### Confidence, Provenance & Self-Healing

| # | Item | Notes |
|---|------|-------|
| EN.8 | **Provenance trail per attribute value** | Extend `character_attributes` (migration 0037 adds `source` + `updated_at`; this completes the picture) with `evidence TEXT` — the exact source quote or URL the model cited. Click an attribute in admin → see "Wikipedia paragraph 3 of 'Frodo Baggins': ‹quoted text›". Removes "trust me" from the data layer. |
| EN.9 | **Calibrated confidence via player corroboration** | When players answer questions during real games, treat their answers as weak labels. After N=20 player answers per (character, attribute) pair, compare to the stored value; if disagreement >70%, auto-file an `attribute_disputes` row. Closes the loop AN.26 (drift tracker) opens. |
| EN.10 | **Self-healing for invalid combinations** | Define logical constraints (`isHuman ∧ isAlien = false`, `isVillain ∨ isHero ∨ isAntiHero ∨ isNeutral = true`). Enrichment post-processor flags violations; second LLM pass attempts to resolve with explicit constraints in the prompt. Persistent violators dropped to `proposed_attributes` for admin review. |
| EN.11 | **Source-attribution-aware ingestion** | Each of the 5 source APIs (TMDb, AniList, IGDB, ComicVine, Wikidata) has known strengths. Tag each attribute with which source produced its value; when sources disagree, weighted vote favors the strongest-for-that-attribute source. (TMDb wins on movies, AniList on anime, IGDB on games, etc.) |
| EN.12 | **Counter-factual probe set** | For each character, a tiny set of "edge case" probes ("If <character> were stripped of their powers, would they still be classified as a hero?"). Tests robustness, not facts. Catches over-fit attribute extraction (model labels everyone with a cape `isHero: true`). |

### Catalog Discovery & Expansion

| # | Item | Notes |
|---|------|-------|
| EN.13 | **Auto-discovery of trending characters** | Weekly Cron polls TMDb's "trending people," IGDB "popular upcoming," AniList seasonal anime lead characters; cross-references against existing catalog; proposes top 20 missing characters into a new `proposed_characters` table. Admin one-clicks → enrichment runs. Catalog stays culturally current without manual curation. |
| EN.14 | **"Why isn't X in the game?" form** | Public `/suggest` page (already in P.7-adjacent territory) with a text field. Submissions hit `proposed_characters`; if 5+ unique IPs request the same character (fuzzy-matched), it auto-promotes to enrichment queue. Crowdsources the long tail. |
| EN.15 | **Franchise-aware bulk enrichment** | When a new character is added, auto-enrich their entire franchise / universe in a single batch. Prompt receives full franchise context once, drastically improving consistency for related characters (all MCU heroes evaluated against the same universe definition of "powered"). Cheaper too — shared context tokens deduplicate. |
| EN.16 | **Catalog gap analysis vs. external lists** | Cron compares catalog against IMDb Top 250 lead characters, IGN Top 100 video game characters, Wikipedia "List of fictional X" pages. Generates `data/catalog-gaps.md` weekly. The "obvious omissions you didn't notice" report. |
| EN.17 | **Era / decade balance audit** | Distribution of characters by `firstAppearedYear`. If 80% of catalog is post-2000, surfaces in admin as a balance warning. Drives intentional curation: "we need 30 more pre-1990 characters." |

### Multimodal & Vision

| # | Item | Notes |
|---|------|-------|
| EN.18 | **Vision-derived visual attributes** | Pass `thumb.webp` to a vision model to derive `hairColor`, `eyeColor`, `wearsGlasses`, `hasBeard`, `hasMask`, `isWearingHat`, dominant outfit color. These are visually obvious to humans and currently get fabricated by text-only enrichment. Vision model has zero-shot accuracy advantage here. Pairs with EN.6 — these are exactly the high-disagreement attributes. |
| EN.19 | **Auto-generated character silhouettes** | For each character image, generate a black-on-transparent silhouette via background-removal (Workers AI `@cf/u2net`). Powers a "guess the silhouette" hint mode in late-game stuck states. Free, one-time per character, cached to R2 alongside the portrait. |
| EN.20 | **Image quality auto-replace pipeline** | EN.18's vision model also scores `face_clarity`, `is_main_character_visible`, `image_resolution_class`. Characters scoring < 0.6 get re-fetched from the next-best source URL. Loops until quality threshold met or all sources exhausted. Currently a manual "this looks bad, find a better image" task. |
| EN.21 | **OCR pass for image text artifacts** | Some character images contain title cards / watermarks / text overlays that confuse the visual question modes. OCR (Tesseract.js or Workers AI) flags + auto-crops them. Cleans the image catalog without anyone reviewing 1,200 portraits. |

### Pipeline Architecture

| # | Item | Notes |
|---|------|-------|
| EN.22 | **Hybrid local-first + cloud-burst pipeline** | Today's pipeline is local-only (slow, single-machine bound). Refactor `enrich.ts` so the same code runs locally OR as a Cloudflare Workflow batch (already in icebox as a long-term move). Local mode for development + small batches; cloud mode for full-catalog re-runs. Bridges the gap until the full Workflow migration. |
| EN.23 | **Tiered model routing per attribute difficulty** | Attribute classification has natural tiers: factual (`birthYear`, `nationality`) → cheapest model (Haiku / `@cf/llama-3.1-8b`); subjective (`isAntiHero`, `personality`) → mid-tier (GPT-4o-mini, current default); contested (failed first pass, EN.10 violation) → escalate to GPT-4o or Claude Opus. Routing logic in `enrich.ts`; cost expected to drop 40-60% with no quality regression on factual attrs. |
| EN.24 | **Embedding-based prompt deduplication** | Many characters share boilerplate context (Marvel heroes, Pokemon trainers). Embed the assembled prompt context; if cosine similarity > 0.95 to a previous prompt's context, reuse the cached classification with character-name substitution. Aggressive but bounded — A/B test against EN.4 golden set. |
| EN.25 | **Streaming enrichment via SSE in admin** | Admin "Run enrichment" button streams progress server-side via the I.3 SSE endpoint: per-character status, current token cost, estimated time remaining, last LLM response preview. Replaces the current "tail the log file" workflow. Pairs with EN.1. |
| EN.26 | **Resumable batch jobs with checkpoints** | Enrichment pipeline writes checkpoints every N characters (current: all-or-nothing). On crash/cancel/network blip, `pnpm enrich:resume` picks up exactly where it left off using the checkpoint + cache. Currently one network blip restarts a 90-minute job. |
| EN.27 | **Dry-run mode with LLM call preview** | `pnpm enrich --dry-run` does everything except call the LLM: prints the exact prompts that would be sent, the estimated token count, the estimated cost, and the cache-hit forecast. Sanity check before kicking off an expensive run. |
| EN.28 | **Provenance-aware rollback** | Every batch enrichment writes a `batch_id`. `pnpm enrich:rollback <batch_id>` reverts every attribute change made by that batch using `attribute_drift` (AN.26) as the audit log. The "I just nuked all the `isVillain` flags" undo button. |

### Player-Facing Enrichment Surfaces

| # | Item | Notes |
|---|------|-------|
| EN.29 | **"Did you know?" character trivia card on reveal** | LLM batch pass populates `characters.trivia` (3 short, surprising facts per character). Surfaces on the reveal screen — adds learning + delight on top of the guess outcome. Cheap one-time pass. |
| EN.30 | **Spoiler-aware enrichment tagging** | Some attributes (`isVillain`, `isDead`, `realIdentity`) are spoilers for some characters. Add a `spoiler_severity` field to `attribute_definitions`; player has a "hide spoilers for media I haven't consumed" toggle. Engine still uses these attributes; UI just blurs the question when the player has opted out for that franchise. |
| EN.31 | **Localization pipeline for top languages** | Enrich character names + brief description in EN/ES/JA/PT/DE. Stored in `character_translations`. Player UI auto-picks based on `Accept-Language`. Major step toward the geo-aware engagement signals AN.14 surfaces. |
| EN.32 | **Pronunciation guide for non-Latin names** | LLM generates IPA + audio pronunciation (Workers AI TTS) for characters with non-English names. Tiny audio file in R2; admin can override. Surfaces on reveal screen and in teaching mode. Small touch, big payoff for accessibility + cultural respect. |

---

## Admin Panel

Larger pipe-dream screens (Real-Time Game Observatory, Health Vitals Board, Character Knowledge Graph, Attribute DNA Matrix, Cost Observatory, etc.) are in [docs/ROADMAP-icebox.md](docs/ROADMAP-icebox.md#admin-panel-pipe-dreams).

### Polish & Wiring Audit

The shell ships 24 routes across three sidebar groups (Tools / Data / Pipeline). This section is the audit pass: confirm each surface is reachable, the data it shows is fresh, the actions it offers actually work end-to-end, and the visual treatment matches the cosmic palette used by the player-facing app.

| # | Item | Notes |
|---|------|-------|
| <a id="ap-1"></a>AP.1 | **Route smoke-test sweep** | One Playwright spec that visits every route in `AdminShell.tsx` (`coverage`, `hygiene`, `cost`, `stress-test`, `recommender`, `category-recommender`, `env`, `bulk-habitat`, `demo`, `characters`, `questions`, `enrichment`, `pipeline`, `analytics`, `funnel`, `confusion`, `matrix`, `experiments`, `enrich`, `proposed-attrs`, `disputes`, `community`, `error-logs`) behind basic auth, asserts the route renders (no error boundary), the primary data fetch resolves, and a screenshot is captured. Single CI job covers wiring regressions. |
| <a id="ap-2"></a>AP.2 | **Action round-trip tests** | Each admin POST/DELETE handler in `functions/api/admin/**` gets one Vitest integration test using `unstable_dev`: approve a proposed attribute, resolve a dispute, retire a question, push a manual enrichment, edit a character. Catches the "button does nothing in prod" class of bug currently undetected. |
| AP.3 | **Empty-state pass for every route** | Audit every route for a graceful empty state: no characters yet, no proposed attrs, no disputes, no errors logged. Today several routes render a blank table. Add a consistent `<EmptyState icon title description action />` primitive in `src/components/admin/ui/EmptyState.tsx` and use it everywhere. |
| AP.4 | **Loading-skeleton consistency pass** | `<Skeleton>` is used inconsistently — some routes spinner, some flash, some block. Standardize: every list uses a 5-row table skeleton, every card uses a card skeleton, every chart uses a chart-shaped skeleton. Reuse via `<RouteSkeleton kind="list|cards|chart" />`. |
| <a id="ap-5"></a>AP.5 | **Error-boundary per route** | Single root error boundary swallows route-specific failures and unmounts the sidebar. Wrap `<Outlet />` in a route-level boundary that renders an inline error card with a Retry button (re-runs the fetch) and a "Copy error → clipboard" affordance. Keeps the rest of the panel usable. |
| AP.6 | **Stale-data freshness badges** | Every data card / table shows a "fetched 2m ago" pill (subtle, top-right). Stale > 5min = amber, > 30min = red. Click to refetch. Cheap signal that you're not staring at cached numbers. |
| AP.7 | **Mobile-friendly admin shell** | Sidebar is desktop-only; on `<768px` collapses to a hamburger drawer. Tables become horizontal-scroll cards. The point is being able to triage from a phone when something's on fire, not full editing parity. |
| AP.8 | **Cosmic palette parity with player app** | Admin panel currently uses default shadcn neutrals; the player app uses cosmic purple/indigo. Apply the same theme tokens (`--primary`, `--accent`, glassmorphism on cards) so the admin feels like the same product. Keep semantic tokens (destructive, warning, success) untouched. |
| AP.9 | **Sidebar grouping + counts** | Each section header (`Tools`, `Data`, `Pipeline`) gets a count badge for queues that have unread items: Disputes (open count), Proposed Attrs (pending), Community Queue (unreviewed), Error Logs (last 24h). Numbers come from a single `GET /api/admin/sidebar-counts` endpoint, polled every 60s. |
| AP.10 | **Global command palette (`⌘K`)** | `cmdk` is already a dep. Bind `⌘K` in admin shell to a palette: jump to any route, jump to any character by name (FTS-powered), recent admin actions, common commands ("export game_stats CSV", "rotate basic-auth"). Cuts navigation latency to near-zero. |
| AP.11 | **Breadcrumbs + page titles** | Every route sets `document.title` to `Admin · {route name} · Andernator` so browser tabs are distinguishable. Inline breadcrumb (`Admin / Pipeline / Proposed Attributes`) replaces the current title-only header. |
| AP.12 | **Keyboard shortcuts overlay (`?`)** | `?` opens an overlay listing every shortcut: `⌘K` palette, `g c` go to characters, `g q` go to questions, `j/k` table row navigation, `e` edit, `enter` open detail. Implements the shortcuts that don't exist yet, then documents them. |
| AP.13 | **Saved table views** | Characters / Questions / Disputes tables: filter + sort + column-visibility state persists to `localStorage` per table, plus a "Save view as…" dropdown for named filters ("Sparse attrs only", "Open disputes assigned to me"). |
| AP.14 | **CSV / JSON export buttons on every table** | One `<TableExportMenu />` primitive (Copy as TSV / Download CSV / Download JSON / Copy as Markdown table). Wired to whatever rows are currently filtered. Removes the constant temptation to drop into D1 SQL for one-off exports. |
| AP.15 | **Inline edit + optimistic updates** | Characters / Questions tables support double-click-to-edit cells (name, attribute values, question text) with optimistic update + rollback on 4xx. Today every edit requires a modal. Pairs with H.8 (audit log) so casual edits are still tracked. |
| AP.16 | **Bulk actions toolbar** | Select N rows → toolbar slides up from bottom with bulk Approve / Reject / Retire / Re-enrich / Delete. Single bulk endpoint per resource (`POST /api/admin/{resource}/bulk` with `{ ids: [], action: '...' }`). Replaces N round-trips with 1. |
| AP.17 | **Toast feedback standardization** | Mix of `toast.success`, alert dialogs, and silent reloads today. Standard: every mutation shows a toast with action result + Undo button (where reversible) + "View" link to the affected row. `sonner` already wired. |
| AP.18 | **Diff view for character / question edits** | Admin edit modal shows side-by-side before/after with changed fields highlighted (uses `diff` lib). Same view powers the version history surfaced by H.8 audit log + the `character_versions` table planned in migration 0037. |
| AP.19 | **Sticky filters & summary bar** | Long tables: filters and a 1-line summary (`Showing 142 of 1,205 characters · avg attrs filled: 73%`) stick to the top of the scroll container. The current pattern scrolls the filters out of reach. |
| <a id="ap-20"></a>AP.20 | **Health badge in shell header** | Top-right corner: green/amber/red dot reflecting last 5min: 5xx rate, p95 latency, LLM error rate, D1 wait time. Click for the latency budget panel (AN.29). The "everything fine?" glance. |
| AP.21 | **Shareable deep-links** | Every filterable surface encodes its state (filters, sort, pagination, selected row) into the URL. Pasting an admin URL in Slack lands the next person on the exact same view. Today most state lives in component state and dies on refresh. |
| AP.22 | **`/admin/about` build & data freshness card** | Single card showing: deployed commit SHA + timestamp, current D1 schema version (latest applied migration), KV namespace IDs, last enrichment run, last cron run, last D1 backup, app version (`package.json`). The "what am I looking at?" page when something's weird. |
| AP.23 | **Demo mode for screenshots** | Toggle that swaps live data for a deterministic seed (loaded from `data/admin-demo-seed.json`) and blurs PII-ish fields. Lets you screenshot the panel for the README / portfolio without doxxing user_ids or showing in-flight experiments. |
| AP.24 | **Session timeout + lock screen** | Basic-auth doesn't auto-expire. Add a 30-min idle timer; on expiry overlay a lock screen requiring password re-entry. Cheap protection against an unattended laptop with the panel open. |
| AP.25 | **Visual regression snapshots** | Playwright + `playwright-test-snapshot` captures a screenshot per route (built on AP.1's smoke test). Diffs in CI catch "I broke the dispute table layout" without anyone noticing for two weeks. |
| AP.26 | **Inline runbooks per route** | Tiny `?` icon next to each route title opens a side sheet with a route-specific runbook: "what this shows, where the data comes from, common follow-up actions, related routes". Markdown sourced from `docs/admin/runbooks/{route}.md`. Onboards future-you in 30 seconds. |
| AP.27 | **Notification center** | Bell icon in shell header. Driven by alerts (AN.33), pending disputes, pending proposed attrs, new error logs since last visit. Persists "last seen" timestamp per category in `localStorage`. Replaces the constant impulse to refresh the queue routes. |

### Near-Term Analytics

| # | Item | Notes |
|---|------|-------|
| <a id="an-1"></a>AN.1 | **Question skip & frustration funnel** | Funnel: question shown → answered / skipped / abandoned. Surfaces questions that consistently kill momentum. |
| AN.3 | **Answer distribution dashboard** | "maybe" rate per question. High-maybe questions are ambiguous and should be rewritten. |
| AN.6 | **Attribute coverage heatmap** | % non-null per attribute. Sparse attributes are the next enrichment target. |
| <a id="an-7"></a>AN.7 | **Confusion matrix** | Most-confused character pairs from `game_stats` runner-ups. Powers question-selector up-weighting for known confusion pairs. |
| AN.8 | **Real-world calibration overlay** | Real-game vs. simulator metrics side-by-side. Detects regression between sim runs and live play. |

### Player-Behavior Insights

| # | Item | Notes |
|---|------|-------|
| AN.9 | **Drop-off Sankey by phase** | `client_events` already records phase transitions. Render a Sankey: `landing → onboarding → game_start → q1 → q5 → q10 → guess → reveal → next_game`. Each link weighted by user count, hover shows median dwell time. Single most informative chart for "where do we lose people." |
| AN.10 | **Cohort retention curves** | Group users by first-game date; track % returning on day 1 / 7 / 30. Anonymous user_id cookie already enables this. Overlay cohorts on one chart so deploy dates become visible inflection points. |
| <a id="an-11"></a>AN.11 | **"Aha moment" detector** | For each game, compute the question after which the engine's top candidate's posterior jumped most. Aggregate: which questions consistently produce "the moment." That's the question-selector's real value, not just info gain. |
| AN.12 | **Engine ↔ player divergence map** | When did the player's apparent target (inferred from their answer pattern) diverge from the engine's top candidate? Surfaces the games where humans used info the engine ignored — direct fuel for engine improvements. |
| AN.13 | **Session shape clustering** | k-means on per-session feature vectors (games_played, avg_questions, win_rate, abandonment_phase, time_of_day). Names the 4-6 player archetypes (speed-runner, completionist, dabbler, frustration-quitter…). Personalize onboarding copy per archetype. |
| AN.14 | **Geo-aware character popularity** | CF gives `request.cf.country` for free. Heatmap of which characters get picked where. Surfaces cultural gaps ("nobody in JP picks Western superheroes — should we expand the anime catalog?"). |
| AN.15 | **Time-of-day & day-of-week play heatmap** | 7×24 grid of game starts. Informs Cron timing (run heavy jobs at the trough), informs LLM cost projections, and is just genuinely interesting to look at. |
| AN.16 | **Bot / automation detection signal** | Flag sessions with sub-200ms answer times, identical UA across many user_ids, or impossibly perfect win rates. Surface in `/admin/security/anomalies` for manual review. Cheap insurance before scraping becomes a problem. |

### Engine Self-Tuning Loops

| # | Item | Notes |
|---|------|-------|
| <a id="an-17"></a>AN.17 | **Question retirement queue** | Composite score per question: `low info_gain × high skip rate × high maybe rate × low player rating`. Top N flagged in `/admin/questions/retirement-queue` with one-click disable. Closes the loop AN.1 + AN.3 + AN.7 open. |
| AN.18 | **Difficulty calibration delta** | `questions.difficulty` (Easy/Medium/Hard, classified by LLM in migration 0030) vs observed difficulty from `question_attempts` win rate. Mismatches auto-suggest reclassification. Cron rolls suggestions into a weekly admin email. |
| AN.19 | **Question-pair redundancy detector** | Pairs of questions whose answer vectors correlate >0.9 across `question_attempts` provide near-duplicate information. Surface pairs; admin retires the lower-rated of each. |
| AN.20 | **Embedding-based duplicate question finder** | Embed each question's text via `@cf/baai/bge-base-en-v1.5`, store in Vectorize. Cosine-similarity > 0.92 = likely duplicate. Catches semantic dupes that AN.19's behavioral signal misses (fresh questions with no attempt data). |
| <a id="an-21"></a>AN.21 | **Catastrophic-failure replay queue** | Every game where the player's actual target wasn't in the engine's top 10 at any point auto-snapshots the full reasoning trace to a `triage_queue` table. Admin triage UI scrubs the game step-by-step (uses existing `game_history_details`). The 50-most-recent failures are the engine's most actionable training set. |
| AN.22 | **Engine reasoning hallucination audit** | Daily Cron samples 20 finished games, runs the saved reasoning text back through an LLM judge with the actual game history + outcome. Judge scores: did the reasoning match the math? Surfaces hallucinated justifications. |
| AN.23 | **Question entropy decay over time** | Replay each question's info gain monthly as the catalog evolves. Questions that were great in v1.2 may be worthless after a 200-character expansion. Auto-deprioritize decayed questions. |

### Catalog & Question Quality

| # | Item | Notes |
|---|------|-------|
| AN.24 | **Character "celebrity index"** | `(picks_per_session × games_with_pick) ÷ catalog_size`. Surfaces over- and under-represented characters. Over-picked characters need siblings (similar archetype, fewer games featuring them); under-picked may be unfamiliar to the audience and candidates for removal. |
| AN.25 | **Catalog freshness ribbon** | Public metric: characters added in last 30 / 90 days. Renders in `/about` as proof the catalog is actively curated. Same query also drives an admin "stale catalog" warning if freshness drops below threshold. |
| AN.26 | **Attribute drift tracker** | When enrichment ingestion flips an attribute value (e.g. `hasGlasses: false → true`), log to `attribute_drift(character_id, attr_key, old, new, source, changed_at)`. Flag flips that contradict admin-locked values. Catches enrichment regressions before they corrupt scoring. |
| AN.27 | **Attribute dispute resolution SLA** | Time from dispute filed (migration 0026) → resolved. Median + p95. Stale disputes (>14d open) bubble to top of admin queue. Public-facing SLA on `/about`: "median dispute resolved in N days" — credibility win. |
| AN.28 | **Question wording A/B harness** | Same `attribute_key`, two question texts. 50/50 split per session. Winner = higher info_gain × lower abandonment over 200-attempt sample. Auto-promote, auto-retire. Compounds question-quality improvements without manual A/B coordination. |

### Operations & Live Telemetry

| # | Item | Notes |
|---|------|-------|
| AN.29 | **Latency budget panel** | p50/p95/p99 per endpoint, with stacked breakdown: D1 wait / KV wait / LLM wait / engine compute / network. Pairs with I.4 (Tail Worker) and I.11 (OpenTelemetry). One glance shows whether a slow `POST /game/answer` is D1 or LLM. |
| <a id="an-30"></a>AN.30 | **Live ops strip** | Rolling 1h counters in admin header: games started / wins / losses / abandons / LLM errors / 5xx rate. Auto-refresh every 30s via SSE. The "is the site healthy right now" view that no dashboard chart replaces. |
| AN.31 | **Cost-per-game ribbon** | `(LLM tokens × per-token price + estimated D1/KV/R2 ops cost) ÷ games`. Daily trend line. Tells you in dollars when a code change made the system more or less efficient. |
| AN.32 | **Weekly insights digest** | Cron generates a markdown summary every Monday: top-3 movers (win rate, abandonment, cost/game), worst-performing questions, newly added characters, anomalies. Posted to `/admin/digest/YYYY-WW` and optionally a Discord/Slack webhook. The "I haven't checked the dashboard in a week" safety net. |
| <a id="an-33"></a>AN.33 | **Anomaly-trigger alerts** | Statistical baseline per metric (rolling 14-day mean ± 2σ); when today's value crosses, write to `alerts` table + optional webhook. Catches "win rate dropped 30% overnight" without staring at charts. |

### Experimentation Platform

| # | Item | Notes |
|---|------|-------|
| AN.34 | **Feature flag → metric attribution** | Existing `feature_flags` table. New `flag_assignments(user_id, flag_key, variant, assigned_at)` and `flag_metrics` view: for each (flag, variant), compute conversion / completion / win rate / cost over the experiment window. Stat-sig column computed via simple two-proportion z-test. Turns ad-hoc rollouts into proper experiments. |
| AN.35 | **Holdout group for engine improvements** | 5% of sessions permanently locked to the previous engine version (last released minor). Side-by-side metrics on `/admin/holdout` answer "did v1.6 actually improve play, or did we just convince ourselves?" |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04 | No monetization, no auth | Portfolio project — simplicity and focus over growth mechanics |
| 2026-04 | Cloudflare-only infra | Zero cold starts, generous free tier, single vendor for deploy simplicity |
| 2026-04 | No leaderboard (yet) | Requires auth; complexity not worth it without an audience |
| 2026-04 | Bayesian engine, not LLM-only | LLM alone is too slow and expensive per question; hybrid is faster and cheaper |
| 2026-04 | DO for sessions = paid plan | DO requires Workers Paid ($5/mo). KV session storage sufficient for portfolio scale; revisit if consistency bugs appear |
| 2026-04 | Admin panel uses Basic auth (not Cloudflare Access) | Solo developer tool — KV shared secret is sufficient and zero-cost. Swap to Access ($3/user/mo) only if collaborators are added |
| 2026-04 | StatsDashboard stays in main app | Player-facing data is not a developer tool; only internal tooling lives in the admin panel |
| 2026-04 | v1 KV endpoints not removed yet | Still referenced by some client paths; document deprecation before removal in a future cleanup migration |
| 2026-04 | Roadmap v1.4 archived | The prior roadmap grew to ~800 lines with most items struck through. Archive at `docs/ROADMAP-archive-v1.4.md` |
| 2026-04 | Roadmap v1.5 cleanup | Migrations 0031–0033 shipped between drafts, leaving the planned-migration list misnumbered; "Open Items in Flight" duplicated detail sections; A.6 duplicated M.8; Admin / Enrichment / UI sections grew long-form prose for items with no near-term timeline. Active sections tightened; icebox / moonshots / pipe dreams extracted to `docs/ROADMAP-icebox.md`; full prior snapshot preserved at `docs/ROADMAP-archive-v1.5.md` |
| 2026-04 | **Roadmap re-sequenced into execution waves** | The flat "Now" shortlist had grown to 19 items with no internal ordering, leaving "what do I pull next?" unanswered. Replaced with a 5-wave execution plan ordered by priority × ease, with effort tags (S ≤ ½ day / M ½–2 days / L 2–5 days) and per-item rationale. Wave 1 (Foundation, ~1 week): 10 zero-risk wins that unblock everything — AI Gateway split, pre-push hook, secret scanning, migration dry-run, Cron Worker stub, source maps, Smart Placement, semantic caching, OG card, robots/sitemap. Wave 2 (Data Quality, ~2 weeks): the priority-one DQ work in dependency order — golden set first, then vision attributes, schema drift detector, evidence trail, agreement scorecard, constraints validator, quality dashboard, player corroboration, reconciliation Cron, sparse-attribute auto-fill. Wave 3 (Operational Readiness, ~1 week): Analytics Engine, Tail Worker, admin smoke + round-trip tests, error boundary, live ops strip, anomaly alerts, health badge. Wave 4 (Insight & Refinement, ~2 weeks): skip funnel, confusion matrix, retirement queue, question quality loop, dedup, aha detector, catastrophic-failure replay. Wave 5 (Polish & Depth, open-ended): clusters of admin polish, DX leverage, player-facing portfolio gloss, infra graduation — unordered within cluster. Items below the cut line stay in their owning sections as the reference catalog |
| 2026-04 | **Data Quality elevated to priority one** | The catalog and attribute layer underpins every other system; quality gaps multiply through the engine, selector, analytics, and UI. Today's pipeline ships a single LLM pass with no cross-validation, no vision corroboration for visually obvious attributes, no logical constraint checking, and no continuous re-verification — players are the de facto QA workforce, which is backwards. Added a new top-level Data Quality section (DQ.1–DQ.30) above all other backlog areas, with seven loops: Continuous Validation (golden regression set + nightly reconciliation Cron + quality dashboard + per-attribute SLAs), Multi-Source Triangulation (agreement scorecard + source-strength weighting + Wikidata SPARQL cross-check + conflict triage), Vision-Backed Visual Truth (vision-derived attributes replacing fabricated values + image-attribute consistency audit + multi-image consensus + style classifier), Active Learning (player-answer corroboration + one-tap report + reputation-weighted labels + implicit corrections from outcomes), Adversarial & Constraint Hardening (logical constraint validator + skeptic model pass + counter-factual probes + chain-of-verification + schema drift detector), Catalog Curation Automation (sparse-attribute auto-fill + duplicate detector + stale-character detection + gap analysis + era balance), Trust & Transparency (public quality page + per-attribute evidence trail + confidence badges in admin + nerd-mode for players). Five highest-leverage items (DQ.1–DQ.5) bumped into the Now shortlist ahead of everything except in-flight Hardening |
| 2026-04 | Enrichment expanded | Added 31 items (EN.2–EN.32) across six new themed sub-sections. Pipeline Quality & Observability: token-level cost ledger, prompt versioning + replay harness, golden regression set, cache hit-rate dashboard, per-attribute reliability score, schema drift detector (EN.2–EN.7). Confidence, Provenance & Self-Healing: per-attribute evidence trail, player-corroboration confidence, logical-constraint self-healing, source-attribution-aware ingestion, counter-factual probes (EN.8–EN.12). Catalog Discovery: trending character auto-discovery, public `/suggest` form with vote threshold, franchise-aware bulk enrichment, gap analysis vs external lists, era/decade balance audit (EN.13–EN.17). Multimodal & Vision: vision-derived visual attributes, auto-silhouettes for hint mode, image quality auto-replace, OCR for text artifacts (EN.18–EN.21). Pipeline Architecture: hybrid local/cloud-burst, tiered model routing per attribute difficulty, embedding-based prompt deduplication, SSE streaming, resumable batch checkpoints, dry-run preview, provenance-aware rollback (EN.22–EN.28). Player-Facing: "Did you know?" trivia card on reveal, spoiler-aware tagging, localization pipeline (EN/ES/JA/PT/DE), TTS pronunciation guide for non-Latin names (EN.29–EN.32) |
| 2026-04 | Developer Experience expanded | Reorganized DX into six themed sub-sections and added 28 items (DX.18–DX.45). Test/Lint/Verification: coverage diff PR comments, type-coverage ratchet, markdown link checker (DX.18–DX.20). Release & Versioning: `release-please` auto-notes, per-PR Cloudflare Pages preview URL with screenshot + Lighthouse (DX.21–DX.22). Developer Loop & Tooling: `pnpm doctor` health check, seed-from-prod-snapshot for local dev, structured wrangler tail, hot-reload for `functions/`, `.vscode/` workspace settings, Renovate noise reduction (DX.23–DX.28). Code Generation & Type Safety: end-to-end handler→client types via hono RPC, generated D1 types from schema, OpenAPI from handlers, engine API contract snapshot (DX.29–DX.32). Visualization: bundle visualizer artifact, dependency-cruiser auto-diagram in ARCHITECTURE.md, migration timeline visualizer, engine decision flame-graph (DX.33–DX.36). Productivity: `pnpm scratch` REPL with bindings, commitlint, PR template + auto-labeler, dev container, TODO indexer, AGENTS.md, `ink`-based deterministic engine TUI playground, shared eslint-config, per-route performance budgets (DX.37–DX.45) |
| 2026-04 | Admin Panel polish & wiring audit added | The admin shell ships 24 routes but lacks an end-to-end wiring guarantee. Added 27 polish items (AP.1–AP.27): route smoke-test sweep + action round-trip tests + visual regression snapshots (AP.1, AP.2, AP.25) so wiring breakage is caught in CI; consistency primitives for empty states, loading skeletons, error boundaries, toasts, freshness badges (AP.3–AP.6, AP.17); shell upgrades — mobile drawer, cosmic palette parity with the player app, sidebar count badges, breadcrumbs, health badge, notification center (AP.7–AP.9, AP.11, AP.20, AP.27); navigation power tools — `⌘K` palette, keyboard shortcuts overlay, shareable deep-links, saved table views (AP.10, AP.12, AP.13, AP.21); table/edit ergonomics — inline edit, bulk actions, diff view, sticky filter bar, universal CSV/JSON export (AP.14–AP.16, AP.18, AP.19); operational surfaces — `/admin/about` build card, demo mode for screenshots, session timeout, per-route runbooks (AP.22–AP.24, AP.26) |
| 2026-04 | Analytics & Refinement expanded | Original Admin section had 5 near-term entries (AN.1, AN.3, AN.6, AN.7, AN.8). Added 27 items across five themes: Player-Behavior Insights (drop-off Sankey, cohort retention, aha-moment detector, engine↔player divergence, session clustering, geo popularity, time heatmap, bot detection); Engine Self-Tuning Loops (question retirement queue, difficulty calibration delta, redundancy detector, embedding-based duplicate finder, catastrophic-failure replay queue, hallucination audit, entropy decay); Catalog & Question Quality (celebrity index, freshness ribbon, attribute drift, dispute SLA, A/B harness); Operations & Live Telemetry (latency budget, live ops strip, cost-per-game, weekly digest, anomaly alerts); Experimentation Platform (feature flag attribution, holdout group). Each item references concrete tables / files that already exist |
| 2026-04 | Hardening & Hygiene section added | Gap audit surfaced 16 concrete items spanning SEO/sharing (no OG image, no robots/sitemap), observability (no Cron Worker entry, no source map upload, no CSP report viewer, no Lighthouse CI), resilience (no corrupt-session recovery, no teaching-mode moderation or per-IP throttle), privacy (no data export/delete), and accessibility (no end-to-end WCAG audit, no surface for the `difficulty` column from migration 0030). Component test coverage backfill (DX.16) and pre-commit secret scanning (DX.17) added under DX. `/about` + `/credits`, light theme + toggle, and a daily-challenge global leaderboard added under Portfolio Polish |
| 2026-04 | Status column added to wave tables | Per user preference, every wave-table row now carries a `Status` column (⬜ not started · 🟡 in progress · ✅ YYYY-MM-DD when shipped) updated in the same commit as the work itself. Same convention codified in user memory — applies to every future roadmap pull |
| 2026-04 | Roadmap promoted to runbook | Added a top-level `How to use this roadmap` section spelling out the pull-loop, status protocol, universal Definition of Done, file/section ownership map, and commit conventions for roadmap edits. Added an `In Progress / Up Next` callout at the top of Now as the single source of truth for "what's next?" — the first thing any future Copilot session reads. Reference catalog vs. active execution path now explicitly separated so the doc scales without future agents getting lost in the themed sections |
| 2026-04 | Roadmap actionability hardened | Three follow-on refinements landed together: (1) added a `Done when` column to all 4 wave tables — every row now has a verifiable acceptance signal so "is this shipped?" is unambiguous; (2) injected stable HTML anchors (`<a id="dq-1"></a>` etc.) on the 35 themed-section rows referenced by waves, and rewrote wave row IDs as clickable links — Cmd-click an ID in a wave row to jump to its full description; (3) created [AGENTS.md](AGENTS.md) at repo root as the canonical entry point for AI agents (and humans), pointing at ROADMAP.md → In Progress block as the first read. Together these change the roadmap from a reference doc into a runbook future Copilot sessions can execute against |
| 2026-04 | I.4 split into Tail Worker scaffolding + inline Pages fallback | First attempt at I.4 added `[[env.*.tail_consumers]]` blocks to the root `wrangler.toml`, which broke the CI deploy: Cloudflare Pages projects reject that key ("Configuration file for Pages projects does not support tail_consumers") and offer no equivalent dashboard wiring. Rather than block I.4 indefinitely, kept the standalone `guess-tail` Worker scaffolding (pure mapper + tests + dataset) for the eventual Pages→Workers migration and shipped an inline fallback: `functions/_middleware.ts` wraps `next()` with a wall-clock timer and writes one AE row per request to the same `WORKER_TAIL` binding using a path-equivalent schema. Net result: AN.29 / AN.30 unblocked today, no hot-path regression, scaffolding ready to flip on once Pages supports `tail_consumers` |
| 2026-04 | DX.10 changesets replaced with tag-driven release workflow | The original DX.10 plan ("add changesets, PRs drop a changeset file, GH Action commits the changelog and tags") had been live since v1.4 but never actually worked: the root `guess` package isn't in `pnpm-workspace.yaml` (which only contains `packages/*`), so `changeset version` always errored with "package guess which is not in the workspace". v1.4 / v1.5 / v1.6 were all hand-tagged. Replaced with a tag-driven flow: `.github/workflows/release.yml` fires on `v*.*.*` push (or manual `workflow_dispatch` with a tag input), extracts the matching `## [X.Y.Z]` section from CHANGELOG.md via `awk`, and creates/updates the GitHub release. Helper script `scripts/cut-release.ts` (`pnpm release patch\|minor\|major\|X.Y.Z`) handles the local side: bumps version, slots `[Unreleased]` under a dated heading, commits, tags, pushes. `@changesets/cli` and `.changeset/` removed |

---

*Last updated: April 2026 · v1.6.0*
