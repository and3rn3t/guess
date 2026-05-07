# iOS Feature Parity Plan

**Effective**: 2026-05-07 | **Supersedes**: `roadmap-foundations.md` (detail) and `ios-master-plan.md` (strategy)

This document is the canonical source for iOS feature parity execution. It defines:
- **Parity scope**: core gameplay + player-facing features (exclude power-user/admin initially)
- **Parity levels**: L1 (functional), L2 (UX-quality), L3 (operational/polished)
- **Milestones**: MP.1-MP.7 with sequencing guardrails and evidence requirements
- **Quality gates**: scorecard evidence + device validation required for each milestone

For feature-level status and exception tracking, see `parity-matrix.md`. For queue/status, see `ROADMAP.md` (MP.* series).

---

## Parity Levels

| Level | Definition | Mobile Equivalent | Evidence |
|-------|------------|-------------------|----------|
| **L1** | Functional | Feature renders, interactions work, data flows | Screen recordings, interaction tests |
| **L2** | UX-Quality | Matches web UX (visual, animation, accessibility), native conventions | Screen-quality-scorecard entries (≥88), device validation logs |
| **L3** | Operational | Performance <100ms tap-to-feedback, <150ms transition start, handles offline/low bandwidth | Profiling traces, device telemetry from field beta |

---

## Milestones (MP.1-MP.7)

### MP.1: Foundation Closeout & Parity Matrix Seed

**Goal**: Lock MB prerequisite evidence, finalize parity-matrix feature registry, prepare for feature work.

**Parity Target**: L1 functional baseline mapped in matrix.

**Dependencies**: MB.1, MB.2, MB.4 complete; MB.5 evidence finalized.

**Features In**: None (closure-only milestone).  
**Features Out**: None.

**API Dependencies**: None new.

**Surfaces**: Update parity-matrix.md with initial feature states (Welcome/Playing/Guessing/GameOver = shipped L2; Challenge = partial L2; Stats/History/etc = missing L1).

**Quality Gates**:
- ✅ Screen-quality-scorecard: All 5 core screens ≥88 (prMerge gate) and ≥90 (milestone gate).
- ✅ Device validation: Haptics, VoiceOver, reduce-motion, lifecycle all verified on physical iPhone.
- ✅ Mobile guardrails: No web-port drift detected (boundary check clean).

**Done When**:
- [ ] MB.3 evidence documented (Welcome/Playing/Guessing/GameOver/Challenge phase transitions recorded).
- [ ] MB.5 acceptance finalized (scorecard entry + device checklist signed off).
- [ ] `parity-matrix.md` seeded with all 10 core features, initial state assignments, and owner field populated.
- [ ] `ROADMAP.md` migrated from MB-series to MP-series queue.
- [ ] No regressions: `pnpm validate` green, mobile guardrails PASS.

**Evidence Artifacts**:
- `docs/mobile/parity-matrix.md` (feature registry)
- `docs/mobile/screen-quality-scores.json` (MB.1-MB.5 completion evidence)
- `docs/mobile/device-validation-checklist.md` (device test results)
- `ROADMAP.md` (MP.1 marked ✅ + MPs marked in queue)

**Risks / Rollback**:
- **Risk**: MB.5 evidence incomplete (scorecard gaps). *Mitigation*: Complete missing scorecard entries before MP.1 closure.
- **Risk**: Phase transition evidence lost. *Mitigation*: Recording saved to `docs/mobile/archive/2026-05-07-phase-transitions.md`.

---

### MP.2: Navigation Shell & Phase Router Expansion

**Goal**: Implement missing player-facing phase routes (Teaching, Stats, History, Compare, SessionResume, PostGameFeedback, Preferences).

**Parity Target**: L1 functional for all phases; L2 UX-quality for core 5 (Welcome/Playing/Guessing/GameOver/Challenge).

**Dependencies**: MP.1 closure complete.

**Features In**: Teaching, Stats, History, Compare, SessionResume, PostGameFeedback, Preferences.  
**Features Out**: Admin routes (Question Manager, Describe Yourself, Team Leaderboard — post-MP.7 scope).

**API Dependencies**:
- `GET /api/v2/game/{id}` (game history)
- `GET /api/v2/games?limit=10&offset=0` (player history)
- `GET /api/v2/characters/{id1}/compare/{id2}` (character compare, if needed)
- `POST /api/v2/player/teaching-mode/{id}` (teaching mode entry)

