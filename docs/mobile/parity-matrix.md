# iOS Feature Parity Matrix

**Last Updated**: 2026-05-10 | **Version**: 1.6 | **MP.1 Status**: ✅ Closed (2026-05-07) | **MP.2 Status**: ✅ Closed (2026-05-07) | **MP.3 Status**: ✅ Closed (2026-05-09) | **MP.4 Status**: ✅ Closed (2026-05-09) | **MP.5 Status**: ✅ Closed (2026-05-09) | **MP.6 Status**: 🟡 In Progress

Living registry of feature parity state across web and iOS. Updated with every mobile PR that touches a parity feature (add owner initials + evidence link to the row's Evidence column).

This matrix reflects the active branch truth for the current React Native / Expo mobile app in `apps/mobile/app/index.tsx` and `apps/mobile/src/screens/**`. Historical SwiftUI target names remain useful as product mapping labels, but branch-truth parity is determined by the shipped RN surfaces in this repo.

---

## Core Features (In Scope for MP.1-MP.7)

| Feature Area | Web Source | iOS Surface (Target) | State | Target Level | Parity | Divergence | Owner | Last Verified | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Welcome Screen** | GamePhaseRouter → WelcomeScreen | `screens/WelcomeScreen.tsx` | ✅ Shipped | L2 | L2 | Offline start guard and resume/challenge entry are intentionally integrated into one mobile-first landing surface. | andernet | 2026-05-10 | `apps/mobile/src/screens/WelcomeScreen.tsx`, `apps/mobile/app/index.tsx` |
| **Playing Screen** | GamePhaseRouter → PlayingScreen | `screens/PlayingScreen.tsx` | ✅ Shipped | L2 | L2 | Sync-state and resilience affordances are surfaced inline instead of via separate diagnostics-only UI. | andernet | 2026-05-10 | `apps/mobile/src/screens/PlayingScreen.tsx`, `apps/mobile/app/index.tsx` |
| **Guessing Phase** | GamePhaseRouter → GuessReveal | `screens/GuessingScreen.tsx` | ✅ Shipped | L2 | L2 | Multi-guess and reject-guess runtime remains mobile-first but parity-equivalent in outcome. | andernet | 2026-05-10 | `apps/mobile/src/screens/GuessingScreen.tsx`, `apps/mobile/app/index.tsx` |
| **Game Over Screen** | GamePhaseRouter → GameOver | `screens/GameOverScreen.tsx` | ✅ Shipped | L2 | L2 | Result submission is queue-backed for offline safety; native share remains lightweight. | andernet | 2026-05-10 | `apps/mobile/src/screens/GameOverScreen.tsx`, `apps/mobile/app/index.tsx` |
| **Challenge Screen** | GamePhaseRouter → ChallengeView | `screens/ChallengeScreen.tsx` | ✅ Shipped | L2 | L2 | Summary-first; top-10 daily leaderboard; seasonal full-board deferred (no server endpoint). | andernet | 2026-05-10 | `apps/mobile/src/screens/ChallengeScreen.tsx`, `apps/mobile/app/index.tsx` |
| **Stats & Streaks** | GamePhaseRouter → StatsRoute | `screens/StatsScreen.tsx` | ✅ Shipped | L2 | L2 | Mobile-first cards and derived streaks; includes MP.6 diagnostics instead of a web-style analytics dashboard. | andernet | 2026-05-10 | `apps/mobile/src/screens/StatsScreen.tsx`, `apps/mobile/src/perf/mobilePerfMetrics.ts` |
| **Game History** | GamePhaseRouter → HistoryRoute | `screens/HistoryScreen.tsx` | ✅ Shipped | L2 | L2 | Mobile-first recent-session list; full board remains intentionally deferred on small screens. | andernet | 2026-05-10 | `apps/mobile/src/screens/HistoryScreen.tsx`, `apps/mobile/app/index.tsx` |
| **Player Compare** | GamePhaseRouter → CompareRoute | `screens/CompareScreen.tsx` | ✅ Shipped | L2 | L2 | Insight density is reduced for handheld scanability, but percentile, difficulty, and category comparisons are present. | andernet | 2026-05-10 | `apps/mobile/src/screens/CompareScreen.tsx`, `apps/mobile/app/index.tsx` |
| **Session Resume** | Session state hook | `screens/ResumeScreen.tsx` | ✅ Shipped | L1 | L1 | Resume prompt is explicit on mobile; cold-start session ID durability now preserves the last resumable session. | andernet | 2026-05-10 | `apps/mobile/src/screens/ResumeScreen.tsx`, `apps/mobile/src/state/mobileSessionDurability.ts` |
| **Player Preferences** | GamePhaseRouter → PreferencesRoute | `screens/PreferencesScreen.tsx` | ✅ Shipped | L2 | L2 | Persona cards, difficulty, category filters, and local persistence are mobile-native and production-wired. | andernet | 2026-05-10 | `apps/mobile/src/screens/PreferencesScreen.tsx`, `apps/mobile/src/state/mobilePreferences.ts` |
| **Teaching Mode** | GamePhaseRouter → TeachingRoute | `screens/TeachingScreen.tsx` | ✅ Shipped | L1 | L1 | Guided lessons are shipped as a mobile-first teaching surface rather than a 1:1 web layout port. | andernet | 2026-05-10 | `apps/mobile/src/screens/TeachingScreen.tsx`, `apps/mobile/src/screens/teachingProgress.ts` |
| **Post-Game Feedback** | GamePhaseRouter → PostGameFeedbackRoute | `screens/FeedbackScreen.tsx` | ✅ Shipped | L1 | L1 | Feedback submission supports offline-safe queuing and replay instead of requiring immediate connectivity. | andernet | 2026-05-10 | `apps/mobile/src/screens/FeedbackScreen.tsx`, `apps/mobile/src/network/mobileOfflineQueue.ts` |

---

## MP.6 Operational Surfaces (Reliability In Progress)

| Surface | State | Notes | Evidence |
| --- | --- | --- | --- |
| Connection status indicator | ✅ Implemented | Global top-banner with online/limited/offline status and sync pill. | `apps/mobile/src/screens/ConnectionStatusBanner.tsx`, `apps/mobile/src/network/useMobileConnectionStatus.ts` |
| Low-bandwidth warning | ✅ Implemented | Dismissible modal shown on cellular/limited network tone. | `apps/mobile/src/screens/LowBandwidthWarningModal.tsx` |
| Sync status badge | ✅ Implemented | Reusable badge on gameplay/feedback surfaces with queued-action awareness. | `apps/mobile/src/screens/SyncStatusBadge.tsx` |
| Offline queue + replay | ✅ Implemented | AsyncStorage-backed queue for result/feedback with reconnect flush behavior. | `apps/mobile/src/network/mobileOfflineQueue.ts`, `apps/mobile/src/network/mobileGameApi.ts`, `apps/mobile/src/network/useMobileOfflineQueue.ts` |
| Transport retry | ✅ Implemented | GET requests retry once on transport errors before surfacing failure. | `apps/mobile/src/network/mobileGameApi.ts`, `apps/mobile/src/network/mobileGameApi.test.ts` |
| MP.6 route audit + evidence | ✅ Complete | All 10 feature routes verified for resilience surfaces (sync badge, connection status, offline graceful degradation). Route-by-route audit table finalized in ios-feature-parity-plan.md. | `docs/mobile/ios-feature-parity-plan.md` (Route Integration Status table, MP.6 section) |
| MP.6 perf/offline evidence package | ✅ Complete | Physical-device p95 and offline airplane-mode evidence captured and validated (2026-05-10). All thresholds met: tap-to-feedback 31.6ms, transition-start 32.1ms, feedback-to-next-question 29.8ms. Offline no-crash pass, queue behavior, and reconnect flush verified. Evidence: `docs/mobile/screenshots/2026-05-10-mp6-*.{png,mov}`. | `package.json` (`mobile:reliability-gate`), `.github/workflows/mobile-ci.yml`, `apps/mobile/src/network/mobileOfflineQueue.test.ts`, `apps/mobile/src/screens/StatsScreen.tsx`, `docs/mobile/device-validation-checklist.md` |

---

## Parity Levels Legend

- **✅ Shipped L2**: Feature complete, UX matches web, device tests pass (scorecard ≥90).
- **🟡 Partial L2**: Feature partially complete (e.g., leaderboard top-10 only), acceptable divergence documented.
- **⬜ Missing L1**: Feature not yet implemented; target is L1 (functional) or higher as noted.
- **— (blank)**: Not yet assigned / not started.

---

## Exception Register

| Feature | Exception | Rationale | Decision Date | Status |
| --- | --- | --- | --- | --- |
| **Challenge Leaderboard** | Summary-first design (top 10 only, not full board) | Perf/payload optimization for 5–6" screens; full board causes scroll jank. Web shows 100-entry board; mobile shows summary card. | 2026-05-07 | Planned for MP.5 |

---

## Deferred Features (Out of Scope for Initial Parity, MP.7+)

| Feature Area | Why Deferred | Target Release | Notes |
| --- | --- | --- | --- |
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
| --- | --- |
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
