/**
 * Native Modules Integration Test
 * 
 * Run this on app startup (development only) to verify all native modules are properly registered.
 * 
 * Usage:
 *   import { testNativeModules } from '@/native/testNativeModules';
 *   testNativeModules(); // Call in App.tsx during development
 */

import { NativeModules, Platform } from 'react-native';

interface ModuleTestResult {
  moduleName: string;
  available: boolean;
  methods?: string[];
  error?: string;
}

/**
 * Test if all expected native modules are available.
 * Logs results to console with detailed information.
 */
export function testNativeModules(): void {
  if (Platform.OS !== 'ios') {
    console.log('⏭️  Native modules test skipped (iOS only)');
    return;
  }

  console.log('🧪 Testing Native iOS Modules...\n');

  const expectedModules = [
    'NativeHaptics',
    'NativeVoiceOver',
    'NativeReduceMotion',
    'NativeLifecycle',
  ];

  const results: ModuleTestResult[] = [];

  expectedModules.forEach(moduleName => {
    const module = NativeModules[moduleName];
    
    if (module) {
      results.push({
        moduleName,
        available: true,
        methods: Object.keys(module).filter(key => typeof module[key] === 'function'),
      });
    } else {
      results.push({
        moduleName,
        available: false,
        error: 'Module not found in NativeModules',
      });
    }
  });

  // Print results
  results.forEach(result => {
    if (result.available) {
      console.log(`✅ ${result.moduleName}`);
      if (result.methods && result.methods.length > 0) {
        console.log(`   Methods: ${result.methods.join(', ')}`);
      }
    } else {
      console.error(`❌ ${result.moduleName}`);
      console.error(`   Error: ${result.error}`);
    }
  });

  const successCount = results.filter(r => r.available).length;
  const totalCount = results.length;

  console.log(`\n📊 Results: ${successCount}/${totalCount} modules available`);

  if (successCount === totalCount) {
    console.log('🎉 All native modules are properly registered!\n');
  } else {
    console.error('⚠️  Some native modules are missing. Check Xcode project configuration.\n');
  }
}

/**
 * Test individual module functionality with basic calls.
 * Returns true if all tests pass, false otherwise.
 */
export async function testModuleFunctionality(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    console.log('⏭️  Functionality test skipped (iOS only)');
    return true;
  }

  console.log('🧪 Testing Native Module Functionality...\n');

  let allTestsPassed = true;

  // Test NativeHaptics
  try {
    const { NativeHaptics } = NativeModules;
    if (NativeHaptics) {
      await NativeHaptics.trigger('light');
      console.log('✅ NativeHaptics.trigger() works');
    }
  } catch (error) {
    console.error('❌ NativeHaptics.trigger() failed:', error);
    allTestsPassed = false;
  }

  // Test NativeVoiceOver
  try {
    const { NativeVoiceOver } = NativeModules;
    if (NativeVoiceOver) {
      const isRunning = await NativeVoiceOver.isVoiceOverRunning();
      console.log(`✅ NativeVoiceOver.isVoiceOverRunning() works (result: ${isRunning})`);
    }
  } catch (error) {
    console.error('❌ NativeVoiceOver.isVoiceOverRunning() failed:', error);
    allTestsPassed = false;
  }

  // Test NativeReduceMotion
  try {
    const { NativeReduceMotion } = NativeModules;
    if (NativeReduceMotion) {
      const isEnabled = await NativeReduceMotion.isEnabled();
      console.log(`✅ NativeReduceMotion.isEnabled() works (result: ${isEnabled})`);
    }
  } catch (error) {
    console.error('❌ NativeReduceMotion.isEnabled() failed:', error);
    allTestsPassed = false;
  }

  // Test NativeLifecycle
  try {
    const { NativeLifecycle } = NativeModules;
    if (NativeLifecycle) {
      const state = await NativeLifecycle.getCurrentState();
      console.log(`✅ NativeLifecycle.getCurrentState() works (result: ${state})`);
    }
  } catch (error) {
    console.error('❌ NativeLifecycle.getCurrentState() failed:', error);
    allTestsPassed = false;
  }

  console.log(allTestsPassed ? '\n🎉 All functionality tests passed!\n' : '\n⚠️  Some tests failed\n');
  
  return allTestsPassed;
}

/**
 * Comprehensive test suite - runs both availability and functionality tests.
 */
export async function runNativeModuleTests(): Promise<void> {
  testNativeModules();
  await testModuleFunctionality();
}

/**
 * Get a summary of available native modules.
 */
export function getNativeModuleSummary(): Record<string, boolean> {
  if (Platform.OS !== 'ios') {
    return {};
  }

  return {
    NativeHaptics: !!NativeModules.NativeHaptics,
    NativeVoiceOver: !!NativeModules.NativeVoiceOver,
    NativeReduceMotion: !!NativeModules.NativeReduceMotion,
    NativeLifecycle: !!NativeModules.NativeLifecycle,
  };
}
