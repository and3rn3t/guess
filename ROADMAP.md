# Roadmap

> Portfolio project — the goal is a delightful, frictionless experience and a showcase of creative AI integration. Not monetized; not mass-scale. Every item here should make the game *more fun* or *less annoying*, not more complex.

**Current version**: 1.4.0 — See [CHANGELOG.md](CHANGELOG.md) for what's shipped.

---

## Contents

- **Guiding Principles** — the four rules every item must satisfy
- **Already Shipped** — implemented features; for reference only
- **Phase 1 — Quick Wins** — near-term gaps and rough edges (≤ 1 week each)
- **AI & LLM Layer** — persona, prompt reliability, novel AI uses (A · B · C)
- **Simulator & Analytics** — engine testing, calibration, analytics (S · AN · E)
- **UI Depth & Polish** — visual layer improvements and pipe dreams (U · U-EX)
- **Data Enrichment Pipeline** — pipeline improvements and pipe dreams (EN · EP)
- **Backend & Infrastructure** — code fixes, config, explorations (BX · BI · BE · BP)
- **Admin Panel** — developer tools behind auth; mission control pipe dreams (AD · AM)
- **Developer Experience** — dev loop improvements and pipe dreams (DX · DP)
- **Phase 2 — Gameplay Depth** — new mechanics (medium-term)
- **Phase 3 — Social & Replayability** — sharing, achievements, community
- **Phase 4 — Showcase & Portfolio Polish** — portfolio finishing touches
- **Modern Web Platform** — browser APIs, CSS features, performance patterns
- **Icebox** — good ideas, no rush
- **Pipe Dreams (AI/LLM)** — wild ideas, no timeline
- **Moonshots** — alternate futures for the whole project
- **Decision Log** — why things were cut or changed

---

## Guiding Principles

- **Remove friction first** — if a player has to stop and think about the UI, something's wrong
- **Reward curiosity** — surfacing the AI's reasoning is the core hook; lean into it
- **Small, shippable slices** — each item should be completable in a weekend session
- **Portfolio-quality polish** — the kind of detail that makes a recruiter say "whoa"

---

## Already Shipped (not in backlog)

These were scoped in the initial roadmap but are already implemented — listed here for reference.

| Item | Details |
|------|---------|
| ~~How-to-play onboarding~~ | `OnboardingOverlay` — 4-step wizard, `useKV` "don't show again" |
| ~~Swipe gestures~~ | `useSwipeAnswer` — right=Yes, left=No; tested |
| ~~Dark/light theme toggle~~ | `next-themes` wired in `AppHeader`, defaults dark |
| ~~Keyboard shortcuts~~ | Y/N/M/U live; desktop hint label shown |
| ~~Daily challenge~~ | Full daily mode with streak-eligible completion recording |
| ~~Touch-optimized UI~~ | `whileTap` scale, gradient buttons, shimmer skeleton |
| ~~Sound effects~~ | `useSound`, `playAnswer`, `playCorrectGuess`, `playIncorrectGuess` |
| ~~Swipe-up = Maybe~~ | `useSwipeAnswer` up-swipe (dragY < −80px) → `'maybe'`; amber MAYBE overlay + label in `QuestionCard` |
| ~~Daily streak counter~~ | `useDailyStreak` hook — consecutive-day win streak from game history; flame badge on welcome screen (≥2 days) |
| ~~Image fallback + skeleton~~ | `CharacterImage` component — shimmer skeleton while loading, initial-letter avatar on error; used in `ReasoningPanel`, `ProbabilityLeaderboard`, `GuessReveal` |
| ~~Keyboard shortcut overlay~~ | `?` key + Keyboard icon toggles native Popover API cheatsheet in `QuestionCard`; no JS state needed |
| ~~Auto-focus answer buttons~~ | `useEffect` auto-focuses first answer button on each question render via `firstAnswerRef` |
| ~~Unified detective persona~~ | `SYSTEM_PREAMBLE` in `prompts.ts` — Sherlock Holmes–style detective character applied across all prompts |
| ~~Workers Observability~~ | `[observability] enabled = true` in `wrangler.toml`; tail logs visible in Cloudflare dashboard |
| ~~Cache-Control on API responses~~ | `public, max-age=60, stale-while-revalidate=300` on `/api/v2/questions` and `/api/v2/characters` |
| ~~KV cache for characters list~~ | 5-min KV cache on unfiltered character list in `characters.ts`; `waitUntil` write |
| ~~Request body size guard~~ | `parseJsonBody` checks `Content-Length`; rejects bodies > 64 KB with 413 before calling `.json()` |
| ~~`COOKIE_SECRET` startup guard~~ | `getSigningKey()` throws if `env.COOKIE_SECRET` is falsy; `DEV_SECRET` fallback removed |
| ~~Static import `getBestGuess`~~ | Moved from dynamic `await import(...)` to static top-level import in `result.ts` |
| ~~Remove legacy session format check~~ | `loadSession()` in `_game-engine.ts` simplified to lean+pool only; expired `'characters' in data` branch removed |
| ~~Update `compatibility_date`~~ | `wrangler.toml` updated from `"2025-04-01"` to `"2026-04-01"` |
| ~~`eslint-plugin-jsx-a11y`~~ | Added to `eslint.config.js` with `recommended` rules; `src/components/ui/` and Workers files exempted |
| ~~`@typescript-eslint/no-explicit-any`~~ | Rule set to `"error"` in `eslint.config.js` |
| ~~Mobile viewports in Playwright~~ | Mobile Safari (iPhone 15) and Mobile Chrome (Pixel 7) projects added to `playwright.config.ts` |
| ~~Persona system~~ | `Persona` type in `packages/game-engine`; all prompt functions persona-aware; `getDifficultyPersona()` replaces flat `SYSTEM_PREAMBLE`; `DIFFICULTY_TO_PERSONA` mapping |
| ~~PersonaSelector UI~~ | `PersonaSelector.tsx` — 3-card grid (Poirot/Watson/Sherlock) replaces difficulty chip pills on `WelcomeScreen` |
| ~~SuspectDescriptionOverlay~~ | `SuspectDescriptionOverlay.tsx` — streams `suspectDescription_v1` pre-reveal prose; animated magnifying glass |
| ~~Living Character Bios~~ | `livingBio_v1` prompt in `prompts.ts` — persona-voiced mini-bio for any character |
| ~~AI Argues Back~~ | `contradictionPushback_v1` in `prompts.ts` — theatrical pushback when player contradicts prior answer |
| ~~"Describe Yourself" mode~~ | `DescribeYourselfScreen.tsx` + `'describeYourself'` `GamePhase`; 10 first-person questions → character match → `selfMatchNarrative_v1` stream |
| ~~Answer impact flash (U.1)~~ | `PlayingScreen` — animated `−N eliminated` badge slides up after each answer; auto-dismisses after 2s |
| ~~Blur-to-reveal on GuessReveal (U.6)~~ | `GuessReveal` — both character images animate from `blur(20–24px) scale(1.15)` to sharp over 1.5s via Framer Motion |
| ~~Win intensity celebration (U.7)~~ | `GameOver` — `ConfettiBurst` scales particle count/spread by `questionsAsked` (≤5q full burst, ≤10q medium, >10q minimal 3 particles); heading becomes "Uncanny!" / "I Got It Right!" / "Just in time." |
| ~~Thinking animation search pulse (U.9)~~ | `QuestionCard` `ThinkingCard` — 4×8 dot grid with left-to-right wave animation replaces generic shimmer blocks |
| ~~Undo ripple (U.10)~~ | `PlayingScreen` — 200ms red-glow flash on the last answer pill before `UNDO_LAST_ANSWER` dispatch; button disabled during flash to prevent double-undo |
| ~~Multi-model enrichment (EN.2)~~ | `scripts/ingest/enrich.ts` — `--model2 <model>` flag; `callOpenRouter()` sends same prompt to a second model via OpenRouter API; `mergeConsensusResults()` takes majority vote per attribute; `contested` column set when models disagree; `consensus:<model>` logged in changelog |
| ~~Attribute confidence tracking (EN.3)~~ | `enrich.ts` — `confidence` column populated per attribute: `0.85` for API-sourced booleans, `0.65` for LLM-set null fields; stored in `enrichment_attributes`; surfaced as heuristic rather than logprob |
| ~~Incremental re-enrichment (EN.4)~~ | `enrich.ts` + `run.ts` — `--new-attrs-only` flag skips characters where the target attribute key already exists in `enrichment_attributes`; runs only rows with missing keys |
| ~~Source overlap heatmap (EN.5)~~ | `scripts/ingest/source-overlap.ts` — `source-overlap` CLI command; queries staging DB for character counts per source pair; outputs pairwise overlap matrix to static `data/overlap.html` |
| ~~Enrichment changelog (EN.6)~~ | `enrich.ts` — `appendEnrichChangelog()` appends a Markdown table row to `data/enrich-log.md` after each run: timestamp, characters processed, attributes filled, model(s) used, tokens, estimated cost |
| ~~Automated attribute discovery (EP)~~ | `scripts/ingest/discover-attributes.ts` — `discover-attrs` CLI command; samples staging DB characters; calls GPT-4o to propose new boolean attribute questions; `--apply` mode submits to `proposed_attributes` D1 table via `POST /api/admin/proposed-attributes`; `AttributeDef` type exported from `enrich.ts` |
| ~~Adversarial attribute validation (EP)~~ | `enrich.ts` `--validate` flag — `runAdversarialValidation()` sends enriched attributes to a skeptic LLM pass; disagreements stored in staging `enrichment_disputes` table; `disputes-upload` CLI command + `generateDisputeUploadSQL()` promotes to D1 `attribute_disputes` table (migration 0026, applied to prod + preview); `GET/PATCH /api/admin/attribute-disputes`; `/admin/disputes` route (`DisputesRoute.tsx`) with paginated table and resolve/dismiss actions |

---

## Phase 1 — Quick Wins (Near-term, ≤ 1 week each)

These are real gaps or rough edges that exist today.

| # | Item | Why |
|---|------|-----|
| ~~1.1~~ | ~~**Swipe-up = Maybe**~~ | ~~`useSwipeAnswer` only handles left/right. Adding up-swipe for "Maybe" makes the full answer set gesture-accessible.~~ |
| ~~1.2~~ | ~~**Web Share API on mobile**~~ | ~~Sharing currently copies to clipboard only. `navigator.share()` triggers the OS native share sheet on mobile — one tap instead of copy-paste.~~ |
| ~~1.3~~ | ~~**Daily challenge streak counter**~~ | ~~Track consecutive daily completions in `localStorage`. Flame icon + streak count on welcome screen. Zero server cost.~~ |
| ~~1.4~~ | ~~**Wordle-style share card**~~ | ~~Emoji grid (🟩🟥🟨) + result text generated from answer history. Pure text — works anywhere. Pair with item 1.2.~~ |
| ~~1.5~~ | ~~**Image fallback + skeleton**~~ | ~~When the R2 image is missing or slow, show a stylised character-initial avatar rather than a broken `<img>`.~~ |
| ~~1.6~~ | ~~**Keyboard shortcut overlay**~~ | ~~Press `?` to toggle a cheat-sheet popover listing Y/N/M/U + Undo. The shortcuts exist; they just aren't discoverable. Use the native [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) — no JS state needed.~~ |
| ~~1.7~~ | ~~**"Skip this question" action**~~ | ~~Player can skip a confusing question. Rerolls to the next highest-entropy question; doesn't count against the budget. Reduces rage-quits on ambiguous questions.~~ |
| ~~1.8~~ | ~~**Auto-focus answer buttons**~~ | ~~On every question render, focus the first answer button via `useEffect` so keyboard users can answer immediately without tabbing.~~ |
| ~~1.9~~ | ~~**"Give up" graceful exit**~~ | ~~A subtle "I give up — reveal the answer" option after ≥5 questions. Shows the character, records as a loss. Removes the frustration of being stuck forever.~~ |

---

## AI & LLM Layer

The Bayesian engine selects questions; LLM handles phrasing, reasoning, and narrative. These items target that layer specifically — personality, reliability, and novel uses of the model.

### A — Personality & Tone (High impact, low effort)

The current `SYSTEM_PREAMBLE` is: *"You are a helpful assistant for a character guessing game."* That's the root problem. Every prompt inherits this flat baseline. The fix is a unified persona that evolves within a game session.

