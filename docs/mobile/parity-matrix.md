# iOS Feature Parity Matrix

**Last Updated**: 2026-05-07 | **Version**: 1.1 | **MP.1 Status**: ✅ Closed (2026-05-07) | **MP.2 Status**: ✅ Closed (2026-05-07)

Living registry of feature parity state across web and iOS. Updated with every mobile PR that touches a parity feature (add owner initials + evidence link to the row's Evidence column).

---

## Core Features (In Scope for MP.1-MP.7)

| Feature Area | Web Source | iOS Surface | State | Target Level | Parity | Divergence | Owner | Last Verified | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| **Welcome Screen** | GamePhaseRouter → WelcomeScreen | `screens/WelcomeScreen.tsx` | ✅ Shipped | L2 | L2 | None (identical flow) | mobile | 2026-05-05 | `screen-quality-scores.json` (Welcome-L2-production) |
| **Playing Screen** | GamePhaseRouter → PlayingScreen | `screens/PlayingScreen.tsx` | ✅ Shipped | L2 | L2 | Native haptics on answer; web shows confetti only | mobile | 2026-05-05 | `screen-quality-scores.json` (Playing-L2-production), `device-validation-checklist.md` (haptics ✓, VoiceOver ✓, reduce-motion ✓) |
| **Guessing Phase** | GamePhaseRouter → GuessReveal | `screens/GuessingScreen.tsx` | ✅ Shipped | L2 | L2 | None (identical reveal flow) | mobile | 2026-05-05 | `screen-quality-scores.json` (Guessing-L2-production) |
| **Game Over Screen** | GamePhaseRouter → GameOver | `screens/GameOverScreen.tsx` | ✅ Shipped | L2 | L2 | Native share via RN Share API | mobile | 2026-05-05 | `screen-quality-scores.json` (GameOver-L2-production) |
| **Challenge Screen** | GamePhaseRouter → ChallengeView | `screens/ChallengeScreen.tsx` | 🟡 Partial | L2 | L1 | Leaderboard summary-first (perf); web shows full board | mobile | 2026-05-04 | `screen-quality-scores.json` (Challenge-L1-partial) |
| **Stats & Streaks** | GamePhaseRouter → StatsRoute | `screens/StatsScreen.tsx` → `/stats` route | ✅ Shipped | L1 | L1 | MVP: streak counter, session count, avg questions, win rate | mobile | 2026-05-07 | `screen-quality-scores.json` (Stats-L1-mvp) |
| **Game History** | GamePhaseRouter → HistoryRoute | `screens/HistoryScreen.tsx` → `/history` route | ✅ Shipped | L1 | L1 | MVP: past game list, filter by timeframe, outcome + questions | mobile | 2026-05-07 | `screen-quality-scores.json` (History-L1-mvp) |
| **Player Compare** | GamePhaseRouter → CompareRoute | `screens/CompareScreen.tsx` → `/compare` route | ✅ Shipped | L1 | L1+ | Insights-backed: percentile band, difficulty win-rate deltas, top attribute signals | mobile | 2026-05-07 | `screen-quality-scores.json` (Compare-L1-mvp), `mobileInsights.ts` derivation tests |
| **Session Resume** | Session state hook | `screens/SessionResumeScreen.tsx` → `/resume` route | ✅ Shipped | L1 | L1 | MVP: resume/start-over prompt with progress bar | mobile | 2026-05-07 | `screen-quality-scores.json` (SessionResume-L1-mvp) |
| **Player Preferences** | GamePhaseRouter → PreferencesRoute | `screens/PreferencesScreen.tsx` → `/preferences` route | ✅ Shipped | L1 | L1+ | Persisted locally via AsyncStorage (difficulty + accessibility toggles) | mobile | 2026-05-07 | `screen-quality-scores.json` (Preferences-L1-mvp), device local persistence check |
| **Teaching Mode** | GamePhaseRouter → TeachingRoute | `screens/TeachingScreen.tsx` → `/teaching` route | ✅ Shipped | L1 | L1 | MVP: 2-lesson walkthrough (yes/no questions, narrowing strategy) | mobile | 2026-05-07 | `screen-quality-scores.json` (Teaching-L1-mvp) |
| **Post-Game Feedback** | GamePhaseRouter → PostGameFeedbackRoute | `screens/PostGameFeedbackScreen.tsx` → `/feedback` route | ✅ Shipped | L1 | L1+ | Posts to `/api/v2/game/feedback` with rating + optional comment | mobile | 2026-05-07 | `screen-quality-scores.json` (PostGameFeedback-L1-mvp), feedback API integration |

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
| **Challenge Leaderboard** | Summary-first design (top 10 only, not full board) | Perf/payload optimization for 5–6" screens; full board causes scroll jank. Web shows 100-entry board; mobile shows summary card. | 2026-05-07 | Approved for MP.5 (documented in `ios-feature-parity-plan.md` MP.5 section) |

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
