# Xcode Setup (apps/mobile)

This project uses Expo + React Native. The Xcode workspace is generated from Expo config and should be treated as a native output surface.

## Prerequisites

- Xcode installed (latest stable)
- CocoaPods installed (`pod` available in PATH)
- Node + pnpm available in PATH

## Generate and open in Xcode

From repo root:

1. Generate iOS project:
   - `pnpm mobile:prebuild:ios`
2. Install pods:
   - `pnpm mobile:pods`
3. Open workspace:
   - `pnpm mobile:open:xcode`

Or run all three:

- `pnpm mobile:setup:xcode`

## Environment config

- Shared config file: `apps/mobile/.xcode.env`
- Local overrides template: `apps/mobile/.xcode.env.local.example`
- Sync into generated iOS folder: `pnpm --filter @guess/mobile sync:xcode-env`

## Notes

- Do not import web UI modules into mobile code. Guardrails are enforced by `pnpm mobile:guardrails`.
- Treat `apps/mobile/ios/Pods` and build outputs as generated artifacts.
- If Expo config changes, regenerate native files with `pnpm mobile:prebuild:ios`.
- For AI context handoff limitations between IDEs, use `docs/mobile/xcode-claude-memory-handoff.md` as the canonical repo note.

## VS Code + Xcode AI Sync Contract

Use this checklist to keep both IDE workflows aligned for AI-assisted changes.

### Source-of-truth boundaries

- Product logic and orchestration: `apps/mobile/src/**` and `packages/app-core/**`.
- Generated native output: `apps/mobile/ios/**` from Expo prebuild.
- Shared iOS environment: `apps/mobile/.xcode.env` (sync via `pnpm --filter @guess/mobile sync:xcode-env`).

### Safe edit policy

- Prefer editing TypeScript and Expo config in VS Code.
- Regenerate iOS output after relevant config/dependency changes:
   - `pnpm mobile:prebuild:ios`
   - `pnpm mobile:pods`
- Avoid committing accidental generated churn from `apps/mobile/ios/**` unless intentionally updating native project files.

### AI session handoff routine

Before switching IDEs (or AI agents), run from repo root:

1. `pnpm validate:fast`
2. `pnpm --filter @guess/mobile typecheck`
3. `pnpm --filter @guess/mobile sync:xcode-env`

This keeps code health, mobile type safety, and Xcode env parity in sync.

### Native-only changes

- If a change is made directly in Xcode-native files, mirror intent back into docs and mobile TS entry points so future AI work in VS Code has context.
- When introducing native module behavior, document why Expo-level APIs were insufficient in `docs/mobile/native-product-contract.md`.

### Swift scaffold entry points

- Starter Swift files are scaffolded at `apps/mobile/ios/Andernator/NativeServices/`.
- In Xcode, ensure each file is added to the project and has target membership for `Andernator`.
- **Implementation Status: ✅ COMPLETED**
- Start implementation from:
   - `HapticsService.swift` - ✅ Implemented (native haptic feedback with all UIFeedbackGenerator styles)
   - `VoiceOverAnnouncer.swift` - ✅ Implemented (VoiceOver announcements with priority control)
   - `ReduceMotionObserver.swift` - ✅ Implemented (real-time reduce motion observation)
   - `LifecycleObserver.swift` - ✅ Implemented (app/scene lifecycle tracking)
   - `BridgeContract.swift` - ✅ Implemented (common protocols and error handling)

### Native Services Implementation Notes

#### Why Native Implementation Was Needed

Per `docs/mobile/native-product-contract.md`, these modules extend beyond Expo's default capabilities:

1. **HapticsService**: Expo's Haptics module lacks fine-grained control over iOS feedback styles (soft, rigid) and notification types needed for native-quality game interactions per HIG.

2. **VoiceOverAnnouncer**: React Native Accessibility APIs don't provide announcement priority and interruption control required for real-time game feedback to screen reader users.

3. **ReduceMotionObserver**: React Native's AccessibilityInfo doesn't expose event-based updates for reduce motion changes, preventing responsive animation adjustments during gameplay.

4. **LifecycleObserver**: React Native's AppState lacks scene-level events needed for multi-window support and precise game state save timing.

#### TypeScript Integration

All modules are exposed via React Native bridge with TypeScript definitions in `apps/mobile/src/native/`:

- `NativeServices.ts` - Type definitions and module exports
- `useNativeServices.ts` - React hooks for easy consumption
- `NativeServicesExamples.tsx` - Example components showing integration patterns
- `testNativeModules.ts` - Development test utilities

#### Bridge API Surface

**NativeHaptics:**
- `trigger(style: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'): Promise<void>`
- `success()`, `warning()`, `error()`, `selection()`: Promise-based notification haptics

**NativeVoiceOver:**
- `announce(message: string, priority?: 'low' | 'default' | 'high'): Promise<void>`
- `isVoiceOverRunning(): Promise<boolean>`
- `announceScreenChange(message?: string): Promise<void>`
- `announceLayoutChange(message?: string): Promise<void>`

**NativeReduceMotion:**
- `isEnabled(): Promise<boolean>`
- `getMotionSettings(): Promise<MotionSettings>`
- Event emitter: `reduceMotionChanged` with `{ isEnabled: boolean }`

**NativeLifecycle:**
- `getCurrentState(): Promise<'active' | 'inactive' | 'background'>`
- Event emitter: `lifecycleChanged` with `{ state: LifecycleState }`

#### Fallback Behavior

All modules implement graceful degradation:
- **Haptics**: Resolves without output on simulator or devices without Taptic Engine
- **VoiceOver**: No-op when VoiceOver is disabled
- **Reduce Motion**: Defaults to `false` if unavailable
- **Lifecycle**: Falls back to React Native's AppState module if needed
- **Platform**: All modules check for iOS and no-op on Android

#### Testing

Run development tests to verify module registration:

```typescript
import { testNativeModules, runNativeModuleTests } from '@/native/testNativeModules';

// In App.tsx during development
if (__DEV__) {
  testNativeModules(); // Quick availability check
  // or
  runNativeModuleTests(); // Full functionality tests
}
```

#### Integration Examples

See `apps/mobile/src/native/NativeServicesExamples.tsx` for complete component examples:
- Guess submission with haptics + VoiceOver feedback
- Adaptive animations respecting reduce motion
- Auto-save on app background
- VoiceOver screen navigation announcements
- Multi-sensory game over feedback

Quick reference: `apps/mobile/src/native/QUICK_REFERENCE.md`