**Surfaces**: 7 new Expo Router screens + state wiring in GameContext.

**Quality Gates**:
- ✅ Screen-quality-scorecard: Teaching/Stats/History/Compare ≥88 (prMerge) and target ≥90 (milestone).
- ✅ Device validation: Tap-to-screen-render <300ms on iPhone 12 (acceptable for feature depth).

**Done When**:
- [ ] All 7 routes wired to GamePhaseRouter state transitions.
- [ ] Each route renders with placeholder content and production API integration.
- [ ] Screen quality scores updated (≥88 for prMerge gate).
- [ ] Device validation confirms tap-to-render times acceptable.
- [ ] `parity-matrix.md` updated: 7 features marked "shipped L1" or "partial L2" with owner signatures.

**Evidence Artifacts**:
- Screen recordings (7 new phases in action)
- `docs/mobile/screen-quality-scores.json` (MP.2 entries added)
- Device profiling traces (tap-to-render, transition timing)

**Risks / Rollback**:
- **Risk**: API latency balloons (especially `GET /api/v2/games?limit=10`). *Mitigation*: Pagination, caching via SWR/React Query.
- **Risk**: Screen quality scores miss gate due to animation cost. *Mitigation*: Defer heavy animations to MP.5 or replace with CSS-driven entry effects.

---

### MP.3: Player Insights & Personalization (I)

**Goal**: Ship per-player stats surfaces: session streaks, achievement badges, question difficulty heatmaps, guess success rates.

**Parity Target**: L2 UX-quality for Stats/History surfaces; mobile-specific divergence allowed (e.g., charts simplified for small screens).

**Dependencies**: MP.2 complete; Stats/History routes wired.

**Features In**: Streak counter, achievement leaderboard, question difficulty heatmap, guess success rates (per category).  
**Features Out**: Team leaderboards, global leaderboards (MP.5+).

**API Dependencies**:
- `GET /api/v2/analytics/player/summary` (session stats)
- `GET /api/v2/analytics/player/streaks` (streak data)
- `GET /api/v2/analytics/question-difficulty` (heatmap data)

**Surfaces**: Stats screen, History screen (expanded), Achievement badge UI component.

**Quality Gates**:
- ✅ Screen-quality-scorecard: Stats/History/Achievements ≥88 (prMerge) and ≥90 (milestone).
- ✅ Device validation: Charts render in <200ms on low-end device (iPhone SE).

**Done When**:
- [ ] All 3 surfaces render with real data (production API + mobile caching).
- [ ] Charts/heatmaps adapted for 5–6" screens (not 1:1 web port).
- [ ] Screen quality scores ≥90.
- [ ] Device validation confirms acceptable performance on SE.
- [ ] `parity-matrix.md` updated: Stats/History/Achievements marked "shipped L2" with owner signatures.

**Evidence Artifacts**:
- Screen-quality-scores.json entries
- Device profiling (chart render times on low-end device)
- API call traces (caching hits vs misses)

**Risks / Rollback**:
- **Risk**: Heatmap rendering blocks main thread. *Mitigation*: Render to canvas or lazy-load cells.
- **Risk**: Stats surface feels cluttered on small screen. *Mitigation*: Redesign for mobile-first (fewer cells per row, vertical stacking).

---

### MP.4: Gameplay Depth & Personalization (II)

**Goal**: Personalization surfaces, player preferences, save/resume mechanics, post-game feedback loop.

**Parity Target**: L2 UX-quality (if possible in timeline); L1 functional acceptable as fallback.

**Dependencies**: MP.3 complete; Analytics surfaces stable.

**Features In**: Player preferences (difficulty, question pool), Session resume (auto-save state), Post-game feedback form, PersonaSelector (refine player model).  
**Features Out**: Team player setup (MP.6+).

**API Dependencies**:
- `POST /api/v2/player/preferences` (save difficulty, pool selection)
- `GET /api/v2/player/session/{id}/resume` (auto-save state)
- `POST /api/v2/player/feedback` (submit post-game feedback)

**Surfaces**: Preferences screen, Session resume banner (if auto-save triggered), Post-game feedback modal, PersonaSelector overlay.

