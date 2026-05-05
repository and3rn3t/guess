# Xcode Scheme Configuration for Native Services Testing

## Overview

This guide helps you set up Xcode schemes optimized for testing native services with different configurations.

## Recommended Schemes

### 1. Andernator (Default Scheme)

**Purpose:** Standard development with all native services enabled

**Configuration:**
- **Build Configuration:** Debug
- **Executable:** Andernator.app
- **Arguments Passed On Launch:** (none by default)
- **Environment Variables:** (see below)

**Environment Variables:**
```
FB_SONARKIT_ENABLED = 1
```

### 2. Andernator-Accessibility (Testing Scheme)

**Purpose:** Test VoiceOver and reduce motion features

**Configuration:**
- **Build Configuration:** Debug
- **Executable:** Andernator.app

**Arguments Passed On Launch:**
```
-UIAccessibilityIsVoiceOverRunning YES
-UIAccessibilityIsReduceMotionEnabled YES
```

**Environment Variables:**
```
FB_SONARKIT_ENABLED = 1
NATIVE_SERVICES_DEBUG = 1
```

**Simulator Settings to Enable:**
- Settings → Accessibility → VoiceOver → On
- Settings → Accessibility → Motion → Reduce Motion → On

### 3. Andernator-Performance (Release Testing)

**Purpose:** Test performance with release optimizations

**Configuration:**
- **Build Configuration:** Release
- **Executable:** Andernator.app
- **Arguments:** (none)

**Environment Variables:**
```
NATIVE_SERVICES_DEBUG = 0
```

## Setting Up Custom Schemes

### Creating a New Scheme:

1. In Xcode, select **Product → Scheme → Manage Schemes...**
2. Click the **+** button
3. Select **Andernator** as the target
4. Name the scheme (e.g., "Andernator-Accessibility")
5. Click **Close**

### Configuring the Scheme:

1. Select **Product → Scheme → Edit Scheme...** (or click scheme dropdown → Edit Scheme)
2. Configure each section:

#### Run Section

**Info Tab:**
- **Build Configuration:** Debug (or Release for performance testing)
- **Executable:** Andernator.app
- **Debug executable:** ☑ (check)

**Arguments Tab:**

**Arguments Passed On Launch:**
```
# For VoiceOver testing
-UIAccessibilityIsVoiceOverRunning YES

# For Reduce Motion testing
-UIAccessibilityIsReduceMotionEnabled YES

# For debugging module registration
-FBLogLevel verbose
```

**Environment Variables:**
```
# Enable native services debug logging
NATIVE_SERVICES_DEBUG = 1

# Enable React Native debug menu
RCT_METRO_PORT = 8081

# Flipper integration
FB_SONARKIT_ENABLED = 1

# Disable yellow box warnings (for cleaner accessibility testing)
RCTYELLOWBOX_ENABLED = 0
```

**Options Tab:**
- **Application Language:** System Language (or specific for testing)
- **Application Region:** System Region
- **Console:** Use Terminal

**Diagnostics Tab:**

**Runtime API Checking:**
- ☑ Main Thread Checker (catches UI updates on background threads)
- ☑ Address Sanitizer (Debug only - catches memory issues)

**Memory Management:**
- ☑ Malloc Stack (logs allocation history)
- ☐ Zombie Objects (only when debugging memory issues - impacts performance)

**Logging:**
- ☑ OS Activity Mode: Default

#### Test Section

**Info Tab:**
- **Build Configuration:** Debug

**Options Tab:**
- **Code Coverage:** ☑ Gather coverage data (optional)
- **Test Language:** System Language
- **Test Region:** System Region

#### Analyze Section

**Build Configuration:** Debug

#### Archive Section

**Build Configuration:** Release

## Environment Variables Reference

### Development Variables

```bash
# Native Services
NATIVE_SERVICES_DEBUG=1              # Enable debug logging from native modules
HAPTICS_FORCE_ENABLE=1               # Enable haptics on simulator (mock)
VOICEOVER_SIMULATE=1                 # Simulate VoiceOver running

# React Native
RCT_METRO_PORT=8081                  # Metro bundler port
RCTYELLOWBOX_ENABLED=1               # Show yellow box warnings
RCT_DEV_MENU_ENABLED=1               # Enable dev menu shake gesture

# Flipper (optional)
FB_SONARKIT_ENABLED=1                # Enable Flipper debugging
USE_FLIPPER=1                        # Use Flipper integration
```

### Testing Variables

```bash
# Accessibility Testing
ACCESSIBILITY_TEST_MODE=1            # Enable accessibility test helpers
VOICEOVER_ANNOUNCEMENT_DELAY=0       # Remove delays for faster tests

# Performance Testing  
NATIVE_SERVICES_PERF_TRACKING=1      # Track performance metrics
HAPTICS_PERF_LOG=1                   # Log haptic timing

# Integration Testing
NATIVE_MODULES_REQUIRED=1            # Fail if modules don't register
BRIDGE_TIMEOUT_MS=5000               # Bridge initialization timeout
```

## Launch Arguments Reference

### Accessibility Arguments

