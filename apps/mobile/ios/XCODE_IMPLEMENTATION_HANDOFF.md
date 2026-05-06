# iOS Native Services - Xcode Handoff

Last updated: 2026-05-05

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
- In-app diagnostics panel is now mounted for device verification:
  - `apps/mobile/src/native/NativeServicesDebugMenu.tsx` is rendered from `apps/mobile/app/_layout.tsx` in dev.
  - `docs/mobile/device-validation-checklist.md` execution order now includes DEV-panel evidence capture.

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

## MB.4 Verification Outcome (Manual Xcode/Device)

Physical-device evidence has been completed and MB.4 is ready to be treated as shipped.

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

### Physical-device evidence summary (2026-05-05)

- User-confirmed in chat: all checks pass.
- Core screens + native module checks passed in one device run.
- Performance checks passed with no visible stutter.

## MB.5 Handoff Requirements

With MB.4 verified, continue with MB.5 verification baseline and quality-gate enforcement:

- Keep `docs/mobile/device-validation-checklist.md` as required evidence input.
- Keep `docs/mobile/screen-quality-scores.json` evidence current for screen-level quality gates.
- Enforce mobile guardrails so required evidence cannot be skipped.

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