| # | Item | Files touched | Notes |
|---|------|--------------|-------|
| ~~A.1~~ | ~~**Unified detective persona**~~ | ~~`prompts.ts`~~ | ~~Replace the flat `SYSTEM_PREAMBLE` with a character: "You are a sharp, witty detective who treats every guessing game like a Sherlock Holmes case. You're confident but never arrogant, and you make the player feel like your partner, not your subject." Apply consistently across *all* prompt functions.~~ |
| ~~A.2~~ | ~~**Confidence-based tone shift**~~ | ~~`dynamicQuestion_v1`~~ | ~~`confidenceTier` + `isEarlyHighConfidence` flags added; system message tone shifts at `<30%` / `30–70%` / `>70%` thresholds.~~ |
| ~~A.3~~ | ~~**Difficulty personalities**~~ | ~~`prompts.ts`, `PersonaSelector.tsx`, `WelcomeScreen.tsx`~~ | ~~Sherlock/Watson/Poirot personas; `DIFFICULTY_TO_PERSONA` mapping; `PersonaSelector` replaces difficulty chips on welcome screen.~~ |
| ~~A.4~~ | ~~**In-game dramatic escalation**~~ | ~~`dynamicQuestion_v1`~~ | ~~`isCloseToGuess: boolean` flag at ≥80% confidence; `EARLY_CONFIDENCE_ASIDE` for questions 2–4 at ≥60%.~~ |
| ~~A.5~~ | ~~**Narrative post-game debrief in character**~~ | ~~`narrativeExplanation_v1`, `GameOver.tsx`, `App.tsx`~~ | ~~Names pivotal answer; persona-voiced closing line; `persona` prop threaded from `App.tsx` → `GameOver`.~~ |

### B — Prompt Reliability (High impact, medium effort)

The current approach uses `"Return valid JSON only"` as a safety net — fragile in production. OpenAI's Structured Outputs API (`response_format: { type: "json_schema" }`) guarantees schema compliance.

| # | Item | Files touched | Notes |
|---|------|--------------|-------|
| ~~B.1~~ | ~~**Structured Outputs for all JSON prompts**~~ | ~~`functions/api/llm.ts`, `prompts.ts`~~ | ~~`jsonSchema?: Record<string, unknown>` added to `buildOpenAIPayload`; uses `response_format: { type: "json_schema" }` when provided; cache key updated.~~ |
| ~~B.2~~ | ~~**Streaming reasoning panel**~~ ✅ | ~~`llm-stream.ts`, `ReasoningPanel.tsx`~~ | ~~The streaming infrastructure is built (`llm-stream.ts`). Wire `ReasoningPanel` to consume tokens as they arrive instead of snapping in all at once.~~ Done: After each answer, `PlayingScreen` auto-triggers `llmStream` to generate a 1-2 sentence in-character comment; streamed tokens displayed in `ReasoningPanel` with blinking cursor. |
| ~~B.3~~ | ~~**Prompt version tracking**~~ | ~~`prompts.ts`~~ | ~~Add a `PROMPT_VERSION` constant (e.g. `"2026-04-A"`) to each prompt function. Log it alongside AI Gateway call records so regressions can be pinpointed by version. Zero runtime cost.~~ |
| B.4 | **Question deduplication via embeddings** | `functions/api/questions.ts` | Before storing a user-submitted or LLM-generated question, embed it (Workers AI `@cf/baai/bge-base-en-v1.5`) and cosine-compare against existing question embeddings. Block if similarity > 0.92. Prevents semantic duplicates like "Is this character a villain?" / "Is this character evil?". |

### C — Novel AI Opportunities

These are unconventional uses of the model that wouldn't occur to most developers — and that's exactly what makes them portfolio-worthy.

| # | Item | Why it's interesting |
|---|------|---------------------|
| ~~C.1~~ | ~~**"Describe my suspect" pre-reveal**~~ | ~~`SuspectDescriptionOverlay.tsx` streams `suspectDescription_v1` at ~85% confidence; animated magnifying glass; "Reveal my guess →" when done.~~ |
| ~~C.2~~ | ~~**LLM-judged attribute corrections**~~ | ~~`correctionJudge_v1` in `prompts.ts` — factual voice rates flagged attribute correctness with confidence score.~~ |
| ~~C.3~~ | ~~**Contradiction explainer**~~ | ~~`contradictionExplain_v1` generates a 1-sentence natural-language contradiction explanation. `contradictionPushback_v1` added for "AI Argues Back" drama.~~ |
| C.4 | **Adaptive question strategy** | Track each player's answer distribution across games (in `IndexedDB`): players who answer "maybe" > 40% of the time are ambiguity-prone; players who answer in < 3 seconds are decisive. Pass a `playerStyle: "decisive" | "hesitant" | "literal"` hint into `dynamicQuestion_v1`. The AI adjusts — fewer double-negative questions for literal players, more direct binary questions for hesitant ones. |
| ~~C.5~~ | ~~**"What attribute set you apart"**~~ | ~~`distinctiveAttributeExplain_v1` in `prompts.ts` — narrates the single distinguishing attribute vs. runner-up using `topCandidates` data.~~ |
| C.6 | **Question quality scoring feedback loop** | After each game, score every question asked by whether its answer changed the probability distribution meaningfully (information gain > threshold). Feed low-scoring questions back to the LLM monthly: "This question was asked 200 times and almost never helped. Suggest a better alternative." Self-improving question bank without manual curation. |
| ~~C.7~~ | ~~**Ambient "I'm watching you" moment**~~ | ~~`isEarlyHighConfidence` flag + `EARLY_CONFIDENCE_ASIDE` constant in `dynamicQuestion_v1`; questions 2–4 at ≥60% confidence get a sly theatrical aside.~~ |
| C.8 | **Semantic character search in teaching mode** | When the player types a character name in teaching mode, embed it in real time and return the 3 most semantically similar existing characters: "Did you mean: *Black Widow*, *Black Panther*, or *Black Adam*?" Uses Workers AI embeddings. Prevents duplicate submissions without requiring exact-match. |

---

## Simulator & Analytics

The headless simulator (`scripts/simulate/`) runs the real Bayesian engine against an oracle player and writes results to D1. The SQL calibration queries (`docs/sim-calibration-queries.sql`) and target ranges (`docs/guess-readiness-calibration.md`) are solid. These items push it further.

### S — Simulator Improvements

| # | Item | Effort | Why |
|---|------|--------|-----|
| ~~S.1~~ | ~~**Noisy oracle player**~~ | ~~Low~~ | ~~The current oracle always answers correctly (`null → 'unknown'`). Real players make mistakes. Add a `--noise <pct>` flag that randomly flips a fraction of answers to "maybe" or the wrong value. A game that's 90% win with perfect answers but 60% with 10% noise has a fragility problem.~~ |
| ~~S.2~~ | ~~**`--compare` flag for regression detection**~~ | ~~Low~~ | ~~After a parameter change, run `pnpm simulate --compare results-before.jsonl results-after.jsonl`. Print a diff table: win rate Δ, avg questions Δ, forced guess rate Δ. Currently this requires manual SQL comparison.~~ |
| ~~S.3~~ | ~~**Category breakdown in analyze output**~~ | ~~Low~~ | ~~`analyze.ts` shows overall win rates and trigger breakdowns but not per-category. "Anime characters win at 92%; Book characters win at 58%" is the single most actionable signal for which part of the DB needs work.~~ |
| ~~S.4~~ | ~~**Chronically-lost characters report**~~ | ~~Low~~ | ~~Add a `--failures` flag that outputs the characters the engine lost on in every run (not just the latest). Cross-reference with attribute coverage — low attribute count is almost always the cause.~~ |
| ~~S.5~~ | ~~**Per-attribute info-gain heatmap**~~ | ~~Medium~~ | ~~Extend `questionsSequence` analysis to show which attributes delivered the most average info gain across all games. Attributes with near-zero info gain across all games are either redundant or too sparse — candidates for removal or new question phrasing.~~ |
| ~~S.6~~ | ~~**Worker threads parallelism**~~ | ~~Medium~~ | ~~The simulator is single-threaded. Node.js `worker_threads` can split the character pool across CPU cores. On an 8-core machine a 500-character `--all` run could be 4–6× faster. Starter pattern: `StaticPool` from `jest-worker` or a simple `Worker` per difficulty.~~ |
| ~~S.7~~ | ~~**Question ordering sensitivity**~~ | ~~Medium~~ | ~~Run the same character 10× with questions shuffled into a random order each time. Measure win rate variance. A robust engine should have low sensitivity to question order; high variance reveals that the greedy question-selector is making brittle early choices.~~ |
| ~~S.8~~ | ~~**Scoring weight grid search**~~ | ~~Medium~~ | ~~`ScoringOptions` (SCORE_MATCH, SCORE_MISMATCH, SCORE_MAYBE, popularity decay) are currently hand-tuned constants. Add a `scripts/simulate/grid-search.ts` that sweeps a parameter grid, runs 200 games per point, and outputs a ranked table. Find the Pareto-optimal weights across win rate vs. avg questions.~~ |
| ~~S.9~~ | ~~**CI regression gate**~~ | ~~Medium~~ | ~~GitHub Actions job: on every PR that touches `packages/game-engine/` or `functions/api/v2/_game-engine.ts`, run `pnpm simulate --sample 200 --write-db` against the preview DB, then run the calibration SQL and `exit 1` if win rate drops > 3 points from main. Makes engine changes risky to merge without evidence.~~ |
| ~~S.10~~ | ~~**Sim run changelog**~~ | ~~Low~~ | ~~Write a `sim-runs.md` that logs each simulator run: date, run_id, sample size, difficulty, win rate, avg questions, key parameter values. Manual but takes 2 minutes after each run — builds a long-term performance history you can graph later.~~ |

### AN — Analytics Improvements

| # | Item | Effort | Why |
|---|------|--------|-----|
| AN.1 | **Question skip & frustration funnel** | Low | Track which questions players skip most often (once item 1.7 ships). High skip rates on a question = either confusing phrasing or the attribute is ambiguous. This feeds directly into question quality improvement. |
| ~~AN.2~~ | ~~**Session funnel in D1**~~ | ~~Low~~ | ~~`game_sessions` table exists but the funnel is unclear. Add a `dropped_at_phase` column: `welcome`, `playing`, `reveal`, `gameover`. A drop spike at `playing:q3` means the first few questions are frustrating.~~ |
| AN.3 | **Answer distribution dashboard** | Medium | The `answerDistribution` field exists in `SimGameResult` and in game data. Surface it in `StatsDashboard`: "Players said 'maybe' 34% of the time on *isVillain*". High "maybe" rates on a question mean it needs rewording or removal. |
| ~~AN.4~~ | ~~**Win rate time-series query**~~ | ~~Low~~ | ~~Add a calibration SQL query (in `sim-calibration-queries.sql`) that shows win rate by week from `game_stats`. Lets you catch gradual drift — a DB that's growing with poorly-attributed characters will show a slow win rate decline.~~ |
| ~~AN.5~~ | ~~**Client→server event pipeline**~~ | ~~Medium~~ | ~~`analytics.ts` stores events in `localStorage` up to `MAX_ANALYTICS_EVENTS` but they never reach the server. Flush to a `POST /api/v2/events` endpoint on game end. Enables cross-session analysis — right now client analytics are ephemeral and siloed per device.~~ |
| AN.6 | **Attribute coverage heatmap** | Medium | A D1 query + `StatsDashboard` view showing, for each attribute, what % of characters have a non-null value. Attributes below ~40% coverage are effectively useless for discrimination. Prioritise filling them via the enrichment pipeline. |
| AN.7 | **Confusion matrix** | Medium | Which characters does the engine most frequently confuse with each other? Store the `secondBestCharacterId` on game loss in D1 (already in `sim_game_stats`). Visualise as a heatmap in `StatsDashboard`. "Batman and Black Panther are confused 40% of the time" is a direct signal to add differentiating attributes. |
| AN.8 | **Real-world calibration overlay** | Medium | Run the calibration SQL queries against both `game_stats` (real games) and `sim_game_stats` (simulator). Display both series side-by-side. If the simulator shows 85% win rate but real games show 62%, the oracle player model is too optimistic — the noise model (S.1) needs calibrating. |

### E — Tech Explorations (Learning-oriented)

> 🧊 **Icebox** — Deferred indefinitely. Worth understanding, but no implementation timeline.

These are deeper algorithmic alternatives — no obligation to ship, but worth understanding for the portfolio narrative.

