# Native Services Quick Reference

## Import

```typescript
import { 
  useHaptics, 
  useVoiceOver, 
  useReduceMotion, 
  useLifecycle 
} from '@/native/useNativeServices';
```

## Haptics

```typescript
const haptics = useHaptics();

// Impact feedback
await haptics.trigger('light');    // Subtle tap
await haptics.trigger('medium');   // Standard tap (default for most interactions)
await haptics.trigger('heavy');    // Strong tap
await haptics.trigger('soft');     // Gentle, soft feel (iOS 13+)
await haptics.trigger('rigid');    // Firm, solid feel (iOS 13+)

// Notification feedback
await haptics.success();  // ✓ Correct answer, success state
await haptics.warning();  // ⚠ Caution, reversible error
await haptics.error();    // ✗ Wrong answer, error state

// Selection feedback
await haptics.selection(); // List item selection, picker change
```

**When to use:**
- `trigger('medium')` - Button presses, guess submission
- `success()` - Correct guess, game won
- `error()` - Incorrect guess, game lost
- `warning()` - Time running out, challenge expiring
- `selection()` - Navigating lists, changing options

## VoiceOver

```typescript
const { announce, isRunning, announceScreenChange } = useVoiceOver();

// Standard announcement
await announce('Game started!');

// High priority (interrupts current speech)
await announce('Correct!', 'high');

// Low priority (queued)
await announce('Time remaining: 30 seconds', 'low');

// Screen changes (navigation)
await announceScreenChange('Welcome Screen');

// Layout changes (content updates)
await announceLayoutChange('Score updated');

// Check if VoiceOver is running
if (isRunning) {
  // Provide more detailed instructions
}
```

**When to use:**
- `announce(..., 'high')` - Critical game state (correct/incorrect, game over)
- `announce(..., 'default')` - Status updates (score change, time warning)
- `announceScreenChange()` - Navigation to new screen
- `announceLayoutChange()` - Dynamic content updates

## Reduce Motion

```typescript
const reduceMotion = useReduceMotion();

// Conditional animation
{reduceMotion ? (
  <SimpleView />
) : (
  <AnimatedView />
)}

// Or use in animation config
const animationDuration = reduceMotion ? 0 : 300;
```

**When to use:**
- Always check before complex animations
- Disable transitions if `true`
- Use instant state changes instead of animated

## Lifecycle

```typescript
const lifecycleState = useLifecycle();
// Returns: 'active' | 'inactive' | 'background'

// Or use effect hooks
useOnAppBackground(() => {
  saveGameState();
});

useOnAppActive(() => {
  resumeGame();
});

// Or combined callbacks
useLifecycleCallbacks({
  onActive: () => resumeGame(),
  onInactive: () => pauseGame(),
  onBackground: () => saveGameState(),
});
```

**When to use:**
- Auto-save game state on background
- Pause/resume game timers
- Prevent data loss during app switching

## Common Patterns

### Button Press with Haptics + VoiceOver

```typescript
const haptics = useHaptics();
const { announce } = useVoiceOver();

const handlePress = async () => {
  await haptics.trigger('medium');
  // ... perform action
  await announce('Action completed');
};
```

### Accessible Animation

```typescript
const reduceMotion = useReduceMotion();

<Animated.View
  style={{
    opacity: reduceMotion ? 1 : fadeAnim,
    transform: reduceMotion ? [] : [{ scale }],
  }}
>
  {children}
</Animated.View>
```

### Game Result Feedback

```typescript
const haptics = useHaptics();
const { announce } = useVoiceOver();

if (isCorrect) {
  await haptics.success();
  await announce('Correct!', 'high');
} else {
  await haptics.error();
  await announce('Incorrect. Try again.', 'high');
}
```

### Auto-Save on Background

```typescript
useOnAppBackground(() => {
  saveToStorage(gameState);
  analytics.track('game_backgrounded', { state: gameState });
});
```

## Testing

### On Simulator
- ✅ VoiceOver: Enable in Settings > Accessibility
- ✅ Reduce Motion: Enable in Settings > Accessibility
- ✅ Lifecycle: Full support
- ❌ Haptics: Not available (will no-op)

### On Device
- ✅ All features available
- Test haptics with sound off to feel feedback
- Test VoiceOver by triple-clicking side button
- Test reduce motion in Settings > Accessibility > Motion

## Error Handling

All methods handle errors gracefully:
- Promises resolve (don't reject) if feature unavailable
- Platform checks included in hooks
- Safe to use on Android (will no-op)

## Performance

- Hooks use `useCallback` to prevent unnecessary re-renders
- Event listeners properly cleaned up on unmount
- Haptic generators cached and reused
- No polling - event-based updates only
