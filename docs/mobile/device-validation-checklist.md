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