| # | Exploration | What you'd learn |
|---|------------|-----------------|
| E.1 | **Monte Carlo Tree Search for question selection** | Replace greedy info-gain with MCTS: simulate multiple question sequences ahead, pick the one with the highest expected win rate at depth 3. Computationally expensive but provably better in theory. Compare against greedy via the simulator. Teaches you MCTS, which transfers to any game AI context. |
| E.2 | **Attribute embedding space** | Embed every character's attribute vector using PCA or t-SNE (scikit-learn or a WASM port). Visualise the character cluster map — nearby characters are hard to distinguish. Reveals structural "blind spots" in the attribute space that no amount of threshold-tuning can fix. |
| E.3 | **Bandit-based question selection** | Model question selection as a multi-armed bandit (UCB or Thompson Sampling). Each "arm" is a question; the reward is whether it led to a win. The bandit learns which questions are most useful across games, adapting beyond what static info-gain can capture. Teaches reinforcement learning fundamentals. |
| E.4 | **Bayesian network attribute model** | Instead of treating attributes as independent (current model), model conditional dependencies: `isVillain` and `hasMagicPowers` are correlated. Build a naive Bayes → full Bayesian network transition. Teaches probabilistic graphical models. Even if you don't ship it, the comparison report from the simulator would be compelling in a portfolio write-up. |
| E.5 | **Self-play engine tournament** | Run the current engine against a modified version (different scoring weights, different question selector) using the simulator. Score by win rate, avg questions, and forced-guess rate. Teaches you how to evaluate AI systems objectively — the same framing used in AlphaGo/AlphaZero. |
| E.6 | **LLM-assisted weight tuning** | Feed the grid search results (S.8) + calibration targets into GPT-4o: "Here are the scoring parameters and their outcome metrics. Suggest the next parameter combination to try." Implements a basic Bayesian optimisation loop with the LLM as the surrogate model. Teaches prompt engineering for scientific tasks. |

---

## UI Depth & Polish

Structured experiments and improvements to the visual layer — from concrete gaps to full pipe dreams.

### U — Practical UI Improvements

Things that are missing or under-realised in the current implementation.

| # | Item | Files touched | Notes |
|---|------|--------------|-------|
| ~~U.1~~ | ~~**Answer impact flash**~~ | ~~`QuestionCard`, `PlayingScreen`~~ | ~~After the player answers, briefly show "−47 characters" (or "+0") in a colour-coded badge that slides up and fades. The count is already computed — it just isn't surfaced. This is the single clearest way to make the Bayesian engine feel tangible without any explanation.~~ |
| ~~U.2~~ | ~~**Probability-weighted possibility grid**~~ ✅ | ~~`PossibilityGrid`~~ | ~~Dots are currently binary — alive (bright) or dead (faded). Instead, scale each dot's opacity and size proportionally to its probability score.~~ Done: `candidateScores` prop passed from `PlayingScreen`; dot opacity/scale now reflects Bayesian probability from `reasoning.topCandidates`. |
| U.3 | **Character image dots in possibility grid** | `PossibilityGrid` | Replace coloured dots with tiny circular character portraits (from R2). When the engine zeros in, the grid shifts from a field of faces to a handful. The "give away" image fallback (U.6) covers missing images. |
| ~~U.4~~ | ~~**Answer history weight**~~ ✅ | ~~`PlayingScreen`~~ | ~~High-impact answers (info gain > threshold) get a visually larger or accent-bordered pill in the answer history.~~ Done: `stepEliminations` computed per turn; pills eliminating ≥1.5× avg get scale + ring glow highlight. |
| ~~U.5~~ | ~~**Top-3 probability trace in chart**~~ ✅ | ~~`PossibilitySpaceChart`~~ | ~~The chart currently shows aggregate "remaining" and a naive confidence line. Replace with 3 stacked lines: the top 3 candidates' individual probability scores over the game.~~ Done: `PossibilitySpaceChart` completely rewritten as a 3-line `LineChart` (emerald/blue/muted) tracking top-3 candidate probabilities per turn. |
| ~~U.6~~ | ~~**Blur-to-reveal on GuessReveal**~~ | ~~`GuessReveal`~~ | ~~The character image currently appears instantly. Start it heavily blurred and clear over 1.5 seconds — like a photograph developing. Pairs perfectly with the typewriter name reveal (2.6). The image and name arrive together as the "case closes."~~ |
| ~~U.7~~ | ~~**Win intensity celebration**~~ | ~~`GameOver`~~ | ~~Confetti count and duration currently don't scale with performance. Win in ≤5 questions → full particle burst + "Uncanny!" heading. Win on the last question → 3 particles, "Just in time." The celebration matches how impressive the win actually was.~~ |
| ~~U.8~~ | ~~**Desktop sidebar layout**~~ | ~~`PlayingScreen`~~ | ~~On screens ≥1280px, render `ReasoningPanel` and `PossibilityGrid` as a fixed right sidebar (already `max-w-7xl mx-auto` grid). Currently they stack below the question on all sizes — on desktop they have room to coexist.~~ |
| ~~U.9~~ | ~~**Thinking animation with search pulse**~~ | ~~`QuestionCard` (ThinkingCard)~~ | ~~The shimmer skeleton is generic. Replace with a custom animation: the possibility grid dots pulse in waves from left to right — visually suggesting the engine is sweeping through candidates. One CSS animation, no JS.~~ |
| ~~U.10~~ | ~~**Undo ripple**~~ | ~~`PlayingScreen`~~ | ~~When the player hits Undo, the most recent answer pill briefly glows red before removing. Currently it just disappears. A 200ms flash gives the action tactile feedback and prevents accidental double-undos.~~ |

### U-EX — UI Explorations & Pipe Dreams

> 🧊 **Icebox** — Deferred indefinitely. Good ideas, no current priority.

The weird stuff. No timeline, no guarantee. Think of these as creative prompts.

**Detective's Corkboard**
Replace the card-based `ReasoningPanel` with a visual corkboard metaphor. Each candidate is a photo pinned to the board. As answers come in, red string connects contradictions; green ticks mark confirming clues. Characters fall off the board as they're eliminated. Pinned photos rearrange via spring physics. Framer Motion handles the layout; no canvas needed. Pure theatre — but the kind that makes people take screenshots.

**Morphing Silhouette**
During gameplay, the `GuessReveal` region shows a blurred composite silhouette — the average shape of all remaining candidates blended via CSS `backdrop-filter` or a `<canvas>` pixel blend. As candidates narrow from 100 to 5, the silhouette sharpens and converges toward the correct character. The moment of "I know" is visual before the guess is made. Requires either Workers AI image blending or a client-side canvas blend of cropped portraits.

**3D Probability Space** *(WebGL / Three.js)*
The `PossibilityGrid` rendered as a 3D scatter plot. Characters are spheres positioned by 3 PCA-reduced attribute dimensions. When an answer fires, spheres representing eliminated characters drain away with a particle dissolve. The surviving cluster visually tightens. Overkill for gameplay; extraordinary as a "how it works" demo page (ties into item 4.1). Uses `@react-three/fiber`.

**Ambient Background Reactor** ✅ *Implemented*
~~The current `.bg-cosmic-glow` is static gradients. Make it dynamic: the radial gradient centers shift slowly based on `confidence` state — at low confidence the glow is diffuse and blue-shifted; at high confidence it contracts to a hot white/purple point behind the question card. CSS custom properties updated via `useEffect` on confidence change. Pure CSS, zero canvas.~~
Done: Added `.bg-cosmic-hot-glow` CSS class that fades in proportional to confidence during gameplay via inline opacity.

**Radar Chart Character Profile** ✅ *Implemented*
~~On `GuessReveal`, alongside the character image, render a spider/radar chart of the character's attribute profile across 6 categories (abilities, physical, social, origin, personality, powers). The shape is unique per character — Batman looks nothing like SpongeBob. Recharts has `RadarChart` built in. After the game it gives the player something to actually look at and compare.~~
Done: `GuessReveal` now shows a Recharts `RadarChart` after reveal, bucketing `character.attributes` by group via `getAttributeGroup()`. Only groups with ≥2 non-null attributes are shown.

**Physics-based Probability Bars** ✅ *Implemented*
~~The confidence percentage and probability bars in `ReasoningPanel` currently snap or linearly interpolate. Add spring physics via Framer Motion's `useSpring` — they overshoot slightly and settle. A bar that snaps from 40% to 80% after one great answer should *bounce*. Two lines of code per bar; the effect is viscerally satisfying.~~
Done: `ReasoningPanel` top-candidate bars replaced with `SpringBar` component using `useSpring` + `useTransform` from Framer Motion.

**CSS Houdini Paint Worklet for Progress Bar** *(learning exercise only — do not ship)*
Register a `PaintWorklet` that draws the progress bar as a flowing wave. `CSS.paintWorklet` is Chrome-only and unsupported in Safari and Firefox — the majority of users would silently fall back to the plain bar. Worth building locally to understand the API; stop there.

**"Case File" Game Over Screen** ✅ *Implemented*
~~On game over (win or loss), replace the current card layout with a manila folder / classified document aesthetic. The character image is stamped with "IDENTIFIED" (green) or "ESCAPED" (red). The answer history is rendered as a typed list with strikethroughs for eliminated clues. The share card text is styled like a redacted report. CSS only — no new dependencies. The kind of polish that makes a designer say "oh that's good."~~
Done: `GameOver` now shows a rotated IDENTIFIED/ABANDONED/ESCAPED stamp, an "Evidence Log" answer history in `font-mono`, and monospace stats line. Personal best burst animation added.

---

## Data Enrichment Pipeline

The pipeline is one of the most technically interesting parts of this project — 5 external APIs (AniList, TMDb, IGDB, Comic Vine, Wikidata) → SQLite staging DB → Levenshtein dedup → GPT-4o-mini batch attribute classification → WebP image processing via `sharp` → R2 upload → D1 migration SQL. This section covers practical improvements and pipe dream extensions that lean into the data and LLM aspects of it.

### EN — Pipeline Improvements (practical)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| EN.1 | **Live enrichment progress dashboard** | Medium | Replace the terminal `console.log` output with a local web dashboard served on `localhost:4000` during a run. Uses a tiny SSE server (Node `http` module) to push `{ character, status, tokensUsed, costSoFar, eta }` events. A single HTML page renders a live progress bar, cost meter, and log tail. *Once the admin panel ships, this local version is superseded by AD.10 — the same SSE stream promoted to a persistent `/admin/enrich` view without a separate local server.* |
| ~~EN.2~~ | ~~**Multi-model enrichment with consensus voting**~~ | ~~Medium~~ | ~~Run the same character through both `gpt-4o-mini` and a second model (e.g. `google/gemma-3-27b-it` via OpenRouter, often free). For each attribute, take the majority answer; flag attributes where models disagree into a `low_confidence` queue for manual review. Disagreement is itself signal — ambiguous attributes surface naturally.~~ |
| ~~EN.3~~ | ~~**Attribute-level confidence tracking**~~ | ~~Low~~ | ~~The `enrichment_attributes` table has a `confidence REAL` column that's hardcoded to `1.0`. Start actually populating it: if the LLM response includes a `logprob` for a token, use it. If not, use a heuristic: `null` fields set by LLM vs. source data get `0.7`; exact API-sourced booleans get `0.95`. Surface confidence in `StatsDashboard` — attributes below 0.6 average are soft data.~~ |
| ~~EN.4~~ | ~~**Incremental re-enrichment on new attribute definitions**~~ | ~~Low~~ | ~~Right now adding a new attribute requires re-running enrichment for all characters. Add a `--new-attrs-only` flag that identifies characters where the new attribute key is missing from `enrichment_attributes` and runs only those. Much faster than a full rerun.~~ |
| ~~EN.5~~ | ~~**Source overlap heatmap**~~ | ~~Low~~ | ~~A script that queries the staging DB and outputs a matrix: for each pair of sources (TMDb × AniList, Wikidata × Comic Vine, etc.), what % of their characters overlap after dedup? Reveals which sources are redundant and which are additive. Surfaces in a single static HTML `data/overlap.html`.~~ |
| ~~EN.6~~ | ~~**Enrichment changelog**~~ | ~~Low~~ | ~~Write `data/enrich-log.md` (not the raw txt log) after each run: date, characters processed, attributes filled, tokens used, cost, any failures. Plain Markdown table. Over time this becomes a run history you can graph — did cost-per-character go up after a prompt change?~~ |

### EP — Enrichment Pipe Dreams

> 🧊 **Icebox** — Deferred indefinitely. Good engineering problems, no current priority.

The enrichment pipeline already does something genuinely impressive — automated character classification at scale using LLMs. These ideas push it into territory most projects never touch.

**LLM Confidence as a First-Class Data Type**
The current pipeline outputs `true / false / null` per attribute. Replace the binary with a structured confidence object: `{ value: true, confidence: 0.91, source: "llm-gpt4o-mini", contested: false }`. When two enrichment passes disagree on a value, `contested: true` gets set. The game engine's Bayesian scorer can weight contested attributes lower at runtime — a character with 10 high-confidence attributes beats one with 20 contested ones. The enrichment output becomes a first-class probabilistic dataset, not just a boolean table.

