# Xcode Native Services Implementation - Handoff Document

## Summary

Implemented native iOS service modules to meet the native product contract requirements for iOS-quality game interactions and accessibility support.

## Files Created

### Swift Native Modules (5 files)

1. **BridgeContract.swift**
   - Common protocols and error handling for React Native bridge
   - Not directly exposed to TypeScript
   - Provides `NativeServiceModule` protocol and `BridgeError` enum

2. **HapticsService.swift**
   - Native haptic feedback with full UIFeedbackGenerator support
   - Exposes `NativeHaptics` module to React Native
   - Methods: `trigger()`, `success()`, `warning()`, `error()`, `selection()`
   - Gracefully handles simulator/unavailable scenarios

3. **VoiceOverAnnouncer.swift**
   - VoiceOver announcements with priority control
   - Exposes `NativeVoiceOver` module to React Native
   - Methods: `announce()`, `isVoiceOverRunning()`, `announceScreenChange()`, `announceLayoutChange()`
   - No-op when VoiceOver is disabled

4. **ReduceMotionObserver.swift**
   - Real-time reduce motion setting observation
   - Exposes `NativeReduceMotion` module + event emitter
   - Methods: `isEnabled()`, `getMotionSettings()`
   - Events: `reduceMotionChanged`
   - Monitors UIAccessibility notifications

5. **LifecycleObserver.swift**
   - App and scene lifecycle state tracking
   - Exposes `NativeLifecycle` module + event emitter
   - Methods: `getCurrentState()`
   - Events: `lifecycleChanged`
   - Supports iOS 13+ scene lifecycle

### TypeScript Integration (3 files)

6. **NativeServices.ts**
   - TypeScript type definitions for all native modules
   - Module exports with proper typing
   - Event emitter setup for subscription-based modules

7. **useNativeServices.ts**
   - React hooks for convenient consumption
   - Hooks: `useHaptics()`, `useVoiceOver()`, `useReduceMotion()`, `useLifecycle()`
   - Effect hooks: `useOnAppActive()`, `useOnAppBackground()`, `useLifecycleCallbacks()`
   - Platform checks and graceful degradation

8. **NativeServicesExamples.tsx**
   - Example React components demonstrating integration
   - Covers all common use cases (guess submission, animations, auto-save, navigation)
   - Accessibility-aware component patterns

### Supporting Files (3 files)

9. **Andernator-Bridging-Header.h**
   - Objective-C bridging header for React Native imports

10. **NativeServices-README.md**
    - Comprehensive documentation for native services
    - Module descriptions, TS contracts, fallback behavior
    - Testing guidance and maintenance notes
    - PR handoff template

11. **AppDelegate.swift** (updated)
    - Added header comments documenting native module registration
    - Explains why native implementation was needed
    - References TypeScript contract location

## Why Native Implementation

Per `docs/mobile/native-product-contract.md`:

1. **Haptics:** Expo's default Haptics module doesn't provide fine-grained control over iOS feedback styles (soft, rigid, notification types) needed for native-quality game interactions.

2. **VoiceOver:** React Native Accessibility APIs lack announcement priority and interruption control required for real-time game feedback to screen reader users.

3. **Reduce Motion:** React Native's AccessibilityInfo doesn't expose event-based updates for reduce motion changes, preventing responsive animation adjustments during gameplay.

4. **Lifecycle:** React Native's AppState lacks scene-level events needed for multi-window support and precise game state save timing.

All implementations provide measurable user impact and include fallback paths.

## TypeScript Caller Contract

All modules are exposed via `NativeServices.ts` with promise-based APIs:

```typescript
import { NativeHaptics, NativeVoiceOver, NativeReduceMotion, NativeLifecycle } from './NativeServices';

// Haptics
await NativeHaptics.trigger('medium');
await NativeHaptics.success();

// VoiceOver
await NativeVoiceOver.announce('Game started!', 'high');
const isRunning = await NativeVoiceOver.isVoiceOverRunning();

// Reduce Motion
const isEnabled = await NativeReduceMotion.isEnabled();
ReduceMotionEmitter.addListener('reduceMotionChanged', handler);

// Lifecycle
const state = await NativeLifecycle.getCurrentState();
LifecycleEmitter.addListener('lifecycleChanged', handler);
```

## Fallback Behavior

All modules implement graceful degradation:

- **Haptics:** Resolves without output on simulator or devices without Taptic Engine
- **VoiceOver:** No-op when VoiceOver is disabled
- **Reduce Motion:** Defaults to `false` if unavailable
- **Lifecycle:** Falls back to React Native's AppState module

## React Integration

Use provided hooks for easy consumption:

```typescript
import { useHaptics, useVoiceOver, useReduceMotion, useLifecycle } from './useNativeServices';

function GameScreen() {
  const haptics = useHaptics();
  const { announce } = useVoiceOver();
  const reduceMotion = useReduceMotion();
  const lifecycleState = useLifecycle();
  
  // Use in component logic
}
```

## Validation Checklist

- [x] All Swift files include header comments explaining:
  - Why native implementation was needed
  - What TS caller contract they expose
  - What fallback path exists
- [x] TypeScript types defined in `NativeServices.ts`
- [x] React hooks provided for convenient consumption
- [x] Example usage documented in `NativeServicesExamples.tsx`
- [x] README created with module descriptions and testing guidance
- [x] AppDelegate updated with documentation

## Next Steps for Integration

1. **Add files to Xcode project:**
   - Add all `.swift` files to `apps/mobile/ios/Andernator/` target
   - Ensure target membership is set to `Andernator`
   - Add bridging header to build settings if not already configured

2. **Copy TypeScript files to mobile app:**
   - Copy `NativeServices.ts`, `useNativeServices.ts`, `NativeServicesExamples.tsx`
   - To: `apps/mobile/src/native/` or appropriate location
   - Update import paths as needed

3. **Run validation:**
   ```bash
   pnpm validate:fast
   pnpm --filter @guess/mobile typecheck
   pnpm mobile:guardrails
   ```

4. **Test on device:**
   - Build and run on physical iOS device
   - Test haptics in gameplay scenarios
   - Enable VoiceOver and test announcements
   - Toggle Reduce Motion and verify animation behavior
   - Background app and verify lifecycle events

5. **Integrate into game screens:**
   - Use examples in `NativeServicesExamples.tsx` as templates
   - Add haptics to guess submission, game over, navigation
   - Add VoiceOver announcements for game state changes
   - Make animations respect reduce motion setting
   - Auto-save game state on background

## Ownership

- **Engineering:** Native module implementation and maintenance
- **Design:** HIG alignment verification for haptics and feedback patterns
- **Product:** User impact measurement and release promotion

## Follow-up Tasks

- [ ] Add Swift files to Xcode project target
- [ ] Copy TypeScript files to mobile app source
- [ ] Run validation suite
- [ ] Test on physical device
- [ ] Integrate into game screens per examples
- [ ] Update `docs/mobile/xcode-setup.md` with implementation notes
- [ ] Create PR with handoff block template
