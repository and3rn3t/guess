# Device Validation Checklist

Use this checklist when validating mobile core screens and native modules on a physical iPhone.

Update this file in the same commit as score changes in docs/mobile/screen-quality-scores.json.

## Run Record

- Last run date: 2026-05-10
- Last run owner: andernet
- Device: physical iPhone (model not captured in chat)
- iOS version: verified on-device (version not captured in chat)
- Build: Debug
- Status: complete (performance + offline airplane-mode evidence captured)

## Preconditions

- [x] Install latest app build on physical device.
- [x] Enable VoiceOver availability check.
- [x] Confirm Reduce Motion setting can be toggled in iOS Accessibility settings.
- [x] Confirm haptics are enabled on the device.

## One-Pass Execution Order

1. Launch Debug build from Xcode to the physical iPhone.
2. Run all 5 core screens in sequence: Welcome -> Playing -> Guessing -> Game Over -> Challenge.
3. Validate native module behavior during the flow:
   - Haptics feedback is present and mapped to expected actions.
   - VoiceOver announcements trigger at expected moments.
   - Reduce Motion state is readable and updates when changed.
   - Lifecycle events appear on app foreground/background transitions.
4. Open the in-app `DEV` Native Debug panel and capture module state evidence:
   - Verify live labels for VoiceOver, Reduce Motion, and Lifecycle.
   - Trigger at least one haptic action and one VoiceOver announcement from the panel.
5. Run quick performance pass:
   - Tap-to-feedback perceived under 100 ms.
   - Transition start perceived under 150 ms.
   - No visible stutter.
6. Update Run Record + checkboxes, then update score evidence in docs/mobile/screen-quality-scores.json.

## Pasteback Template (for chat handoff)

Copy and fill this block so evidence can be applied quickly:

```text
Owner: [name]
Device: [model]
iOS: [version]
Run date: [YYYY-MM-DD]

Core screens:
- WelcomeScreen: pass|fail - [notes]
- PlayingScreen: pass|fail - [notes]
- GuessingScreen: pass|fail - [notes]
- GameOverScreen: pass|fail - [notes]
- ChallengeScreen: pass|fail - [notes]

Native modules:
- NativeHaptics: pass|fail - [notes]
- NativeVoiceOver: pass|fail - [notes]
- NativeReduceMotion: pass|fail - [notes]
- NativeLifecycle: pass|fail - [notes]

Performance:
- Tap-to-feedback <100 ms: yes|no - [notes]
- Transition start <150 ms: yes|no - [notes]
- Stutter observed: yes|no - [notes]

Score updates wanted now:
- WelcomeScreen: [weighted or keep]
- PlayingScreen: [weighted or keep]
- GuessingScreen: [weighted or keep]
- GameOverScreen: [weighted or keep]
- ChallengeScreen: [weighted or keep]

Ready to mark:
- MB.4 shipped: yes|no
- MB.5 in progress: yes|no
```

## Core Screens

- [x] WelcomeScreen
- [x] PlayingScreen
- [x] GuessingScreen
- [x] GameOverScreen
- [x] ChallengeScreen

## Native Modules

- [x] NativeHaptics: expected feedback patterns fire for core actions.
- [x] NativeVoiceOver: announcements fire when expected.
- [x] NativeReduceMotion: current state is readable and change events propagate.
- [x] NativeLifecycle: foreground/background transitions emit expected events.

## Performance / Interaction Checks

- [x] P95 tap-to-feedback latency observed under 100 ms.
- [x] P95 transition start observed under 150 ms.
- [x] No visible stutter in end-to-end gameplay flow.

## MP.6 Evidence Notes

- Use this record as the source for scorecard updates in docs/mobile/screen-quality-scores.json.
- If a check fails, include mitigation details in the relevant screen notes.
- 2026-05-05: all checklist checks confirmed passed by user in chat after physical-device run.

## MP.3 Addendum (Closed)

This addendum is closed as superseded by the MP.6/MP.7 evidence package captured on 2026-05-10.

- [x] StatsScreen (live insights + achievement progress cards)
- [x] HistoryScreen (live history filters + summary metrics)
- [x] CompareScreen (insights-driven percentile/difficulty/category comparisons)
- [x] PreferencesScreen (AsyncStorage persistence after relaunch)
- [x] PostGameFeedbackScreen (POST /api/v2/game/feedback end-to-end)

MP.3-specific checks:

- [x] Verify VoiceOver reading order for new cards, progress bars, and status text.
- [x] Verify tap-to-feedback and transition timing remain within scorecard thresholds.
- [x] Verify feedback submission succeeds and handles offline/error states gracefully.
- [x] Verify preferences persist after app restart on physical device.

Evidence sources:

- `docs/mobile/parity-matrix.md` (all core feature rows verified 2026-05-10)
- `docs/mobile/ios-feature-parity-plan.md` (MP.6 Route Integration Status table)
- `docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-1.png`
- `docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-2.png`
- `docs/mobile/screenshots/2026-05-10-mp6-offline-recording.mov`

## MP.6 Addendum (Reliability & Performance Closure)

Run this pass after the MP.6 reliability hardening and diagnostics instrumentation commits.

### MP.6 Preconditions

- [x] Build includes `apps/mobile/src/perf/mobilePerfMetrics.ts` instrumentation.
- [x] Build includes Stats diagnostics card (`MP.6 Diagnostics`) in `StatsScreen`.
- [x] Device has cellular or Wi-Fi available and can toggle airplane mode.

### Performance Evidence Capture (p95)

1. Launch app and use `Reset Diagnostics Samples` on Stats.
2. Execute 20+ interaction samples across gameplay:
   - Start game / start challenge
   - Answer question
   - Skip question
   - Reject guess
   - Submit result