**Cross-Character Relationship Graph**
After enrichment, run a second LLM pass: "List every character in this batch who shares a fictional universe with another character in your database." Build a `character_relationships` table in D1: `(character_a, character_b, relationship_type)` where `relationship_type` is one of `same_universe`, `same_franchise`, `same_creator`, `rivals`, `allies`. Use this graph during gameplay: if the player has eliminated all DC characters but the answer is Joker, the engine knows it's in trouble and can ask "Do they share a universe with Batman?" — a question impossible to generate from attributes alone. The game can reason about fictional structure, not just attribute space.

**Wikipedia Full-Text Semantic Enrichment**
For each character, fetch their Wikipedia page (via the MediaWiki REST API — free, no key). Run a chunked embedding over the full article text using Workers AI `@cf/baai/bge-base-en-v1.5` and store the character-level embedding in Cloudflare Vectorize. During gameplay, when the Bayesian engine is stuck (say, 10 candidates with similar probability), embed the player's recent answers as a query vector and retrieve the top-3 nearest characters from Vectorize. This gives the engine a semantic "gut feeling" that operates independently of structured attributes — characters that feel similar based on prose descriptions rather than boolean tags. The structured Bayesian engine and the semantic engine vote together.

~~**Automated Attribute Discovery via LLM Archaeology**~~
~~Instead of maintaining a hand-curated attribute definition list, run a weekly discovery pass: feed 50 randomly sampled character descriptions into GPT-4o and ask: "What boolean questions could you ask that would uniquely distinguish these characters from each other? Return 20 high-signal questions we haven't thought of yet." Compare the suggestions against existing `attribute_definitions`. New candidates go into a `proposed_attributes` table with a review flag. The LLM is auditing its own attribute space and filing bug reports. Run this monthly and the attribute list evolves with the character DB.~~

~~**Adversarial Attribute Validation**~~
~~After enrichment, run a second LLM as a skeptic: "Here are Batman's attributes: `isHuman: true`, `hasMagicPowers: false`, `isVillain: false`. Challenge any of these that seem wrong." The skeptic returns disputed attributes with a brief reason. Disputes are stored in `attribute_disputes` and surfaced in the admin panel. The pipeline validates its own output using a second model as a contrarian — peer review for LLM-generated data. Catches systematic biases in the enrichment prompt before they pollute the game engine.~~

**Popularity Decay Model via Real Game Data**
Current popularity is a static `[0,1]` score from source APIs (TMDb vote count, AniList favourites, IGDB rating). Replace it with a dynamic score that blends API popularity with in-game pick frequency: how often does this character appear in the top-3 probability list during real games? Characters that the engine consistently surfaces are implicitly popular with *this* game's player base. A nightly Cron Trigger Worker recomputes the score from `game_stats` and writes back to D1. The character DB becomes self-calibrating — characters that players care about float up; obscure ones drift down, affecting pool selection and question prioritization.

**Image Aesthetics Scoring via Vision Model**
After downloading and resizing each character image, pass the `thumb.webp` to a vision model (`gpt-4o-mini` with image input, or Workers AI `@cf/llava-1.5-7b-hf`): "Rate this character portrait for: (1) face visibility, (2) art style consistency, (3) character recognizability. Return JSON `{ faceScore, styleScore, recognitionScore }` each 0–1." Store the scores in the image pipeline. During gameplay, prefer high-scoring portraits for the possibility grid (U.3) and GuessReveal. The image pipeline stops being a dumb download-and-resize and starts being a curated selection system. Low-scoring images (blurry, group shots, logo-only) get flagged for replacement.

**Multi-Language Attribute Enrichment**
Run enrichment in English, then a second pass in Japanese (for anime characters) and Spanish (for Latin American characters). Some attributes are better answered by a model prompted in the source language — a character that's `isFromRuralArea: null` in English might be `true` in Japanese because the original source material makes it explicit. Merge the multi-language results using a confidence-weighted majority vote. The pipeline becomes multilingual without the game surface needing to change at all.

---

## Backend & Infrastructure

Grounded in a code audit of `functions/api/`, `_game-engine.ts`, and `wrangler.toml`. These items don't affect gameplay but affect reliability, latency, cost, and debuggability.

### BX — Code Fixes (quick, 1–2 hours each)

Issues found in the current implementation.

| # | Item | Files touched | What's wrong / fix |
|---|------|--------------|---------------------|
| ~~BX.1~~ | ~~**Offload D1 `game_stats` write to `waitUntil`**~~ | ~~`functions/api/v2/game/result.ts`~~ | ~~The `INSERT INTO game_stats` is awaited synchronously before the response returns — adds ~20–50ms latency to every game end. Non-critical write; use `context.waitUntil(d1Run(...).catch(() => {}))` as already done for the `UPDATE game_sessions` call directly below it.~~ |
| ~~BX.2~~ | ~~**Convert dynamic import to static**~~ | ~~`functions/api/v2/game/result.ts`~~ | ~~`getBestGuess` is dynamically imported inside the handler (`await import('../_game-engine')`). Cloudflare Workers re-resolve dynamic imports on each invocation. Move it to a static top-level import — one line change.~~ |
| ~~BX.3~~ | ~~**Cookie-based user ID in LLM rate limiter**~~ | ~~`functions/api/llm.ts`~~ | ~~Uses the deprecated `getUserId()` (IP + header fallback) for rate limiting. Users behind NAT share a rate limit bucket and can be unfairly throttled. Swap to `getOrCreateUserId()` (cookie-based, already used in all v2 routes).~~ |
| ~~BX.4~~ | ~~**Remove dead legacy session format check**~~ | ~~`functions/api/v2/_game-engine.ts`~~ | ~~`loadSession()` checks `'characters' in data` to detect the old full-session format on every load. `SESSION_TTL = 3600` — all legacy sessions expired at least a year ago. Remove the branch; simplify to lean+pool format only.~~ |
| BX.5 | **Separate AI Gateway for preview vs. production** | `wrangler.toml` | Both `env.production` and `env.preview` point to the same `CLOUDFLARE_AI_GATEWAY` URL. Preview LLM calls appear in production cost dashboards and share rate limits. Create a dedicated preview gateway in the Cloudflare AI Gateway dashboard and reference it in `env.preview.vars`. |
| ~~BX.6~~ | ~~**Update `compatibility_date`**~~ | ~~`wrangler.toml`~~ | ~~Set to `"2025-04-01"` — a full year behind. Update to `"2026-04-01"` to pick up Workers runtime improvements, V8 updates, and platform bug fixes shipped in the past year.~~ |
| ~~BX.7~~ | ~~**KV cache for questions and characters list endpoints**~~ | ~~`functions/api/v2/questions.ts`, `characters.ts`~~ | ~~`GET /api/v2/questions` and the unfiltered `GET /api/v2/characters` list hit D1 on every request. Neither changes frequently. Apply the same KV cache pattern already used in `stats.ts` (5-min TTL, `waitUntil` for the write) to eliminate redundant D1 reads.~~ |

### BI — Infrastructure Improvements (config/architecture)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| ~~BI.1~~ | ~~**Enable Workers Observability**~~ | ~~Low~~ | ~~Add `[observability]` `enabled = true` to `wrangler.toml`. Current `catch {}` blocks silently swallow all production errors — no visibility into LLM failures, D1 errors, or KV misses. Tail logs appear in the Cloudflare dashboard with zero code changes.~~ |
| ~~BI.2~~ | ~~**Add `Cache-Control` to API responses**~~ | ~~Low~~ | ~~Workers responses aren't covered by `public/_headers`. Stable GET endpoints (`/api/v2/questions`, `/api/v2/characters`) should return `Cache-Control: public, max-age=60, stale-while-revalidate=300` — lets the Cloudflare edge serve repeat requests without Worker invocations.~~ |
| ~~BI.3~~ | ~~**Request body size guard**~~ | ~~Low~~ | ~~`parseJsonBody` reads the full body with no size cap. A request with a large body consumes Worker CPU. Add a `Content-Length` check in `parseJsonBody`: reject requests over 64 KB with a `413` before calling `.json()`.~~ |
| ~~BI.4~~ | ~~**Deployment checklist: verify `COOKIE_SECRET`**~~ | ~~Low~~ | ~~`_helpers.ts` falls back to `DEV_SECRET = 'dev-insecure-secret-do-not-use-in-production'` if `COOKIE_SECRET` is unset. There's no production guard that fails loudly. Add a startup assertion in `getSigningKey`: if `env.COOKIE_SECRET` is falsy, throw — don't silently use the dev secret.~~ |
| ~~BI.5~~ | ~~**Atomic rate limiting via Durable Objects**~~ | ~~Medium~~ | ~~`checkRateLimit` does KV read → write (non-atomic). Concurrent requests see the same count before any write lands — the limit can be exceeded. Replace with a Durable Object per `{action}:{userId}` — atomic counters via `state.storage`. The canonical Cloudflare solution; teaches DO lifecycle and state management.~~ |

### BE — Backend Explorations

> 🧊 **Icebox** — Deferred indefinitely. Learning-oriented; no implementation timeline.

| # | Exploration | What you'd learn |
|---|------------|-----------------|
| BE.1 | **Workers Analytics Engine for LLM cost tracking** | Replace the KV `costs:{userId}:{date}` records in `llm.ts` with the Workers Analytics Engine (columnar, time-series). Query cost trends by model/user/date from the Cloudflare dashboard without manually enumerating KV keys. Free tier: 100K data points/day. Teaches the Analytics Engine API, which is broadly useful for any Workers project. |
| BE.2 | **Durable Objects for game session state** | Replace KV lean+pool session storage with a DO per game session. Every answer hits the same DO instance — strongly consistent, no KV serialization round-trip, no race on concurrent answer submissions. Teaches DO `state.storage`, `alarm()`, and hibernation API. Trade-off: paid plan required; adds architectural complexity. |

### BP — Backend Pipe Dreams

> 🧊 **Icebox** — Deferred indefinitely. Technically deep; listed for portfolio narrative value.

**Cloudflare Vectorize as the Character Index**
Replace the O(N×Q) Bayesian probability loop with approximate nearest neighbor search. On each answer, embed the current answer state as a vector (`yes/no/maybe/null` per attribute → float[]). Store all characters as pre-computed vectors in Cloudflare Vectorize. `POST /api/v2/game/answer` does a single `vectorize.query()` instead of iterating 500 characters × 50 attributes. The Bayesian engine becomes an embedding update step — a fundamentally different architecture. Teaches: vector databases, ANN search, Vectorize API. The tradeoff: loses the transparency of per-character probability scores (though you can re-derive them from similarity distances).

**Cloudflare Workflows for the Enrichment Pipeline**
The current enrichment is `run-enrich.sh` — a zsh wrapper over `tsx scripts/ingest/run.ts enrich 5`. It has no retry, no pause/resume, no visibility into what's happening. Rewrite it as a Cloudflare Workflow: each character is a Workflow step; failures retry automatically with exponential backoff; the Workflow UI shows exactly where it stalled. Add a step that calls the LLM for attribute filling, a step that writes to D1, a step that uploads images to R2, and a final step that invalidates the KV cache. Teaches: Cloudflare Workflows API, durable execution patterns, which transfer directly to any long-running job system.

**Self-Tuning Engine via Scheduled Worker**
A Cron Trigger Worker runs nightly at 3am: it reads the last 7 days of `game_stats` from D1, computes actual win rate per trigger type vs. the calibration targets, and uses a simple gradient step to adjust `SCORE_MATCH`, `SCORE_MISMATCH`, and `SCORE_MAYBE` stored as KV flags. The live Worker reads scoring constants from KV on every game start instead of compiled-in constants. The engine tunes itself while you sleep — without a code deploy. Teaches: Cron Triggers, KV as a live config store, gradient-based hyperparameter optimization in a production loop.

**R2 Event Notifications → Dominant Color Extraction**
When an admin uploads a new character image to R2, an Event Notification fires a Worker. The Worker fetches the image, runs a 16-color median cut quantization in pure JS over the pixel data (no canvas API needed on Workers), and writes the dominant hex color to D1 `characters.dominant_color`. The `GuessReveal` card then uses this for item 4.3 (ambient character theming) — zero manual work per character. Teaches: R2 Event Notifications, binary data processing in Workers, color quantization algorithms.

