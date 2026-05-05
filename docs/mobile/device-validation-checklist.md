# Device Validation Checklist

Use this checklist when validating mobile core screens and native modules on a physical iPhone.

Update this file in the same commit as score changes in docs/mobile/screen-quality-scores.json.

## Run Record

- Last run date: 2026-05-05
- Last run owner: pending
- Device: pending
- iOS version: pending
- Build: Debug
- Status: pending device execution

## Preconditions

- [ ] Install latest app build on physical device.
- [ ] Enable VoiceOver availability check.
- [ ] Confirm Reduce Motion setting can be toggled in iOS Accessibility settings.
- [ ] Confirm haptics are enabled on the device.

## One-Pass Execution Order

1. Launch Debug build from Xcode to the physical iPhone.
2. Run all 5 core screens in sequence: Welcome -> Playing -> Guessing -> Game Over -> Challenge.
3. Validate native module behavior during the flow:
	- Haptics feedback is present and mapped to expected actions.
	- VoiceOver announcements trigger at expected moments.
	- Reduce Motion state is readable and updates when changed.
	- Lifecycle events appear on app foreground/background transitions.
4. Run quick performance pass:
	- Tap-to-feedback perceived under 100 ms.
	- Transition start perceived under 150 ms.
	- No visible stutter.
5. Update Run Record + checkboxes, then update score evidence in docs/mobile/screen-quality-scores.json.

## Pasteback Template (for chat handoff)

Copy and fill this block so evidence can be applied quickly:

Owner: <name>
Device: <model>
iOS: <version>
Run date: <YYYY-MM-DD>

Core screens:
- WelcomeScreen: pass|fail - <notes>
- PlayingScreen: pass|fail - <notes>
- GuessingScreen: pass|fail - <notes>
- GameOverScreen: pass|fail - <notes>
- ChallengeScreen: pass|fail - <notes>

Native modules:
- NativeHaptics: pass|fail - <notes>
- NativeVoiceOver: pass|fail - <notes>
- NativeReduceMotion: pass|fail - <notes>
- NativeLifecycle: pass|fail - <notes>

Performance:
- Tap-to-feedback <100 ms: yes|no - <notes>
- Transition start <150 ms: yes|no - <notes>
- Stutter observed: yes|no - <notes>

Score updates wanted now:
- WelcomeScreen: <weighted or keep>
- PlayingScreen: <weighted or keep>
- GuessingScreen: <weighted or keep>
- GameOverScreen: <weighted or keep>
- ChallengeScreen: <weighted or keep>

Ready to mark:
- MB.4 shipped: yes|no
- MB.5 in progress: yes|no

## Core Screens

- [ ] WelcomeScreen
- [ ] PlayingScreen
- [ ] GuessingScreen
- [ ] GameOverScreen
- [ ] ChallengeScreen

## Native Modules

- [ ] NativeHaptics: expected feedback patterns fire for core actions.
- [ ] NativeVoiceOver: announcements fire when expected.
- [ ] NativeReduceMotion: current state is readable and change events propagate.
- [ ] NativeLifecycle: foreground/background transitions emit expected events.

## Performance / Interaction Checks

- [ ] P95 tap-to-feedback latency observed under 100 ms.
- [ ] P95 transition start observed under 150 ms.
- [ ] No visible stutter in end-to-end gameplay flow.

## Notes

- Use this record as the source for scorecard updates in docs/mobile/screen-quality-scores.json.
- If a check fails, include mitigation details in the relevant screen notes.
