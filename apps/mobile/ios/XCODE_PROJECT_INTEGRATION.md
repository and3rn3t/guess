# Xcode Project Integration Guide

## Step 1: Add Swift Files to Xcode Project

### Manual Steps in Xcode:

1. **Open the project:**
   ```bash
   pnpm mobile:open:xcode
   # Or manually: open apps/mobile/ios/Andernator.xcworkspace
   ```

2. **Create NativeServices group:**
   - In Xcode's Project Navigator (left sidebar)
   - Right-click on the `Andernator` folder
   - Select "New Group"
   - Name it: `NativeServices`

3. **Add Swift files to the project:**
   - Right-click on the newly created `NativeServices` group
   - Select "Add Files to Andernator..."
   - Navigate to where the Swift files are located:
     - `BridgeContract.swift`
     - `HapticsService.swift`
     - `VoiceOverAnnouncer.swift`
     - `ReduceMotionObserver.swift`
     - `LifecycleObserver.swift`
   - **Important options:**
     - ☑️ **"Copy items if needed"** (check this to copy files into the project)
     - ☑️ **"Create groups"** (not folder references)
     - ☑️ **Add to targets:** Make sure `Andernator` is checked
   - Click "Add"

4. **Configure Bridging Header:**
   - If this is your first Swift file integration, Xcode may ask to create a bridging header
   - If prompted, click "Create Bridging Header"
   - If NOT prompted, add manually:
     - Select the `Andernator` project in navigator
     - Select the `Andernator` target
     - Go to Build Settings tab
     - Search for "bridging"
     - Under "Swift Compiler - General" find "Objective-C Bridging Header"
     - Set value to: `Andernator/Andernator-Bridging-Header.h`

5. **Verify files are added:**
   - Each `.swift` file should appear in the `NativeServices` group
   - Select each file and check the File Inspector (right sidebar)
   - Ensure "Target Membership" shows `Andernator` checked

## Step 2: Move Files to Correct Location

If you created the Swift files outside the project directory, move them:

```bash
# From repo root
mkdir -p apps/mobile/ios/Andernator/NativeServices

# Move Swift files
mv BridgeContract.swift apps/mobile/ios/Andernator/NativeServices/
mv HapticsService.swift apps/mobile/ios/Andernator/NativeServices/
mv VoiceOverAnnouncer.swift apps/mobile/ios/Andernator/NativeServices/
mv ReduceMotionObserver.swift apps/mobile/ios/Andernator/NativeServices/
mv LifecycleObserver.swift apps/mobile/ios/Andernator/NativeServices/

# Move bridging header
mv Andernator-Bridging-Header.h apps/mobile/ios/Andernator/
```

## Step 3: Move TypeScript Files to Mobile App

```bash
# From repo root
mkdir -p apps/mobile/src/native

# Move TypeScript files
mv NativeServices.ts apps/mobile/src/native/
mv useNativeServices.ts apps/mobile/src/native/
mv NativeServicesExamples.tsx apps/mobile/src/native/

# Move documentation
mv NativeServices-README.md apps/mobile/src/native/README.md
mv NATIVE_SERVICES_QUICK_REF.md apps/mobile/src/native/QUICK_REFERENCE.md
```

## Step 4: Build and Verify

1. **Clean build folder (recommended):**
   - In Xcode: Product → Clean Build Folder (Shift+Cmd+K)

2. **Build the project:**
   - In Xcode: Product → Build (Cmd+B)
   - Fix any compilation errors

3. **Verify modules are registered:**
   - Build should succeed without errors
   - React Native will auto-discover the modules via `@objc` decorators

## Step 5: Run Validation Commands

```bash
# From repo root
pnpm validate:fast
pnpm --filter @guess/mobile typecheck
pnpm mobile:guardrails
```

## Step 6: Test on Device/Simulator

### On Simulator:
```bash
# Run the app
pnpm mobile:ios

# Or from Xcode:
# Product → Run (Cmd+R)
```

### Test Checklist:
- [ ] App builds successfully
- [ ] App launches without crashes
- [ ] Console shows no module registration errors
- [ ] React Native bridge is connected

## Troubleshooting

### Issue: "Use of undeclared type 'RCTBridgeModule'"

**Solution:** Ensure bridging header is configured and contains:
```objc
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
```

### Issue: "No such module 'React'"

**Solution:** 
1. Clean build folder
2. Run `pnpm mobile:pods` to reinstall pods
3. Rebuild

### Issue: Modules not appearing in React Native

**Solution:**
1. Verify `@objc(ModuleName)` decorator is present
2. Verify `moduleName()` static method returns correct string
3. Check that files have target membership
4. Rebuild and restart Metro bundler

### Issue: Build succeeds but crashes at runtime

**Solution:**
1. Check Xcode console for error messages
2. Verify all imports in Swift files are correct
3. Ensure bridging header imports are correct
4. Check that React Native dependency versions match

## Verification Script

Create a test in your React Native app to verify modules are available:

```typescript
// apps/mobile/src/native/testNativeModules.ts
import { NativeModules } from 'react-native';

export function testNativeModules() {
  const modules = [
    'NativeHaptics',
    'NativeVoiceOver', 
    'NativeReduceMotion',
    'NativeLifecycle'
  ];

  modules.forEach(moduleName => {
    if (NativeModules[moduleName]) {
      console.log(`✅ ${moduleName} is available`);
    } else {
      console.error(`❌ ${moduleName} is NOT available`);
    }
  });
}

// Run on app startup to verify
testNativeModules();
```

## Next Steps After Integration

Once files are added and building successfully:

1. **Update documentation:**
   - Add implementation notes to `docs/mobile/xcode-setup.md`
   - Document any Expo config changes needed

2. **Create example integration:**
   - Pick one game screen to integrate native services
   - Use examples from `NativeServicesExamples.tsx`
   - Test on physical device for haptics

3. **Prepare PR:**
   - Use handoff block from `XCODE_IMPLEMENTATION_HANDOFF.md`
   - Include screenshots/videos of haptics and accessibility features
   - Document testing performed

## Files Added to Git

Make sure these are tracked and committed:

```bash
# Swift files
git add apps/mobile/ios/Andernator/NativeServices/*.swift
git add apps/mobile/ios/Andernator/Andernator-Bridging-Header.h

# TypeScript files  
git add apps/mobile/src/native/NativeServices.ts
git add apps/mobile/src/native/useNativeServices.ts
git add apps/mobile/src/native/NativeServicesExamples.tsx
git add apps/mobile/src/native/README.md
git add apps/mobile/src/native/QUICK_REFERENCE.md

# Documentation
git add apps/mobile/ios/AppDelegate.swift
git add docs/mobile/XCODE_IMPLEMENTATION_HANDOFF.md
```