**Tail Worker as a Zero-Touch Observability Layer**
Deploy a separate Tail Worker that receives every invocation from the main Worker — errors, CPU time, response status, request path. It parses the tail event and writes structured rows to Workers Analytics Engine: `{ path, status, cpuMs, error, timestamp }`. The dashboard becomes a live API health monitor with no changes to any existing endpoint code. Teaches: Tail Workers (a rarely-used Workers primitive), the Analytics Engine write API, and how to build observability infrastructure without modifying application code.

**Cloudflare Queues for Async Teaching Mode**
Currently when a player submits a new character in teaching mode, the Worker synchronously calls D1 + optionally LLM attribute filling + KV cache invalidation in the response path. Queue it instead: `POST /api/v2/characters` writes a minimal record to D1 and pushes a job to a Cloudflare Queue. A separate consumer Worker processes the enrichment (LLM calls, attribute filling, image upload, cache bust) asynchronously. The player sees "submitted — we'll add it shortly" instead of waiting for 3+ LLM calls to complete. Teaches: Cloudflare Queues, producer/consumer architecture, the decoupling of write path from processing path.

**Character Confusion Graph in D1**
Build a `character_confusions` table: `(character_a, character_b, confusion_count, last_seen)`. After every game loss, record the winner vs. runner-up pair (already available via `secondBestCharacterId`). A weekly Cron Trigger Worker computes the top-20 most-confused pairs and writes the top-N attributes that the two characters *share* to a `distinguishing_gaps` view. The question selection engine can then consult this graph to up-weight questions that differentiate known confusion pairs. The database is literally learning which characters it can't tell apart and prioritizing fixes. Teaches: graph modelling in SQLite, scheduled analytics aggregation, feedback-driven system design.

**A/B Engine via KV Feature Flags**
Add a `variant` field to `game_stats`: `"control"` or `"experiment"`. On game start, read a KV flag `ab:engine:experiment_pct` (e.g. `"20"`). Route that % of games to an alternate scoring constants set (also in KV). Both variants play live games; real-world win rates accumulate in D1 split by variant. After 500 games per variant, a calibration SQL query tells you which set of constants wins in the real world — not just in the simulator. Zero-deploy A/B testing of the engine's core numerics. Teaches: feature flags as a system design pattern, statistical significance in A/B tests, experiment infrastructure at the edge.

---

## Admin Panel

The project already has developer tools — `CostDashboard`, `DataHygiene`, `AttributeCoverageReport`, `AttributeRecommender`, `CategoryRecommender`, `EnvironmentTest`, `MultiCategoryEnhancer`, `QuestionGeneratorDemo` — but they're fragmented: each is a raw `GamePhase` variant (e.g. `'costDashboard'`, `'bulkHabitat'`) accessible only by navigating in code, with no unified UI, no navigation between them, and no auth gate. The admin panel consolidates everything into a single coherent surface.

### AD — Admin Panel (ordered by priority)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| ~~AD.1~~ | ~~**Basic auth gate**~~ | ~~Low~~ | ~~A Worker middleware (or Pages Function `_middleware.ts`) that intercepts all requests to `/admin*` and checks for an `Authorization: Basic` header. Credentials stored as a KV secret (`admin:basic-auth`). Returns `401 WWW-Authenticate: Basic realm="Admin"` on failure — triggers native browser auth dialog, zero JS required. Guards all admin routes at the edge before the SPA loads.~~ |
| ~~AD.2~~ | ~~**Admin shell layout**~~ | ~~Low~~ | ~~A new `AdminShell` component with a persistent sidebar listing every tool by section. Replace the `GamePhase` case-switching in `AdminRouter.tsx` with React Router (already a Vite SPA — just add a `/admin` base route). Each tool gets its own `/admin/cost`, `/admin/coverage`, `/admin/hygiene`, etc. route. URL-addressable, bookmarkable, linkable. No more navigating in code to reach a tool.~~ |
| ~~AD.3~~ | ~~**Consolidate existing tools**~~ | ~~Low~~ | ~~Move all 8 existing admin `GamePhase` variants into the new shell: `CostDashboard`, `DataHygiene`, `AttributeCoverageReport`, `AttributeRecommender`, `CategoryRecommender`, `EnvironmentTest`, `MultiCategoryEnhancer`, `QuestionGeneratorDemo`. Each becomes a route; `AdminRouter.tsx` becomes the shell entry point instead of a phase switch. Remove these variants from `GamePhase` — they don't belong in the game state machine.~~ |
| ~~AD.4~~ | ~~**Enrichment status view**~~ | ~~Medium~~ | ~~A `/admin/enrichment` page that queries `enrichment_status` from D1: total characters enriched vs. pending vs. failed; a sortable table of failures with the stored `error` column; a "retry failed" button that POSTs to a new `POST /api/admin/enrich-retry` endpoint (thin wrapper over the existing CLI logic). The enrichment pipeline status becomes visible without opening a terminal.~~ |
| ~~AD.5~~ | ~~**Pipeline audit log**~~ | ~~Medium~~ | ~~A `/admin/pipeline` page that reads from a new `pipeline_runs` D1 table (one row per character per pipeline step: `fetch`, `dedup`, `enrich`, `image`, `upload`). Provides the full provenance trail from raw API data to D1 row that the EP pipe dream describes — the admin panel is where it surfaces. Filter by character, step, status, or date range. *The aspirational version of this page is the "Pipeline Visual DAG Orchestrator" in AM — same underlying data, rendered as an interactive DAG instead of a log table.*~~ |
| ~~AD.6~~ | ~~**Character manager**~~ | ~~Medium~~ | ~~A `/admin/characters` page: searchable/filterable table of all characters with their attribute coverage %, enrichment status, image thumbnail, and a row-level "re-enrich", "flag for review", and "delete" action. The data already exists across several D1 tables — this is the read layer. Inline editing of individual attribute values (triggers a `PATCH /api/admin/characters/:id/attributes` endpoint).~~ |
| ~~AD.7~~ | ~~**Question manager**~~ | ~~Low~~ | ~~A `/admin/questions` page: paginated list of all questions with their attribute key, usage count (from `game_stats`), skip rate (once AN.1 ships), and average info gain. Inline edit question text; one-click disable/enable via `is_active` flag in D1. Surfaces the low-value questions that C.6 identifies programmatically.~~ |
| ~~AD.8~~ | ~~**Proposed attributes queue**~~ | ~~Medium~~ | ~~A `/admin/proposed-attributes` page that reads from the `proposed_attributes` table that the EP "Automated Attribute Discovery" pipe dream writes to. Each proposed attribute shows sample characters it would apply to, model-generated rationale, and approve/reject buttons. Approved attributes trigger a new row in `attribute_definitions` + an enrichment job for all relevant characters. LLM proposals become actionable without touching the DB directly.~~ |
| ~~AD.9~~ | ~~**Community contributions queue**~~ | ~~Medium~~ | ~~If the Teaching Mode as Community Platform moonshot ships, this `/admin/community` page is the review interface: pending character submissions with their community vote count, auto-enriched attribute preview, and a merge button. Rejected submissions get a brief reason stored for the submitter. The entire moderation workflow happens in the admin panel, not via D1 queries.~~ |
| AD.10 | **Live enrichment dashboard** | Medium | The EN.1 enrichment progress dashboard — currently imagined as a local `localhost:4000` SSE page — promoted to a persistent `/admin/enrich` view inside the panel. SSE endpoint at `GET /api/admin/enrich/stream` pushes `{ character, status, tokensUsed, costSoFar, eta }` events. A "Start enrichment run" button triggers the pipeline via `POST /api/admin/enrich/start` (KV flag + Cron/Queue dispatch). Enrichment is now controllable and observable from the browser without a terminal. |

### AD-Notes

- **Auth model**: Basic auth via Worker middleware is intentionally minimal — this is a solo developer tool, not a multi-user system. The single credential pair is stored in KV (`admin:basic-auth`) so it can be rotated without a deploy. If multiple collaborators ever need access, swap for a Cloudflare Access policy (zero code change to the app).
- **URL scheme**: `/admin/*` served by the same Pages SPA. Vite's `createBrowserRouter` with `basename="/admin"` handles routing; the existing `AppHeader` is hidden for admin routes. The Pages `_redirects` file gets one new rule: `/admin/* /index.html 200`.
- **Not a public feature**: `StatsDashboard` (the player-facing win/loss stats view) stays in the main app flow — it's user data, not a developer tool. Only the internal tooling moves into the admin panel.
- **`GamePhase` cleanup**: removing 8 admin variants from the `GamePhase` union type simplifies `useGameState` significantly — the reducer no longer handles navigation paths that have nothing to do with game state.

### AM — Admin Pipe Dreams: Mission Control

> 🧊 **Icebox** — Deferred indefinitely. These transform the admin panel into a live ops center; no implementation timeline.

These ideas transform the admin panel from a collection of developer tools into a live operations center for the game. The technology is all real and available — the question is just how far to take it.

**Real-Time Game Observatory**
A `/admin/observatory` view that shows every anonymized game happening right now. A Tail Worker attached to the main Worker captures game events (answer submitted, question asked, guess made, game ended) and pipes them into a Cloudflare Queue. A consumer Worker writes them to a time-series table in D1 (or the Analytics Engine). The admin panel SSE-streams a live ticker: *"User in 🇩🇪 answered 'Yes' to isHuman — 47 → 12 candidates remaining. Confidence: 84%."* Below the ticker, a live counter shows games in progress, answers per minute, and the current most-guessed character. It looks like a real-time trading floor for a guessing game. The reasoning panel visualization plays out for every active game simultaneously — a grid of probability bars all moving at once. Zero impact on user-facing latency since Tail Workers run after the response is sent.

**Engine Health Vitals Board**
A `/admin/health` page that is the operational source of truth for the game engine. Six live sparklines pulled from Workers Analytics Engine: win rate (7-day rolling), average questions per game, forced-guess rate, contradiction rate, median confidence at guess time, and LLM error rate. Each sparkline has a colored status indicator: green (within calibration targets), amber (drifting), red (out of bounds — alert fires). Below the sparklines, a "calibration delta" section compares the current real-game metrics against the simulator's last run outputs side-by-side — the split-screen view from AN.8, but live and auto-refreshing. If any metric crosses a threshold, a Cron Trigger Worker fires a notification (KV flag + optional webhook) before the problem is visible to players. The panel doesn't just display the engine's health — it watches it.

**Character Knowledge Graph** *(admin-only — the player-facing equivalent is "The Character Genealogy Map" in Moonshots)*
A `/admin/graph` page: a full D3.js force-directed graph of every character in the database. Three toggleable edge layers: `confused_with` (from the `character_confusions` table — characters the engine most frequently mistakes for each other, edge weight = confusion count), `same_franchise` (from `character_relationships`), and `attribute_neighbors` (characters whose attribute vectors have cosine similarity above a tunable threshold). Node size scales with popularity score; node color maps to category (anime = indigo, movies = amber, etc.); node glow intensity scales with enrichment confidence. Clicking a node expands a floating panel with the character's full attribute profile, image, and a "re-enrich" button. Dragging zooms and pans. A search bar filters to any character by name and animates the graph to center on them. Lasso-select a cluster of nodes and batch-send them to the enrichment queue. The entire knowledge base — visible, navigable, and actionable in one canvas. Uses `d3-force` simulation with `@react-spring/web` for the selection animations.

