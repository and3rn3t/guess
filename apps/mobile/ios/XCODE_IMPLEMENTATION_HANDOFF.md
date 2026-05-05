# iOS Native Services - Xcode Handoff

Last updated: 2026-05-04

This document is the execution handoff for MB.4 (native bridge baseline reliability).
It reflects the current state after Expo SDK 55 / React Native compatibility alignment and headless simulator build verification.

## Current Status

### Completed in repo

- Native source-of-truth is consolidated at:
  - `apps/mobile/ios/Andernator/NativeServices/`
- Duplicate legacy native tree was removed:
  - `apps/mobile/ios/mobile/`
- Mobile gameplay actions were decomposed into phase screens in:
  - `apps/mobile/src/screens/`
- Mobile storage adapter now persists via AsyncStorage with in-memory fallback in:
  - `apps/mobile/src/platform/adapters.ts`

### Completed for MB.4 technical unblockers

- Expo/RN version alignment completed for SDK 55:
  - `react-native` set to `0.83.6` in `apps/mobile/package.json`
- iOS artifacts regenerated (`prebuild:ios`, `pods`), then project paths corrected:
  - `apps/mobile/ios/Andernator.xcodeproj/project.pbxproj`
- Swift bridge compile blockers fixed:
  - Objective-C selector conflict removed from the `NativeServiceModule` contract
  - invalid closure-type extensions replaced with helper functions in `BridgeContract.swift`

### Verification completed in VS Code

- `pnpm --filter @guess/mobile typecheck` passed
- `pnpm validate:fast` passed
- `pnpm validate` passed (2026-05-04)
- `pnpm build` passed (2026-05-04)
- `pnpm build:worker` passed (2026-05-04, dry-run deploy using `tail-worker/wrangler.toml`)
- Headless simulator build passed (re-verified 2026-05-04 after project file updates):

```bash
xcodebuild -quiet \
  -workspace Andernator.xcworkspace \
  -scheme Andernator \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  build CODE_SIGNING_ALLOWED=NO
```

## Native Module Surface

Native module names exposed to JS via `apps/mobile/src/native/NativeServices.ts`:

- `NativeHaptics`
- `NativeVoiceOver`
- `NativeReduceMotion`
- `NativeLifecycle`

Canonical Swift module files:

- `apps/mobile/ios/Andernator/NativeServices/BridgeContract.swift`
- `apps/mobile/ios/Andernator/NativeServices/HapticsService.swift`
- `apps/mobile/ios/Andernator/NativeServices/VoiceOverAnnouncer.swift`
- `apps/mobile/ios/Andernator/NativeServices/ReduceMotionObserver.swift`
- `apps/mobile/ios/Andernator/NativeServices/LifecycleObserver.swift`

Bridging header:

- `apps/mobile/ios/Andernator/Andernator-Bridging-Header.h`

## Remaining MB.4 Checks (Manual Xcode/Device)

### 1. Xcode target wiring

- Open workspace: `pnpm mobile:open:xcode`
- Confirm `Andernator` target membership includes all five Swift files above
- Confirm build setting points to bridging header:
  - `Andernator/Andernator-Bridging-Header.h`

### 2. Device build and runtime

- Build debug device target (Cmd+B) without bridge errors
- Launch app and verify no native module registration errors
- Confirm native debug UI reports module availability

### 3. Physical-device behavior

- Haptics produce expected feedback on device (simulator excluded)
- VoiceOver announcements fire with VoiceOver enabled
- Reduce-motion state and change events are observed
- Lifecycle foreground/background transitions emit expected events

## Close-out Requirements

Before marking MB.4 as shipped:

- Record manual verification evidence in this file
- Update `apps/mobile/ios/IMPLEMENTATION_STATUS.md` with final runtime evidence
- Update `ROADMAP.md`:
  - mark MB.4 as shipped with date
  - move MB.5 to in-progress if started

## Quick Commands

Run from repo root:

```bash
pnpm validate:fast
pnpm --filter @guess/mobile typecheck
pnpm --filter @guess/mobile prebuild:ios
pnpm --filter @guess/mobile pods
pnpm mobile:open:xcode
```

## Notes

- Treat `apps/mobile/ios/Pods/**` and most generated iOS churn as generated artifacts.
- Keep native source-of-truth under `apps/mobile/ios/Andernator/NativeServices/`.
- If prebuild rewires file references, re-verify `project.pbxproj` paths before validating builds.
