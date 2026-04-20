# Changelog

All notable changes to this project are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased] — 2026-04-20

### Changed

- **Soft scoring resilience** — `SCORE_MISMATCH` raised from `0.0` → `0.05`; a single wrong/inconsistent answer no longer permanently zeros out the correct character
- **Fuzzy hard-filter** — `filterPossibleCharacters` now tolerates 1 mismatch (`MAX_MISMATCHES=1`) before eliminating a character, preventing premature elimination from one bad answer
- **Singleton guard** — AI no longer guesses on a singleton candidate until at least 5 questions have been asked (was 0), avoiding false-confident guesses early in the game
- **Zero-candidates fallback** — if all candidates are eliminated (contradictory answers), the engine now forces a guess rather than stalling
- **`detectContradictions` accuracy** — fixed to use the hard-filter count rather than soft probability scores, so contradiction detection is consistent with filtering logic
- Deleted 3 duplicate questions from production DB (`q176` isFromMovie, `q171` isVideoGameCharacter, `q177` isFromBook) that caused double-elimination when the same question appeared twice

### Added

- **User answer reveal on loss** — when the AI fails to guess, `GameOver` now shows a "Who were you thinking of?" input field
- `POST /api/v2/game/reveal` endpoint — accepts the character name + session Q&A answers:
  - Fuzzy-matches the name against `characters` table (exact then LIKE)
  - Backfills `null` attribute values with confidence 0.5 from confident yes/no answers
  - Queues `system:reveal:` correction votes in KV for any contradicting attribute values
  - Stores a `game_reveals` audit row regardless of whether the character was found
- `game_reveals` D1 table — stores `actual_character_name`, `actual_character_id`, `answers` (JSON), `attributes_filled`, `discrepancies`, `created_at`
- Migration `0016_game_reveals.sql` applied to both production and preview databases

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