3. Return to Stats and capture diagnostics values:
   - `Tap-to-feedback p95`
   - `Transition-start p95`
   - sample counts
4. Record screenshot(s) in `docs/mobile/screenshots/` and link in parity evidence notes.
   - Recommended filename: `YYYY-MM-DD-mp6-stats-diagnostics.png`
   - Include the `Pasteback Snapshot` block in the screenshot when possible.
   - Use `Share Diagnostics Snapshot` to send the text block off-device if text selection is awkward during capture.

Performance pass criteria:

- [x] Tap-to-feedback p95 <= 100 ms.
- [x] Transition-start p95 <= 150 ms.
- [x] Sample count is >= 20 for tap and >= 10 for transition.

### Offline / Airplane Mode Evidence Capture

1. Start in online mode and begin a game session.
2. Toggle airplane mode ON.
3. Validate resilience surfaces while offline:
   - Connection banner shows offline state.
   - Sync badge reflects offline/pending behavior.
   - No crash while navigating Welcome, Playing, Guessing, Game Over, Challenge, Stats, History.
4. Submit result and feedback while offline to queue actions.
5. Toggle airplane mode OFF and verify queued actions flush.
6. Capture screen recording and attach evidence path.
   - Recommended filename: `YYYY-MM-DD-mp6-offline-recording.mov`
   - Ensure the recording includes offline banner state, queued submission, and reconnect flush.

Offline pass criteria:

- [x] No crashes across tested routes in airplane mode.
- [x] Offline submissions queue correctly.
- [x] Reconnect flush succeeds and clears queued count.

### MP.6 Pasteback Template

```text
Owner: andernet
Device: physical iPhone (model not captured in chat)
iOS: verified on-device (version not captured in chat)
Run date: 2026-05-10

Performance diagnostics:
- Tap-to-feedback p95: 31.6 ms (threshold 100)
- Feedback-to-next-question p95: 29.8 ms (threshold 450)
- Transition-start p95: 32.1 ms (threshold 150)
- Transition-complete p95: 35.2 ms (threshold 350)
- Tap samples: 34
- Feedback-to-next-question samples: 26
- Transition-start samples: 14
- Transition-complete samples: 14

Offline run:
- Airplane mode no-crash pass: yes - verified across Welcome, Playing, Guessing, Game Over, Stats, History routes
- Offline queue enqueued actions: yes - queued submission observed with sync badge pending
- Reconnect flush cleared queue: yes - offline banner disappeared, start game re-enabled after reconnect

Evidence files:
- Screenshot 1: docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-1.png
- Screenshot 2: docs/mobile/screenshots/2026-05-10-mp6-offline-diagnostics-2.png
- Recording: docs/mobile/screenshots/2026-05-10-mp6-offline-recording.mov

Ready to mark:
- MP.6 Performance profiling complete: yes
- MP.6 Offline mode tested on device: yes
```

## Notes

- 2026-05-10 device evidence captured (performance + offline runs).
- Tap-to-feedback and transition-start meet the MP.6 thresholds.
- Feedback-to-next-question p95 was 29.8 ms, which is within the 450 ms target.
- Offline airplane-mode evidence complete: no crashes, queue behavior verified, reconnect flush validated.
- **MP.6 closure ready** — all performance and reliability gates passed on physical device.

## MY.2 Addendum (Challenge Leaderboard 25-Row Perf Validation)

Run this addendum on at least one small-screen iPhone to validate the MX.3 depth expansion.

### MY.2 Preconditions

- [ ] Build includes challenge leaderboard depth expansion (top-10 preview + expandable rows up to 25).
- [ ] Daily leaderboard has enough rows to exercise expanded list rendering (prefer 20+ rows).
- [ ] Device configured to default text size and again at larger Dynamic Type for a second pass.

### MY.2 Execution Steps

1. Launch app and navigate to Challenge.
2. Capture baseline behavior with top-10 preview visible.
3. Expand leaderboard rows ("Show More Entries") to render up to 25 rows.
4. Perform 3-5 full vertical scroll passes over expanded rows.
5. Collapse and re-expand once to verify interaction stability.
6. Repeat quick pass at larger Dynamic Type.

### MY.2 Pass Criteria

- [ ] No visible frame-jank or long input delay while expanding/collapsing rows.
- [ ] Scroll interaction remains smooth with expanded rows on small-screen device.
- [ ] No crash, no redbox, no stuck loading state after repeated expand/collapse.
- [ ] If regression is observed, fallback cap recommendation is documented.

### MY.2 Evidence Files

- Recommended screenshot: `docs/mobile/screenshots/YYYY-MM-DD-my2-leaderboard-expanded.png`
- Recommended recording: `docs/mobile/screenshots/YYYY-MM-DD-my2-leaderboard-scroll.mov`
- Optional diagnostics screenshot: `docs/mobile/screenshots/YYYY-MM-DD-my2-leaderboard-diagnostics.png`

### MY.2 Pasteback Template

```text
Owner: [name]
Device: [model]
iOS: [version]
Run date: [YYYY-MM-DD]

Rows observed:
- Preview rows: 10
- Expanded rows rendered: [count]

Interaction checks:
- Expand/collapse responsiveness: pass|fail - [notes]
- Expanded-list scrolling smoothness: pass|fail - [notes]
- Crash/redbox/stuck-state: pass|fail - [notes]

Dynamic Type pass:
- Larger-text expanded list behavior: pass|fail - [notes]

Evidence files:
- Screenshot: docs/mobile/screenshots/[file]
- Recording: docs/mobile/screenshots/[file]
- Optional diagnostics: docs/mobile/screenshots/[file]

Fallback recommendation needed:
- no|yes - [if yes, recommend cap and rationale]

Ready to mark:
- MY.2 done: yes|no
```
