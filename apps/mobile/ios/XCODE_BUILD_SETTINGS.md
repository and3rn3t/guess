# Xcode Build Settings for Native Services

## Required Build Settings

### Swift Compiler - General

**Objective-C Bridging Header:**
```
Andernator/Andernator-Bridging-Header.h
```

**Objective-C Generated Interface Header Name:**
```
Andernator-Swift.h
```
(This is the default, should be auto-generated)

**Install Objective-C Compatibility Header:**
```
Yes
```

### Swift Compiler - Language

**Swift Language Version:**
```
Swift 5
```
(Or latest available)

### Linking

**Other Linker Flags:**
```
-ObjC
```
(Should already be set by React Native)

### Search Paths

**Header Search Paths:**
```
$(inherited)
${PODS_ROOT}/Headers/Public
${PODS_ROOT}/Headers/Public/React-Core
```
(Should already be set by CocoaPods)

**Framework Search Paths:**
```
$(inherited)
${PODS_ROOT}/Frameworks
```

## Recommended Build Settings

### Deployment

**iOS Deployment Target:**
```
13.0 or higher
```
(Native services support iOS 12+, but iOS 13+ recommended for full scene lifecycle support)

### Code Signing

**Code Signing Identity:**
```
Apple Development (for debug)
iPhone Distribution (for release)
```

**Provisioning Profile:**
```
Automatic (development)
Match/Manual (production)
```

## Build Phases

### Recommended Custom Build Phases

#### 1. Verify Native Modules (Optional)
**Phase:** Run Script (before Compile Sources)
**Shell:** `/bin/bash`
**Script:**
```bash
${PROJECT_DIR}/Andernator/Scripts/verify-native-modules.sh
```

**Benefits:**
- Verifies all Swift files are present
- Checks bridging header configuration
- Catches configuration issues early

#### 2. Sync Xcode Environment
**Phase:** Run Script (before Compile Sources)
**Shell:** `/bin/bash`
**Script:**
```bash
# Sync .xcode.env files
if [ -f "${PROJECT_DIR}/../../.xcode.env" ]; then
  cp "${PROJECT_DIR}/../../.xcode.env" "${PROJECT_DIR}/.xcode.env"
fi
```

**Benefits:**
- Keeps Xcode environment in sync with project root
- Required by Expo workflow

## Compiler Warnings to Enable

### Swift Compiler - Warnings Policies

**Treat Warnings as Errors:**
```
No (for development)
Yes (for CI/production)
```

**Enable Additional Warnings:**
```
Yes
```

### Specific Warnings for Native Services

Enable these to catch common Swift/React Native bridge issues:

- **Unqualified Access to Module:** Yes
- **Unused Variables:** Yes (helps catch unused parameters)
- **Implicit Conversions:** Yes
- **Suspicious Calls:** Yes

## Optimization Settings

### Debug Configuration

**Swift Optimization Level:**
```
No Optimization [-Onone]
```

**Swift Compilation Mode:**
```
Incremental
```

**Debug Information Format:**
```
DWARF with dSYM File
```

### Release Configuration

**Swift Optimization Level:**
```
Optimize for Speed [-O]
```

**Swift Compilation Mode:**
```
Whole Module Optimization
```

**Debug Information Format:**
```
DWARF with dSYM File
```

**Strip Debug Symbols During Copy:**
```
Yes
```

## Verification Checklist

After configuring build settings:

- [ ] Build succeeds for Debug configuration
- [ ] Build succeeds for Release configuration
- [ ] No Swift compiler warnings in NativeServices files
- [ ] Bridging header generates no errors
- [ ] App runs on simulator without crashes
- [ ] Native modules appear in React Native bridge (check with testNativeModules)
- [ ] All 4 services return valid data in tests

## Common Build Issues

### Issue: "Use of undeclared type 'RCTBridgeModule'"

**Solution:**
1. Verify bridging header path in build settings
2. Ensure bridging header contains: `#import <React/RCTBridgeModule.h>`
3. Clean build folder (Shift+Cmd+K)
4. Rebuild

### Issue: "No such module 'React'"

**Solution:**
1. Run `pod install` in `apps/mobile/ios/`
2. Open `.xcworkspace` file (not `.xcodeproj`)
3. Clean build folder
4. Rebuild

### Issue: Modules not appearing in React Native

**Solution:**
1. Verify `@objc(ModuleName)` decorator on each class
2. Verify `moduleName()` static method exists
3. Check target membership in File Inspector
4. Rebuild and restart Metro bundler

### Issue: Build succeeds but app crashes on launch

**Solution:**
1. Check Xcode console for error messages
2. Verify all React Native imports are correct
3. Ensure no circular dependencies
4. Check for missing `@objc` annotations on methods called from JS

## Performance Optimization

### For Development

Keep these disabled for faster iteration:
- Whole Module Optimization: Off
- Strip Debug Symbols: Off
- Optimization Level: -Onone

### For Production

Enable these for best performance:
- Whole Module Optimization: On
- Strip Debug Symbols: On
- Optimization Level: -O
- Dead Code Stripping: Yes

## Build Time Optimization

To improve build times during development:

1. **Enable Build Active Architecture Only:**
   - Debug: Yes
   - Release: No

2. **Limit Architectures:**
   - Debug: arm64 only (for device) or x86_64 (for simulator)
   - Release: arm64, armv7 (if supporting older devices)

3. **Use Incremental Builds:**
   - Swift Compilation Mode (Debug): Incremental

4. **Parallelize Build:**
   - Build Settings → Build Options → Enable Parallel Building: Yes

## Next Steps

After configuring these settings:

1. Clean build folder: Product → Clean Build Folder (Shift+Cmd+K)
2. Build project: Product → Build (Cmd+B)
3. Run on simulator: Product → Run (Cmd+R)
4. Verify modules in app using `testNativeModules()`
5. Test on physical device for haptic feedback

## Reference

For more information on React Native module configuration:
- https://reactnative.dev/docs/native-modules-ios
- https://reactnative.dev/docs/native-modules-setup

For Swift/Objective-C bridging:
- https://developer.apple.com/documentation/swift/imported-c-and-objective-c-apis
