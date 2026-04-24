# Changelog

All notable changes to this project are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added

- **Blur-to-reveal on GuessReveal (U.6)** — both character images in `GuessReveal` now animate from `blur(20–24px) scale(1.15)` to sharp over 1.5s using Framer Motion, paired with the existing spring-physics scale entrance
- **Thinking animation search pulse (U.9)** — `ThinkingCard` in `QuestionCard.tsx` replaces the 4 generic shimmer blocks with a 4×8 dot grid that pulses in left-to-right waves, visually suggesting the engine sweeping through candidates
- **Undo ripple (U.10)** — when the player clicks Undo in `PlayingScreen`, the last answer pill flashes a 200ms red glow before `UNDO_LAST_ANSWER` dispatches; undo button is disabled during the flash to prevent double-undos

### Changed

- **Win intensity celebration (U.7)** — `ConfettiBurst` in `GameOver` now scales particle count and spread by `questionsAsked`: ≤5 questions → full burst (50 desktop particles, wider spread) + **"Uncanny!"** heading; ≤10 questions → medium burst + "I Got It Right!"; >10 / last question → 3 particles + **"Just in time."** heading; `maxQuestions` prop added to `GameOverProps` and wired from `App.tsx`

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
