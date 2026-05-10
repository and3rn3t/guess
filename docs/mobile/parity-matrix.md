# iOS Feature Parity Matrix

**Last Updated**: 2026-05-09 | **Version**: 1.5 | **MP.1 Status**: ✅ Closed (2026-05-07) | **MP.2 Status**: ✅ Closed (2026-05-07) | **MP.3 Status**: ✅ Closed (2026-05-09) | **MP.4 Status**: ✅ Closed (2026-05-09) | **MP.5 Status**: ✅ Closed (2026-05-09) | **Reality Reset**: Applied for current branch

Living registry of feature parity state across web and iOS. Updated with every mobile PR that touches a parity feature (add owner initials + evidence link to the row's Evidence column).

This matrix reflects the active branch truth. If a feature is not implemented in the current tree, it remains `⬜ Missing` regardless of historic status in archived plans.

---

## Core Features (In Scope for MP.1-MP.7)

| Feature Area | Web Source | iOS Surface (Target) | State | Target Level | Parity | Divergence | Owner | Last Verified | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| **Welcome Screen** | GamePhaseRouter → WelcomeScreen | `SwiftUI/WelcomeView` | ⬜ Missing | L2 | — | None planned | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |
| **Playing Screen** | GamePhaseRouter → PlayingScreen | `SwiftUI/PlayingView` | ⬜ Missing | L2 | — | Native haptics planned | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |
| **Guessing Phase** | GamePhaseRouter → GuessReveal | `SwiftUI/GuessingView` | ⬜ Missing | L2 | — | None planned | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |
| **Game Over Screen** | GamePhaseRouter → GameOver | `SwiftUI/GameOverView` | ⬜ Missing | L2 | — | Native share planned | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |
| **Challenge Screen** | GamePhaseRouter → ChallengeView | `screens/ChallengeScreen.tsx` | ✅ Shipped | L2 | L2 | Summary-first; top-10 daily leaderboard; multi-guess attempt badges in PlayingScreen/GuessingScreen; seasonal leaderboard deferred (no server endpoint) | andernet | 2026-05-09 | MP.5 commit; PlayingScreen guessCount + cooldown UX; GuessingScreen attempt label |
| **Stats & Streaks** | GamePhaseRouter → StatsRoute | `screens/StatsScreen.tsx` | ✅ Shipped | L2 | L2 | Mobile-first: simplified charts, derived streak from history (no dedicated endpoint) | andernet | 2026-05-09 | MP.3 commit 6db3f51; live `/api/v2/stats` + `/api/v2/history`; streak, achievements, difficulty breakdown |
| **Game History** | GamePhaseRouter → HistoryRoute | `screens/HistoryScreen.tsx` | ✅ Shipped | L2 | L2 | Mobile-first list (8 recent games; full board deferred) | andernet | 2026-05-09 | MP.3 commit 6db3f51; live `/api/v2/history`; outcome colour-coded, difficulty badge |
| **Player Compare** | GamePhaseRouter → CompareRoute | `SwiftUI/CompareView` | ⬜ Missing | L1→L2 | — | Insight density reduced on small screens | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |
| **Session Resume** | Session state hook | `screens/ResumeScreen.tsx` | ✅ Shipped | L1 | L1 | Resume prompt on welcome; no auto-save banner yet | andernet | 2026-05-09 | MP.3 commit 6db3f51; wired to `resumeGame` API |
| **Player Preferences** | GamePhaseRouter → PreferencesRoute | `screens/PreferencesScreen.tsx` | ✅ Shipped | L2 | L2 | Persona cards (Poirot/Watson/Sherlock) match web PersonaSelector; difficulty wired to startGame | andernet | 2026-05-09 | MP.4 commit 1b2d9ff; difficulty applied to POST /api/v2/game/start |
| **Teaching Mode** | GamePhaseRouter → TeachingRoute | `SwiftUI/TeachingView` | ⬜ Missing | L1→L2 | — | Guided-card onboarding style planned | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |
| **Post-Game Feedback** | GamePhaseRouter → PostGameFeedbackRoute | `screens/FeedbackScreen.tsx` | ✅ Shipped | L1 | L1 | 1–5 star rating + notes; POST to `/api/v2/game/feedback` | andernet | 2026-05-09 | MP.3 commit 6db3f51; success/error states wired |

---

## MP.6 Operational Surfaces (Reliability In Progress)

| Surface | State | Notes | Evidence |
|---|---|---|---|
| Connection status indicator | ✅ Implemented | Global top-banner with online/limited/offline status and sync pill. | `apps/mobile/src/screens/ConnectionStatusBanner.tsx`, `apps/mobile/src/network/useMobileConnectionStatus.ts` |
| Low-bandwidth warning | ✅ Implemented | Dismissible modal shown on cellular/limited network tone. | `apps/mobile/src/screens/LowBandwidthWarningModal.tsx` |
| Sync status badge | ✅ Implemented | Reusable badge on gameplay/feedback surfaces with queued-action awareness. | `apps/mobile/src/screens/SyncStatusBadge.tsx` |
| Offline queue + replay | ✅ Implemented | AsyncStorage-backed queue for result/feedback with reconnect flush behavior. | `apps/mobile/src/network/mobileOfflineQueue.ts`, `apps/mobile/src/network/mobileGameApi.ts`, `apps/mobile/src/network/useMobileOfflineQueue.ts` |
| Transport retry | ✅ Implemented | GET requests retry once on transport errors before surfacing failure. | `apps/mobile/src/network/mobileGameApi.ts`, `apps/mobile/src/network/mobileGameApi.test.ts` |
| MP.6 route audit + evidence | ✅ Complete | All 10 feature routes verified for resilience surfaces (sync badge, connection status, offline graceful degradation). Route-by-route audit table finalized in ios-feature-parity-plan.md. | `docs/mobile/ios-feature-parity-plan.md` (Route Integration Status table, MP.6 section) |
| MP.6 perf/offline evidence package | 🟡 Pending | Device p95 timings and airplane-mode recordings are still required for MP.6 closeout; 50+ queue durability is covered in tests. In-app p95 diagnostics are available on the Stats screen, and execution steps are documented in the device validation checklist. | `docs/mobile/ios-feature-parity-plan.md` (MP.6 Done When), `apps/mobile/src/network/mobileOfflineQueue.test.ts`, `apps/mobile/src/screens/StatsScreen.tsx`, `docs/mobile/device-validation-checklist.md` |

---

## Parity Levels Legend

- **✅ Shipped L2**: Feature complete, UX matches web, device tests pass (scorecard ≥90).
- **🟡 Partial L2**: Feature partially complete (e.g., leaderboard top-10 only), acceptable divergence documented.
- **⬜ Missing L1**: Feature not yet implemented; target is L1 (functional) or higher as noted.
- **— (blank)**: Not yet assigned / not started.

---

## Exception Register

| Feature | Exception | Rationale | Decision Date | Status |
|---|---|---|---|---|
| **Challenge Leaderboard** | Summary-first design (top 10 only, not full board) | Perf/payload optimization for 5–6" screens; full board causes scroll jank. Web shows 100-entry board; mobile shows summary card. | 2026-05-07 | Planned for MP.5 |

---

## Deferred Features (Out of Scope for Initial Parity, MP.7+)

| Feature Area | Why Deferred | Target Release | Notes |
|---|---|---|---|
| **Question Manager** | Admin surface; explicitly out of initial scope | MP.9 or later (admin track) | Requires ACL/admin state management not yet ported to mobile. |
| **Describe Yourself** | Onboarding complexity; lower priority than active gameplay | MP.8 or later | Persona ML training depends on sufficient game data first. |
| **Team Leaderboards** | Scope expansion; blocked on multi-player session support | Post-MP.7 | Requires shared game session state management (future work). |

---

## How to Update This Matrix

**For Every Mobile PR**:
1. Identify which parity feature row(s) your PR touches.
2. Update the row's **State** if your PR completes/ships the feature.
3. Add your initials to **Owner** (or leave blank if not assigned yet).
4. Add **Evidence** links:
   - `screen-quality-scores.json` entry (if scorecard completed)
   - Device validation checklist link (if device testing completed)
   - API trace/telemetry (if performance verified)
   - Screen recording link (if archived for review)
5. Update **Last Verified** to today's date.
6. If your PR introduces an intentional divergence, add a row to the Exception Register.

**Example PR Entry**:
```markdown
| **Stats & Streaks** | GamePhaseRouter → StatsRoute | `screens/StatsScreen.tsx` | ✅ Shipped | L2 | L2 | None | jdoe | 2026-05-15 | screen-quality-scores.json (entry: Stats-L2-prMerge), device-validation-checklist.md (iPhone SE tap-to-render: 95ms) |
```

**Marking Milestone Complete**:
When a milestone (MP.1, MP.2, etc.) is completed:
1. Mark all its associated features ✅ Shipped (or 🟡 Partial if intentional).
2. Update ROADMAP.md entry to ✅ + date.
3. Update `ios-feature-parity-plan.md` Done When checklist.
4. Commit all in a single `docs(mobile): ship MP.X` commit.

---

## State Shorthand

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete and meeting parity level target |
| 🟡 | Partial; acceptable divergence or in-progress |
| ⬜ | Not started; missing from iOS |
| — | Not assigned / placeholder |

---

## See Also

- `ios-feature-parity-plan.md` — milestone planning, dependencies, quality gates, sequencing guardrails.
- `ROADMAP.md` → Mobile (iOS App) → Foundations Queue — active MP.* queue and status.
- `screen-quality-scorecard.md` — how to score features and what ≥88/≥90/≥92 thresholds mean.
- `device-validation-checklist.md` — checklist for physical iPhone testing (haptics, VoiceOver, reduce-motion, lifecycle).
