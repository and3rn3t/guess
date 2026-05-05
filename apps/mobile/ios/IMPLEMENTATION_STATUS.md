# iOS Native Services - Implementation Status

Last updated: 2026-05-04
Last updated: 2026-05-05

This file tracks MB.4 native bridge baseline reliability evidence.

## Current State

### Completed in repository

- [x] Canonical native source-of-truth consolidation completed.
  - Native bridge files live under `apps/mobile/ios/Andernator/NativeServices/`.
  - Legacy duplicate tree under `apps/mobile/ios/mobile/` removed.
- [x] Core gameplay screen decomposition completed in `apps/mobile/src/screens/`.
- [x] Persistent storage adapter completed in `apps/mobile/src/platform/adapters.ts` using AsyncStorage with in-memory fallback.
- [x] Xcode project cleanup completed to remove stale duplicate file references.

### Verification completed in VS Code

- [x] `pnpm validate:fast` passed.
- [x] `pnpm --filter @guess/mobile typecheck` passed.
- [x] `pnpm validate` passed (2026-05-04).
- [x] `pnpm build` passed (2026-05-04).
- [x] `pnpm build:worker` passed (2026-05-04, dry-run deploy via Wrangler preview config).
- [x] Expo/RN compatibility aligned for SDK 55.
  - Set `apps/mobile` `react-native` to `0.83.6` (Expo recommended) and regenerated iOS artifacts (`prebuild:ios`, `pods`).
- [x] Restored canonical native-source references after prebuild rewired missing paths.
  - Updated `apps/mobile/ios/Andernator.xcodeproj/project.pbxproj` file references to `Andernator/NativeServices/*.swift`.
- [x] Fixed Swift bridge compile issues surfaced by Xcode:
  - Removed Objective-C selector collisions in `NativeServiceModule`.
  - Replaced unsupported closure-type extensions for `RCTPromiseResolveBlock` / `RCTPromiseRejectBlock` with helper functions.
- [x] Headless Xcode simulator build succeeded via:
  - `xcodebuild -quiet -workspace Andernator.xcworkspace -scheme Andernator -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO`
  - Re-verified 2026-05-04 after updates in `apps/mobile/ios/Andernator.xcodeproj/project.pbxproj`.

### Remaining for MB.4

### Verified in VS Code (2026-05-05)

- [x] Expo prebuilt + Xcode 26 (year-based, `iPhoneSimulator26.4.sdk`) header fix applied via `Podfile` `post_install` hook.
  - Root cause: `RCTAppDelegateUmbrella.h` uses `__has_include(<React_RCTAppDelegate/...>)` (underscore) but CocoaPods only creates `React-RCTAppDelegate/` (dash) in `Pods/Headers/Public/`.
  - Fix: creates `Pods/Headers/Public/React_RCTAppDelegate/` (underscore) and copies all headers from the dash dir.
  - `pod install` confirms: `[Andernator] Created React_RCTAppDelegate/ (underscore) for Expo prebuilt compatibility.`
- [x] Headless simulator build re-verified (2026-05-05): `xcodebuild ... -sdk iphonesimulator build CODE_SIGNING_ALLOWED=NO` → `EXIT: 0`.
## MB.4 Verification Checklist
### Remaining for MB.4

- [ ] Manual Xcode target membership and bridge registration verification.
- [ ] Simulator and physical-device runtime verification for all native modules.
- [ ] Mark MB.4 shipped in roadmap after verification evidence is recorded.
### 1. Project and target wiring (Xcode)

- [ ] Open workspace with `pnpm mobile:open:xcode`.
- [ ] Confirm `Andernator` target includes:
  - [ ] `apps/mobile/ios/Andernator/NativeServices/BridgeContract.swift`
  - [ ] `apps/mobile/ios/Andernator/NativeServices/HapticsService.swift`
  - [ ] `apps/mobile/ios/Andernator/NativeServices/VoiceOverAnnouncer.swift`
  - [ ] `apps/mobile/ios/Andernator/NativeServices/ReduceMotionObserver.swift`
  - [ ] `apps/mobile/ios/Andernator/NativeServices/LifecycleObserver.swift`
- [ ] Confirm bridging header path points to `apps/mobile/ios/Andernator/Andernator-Bridging-Header.h`.

### 2. Build verification

- [x] Build debug simulator target without bridge compile errors (verified via headless `xcodebuild`).
- [ ] Build debug device target (Cmd+B) without bridge compile errors.

### 3. Runtime verification

- [ ] App launches without module registration errors.
- [ ] Native services debug UI reports module availability.
- [ ] Haptics behavior verified on physical device.
- [ ] VoiceOver announce behavior verified with VoiceOver enabled.
- [ ] Reduce-motion state and change events verified.
- [ ] Lifecycle foreground/background transitions verified.

### 4. Evidence and close-out

- [ ] Capture verification notes in `apps/mobile/ios/XCODE_IMPLEMENTATION_HANDOFF.md`.
- [ ] Update roadmap status for MB.4 to shipped with date.
- [ ] Move next mobile item to in-progress in roadmap block.

## Reference Files

- `docs/mobile/xcode-setup.md`
- `docs/mobile/xcode-claude-memory-handoff.md`
- `apps/mobile/ios/XCODE_PROJECT_INTEGRATION.md`
- `apps/mobile/ios/XCODE_IMPLEMENTATION_HANDOFF.md`
- `apps/mobile/ios/NativeServices-README.md`