**Quality Gates**:
- ✅ Screen-quality-scorecard: Preferences/Feedback ≥88 (prMerge).
- ✅ Auto-save reliability: 100% save success rate on test device.

**Done When**:
- [ ] Preferences screen wired to API and reflects in next game session.
- [ ] Session resume correctly restores game state (question, history, posterior).
- [ ] Feedback form submits and triggers analytics ingestion.
- [ ] `parity-matrix.md` updated: Preferences/Resume/Feedback marked as target.

**Evidence Artifacts**:
- Screen recordings (preferences update → next game reflects choice)
- Auto-save reliability telemetry
- Feedback submission logs

**Risks / Rollback**:
- **Risk**: Auto-save triggers false positives (resume offered when not needed). *Mitigation*: Set high threshold (game >1 minute old).
- **Risk**: Preferences not applied to API response. *Mitigation*: Add player context to bootstrap request.

---

### MP.5: Daily Challenge & Seasonal Depth

**Goal**: Ship daily challenge surface, seasonal leaderboard, multi-guess modes.

**Parity Target**: L2 UX-quality for Challenge; intentional divergence from web (summary-first instead of full-board for perf).

**Dependencies**: MP.4 complete; Analytics stable.

**Features In**: Daily challenge surface (summary-first design), seasonal challenge leaderboard (top 10, not all), multi-guess game mode.  
**Features Out**: Full global leaderboard, team-based challenges.

