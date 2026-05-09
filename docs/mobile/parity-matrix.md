# iOS Feature Parity Matrix

**Last Updated**: 2026-05-09 | **Version**: 1.2 | **MP.1 Status**: ✅ Closed (2026-05-07) | **MP.2 Status**: ✅ Closed (2026-05-07) | **Reality Reset**: Applied for current branch

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
| **Challenge Screen** | GamePhaseRouter → ChallengeView | `SwiftUI/ChallengeView` | ⬜ Missing | L2 | — | Summary-first leaderboard retained | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |
| **Stats & Streaks** | GamePhaseRouter → StatsRoute | `SwiftUI/StatsView` | ⬜ Missing | L2 | — | Mobile-first chart simplification planned | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |
| **Game History** | GamePhaseRouter → HistoryRoute | `SwiftUI/HistoryView` | ⬜ Missing | L2 | — | Mobile-first list design planned | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |
| **Player Compare** | GamePhaseRouter → CompareRoute | `SwiftUI/CompareView` | ⬜ Missing | L1→L2 | — | Insight density reduced on small screens | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |
| **Session Resume** | Session state hook | `SwiftUI/SessionResumeView` | ⬜ Missing | L1→L2 | — | Resume prompt UX may diverge | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |
| **Player Preferences** | GamePhaseRouter → PreferencesRoute | `SwiftUI/PreferencesView` | ⬜ Missing | L1→L2 | — | Native settings patterns planned | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |
| **Teaching Mode** | GamePhaseRouter → TeachingRoute | `SwiftUI/TeachingView` | ⬜ Missing | L1→L2 | — | Guided-card onboarding style planned | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |
| **Post-Game Feedback** | GamePhaseRouter → PostGameFeedbackRoute | `SwiftUI/PostGameFeedbackView` | ⬜ Missing | L1→L2 | — | Native sheet presentation planned | mobile | 2026-05-09 | Branch reset baseline: `apps/mobile/app/index.tsx` |

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