**Attribute DNA Matrix**
A `/admin/matrix` page: every character (rows) × every attribute (columns) rendered as a color-coded pixel grid — green for `true`, red for `false`, mid-grey for `null/unknown`. At 500 characters × 50 attributes, the entire knowledge base fits on a 1280px canvas with readable cells. D3 renders it as an SVG grid or a `<canvas>` for performance. Hovering a cell shows character name + attribute key + value + confidence score + which model set it. Clicking a cell opens an inline edit popover. Sorting rows by attribute coverage % causes them to animate into position via Framer Motion layout animations. Sorting columns by info gain (from the simulator's per-attribute analysis) reorders the grid so the most discriminating attributes are on the left. The matrix makes the shape of the knowledge base visible at a glance — sparse rows are obvious, correlated column clusters reveal attribute redundancy, the null pattern exposes which attributes the LLM consistently can't answer.

**Pipeline Visual DAG Orchestrator**
A `/admin/pipeline` page rendered not as a log table but as an interactive directed acyclic graph of the enrichment pipeline: `[Fetch Sources] → [Dedup] → [LLM Enrich] → [Image Process] → [D1 Upload] → [Cache Bust]`. Each node is a card showing: current status (idle / running / error), throughput (characters/min), queue depth, error rate, and the last 60 seconds as a mini sparkline. During a live run (once AD.10 ships), the SSE stream animates characters flowing through the graph — a pulsing dot moves from node to node as each pipeline step completes. Clicking a node drills into its log table: every character that passed through, how long it took, any errors. A "pause after this step" toggle lets you inspect intermediate results before committing to the next stage. The pipeline is no longer a black-box shell script — it's a visual, interactive machine you can observe and control.

**LLM Cost Observatory**
A `/admin/cost` page that goes far beyond the existing `CostDashboard`. Pulls from two sources: AI Gateway's native cost metrics (already proxying all LLM calls — zero extra instrumentation needed once BX.5 routes correctly) and the Workers Analytics Engine rows written by the `costs:{userId}:{date}` pattern in `llm.ts`. Shows: cost-per-game by day (bar chart), cost-per-enrichment-run (scatter plot, x = characters processed, y = cost), model comparison (gpt-4o-mini vs. any second model in EN.2), projected monthly cost at current daily burn rate, and a "what-if" slider — drag the enrichment batch size and see projected cost change in real time. A "cost efficiency" score: cost per successful game win. The observatory makes the LLM spend as legible as any SaaS billing dashboard — not a surprising monthly bill but a live instrument.

**A/B Experiment Control Room**
A `/admin/experiments` page that makes the BP "A/B Engine via KV Feature Flags" idea fully operational from the browser. A list of active and completed experiments, each showing: experiment name, traffic split %, sample size accumulated per variant, win rate per variant with 95% confidence intervals, average questions per variant, and a live p-value indicator that turns green when statistical significance is reached (p < 0.05, displayed as "Significant ✓ — ready to call"). Buttons: "Start experiment" (sets KV `ab:*` flags), "Increase traffic to experiment arm", "Declare winner" (sets the winning constants as the new production values, clears experiment flags), "Roll back" (resets to control). The math is all in D1 — a calibration SQL query runs client-side via `fetch('/api/admin/experiments/:id/results')`. No external stats library needed; the confidence intervals are standard Wald intervals computable in 10 lines of TypeScript. Experiment management without touching KV manually or writing SQL.

**Adversarial Stress Test Console**
A `/admin/stress-test` page. Type any character name, click "Run". The panel calls a new `POST /api/admin/stress-test` endpoint that: loads the game engine, runs the deterministic simulator in "adversarial mode" (generating the hardest possible correct-but-misleading answer sequence, as described in the Pipe Dreams section), and streams results back via SSE. The admin panel renders the game unfolding in real time — question by question, the probability bars update, candidates drop off, the engine either closes in or is confused. A "confusion report" at the end shows: the highest-ranked wrong character at each step, the attribute that finally broke the tie, and a list of attributes that if added or corrected would have resolved the confusion earlier. It's a live debugger for the Bayesian engine — find any character's worst-case failure mode without playing hundreds of real games.

**Tail Worker Activity Stream**
A `/admin/logs` page: a live, filterable log of every Worker invocation, rendered like a terminal in the browser. A deployed Tail Worker (from the BP "Tail Worker as Zero-Touch Observability Layer" item) captures `{ path, method, status, cpuMs, wallMs, error, timestamp }` for every request and writes to Workers Analytics Engine. The admin panel polls (or SSE-streams) this data and renders it as a scrolling log with color-coded status: green for 2xx, amber for 4xx, red for 5xx, purple for edge cache hits. Filters: by path prefix (`/api/v2/game/*`), by status code, by CPU time percentile (show me the slowest 10% of requests). Click any row to expand the full request context — headers, CF ray ID, country. A latency histogram at the top updates in real time. No external APM tool. No Datadog. The entire observability stack runs inside Cloudflare and costs nothing beyond what's already deployed. The logs panel is what separates "I deployed a Cloudflare Worker" from "I operate a production system."

---

## Developer Experience

The development loop is already solid — Husky pre-commit, lint-staged, CI with path filtering, Playwright e2e, Vitest unit tests, v8 coverage. These items close the remaining gaps and make the local-to-production cycle as tight as possible.

### DX — Developer Experience (concrete improvements)

| # | Item | Effort | Notes |
|---|------|--------|-------|
| ~~DX.1~~ | ~~**Enable `strict: true` in `tsconfig.json`**~~ | ~~Low~~ | ~~Currently only `strictNullChecks: true` is set. `"strict": true` adds `noImplicitAny`, `strictFunctionTypes`, `strictPropertyInitialization`, and `strictBindCallApply` — the full safety net. The copilot instructions say "avoid `any`" but nothing in the compiler enforces it. Expect ~20–40 type errors on first enable; fixing them will surface latent bugs not caught by tests.~~ |
| ~~DX.2~~ | ~~**Add type-check to `lint-staged`**~~ | ~~Low~~ | ~~The pre-commit hook runs `eslint --fix` on changed `.ts/.tsx` files but not `tsc`. A type error in a changed file passes pre-commit silently and only fails in CI. Add `tsc -b --noCheck` (or `tsc --noEmit --isolatedModules` per-file) to `lint-staged`. Type errors are caught locally before they waste a CI run.~~ |
| DX.3 | **`@cloudflare/vitest-pool-workers` for Workers handler tests** | Medium | Every file in `functions/api/v2/game/**`, `questions.ts`, `characters.ts`, etc. is explicitly excluded from coverage because they require the CF Workers runtime. `@cloudflare/vitest-pool-workers` runs Vitest inside Miniflare — real Workers runtime, local KV + D1 bindings, no mocking required. Route handlers become testable without a deployed environment, and a currently dark coverage zone gets light. |
| DX.4 | **MSW for API-dependent component tests** | Medium | Components that call `/api/v2/*` can't be unit-tested without a running server, so they're skipped. Add [MSW](https://mswjs.io/) (`msw/node` in Vitest): intercept `fetch` at the network layer and return fixture responses. Component tests for `ReasoningPanel`, `QuestionCard`, and game hooks become self-contained and fast, with no server dependency. Fixtures can be generated from the Zod schemas in DP "Zod API Contract Layer". |
| ~~DX.5~~ | ~~**Bundle size budget in CI**~~ | ~~Low~~ | ~~The `vendor-radix` chunk grows silently every time a new shadcn/ui component is added — there's no alarm. Add [size-limit](https://github.com/ai/size-limit) with per-chunk budgets in CI: `vendor-radix ≤ 130 KB gzip`, `vendor-motion ≤ 50 KB gzip`, `vendor-charts ≤ 65 KB gzip`. A chunk that exceeds its budget fails CI. Chunk bloat becomes a deliberate choice, not a surprise on delay.~~ |
| ~~DX.6~~ | ~~**WebKit + mobile viewport in Playwright**~~ | ~~Low~~ | ~~`playwright.config.ts` runs Desktop Chromium and Desktop Firefox only. The game has swipe gestures (`useSwipeAnswer`) and a fully touch-optimized layout — neither is exercised in CI. Add a `Mobile Safari` project (`devices['iPhone 15']`) and a `Mobile Chrome` project (`devices['Pixel 7']`). Move swipe gesture specs into a group that only runs on mobile projects. Safari rendering bugs and touch interaction failures are caught before deploy.~~ |
| ~~DX.7~~ | ~~**Coverage thresholds in CI**~~ | ~~Low~~ | ~~`pnpm test:coverage` generates `lcov.info` but no threshold is enforced — coverage can drop to 0% without a CI failure. Add `coverage.thresholds` in `vitest.config.ts`: `{ lines: 70, functions: 70, branches: 60 }` as a baseline (calibrated to actual current coverage). The number exists to catch accidental regression, not to demand perfection.~~ |
| ~~DX.8~~ | ~~**`eslint-plugin-jsx-a11y`**~~ | ~~Low~~ | ~~The Modern Web section identifies four accessibility gaps. None are caught automatically — there's no a11y linting in `eslint.config.js`. Add `eslint-plugin-jsx-a11y` with the `recommended` rule set. `aria-live`, focus management, and interactive element labelling issues get flagged at lint time instead of discovered during a manual audit.~~ |
| ~~DX.9~~ | ~~**`@typescript-eslint/no-explicit-any` enforcement**~~ | ~~Low~~ | ~~The copilot instructions say "avoid `any`" in function signatures. ESLint enforces `no-unused-vars` but not `no-explicit-any`. Add the rule at `"error"` with `ignoreRestArgs: false`. The few legitimate escape hatches get `// eslint-disable-next-line` comments explaining why — making implicit `any` a deliberate, documented exception rather than invisible drift.~~ |
| DX.10 | **Automated CHANGELOG + release tagging** | Low | `CHANGELOG.md` is maintained by hand. Add [changesets](https://github.com/changesets/changesets): PR authors drop a changeset file; on merge to `main`, a GitHub Action commits the changelog entry and creates a semantic version tag. The git history gets clean `v1.x.y` tags and the CHANGELOG stays accurate automatically — no manual "what did I ship this week?" archaeology. |
| ~~DX.11~~ | ~~**DB types CI drift check**~~ | ~~Medium~~ | ~~`pnpm db:types` runs `scripts/generate-db-types.ts` to produce `functions/api/_db-types.ts` from the D1 schema. This is a manual step — types can silently drift from the schema after any migration lands. Add a CI step that re-runs the generator and runs `git diff --exit-code`; if the output changed, the job fails with the diff. Untracked schema drift becomes a CI failure rather than a runtime surprise.~~ |

### DP — DX Pipe Dreams

> 🧊 **Icebox** — Deferred indefinitely. Best-in-class tooling; not scoped.

A best-in-class development loop. Not scoped — listed because they're worth knowing about.

**Full Storybook Component Catalog**
A Storybook instance (`@storybook/react-vite`) that documents every component in `src/components/` in isolation. Stories cover every meaningful variant: `QuestionCard` with easy vs. hard questions, `GuessReveal` with and without an R2 image, `ReasoningPanel` with 3 candidates vs. 80 candidates, every shadcn/ui primitive in its game-context theming. Interaction tests (`@storybook/addon-interactions`) automate the same user flows Playwright covers end-to-end — faster, no server dependency. Visual snapshot testing catches CSS regressions before Playwright runs. The Storybook build deploys as a Cloudflare Pages preview on every PR — reviewers see the component changes rendered without cloning the repo.

**Zod API Contract Layer**
Replace the manually-generated `_db-types.ts` with a shared Zod schema living in `packages/game-engine/src/schemas.ts`. Workers handlers validate incoming request bodies and outgoing response shapes at the edge using `.parse()`. React hooks import the same schemas for response type inference — not `json as unknown as GameSession`, but `SessionSchema.parse(json)`. Schema mismatches between client and server become runtime-caught + type-checked simultaneously, from a single source of truth. The schemas also serve as MSW fixture generators for DX.4 — one definition file, three uses: validation, type inference, test mocks.

**Turborepo Task Graph**
The monorepo (`packages/game-engine` + root) runs `tsc`, `lint`, and `test` sequentially via `pnpm validate`. Add Turborepo: define a task pipeline (`test` depends on `build`, `build` depends on `game-engine#build`). Tasks that haven't changed since the last run are cache-hits and return instantly. CI benefits most: if only `src/` changed, `packages/game-engine` lint/type-check/test is skipped. If only `packages/game-engine/src` changed, the reverse. The cold-cache run is the same speed as today; the warm-cache run after a small change is near-instant.

**Playwright Visual Regression Baseline**
Extend the existing Playwright suite with screenshot comparison: after each phase transition (`welcome → playing → reveal → win/loss`), Playwright captures a screenshot and diffs it against a committed golden image. Any pixel-level layout regression — a shifted component, a changed color, a missing animation frame — fails CI with a visual diff. Golden images live in `.playwright/snapshots/`; updated explicitly with `--update-snapshots`. Catches CSS regressions that pass type-check, lint, and unit tests. The diff output uploads as a CI artifact, reviewable without checking out the branch.

**Generated Type-Safe API Client**
Every `fetch('/api/v2/game/answer', { method: 'POST', body: JSON.stringify(...) })` call in `src/hooks/` is hand-typed — no compiler guarantee the URL, method, body shape, or response type matches the Worker on the other side. Generate a `src/lib/api.generated.ts` client from the Worker function signatures: a build script parses each `functions/api/v2/` file, extracts request/response types, and emits a typed client. `api.game.answer({ answer: 'yes' })` is then fully type-safe end-to-end — the compiler catches mismatches before runtime. Similar to tRPC but without the framework; works with the existing Cloudflare Pages Functions architecture.

**Full Miniflare Integration Test Suite**
DX.3 makes individual route handlers testable. The next level: a full integration suite that spins up the complete Worker with Miniflare (local D1, KV, R2), seeds test fixtures, and runs the full request-response cycle for every endpoint. Covers: session lifecycle (`start → answer × N → result`), rate limiting (11 LLM calls → 429), cookie signing (tampered cookie → 401), D1 contention (concurrent session writes → consistent state). These tests run in CI on every push and provide full confidence that server-side logic is correct — without a deployed environment or live database. The coverage gap from DX.3 closes entirely.

---

## Phase 2 — Gameplay Depth (Medium-term, 1–4 weeks each)

> 🧊 **Icebox** — Remaining unimplemented items deferred. Completed items are struck through above.

New mechanics that expand replayability without breaking what works.

| # | Item | Why |
|---|------|-----|
| 2.1 | **Reverse mode** | The player picks a character from the DB and the AI *defends* it — player asks yes/no questions; AI answers based on attributes. Complete role reversal. |
| 2.2 | **Hint system** | Player can request a hint at any point: reveals one binary attribute ("this character can fly"). Costs 2 questions from the remaining budget. Adds strategy. |
| 2.3 | **Multi-guess with drama** | Instead of one final guess, the AI gets 3 guesses — each with a higher confidence threshold. Dramatic reveal sequence; last guess plays the full typewriter + ring animation. |
| 2.4 | **Speed mode** | 60-second countdown per session (not per question). Keyboard answers are essential here — desktop only. Timer shown as a sweeping arc instead of a number. |
| 2.5 | ~~**Personal best tracking**~~ ✅ | ~~Track lowest question count to win per difficulty in `localStorage`. Surface as "Personal Best: 7 questions" on the win screen with a "new record" burst animation.~~ Done: `usePersonalBest` hook, displayed on `WelcomeScreen` + burst animation on `GameOver`. |
| ~~2.6~~ | ~~**Suspense reveal animation**~~ | ~~On final guess, reveal the character name one letter at a time (typewriter, ~80ms/char) with a subtle drumroll via Web Audio. Purely theatrical — highly memorable. Already partially staged in `GuessReveal`.~~ |
| 2.7 | ~~**Warm/cold proximity indicator**~~ ✅ | ~~After each answer, flash "Getting warmer 🔥" or "Going cold 🧊" based on whether the top candidate's score moved up or down. Gamification without spoiling.~~ Done: `PlayingScreen` tracks `prevTopProbRef`; delta ≥6 → warm badge, ≤-6 → cold badge, auto-dismiss 2.2s. |
| ~~2.8~~ | ~~**Decisive question highlight**~~ | ~~On game over (win or loss), star the single question that caused the biggest probability jump. "This question cracked it." Reinforces the Bayesian narrative.~~ |
| 2.9 | ~~**AI confidence sparkline**~~ ✅ | ~~In `ReasoningPanel`, add a 12-point mini sparkline of the top candidate's score over the game so far. Visual proof of the narrowing — already have `Recharts`.~~ Done: `ReasoningPanel` renders a Recharts `LineChart` sparkline of `confidenceHistory[]` when ≥3 data points exist. Also added a top-3 probability trace chart (`PossibilitySpaceChart`) in the right column. |

---

## Phase 3 — Social & Replayability (Longer-term, project weekends)

> 🧊 **Icebox** — Remaining unimplemented items deferred. Completed items are struck through above.

Features that make people come back and bring friends.

| # | Item | Why |
|---|------|-----|
| 3.1 | **Challenge a friend link** | Encode a specific character ID + salt into a shareable URL. Friend plays the same character; results compared side-by-side. Uses existing `sharing.ts` base64 encoding. |
| 3.2 | **Custom character lists** | Let users create a named list of character IDs (stored in `localStorage`). Play against only their list — great for family/friend groups with shared fandoms. |
| ~~3.3~~ | ~~**Achievement badges**~~ | ~~Unlockable badges stored in `localStorage`: "Speed Demon" (win ≤5q), "Stubborn" (use all questions), "Teacher" (submit 10 corrections), "Perfect Week" (daily streak ×7). Shown on welcome screen.~~ |
| 3.4 | **Improved teaching mode UX** | Current flow is functional but one long form. Redesign as a wizard: (1) character name, (2) confirm auto-detected attributes, (3) fill gaps manually, (4) submit. Progress indicator between steps. |
| ~~3.5~~ | ~~**Weekly recap card**~~ | ~~Every Monday, show "Last week:" — games played, win rate, streak, hardest character. Computed from `IndexedDB` game history. Zero server cost.~~ |
| 3.6 | **Bento grid stats dashboard** | Replace the flat stat rows in `StatsDashboard` with a CSS grid bento layout — large "Win Rate" tile, smaller supporting tiles. Looks much stronger as a portfolio piece. |
| 3.7 | **Voice input (experimental)** | Web Speech API "Yes / No / Maybe" recognition — triggers only on user permission. Fun party trick; fully degradable if unsupported. |

---

## Phase 4 — Showcase & Portfolio Polish (Ongoing)

> 🧊 **Icebox** — Remaining unimplemented items deferred. Completed items are struck through above.

Items that make the project stand out as a demo piece.

| # | Item | Why |
|---|------|-----|
| 4.1 | **"How the AI thinks" explainer page** | A static `/how-it-works` route with step-by-step Bayesian scoring walkthrough + a live embedded mini-demo. Demonstrates depth of thinking — strong for portfolios. |
| 4.2 | **Replay mode** | After a game, re-animate the full question sequence with probability scores updating in real time. Shareable link encodes the replay. Shows off the Bayesian engine visually. |
| 4.3 | **Ambient character color theming** | Extract the dominant color from the character's R2 image (small canvas script on the Worker). Use it as the accent tint on the `GuessReveal` card — the UI literally adapts to the character. |
| 4.4 | **Character suggestion page** | A simple `/suggest` route — visitors nominate characters via a form stored in D1. You review and merge. Turns passive visitors into contributors without requiring auth. |
| 4.5 | **Offline-first full game** | Currently PWA-registered but not fully offline-playable. Bundle a representative 100-character subset into the service worker cache. Works on a plane. |
| ~~4.6~~ | ~~**Adaptive difficulty prompt**~~ | ~~After 10+ games, analyze the player's recent win rate and prompt: "You've won 9 of your last 10 on Medium — try Hard?" Shown as a dismissible toast on the welcome screen.~~ |
| 4.7 | **AI-generated character portraits** | For characters missing an R2 image, call `@cf/stabilityai/stable-diffusion-xl-base-1.0` via Workers AI to generate and cache a portrait. Zero manual asset work. |

---

## Modern Web Platform Opportunities

These are browser/platform capabilities that are either new or underused here. Each one has low implementation cost and high demo value.

### CSS & Layout

| Technique | Where to apply | Benefit |
|-----------|---------------|---------|
| ~~**View Transitions API**~~ ✅ | ~~Game phase changes (`welcome → playing → reveal`)~~ | ~~Native cross-fade/morph between phases~~ Done: `startViewTransition()` helper in `src/lib/view-transitions.ts` wraps all `navigate` calls in `App.tsx`. Falls back gracefully on unsupported browsers. |
| **CSS Scroll-driven Animations** | Answer history pills, possibility grid rows | Entries animate in as they scroll into view — zero JS, respects `prefers-reduced-motion` automatically |
| **`@starting-style`** | Any newly inserted DOM element (toasts, overlays) | Entry animations (fade, slide) without JS — just CSS. Reduces the number of `AnimatePresence` wrappers needed |
| **Container Queries** | `ReasoningPanel`, `QuestionCard` | These components should adapt to *their container*, not the viewport — container queries are the right tool, not breakpoints |
| **CSS Anchor Positioning** | Keyboard shortcut popover, hint tooltip | Popovers that follow their trigger element without JS position calculation |
| **`color-mix()`** | Theme tokens | Mix primary/accent colors at build time — cleaner than Tailwind opacity modifiers, more expressive |

### Browser APIs

| API | Use case | Notes |
|-----|---------|-------|
| **Popover API** (`popover` attribute) | Keyboard shortcut overlay, skip-question tooltip | Zero-JS dismissible overlays; native focus trap + Escape key handling built in |
| **Web Share API** | Share card + native share (items 1.2 + 1.4) | `navigator.share()` triggers OS native share sheet on mobile; fall back to clipboard on desktop |
| **Page Visibility API** | Speed mode timer (item 2.4) | Pause countdown when the tab is hidden; resume when visible |
| **`scheduler.postTask()`** | Question scoring / candidate filtering | Runs heavy scoring off the main thread with priority hints; keeps the UI responsive during AI "thinking" |
| **`navigator.wakeLock`** | Active gameplay | Prevents the screen from dimming mid-game on mobile |
| **`requestIdleCallback`** | Analytics flush, IndexedDB writes | Defer non-critical writes to idle time — free performance |
| **`ResizeObserver`** | Bento grid layout (item 3.6) | Drive layout breakpoints from container size, not window size |

### Performance Patterns

| Pattern | Where | Benefit |
|---------|-------|---------|
| **Streaming UI** | `ReasoningPanel` | Token-by-token render from existing `llm-stream.ts` — feels instant instead of "thinking then snap" |
| **Optimistic updates** | Answer submission | Update probability scores on click before server confirms; roll back on error. Eliminates the visible lag between answer and next question |
| **`startTransition`** | Phase changes, dashboard loads | Mark non-urgent state updates so React 19 can keep the current UI interactive during the transition |
| **Speculation Rules API** | Welcome → Playing navigation | Prefetch the `/api/v2/game/start` response speculatively when the user hovers "Start Game" |
| **Canvas confetti** | Game win state | Replace the current CSS-div confetti with a single `<canvas>` element — same visual, far fewer DOM nodes |

### Accessibility Gaps

| Gap | Fix |
|-----|-----|
| Screen reader announcements | `aria-live="polite"` on the question text so assistive tech reads new questions automatically |
| Focus management on phase change | `useEffect` to `focus()` the first interactive element when the game phase changes |
| Color contrast on amber/rose buttons | Audit answer buttons against WCAG 2.1 AA — amber in particular often fails on light backgrounds |
| `prefers-reduced-motion` on sparkline | The future confidence sparkline should disable its entry animation if motion is reduced |

---

## Icebox (Good Ideas, No Rush)

Parked here so they don't get lost, but not prioritized.

- **Multiplayer party mode** — real-time websocket game where players compete to guess the same character fastest (Cloudflare Durable Objects)
- **Story mode / campaign** — 10-character arc with a narrative wrapper (e.g., "Identify the villain across 10 rounds")
- **Character of the week** — a curated pick (manually set in a KV flag) highlighted with a subtle "featured" badge on the welcome screen
- **Answer confidence slider** — single horizontal slider (Definitely No ← → Definitely Yes) instead of 4 buttons; maps to the same 4 buckets
- **Leaderboard** — global daily challenge leaderboard (fewest questions to win); requires auth which adds complexity
- **Localization** — Spanish, French, Japanese character sets; requires translated attributes
- **Native app (PWA install prompt)** — explicit "Add to home screen" prompt with A2HS banner
- **Isometric character grid** — CSS isometric variant of the possibility grid. Visually novel but doesn't add information over U.2; style over function
- **Spatial answer history** — SVG arc layout where pill height = info gain. Too abstract for casual players; U.4 (answer history weight) achieves the same legibility goal more clearly
- **Streaming probability updates** — incremental per-answer Bayesian recalculation instead of full batch. Meaningful optimization only at 10K+ characters; premature for the current 500-character pool

---

## Pipe Dreams (Wacky AI/LLM Ideas)

> 🧊 **Icebox** — No timelines. No promises. Deferred indefinitely.

No timelines. No promises. Just "wouldn't it be wild if..."

**The AI Argues Back**
When the player answers in a way that contradicts a previous answer, instead of silently adjusting probabilities, the AI calls it out in character: *"You told me earlier they can't fly — but now you're saying they're airborne? Enlighten me."* Uses the contradiction detector to trigger an LLM-generated pushback line. The player can double down or correct themselves.

**Player Psychological Profile**
After 5+ games, the LLM analyzes the player's answer patterns from `IndexedDB` and generates a one-paragraph "you as a guesser" personality report: *"You tend to think in absolutes — rare maybes, fast answers. You probably do well on hard mode but your instinct to over-specify sometimes tricks you."* Unlockable from the stats dashboard. Pure novelty, surprisingly accurate.

**The AI Bluffs**
On Easy difficulty, occasionally (10% of games) the AI already knows the character by question 3 but keeps asking questions anyway — building a false sense of suspense before a confident reveal. Controlled by a KV flag. The post-game narrative winks at it: *"I had you at question 3, but where's the fun in that?"* Illusion of drama; technically trivial.

**Lore Mode**
Instead of naming the character at the end, the AI delivers a 3-sentence lore excerpt about them — written in the style of their fictional universe — and the player has to identify them from that alone. An optional second layer after the guess. GPT-4o can nail this for well-known characters. *"He is the last son of a doomed world, raised beneath a yellow sun..."*

**Multi-character Crossover Round**
Generate a question that's simultaneously about two characters from different universes: *"Could this character defeat the last character you played against in a fight?"* Uses `GameHistory` from `IndexedDB` + LLM to generate a contextual crossover question. Totally chaotic, unexpectedly engaging.

**The AI Gets Nervous**
At >90% confidence, inject a single line of theatrical self-doubt into the reasoning panel — something the persona would say: *"I'm almost certain... but I've been wrong before."* Then make the guess. Pure theater that makes the reveal feel higher-stakes. One LLM call or even a hardcoded rotating set of 10 lines — no real cost.

**"Describe Yourself" Mode**
The player doesn't pick a character — they describe themselves using the same attribute questions. At the end, the AI guesses which fictional character they most resemble and why. Wildly shareable. Uses the inverse of the Bayesian engine: character → attributes → closest match. *"Based on your answers: you are most like Hermione Granger (83% match)."*

**Adversarial Character Stress Test**
*Fully specced as the "Adversarial Stress Test Console" in the AM section of the Admin Panel.* Short version: type a character name, hit Run, watch the simulator play adversarially in the browser question by question, get a confusion report at the end showing the hardest-to-distinguish alternatives and which attributes would resolve them. See AM for the implementation plan.

**The AI Writes Fan Fiction**
After a loss (AI didn't guess correctly), the AI generates a 2-sentence micro-story where the character the AI guessed instead meets the character the player was actually thinking of. Consolation prize. *"Batman found himself face-to-face with Zorro. They argued for an hour about who had the better cape."* One LLM call, pure delight.

**Living Character Bios**
Each character in the DB gets an LLM-generated 2-sentence bio written in the AI's detective persona — generated once, cached in KV. On the guess reveal screen, instead of just a name and image, the AI presents the bio as if reading from a case file: *"Subject: SpongeBob SquarePants. Occupation: fry cook. Known associates: a dim-witted starfish. Considered enthusiastic and deeply unhinged."* Batch-generate offline using the admin panel.

---

## Moonshots

> 🧊 **Icebox** — Alternate futures for the project. No timelines, no current priority.

Ideas at a different scale — not features or improvements, but alternate futures for what this project could become. No timelines. Listed here because they're worth thinking about.

**A Game That Plays Itself**
An autonomous demo mode: the engine picks a character at random, an LLM plays the role of asker (generating questions from the existing question bank), the Bayesian engine plays the guesser (updating probabilities on each answer), and a second LLM call answers each question based on the character's stored attributes. The full game plays out on screen — question by question, probability bars updating, dramatic reveal, confetti or silence — then loops to the next character. Leave it running at a conference booth, on a portfolio page, or open during a video interview. The game demonstrates its own sophistication without a human sitting down to play. Architecturally, it's two LLM calls per question with the existing engine wired between them. Could run as a `/demo` route that auto-plays after 30 seconds of inactivity.

**Crowdsourced Attribute Voting**
After each completed game, surface one `null` or low-confidence attribute for the revealed character: *"Quick — is [Character Name] [attribute]?"* One tap. D1 stores the vote in a `community_votes(character_id, attribute_key, vote, user_hash)` table. A nightly Cron Worker aggregates: 10+ concordant votes → attribute auto-updated with `source: "community"` and `confidence: 0.85`. Zero LLM cost. Zero prompt engineering. Every completed game becomes a passive micro-crowdsourcing task — the player base collectively becomes the enrichment pipeline. Over time, the rarest and most obscure characters get filled in by the players most invested in them. The DB improves continuously through play, not through batch jobs.

**The Character Genealogy Map** *(player-facing `/explore` page — the admin-only equivalent is "Character Knowledge Graph" in AM)*
An interactive `/explore` page: a D3.js force-directed graph where every character is a node. Three edge types: `confused_with` (from the `character_confusions` table in BP), `same_franchise` (from the `character_relationships` table in EP), and `attribute_neighbors` (cosine similarity of attribute vectors above a threshold). Node size scales with popularity score; color maps to category; clicking a node expands the full attribute profile and highlights the character's nearest neighbors. The entire knowledge graph — 500+ characters — visible at once and navigable. The kind of visualization that makes someone stop and say *"I didn't know this was underneath a guessing game."* Equal parts technical depth and portfolio showpiece. Filterable by category, linkable by character ID.

**Dual Engine Race — "The Detective" vs. "The Oracle"**
Two AI architectures compete against each other on the same character, rendered side-by-side. The Detective is the current hybrid: structured Bayesian probability engine + LLM question phrasing, transparent probability scores visible at every step. The Oracle is pure GPT-4o — receives the full game history as context and reasons to its conclusion from first principles, no structured probability model, just emergent in-context reasoning. Both engines draw from the same question bank; the one that guesses correctly in fewer questions wins. Results feed into the simulator: over thousands of races, which paradigm is actually smarter? The answer is probably "it depends on character type" — which is itself interesting. In a portfolio context, this is the most honest and dramatic answer to "how does AI know?" you can show a non-technical audience.

**Teaching Mode as a Community Platform**
Elevate Teaching Mode from a power-user form into a full community contribution system. Submitted characters enter a `/community` queue visible to all players. Others upvote, add missing attributes, or flag inaccuracies — one attribute at a time, no account required. Characters reaching ≥20 upvotes auto-trigger the enrichment pipeline: LLM attribute fill, image fetch from the source API, confidence scoring computed. An admin reviews the enriched result and merges in one click. Contribution loop: *submit → community validates → auto-enrich → admin merge*. Uses `getOrCreateUserId()` cookies throughout — no auth required. Over time, Teaching Mode becomes the primary growth mechanism for the game's content. Players become co-authors of the AI's world model.

**The Self-Documenting Codebase**
An AI agent runs on a schedule (nightly Cron Trigger or GitHub Actions cron) that reads every file in `src/`, `functions/`, and `packages/game-engine/src/`, then produces three outputs: (1) a fresh `ARCHITECTURE.md` that reflects what the code actually does today, not what it did when the doc was last edited; (2) a drift report listing every discrepancy between the current `ARCHITECTURE.md` and reality — renamed files, added endpoints, changed data flows; (3) a one-paragraph "what changed this week" summary derived from the git log. The AI doesn't write the roadmap — that's still intentional human thinking. But it keeps the reference documentation honest. Architecture docs that stay synchronized with the code without manual maintenance. The kind of operational discipline that usually only exists in teams with dedicated technical writers.

**Zero-Config New Character Category**
Adding a new character category today means: write attribute definitions, update the enrichment config, add simulator weights, possibly write a migration. It's a multi-file, multi-step process with no obvious starting point. A single CLI command — `pnpm ingest:new-category --name "anime-villains"` — triggers a wizard that: (1) asks for 5 example characters in the category; (2) calls GPT-4o to propose a set of distinguishing attributes for that category based on the examples; (3) writes the attribute schema; (4) generates a seed migration; (5) configures enrichment targets; (6) adds simulator weights extrapolated from the closest existing category. The category is ready to ingest. Adding a new content type goes from "a day of scaffolding" to "a 5-minute conversation with a CLI." The real magic: the AI designs its own expansion without manual prompt engineering — it understands the attribute system well enough to propose what distinguishes one category from another.

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04 | No monetization, no auth | Portfolio project — simplicity and focus over growth mechanics |
| 2026-04 | Cloudflare-only infra | Zero cold starts, generous free tier, single vendor for deploy simplicity |
| 2026-04 | No leaderboard (yet) | Requires auth; complexity not worth it without an audience |
| 2026-04 | Bayesian engine, not LLM-only | LLM alone is too slow and expensive per question; hybrid is faster and cheaper |
| 2026-04 | Backend audit findings | result.ts dynamic import + blocking D1 write are quick wins; BX.1–BX.7 are all low-risk, high-ROI fixes |
| 2026-04 | DO for sessions = paid plan | Durable Objects require Workers Paid ($5/mo). KV session storage is sufficient for portfolio scale; revisit if DO atomic guarantees become necessary |
| 2026-04 | Cut command palette (1.10) | 4 navigation destinations don't need cmd+k in a casual game — they're already in the header |
| 2026-04 | Cut themed packs (2.4) | Category filter chips already do this; named packs would just be preset chip configurations |
| 2026-04 | Cut 3.5 (streaming reasoning) | Exact duplicate of B.2; B.2 is the canonical backlog item |
| 2026-04 | CSS Houdini flagged learning-only | Chrome-only API; Safari/Firefox users get silent fallback. Not worth shipping to production |
| 2026-04 | Analytics section renamed A→AN | Avoids prefix collision with AI & LLM Layer "A" series (A.1–A.5); both used "A" |
| 2026-04 | E.7 removed from tech explorations | Already present in Icebox with the same rationale; removing the duplicate |
| 2026-04 | EP Workflow paragraph removed | Near-duplicate of BP "Cloudflare Workflows for the Enrichment Pipeline"; BP is the canonical item with more infrastructure detail |
| 2026-04 | Admin panel uses Basic auth (not Cloudflare Access) | Solo developer tool — shared secret in KV is sufficient and zero-cost. Cloudflare Access ($3/user/mo) is overkill unless collaborators are added |
| 2026-04 | StatsDashboard stays in main app | It's player-facing data (their own win/loss stats), not a developer tool; only internal tooling moves into the admin panel |
| 2026-04 | Admin panel removes admin GamePhases from GamePhase union | Admin tool navigation has no business in the game state machine; routing by URL is cleaner and enables bookmarking |
| 2026-04 | Phase 2 renumbered — gaps closed | Item 2.4 (themed packs) was cut in a prior pass; 2.5–2.10 renumbered to 2.4–2.9 for clean sequential numbering |
| 2026-04 | Phase 3 renumbered — gaps closed | Item 3.5 (streaming reasoning) was cut in a prior pass; 3.6–3.8 renumbered to 3.5–3.7 for clean sequential numbering |
| 2026-04 | Pipe Dreams "Adversarial Stress Test" deferred to AM | The Admin Panel "Adversarial Stress Test Console" (AM) is the full implementation spec; the Pipe Dreams entry now references it to avoid duplication |
| 2026-04 | Developer Experience section added | Audit of `tsconfig.json`, `eslint.config.js`, `playwright.config.ts`, `vitest.config.ts`, `lint-staged`, and CI workflows revealed 11 concrete gaps; each DX item is grounded in a real observed deficiency rather than aspirational tooling |
| 2026-05 | Persona replaces difficulty label | `Difficulty` remains the internal state (`'easy'|'medium'|'hard'`); `Persona` is a pure display + prompt concern derived via `DIFFICULTY_TO_PERSONA`. Two concerns, one source of truth. |
| 2026-05 | `correctionJudge_v1` uses raw factual voice | Unlike all other prompts, this is a fact-checker role — no detective persona. Injecting theatrical Poirot voice into an attribute-accuracy judge would degrade accuracy. |
| 2026-05 | `'describeYourself'` added to `GamePhase` | The "Describe Yourself" screen uses the same question pool and character scoring logic as the main game — it's a game phase, not a separate app. `GamePhase` union extended; lazy-loaded into `App.tsx`. |
| 2026-04 | Admin panel (AD.1–AD.9) live in production | Basic auth gate (`_middleware.ts` + KV `admin:basic-auth`), React Router admin shell (`AdminShell`, `AdminApp`), all 9 management routes, D1 migrations 0022–0025 applied to production |
| 2026-04 | AN.2 + AN.5 shipped | `dropped_at_phase` column added to `game_sessions` (migration 0024); `client_events` table + `POST /api/v2/events` endpoint live in production (migration 0025) |
| 2026-05 | EN.2–EN.6 + EP automated discovery + adversarial validation shipped | Multi-model consensus voting via OpenRouter (`--model2`), per-attribute confidence heuristics (0.85/0.65), `--new-attrs-only` incremental flag, source overlap heatmap (`data/overlap.html`), enrichment changelog (`data/enrich-log.md`), LLM attribute discovery pipeline (`discover-attrs` command + `proposed_attributes` D1 table), and skeptic-LLM adversarial validation (`--validate`, `attribute_disputes` table, `/admin/disputes` UI) all implemented; migration 0026 applied to both environments |
| 2026-05 | `fetchGlobalCharacters` attributes_json fix | D1 v2 characters endpoint returns denormalized `attributes_json` TEXT; `sync.ts` now parses it (0→false, 1→true); `AttributeCoverageReport` guards with `?? {}` |

---

*Last updated: May 2026 · v1.4.0*
