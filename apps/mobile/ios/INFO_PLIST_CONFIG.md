# Info.plist Configuration for Native Services

## Overview

Additional Info.plist keys that may be beneficial for native services and accessibility features.

## Required Keys (Should Already Exist)

These are standard Expo/React Native keys that support our native services:

```xml
<!-- App Display Name -->
<key>CFBundleDisplayName</key>
<string>Andernator</string>

<!-- Bundle Identifier -->
<key>CFBundleIdentifier</key>
<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>

<!-- iOS Deployment Target -->
<key>MinimumOSVersion</key>
<string>13.0</string>
```

## Recommended Keys for Accessibility

### Accessibility Features

Add these if not present to better support native services:

```xml
<!-- Supports Multiple Windows (iOS 13+) -->
<!-- Required for proper LifecycleObserver scene support -->
<key>UIApplicationSceneManifest</key>
<dict>
    <key>UIApplicationSupportsMultipleScenes</key>
    <false/>
    <key>UISceneConfigurations</key>
    <dict>
        <key>UIWindowSceneSessionRoleApplication</key>
        <array>
            <dict>
                <key>UISceneConfigurationName</key>
                <string>Default Configuration</string>
                <key>UISceneDelegateClassName</key>
                <string>SceneDelegate</string>
            </dict>
        </array>
    </dict>
</dict>

<!-- Accessibility Labels -->
<!-- Helps VoiceOver understand app purpose -->
<key>NSHumanReadableCopyright</key>
<string>© 2026 Andernator</string>

<!-- User Activity Types -->
<!-- For better handoff and continuity -->
<key>NSUserActivityTypes</key>
<array>
    <string>com.andernator.game.playing</string>
    <string>com.andernator.game.challenge</string>
</array>
```

## Optional Keys for Enhanced Experience

### Background Modes (if needed)

Only add if you need background execution:

```xml
<!-- Background Modes -->
<!-- Note: Only enable if truly needed for app functionality -->
<key>UIBackgroundModes</key>
<array>
    <!-- For audio feedback while backgrounded -->
    <string>audio</string>
    <!-- For background task completion (saving game state) -->
    <string>processing</string>
</array>

<!-- Background Task Identifier -->
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
    <string>com.andernator.save-game-state</string>
</array>
```

### Localization

```xml
<!-- Localization -->
<key>CFBundleDevelopmentRegion</key>
<string>en</string>

<key>CFBundleLocalizations</key>
<array>
    <string>en</string>
    <!-- Add more languages as needed -->
</array>
```

### App Capabilities

```xml
<!-- Preferred Language -->
<key>CFBundleAllowMixedLocalizations</key>
<true/>

<!-- Status Bar Style -->
<key>UIStatusBarStyle</key>
<string>UIStatusBarStyleDefault</string>

<key>UIViewControllerBasedStatusBarAppearance</key>
<true/>
```

## Performance & Optimization

```xml
<!-- Prewarming -->
<!-- Disable if you want to test actual cold start performance -->
<key>UIApplicationSupportsIndirectInputEvents</key>
<true/>

<!-- Rendering -->
<!-- Metal support for better graphics performance -->
<key>UIRequiresPersistentWiFi</key>
<false/>
```

## Privacy & Permissions

Even though native services don't require permissions, document app behavior:

```xml
<!-- Privacy - Motion Usage Description -->
<!-- Only if you use CMMotionManager (we don't currently) -->
<!-- 
<key>NSMotionUsageDescription</key>
<string>This app uses device motion for enhanced game interactions.</string>
-->

<!-- Privacy - Microphone Usage Description -->
<!-- Only if you add voice features later -->
<!--
<key>NSMicrophoneUsageDescription</key>
<string>This app uses the microphone for voice commands.</string>
-->
```

## App Transport Security

```xml
<!-- App Transport Security -->
<!-- Expo handles this, but verify settings -->
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>
```

## Checking Current Info.plist

### Via Xcode:

1. Open project in Xcode
2. Navigate to: `Andernator` → `Info.plist`
3. Right-click → Open As → Source Code
4. Review XML content

### Via Terminal:

```bash
# From repo root
cat apps/mobile/ios/Andernator/Info.plist

# Or pretty-print:
plutil -p apps/mobile/ios/Andernator/Info.plist
```

## Expo Configuration

Since this is an Expo project, many Info.plist values come from `app.json`:

### In app.json:

```json
{
  "expo": {
    "name": "Andernator",
    "slug": "andernator",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.andernator.app",
      "buildNumber": "1",
      "supportsTablet": true,
      "infoPlist": {
        "UIBackgroundModes": ["audio"],
        "NSUserActivityTypes": [
          "com.andernator.game.playing"
        ]
      }
    }
  }
}
```

Then regenerate iOS project:
```bash
pnpm mobile:prebuild:ios
```

## Info.plist Keys Related to Native Services

### Haptics

No special Info.plist keys required. Haptic support is automatic based on device capabilities.

### VoiceOver

No special Info.plist keys required. VoiceOver uses standard UIAccessibility APIs.

### Reduce Motion

No special Info.plist keys required. Uses standard UIAccessibility.isReduceMotionEnabled.

### Lifecycle

**Optional but recommended for scene support:**

```xml
<key>UIApplicationSceneManifest</key>
<dict>
    <key>UIApplicationSupportsMultipleScenes</key>
    <false/>
</dict>
```

This ensures proper lifecycle event handling in `LifecycleObserver.swift`.

## Validation

### Check for Required Keys:

```bash
# From repo root
cd apps/mobile/ios/Andernator

# Check if key exists
/usr/libexec/PlistBuddy -c "Print :CFBundleDisplayName" Info.plist
/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" Info.plist
/usr/libexec/PlistBuddy -c "Print :MinimumOSVersion" Info.plist
```

### Validate Info.plist Format:

```bash
plutil -lint apps/mobile/ios/Andernator/Info.plist
```

Should output:
```
apps/mobile/ios/Andernator/Info.plist: OK
```

## Troubleshooting

### Issue: Changes to Info.plist not taking effect

**Solution:**
1. Clean build folder (Shift+Cmd+K)
2. Delete app from simulator/device
3. Rebuild and reinstall

### Issue: Info.plist gets overwritten after prebuild

**Solution:**
Use Expo's `app.json` → `ios.infoPlist` configuration instead of manually editing Info.plist.

### Issue: Invalid Info.plist

**Solution:**
```bash
# Validate syntax
plutil -lint Info.plist

# Convert to readable format
plutil -convert xml1 Info.plist
```

## Best Practices

1. **Use Expo config when possible** - Keeps prebuild workflow clean
2. **Document custom keys** - Add comments explaining why each key exists
3. **Version control** - Commit Info.plist changes with clear messages
4. **Test after changes** - Clean build and verify app still launches
5. **Minimal additions** - Only add keys that are truly needed

## File Locations

### Development:
```
apps/mobile/ios/Andernator/Info.plist
```

### Expo Config:
```
apps/mobile/app.json → expo.ios.infoPlist
```

### After Changes:
1. Edit `app.json` (preferred)
2. Run `pnpm mobile:prebuild:ios`
3. Verify changes in generated `Info.plist`

## References

- [Apple Info.plist Keys Reference](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/)
- [Expo app.json Configuration](https://docs.expo.dev/versions/latest/config/app/)
- [React Native Info.plist Configuration](https://reactnative.dev/docs/integration-with-existing-apps#configuring-cocoapods-dependencies)