**API Dependencies**:
- `GET /api/v2/challenges/daily/{date}` (today's challenge)
- `POST /api/v2/challenges/daily/{date}/submit` (submit challenge guess)
- `GET /api/v2/leaderboards/challenges/seasonal?limit=10` (top 10 leaderboard)

**Surfaces**: Challenge detail screen (mobile-optimized), Challenge leaderboard (top 10 only), Multi-guess mode in Playing screen.

**Quality Gates**:
- ✅ Screen-quality-scorecard: Challenge/Leaderboard ≥88 (prMerge) and ≥90 (milestone).
- ✅ Device validation: Summary render <150ms (even on low-end device).
- ✅ Leaderboard scroll performance: <60ms per scroll frame.

**Done When**:
- [ ] Challenge summary renders with player's previous attempt and today's meta (# guesses, top guesses).
- [ ] Leaderboard loads and scrolls smoothly (60fps target).
- [ ] Multi-guess mode integration confirmed in Playing screen state machine.
- [ ] `parity-matrix.md` updated: Challenge/Leaderboard marked "shipped L2" with owner + evidence links.

**Evidence Artifacts**:
- Screen-quality-scores.json entries (Challenge/Leaderboard)
- Device profiling (render times, scroll fps)
- Leaderboard API response telemetry

**Risks / Rollback**:
- **Risk**: Leaderboard query times out (full SQL query too expensive). *Mitigation*: Pre-compute top 10 nightly, cache in KV.
- **Risk**: Multi-guess state machine breaks existing game flow. *Mitigation*: Feature-flag behind `multiGuessEnabled` context flag, default off until MP.5 ship.

---

### MP.6: Reliability & Performance Gate

**Goal**: Ensure all shipped features meet operational baselines (L3): <100ms tap-to-feedback, <150ms transition start, offline-first UX, network-resilient state sync.

**Parity Target**: L3 operational for all 10+ features.

**Dependencies**: MP.5 complete; all features shipped and in beta.

**Features In**: Network resilience layer (SWR/React Query upgrades), Offline state indicators, Low-bandwidth mode (adaptive image sizing), Background sync queue.  
**Features Out**: None (maintenance + hardening only).

**API Dependencies**: No new endpoints (use existing with enhanced caching/retry logic).

**Surfaces**: Connection status indicator (top-of-screen), Low-bandwidth warning modal, Background sync badge on answers/feedback.

**Quality Gates**:
- ✅ Device validation: p95 tap-to-feedback <100ms, p95 transition start <150ms across all 10 features (iPhone SE).
- ✅ Offline resilience: All surfaces gracefully degrade (no crashes, state preserved).
- ✅ Network profiling: 100% of API calls cache-aware; retry logic logs telemetry.
- ✅ Screen-quality-scorecard: No regressions from MP.5.

**Done When**:
- [ ] Performance profiling complete (all features meet <100ms, <150ms gates).
- [ ] Offline mode tested on device (enable airplane mode, verify no crashes, state persists).
- [ ] Background sync queue handles 50+ pending answers without data loss.
- [ ] Network resilience layer integrated into all 10 feature routes.
- [ ] `parity-matrix.md` updated: All features marked "shipped L3" with performance + offline evidence.

**Evidence Artifacts**:
- Device profiling traces (tap-to-feedback, transition timing per feature)
- Offline mode test recordings
- Network telemetry logs (cache hit rates, retry counts)
- Background sync durability test results

**Risks / Rollback**:
- **Risk**: Performance targets unmet on SE (due to heavy analytics). *Mitigation*: Disable intra-game analytics on low-end device, log only on game completion.
- **Risk**: Offline state becomes stale (user edits answer locally, server has different state). *Mitigation*: Strict conflict-free merge strategy (server always wins; show undo prompt if local edits lost).

---

### MP.7: Release & Handoff Gate

**Goal**: Final parity validation, documentation handoff to Xcode team, appstore submission prep.

**Parity Target**: L2+ for all core + player-facing features (L1 acceptable only with documented exceptions).

**Dependencies**: MP.6 complete; all features ≥L2 quality gates.

**Features In**: None (validation only).  
**Features Out**: None.

**API Dependencies**: None new.

**Surfaces**: Release notes, handoff README (Xcode continuity), Changelog entry in `CHANGELOG.md`.

**Quality Gates**:
- ✅ Parity matrix: 10+ core features all marked ✅ (shipped L2+) with evidence links + owner signatures.
- ✅ Screen-quality-scorecard: All features ≥90 (production gate).
- ✅ Device validation: All tests green on iPhone 12 + SE.
- ✅ Guardrails: Mobile boundary checks + shared-core tests all pass.
- ✅ CI/CD: E2E tests green for all mobile flows.

**Done When**:
- [ ] `parity-matrix.md` finalized: all features ✅, all evidence linked, all owners signed.
- [ ] `ROADMAP.md` MP.7 marked ✅ with date.
- [ ] Handoff README updated in `docs/mobile/xcode-claude-memory-handoff.md` with known edge cases + mobile-specific API behaviors.
- [ ] Release notes drafted in `CHANGELOG.md` (version TBD, likely 2.0.0 or 1.2.0).
- [ ] AppStore submission readiness verified (TestFlight build passes review, no known crashes).

**Evidence Artifacts**:
- Finalized `parity-matrix.md`
- `CHANGELOG.md` release entry
- Handoff README
- AppStore submission checklist (signed off)

**Risks / Rollback**:
- **Risk**: AppStore review rejects due to privacy/compliance issue. *Mitigation*: Pre-submission review with privacy/legal; test in TestFlight for 1+ week.
- **Risk**: Last-minute blocker (e.g., iOS 18 incompatibility). *Mitigation*: Maintain `1.x-lts` branch for prior iOS versions if needed; communicate timeline to stakeholders.

---

## Sequencing Guardrails

1. **No feature work (MP.2+) before MP.1 closure** — prerequisite evidence must be locked.
2. **No MP.3+ start before MP.2 complete** — player insights depend on navigation infrastructure.
3. **MP.5 cannot start until MP.4 complete** — challenge leaderboard depends on personalization state.
4. **MP.6 is mandatory before MP.7** — operational baselines must be met before release.
5. **Evidence required for closure** — no milestone marks ✅ without artifact links in `parity-matrix.md`.

---

## How to Update This Document

- **Milestone scope change**: Edit the "Features In/Out" section and record decision in `ROADMAP.md` Decision Log.
- **Quality gate change**: Edit "Quality Gates" and update acceptance in `parity-matrix.md` (one row per feature).
- **Evidence artifact added**: Link it in the milestone's "Evidence Artifacts" section and in `parity-matrix.md` (Evidence column).
- **Milestone completed**: Mark `ROADMAP.md` entry ✅ with date; update all feature rows in `parity-matrix.md` to reflect new state.

---

## See Also

- `parity-matrix.md` — living feature-by-feature parity status and exception register.
- `ROADMAP.md` → Mobile (iOS App) section — queue and status (MP.* series).
- `docs/mobile/README.md` — full mobile docs index and read order.
- `native-product-contract.md` — quality bar and acceptance criteria (per-feature).
- `native-surface-policy.md` — boundaries and what is out-of-scope for iOS.