```bash
# VoiceOver
-UIAccessibilityIsVoiceOverRunning YES

# Reduce Motion
-UIAccessibilityIsReduceMotionEnabled YES

# Reduce Transparency
-UIAccessibilityIsReduceTransparencyEnabled YES

# Differentiate Without Color
-UIAccessibilityDarkerSystemColorsEnabled YES

# Button Shapes
-UIAccessibilityButtonShapesEnabled YES
```

### System Appearance Arguments

```bash
# Dark Mode
-UIUserInterfaceStyle Dark

# Light Mode
-UIUserInterfaceStyle Light

# Right-to-Left Layout
-AppleLanguages (ar)
-NSForceRightToLeftWritingDirection YES
```

### React Native Arguments

```bash
# Enable Fast Refresh
-FBFastRefreshEnabled YES

# Verbose Logging
-FBLogLevel verbose

# Disable bundle cache
-RCTDevLoadingViewEnabled YES
```

## Simulator Configuration

### For Haptics Testing (Simulator Limitations)

Haptics **cannot be felt** in simulator, but you can:

1. **Enable Audio Feedback:**
   - Simulator → Settings → Accessibility → Touch → Vibration → On
   - Note: This only provides visual/audio cues, not actual haptics

2. **Monitor Console:**
   - Add debug logging in `HapticsService.swift` to verify calls
   - Check console for haptic trigger messages

3. **Test on Physical Device:**
   - Always test haptics on real iPhone
   - Feel feedback with sound off

### For VoiceOver Testing

1. **Enable VoiceOver:**
   - Simulator → Accessibility Inspector
   - Or: Settings → Accessibility → VoiceOver → On

2. **VoiceOver Shortcuts:**
   - Two-finger swipe up: Read from top
   - Two-finger swipe down: Read from current position
   - Three-finger swipe: Scroll

3. **Accessibility Inspector:**
   - Xcode → Open Developer Tool → Accessibility Inspector
   - Test element descriptions and hints
   - Verify announcement order

### For Reduce Motion Testing

1. **Enable Reduce Motion:**
   - Settings → Accessibility → Motion → Reduce Motion → On

2. **Verify in App:**
   - Animations should become instant/simplified
   - Transitions should be direct
   - No parallax effects

3. **Monitor State Changes:**
   - Use `testNativeModules()` to log current state
   - Test dynamic changes while app is running

## Build Configurations

### Debug Configuration

**When to use:** Daily development, testing features

**Characteristics:**
- No optimizations (faster builds)
- Debug symbols included
- Assertions enabled
- Native services debug logging

### Release Configuration

**When to use:** Performance testing, pre-production validation

**Characteristics:**
- Full optimizations
- Debug symbols stripped
- Assertions disabled
- Production-like performance

### Creating Custom Configurations

1. **Project Navigator** → Select Project
2. **Info Tab** → Configurations section
3. Click **+** → Duplicate "Debug" Configuration
4. Name it (e.g., "Staging")
5. Adjust build settings for that configuration

## Breakpoints Configuration

### Symbolic Breakpoints for Native Services

Add these to catch common issues:

**1. React Native Module Registration:**
```
Symbol: -[RCTCxxBridge registerModuleForClass:]
Module: Andernator
```

**2. Bridge Errors:**
```
Symbol: RCTFatal
Module: React-Core
Action: Log Message + Continue
```

**3. Main Thread Violations:**
```
Symbol: _dispatch_assert_queue_fail
Module: libdispatch.dylib
```

### Method Breakpoints in Swift Files

For debugging native services:

1. Open Swift file (e.g., `HapticsService.swift`)
2. Set breakpoint in method (e.g., `trigger(_:resolver:rejecter:)`)
3. Add conditions or actions as needed

## Testing Workflow

### Daily Development

1. **Use:** Andernator scheme (Debug)
2. **Run on:** Simulator
3. **Focus:** Feature implementation
4. **Verify:** Module registration, basic functionality

### Accessibility Testing

1. **Use:** Andernator-Accessibility scheme
2. **Run on:** Simulator with VoiceOver enabled
3. **Focus:** Announcements, navigation, reduce motion
4. **Verify:** All accessibility features work

### Performance Testing

1. **Use:** Andernator-Performance scheme (Release)
2. **Run on:** Physical device
3. **Focus:** Haptics, smooth animations, battery impact
4. **Verify:** Native-quality feel, no lag

### Pre-Production Testing

1. **Use:** Release configuration
2. **Run on:** Multiple physical devices
3. **Focus:** Real-world scenarios, edge cases
4. **Verify:** Production readiness

## Troubleshooting Schemes

### Issue: Scheme not building

**Check:**
- Target membership of all files
- Build phases order
- Dependency graphs

### Issue: Environment variables not working

**Check:**
- Variables are set in Run → Arguments tab
- App is fully quit and relaunched
- Check with `ProcessInfo.processInfo.environment` in Swift

### Issue: Launch arguments ignored

**Check:**
- Arguments have proper syntax (dash prefix)
- App is reinstalled (cached values)
- Check UserDefaults in app

## Next Steps

After setting up schemes:

1. **Test each scheme** to verify configuration
2. **Document team-specific** schemes in project README
3. **Share schemes** via Xcode project (check "Shared" box)
4. **Commit scheme files** to git for team consistency

Scheme files location:
```
Andernator.xcodeproj/xcshareddata/xcschemes/
```
