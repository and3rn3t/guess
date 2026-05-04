# Native Services

This directory contains iOS-native Swift modules that extend Expo's capabilities to meet the native product contract requirements.

## Modules

### HapticsService.swift
**Why native:** Provides fine-grained haptic feedback control beyond React Native's basic Haptics module. Supports all UIImpactFeedbackGenerator styles and notification types per iOS HIG.

**TS contract:** `NativeHaptics` module
```typescript
NativeHaptics.trigger('medium' | 'light' | 'heavy' | 'soft' | 'rigid')
NativeHaptics.success()
NativeHaptics.warning()
NativeHaptics.error()
NativeHaptics.selection()
```

**Fallback:** All methods resolve without haptic output on simulator or devices without Taptic Engine.

**User impact:** Native-quality tactile feedback for game interactions (guess submission, correct/incorrect answers, navigation).

---

### VoiceOverAnnouncer.swift
**Why native:** React Native's Accessibility APIs lack fine-grained control over announcement priority and interruption needed for real-time game feedback.

**TS contract:** `NativeVoiceOver` module
```typescript
NativeVoiceOver.announce(message, priority?: 'low' | 'default' | 'high')
NativeVoiceOver.isVoiceOverRunning()
NativeVoiceOver.announceScreenChange(message?)
NativeVoiceOver.announceLayoutChange(message?)
```

**Fallback:** All methods resolve as no-ops when VoiceOver is disabled.

**User impact:** Accessible game state announcements for VoiceOver users (correct/incorrect guess, game over, challenge status).

---

### ReduceMotionObserver.swift
**Why native:** React Native's AccessibilityInfo doesn't provide event-based updates for reduce motion changes. iOS notifications enable responsive animation adjustments during gameplay.

**TS contract:** `NativeReduceMotion` module + event emitter
```typescript
NativeReduceMotion.isEnabled()
NativeReduceMotion.getMotionSettings()

// Event subscription
ReduceMotionEmitter.addListener('reduceMotionChanged', (event) => {
  console.log(event.isEnabled);
});
```

**Fallback:** TS callers should default to reduced motion OFF if module is unavailable.

**User impact:** Dynamic animation simplification for users with motion sensitivity, respecting system accessibility settings.

---

### LifecycleObserver.swift
**Why native:** React Native's AppState module lacks scene-level lifecycle events needed for proper multi-window support and precise game state save timing.

**TS contract:** `NativeLifecycle` module + event emitter
```typescript
NativeLifecycle.getCurrentState() // 'active' | 'inactive' | 'background'

// Event subscription
LifecycleEmitter.addListener('lifecycleChanged', (event) => {
  console.log(event.state);
});
```

**Fallback:** Use React Native's AppState module if this is unavailable.

**User impact:** Accurate game pause/resume behavior, preventing data loss when app backgrounds during active game.

---

### BridgeContract.swift
**Purpose:** Defines common protocols and error handling for all native modules. Not directly exposed to TypeScript.

---

## Integration

### Swift Side
All modules conform to `RCTBridgeModule` and are auto-registered by React Native's module system. No manual registration required in AppDelegate.

### TypeScript Side
Import from `NativeServices.ts`:
```typescript
import { 
  NativeHaptics, 
  NativeVoiceOver, 
  NativeReduceMotion,
  NativeLifecycle,
  ReduceMotionEmitter,
  LifecycleEmitter 
} from '@/native/NativeServices';
```

## Testing

### On Device
All haptic and accessibility features require physical iOS devices. Simulator behavior:
- Haptics: No-op (resolves successfully without feedback)
- VoiceOver: Can be enabled in Simulator > Accessibility
- Reduce Motion: Can be toggled in Simulator > Accessibility
- Lifecycle: Full support

### Validation
```bash
# Type check TypeScript contract
pnpm --filter @guess/mobile typecheck

# Validate native boundaries
pnpm mobile:guardrails

# Full validation
pnpm validate:fast
```

## Maintenance Notes

- **Owner:** Mobile engineering team
- **Dependencies:** Only UIKit and React Native bridge APIs
- **iOS version support:** iOS 12+ (with graceful degradation for newer APIs)
- **Update frequency:** Only when native capabilities need extension beyond Expo defaults

## PR Handoff Template

When modifying these files, include in PR description:

```md
### Xcode Handoff
- Intent: [Why this change was needed]
- User impact: [What user-facing behavior changes]
- Files touched: [List Swift and TS files]
- Bridge/API surface added or changed: [New or modified methods]
- TS fallback behavior: [What happens if module unavailable]
- Validation run:
  - [ ] pnpm validate:fast
  - [ ] pnpm --filter @guess/mobile typecheck
- Follow-up tasks: [Any remaining work]
```

See `docs/mobile/xcode-claude-memory-handoff.md` for full PR requirements.
