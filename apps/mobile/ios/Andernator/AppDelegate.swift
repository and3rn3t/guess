//
//  AppDelegate.swift
//  Andernator
//
//  Expo + React Native app delegate with native service module registration.
//
//  Native modules registered:
//    - HapticsService: Native haptic feedback for game interactions
//    - VoiceOverAnnouncer: Accessibility announcements for game state changes
//    - ReduceMotionObserver: Reduce motion setting observation
//    - LifecycleObserver: App lifecycle state management
//
//  Why native modules: These provide capabilities beyond Expo's default abstractions,
//  meeting iOS HIG requirements for native-quality game interactions and accessibility.
//
//  TS contract: See NativeServices.ts for TypeScript type definitions.
//
//  Fallback: All modules gracefully degrade if unavailable (simulator, older iOS versions).
//

internal import Expo
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
#if DEBUG
    // Force RN's packager URL provider to prefer tunnel host in device debug runs.
    let configuredMetroHost = ProcessInfo.processInfo.environment["RCT_METRO_HOST"] ?? "htghubm-anonymous-8081.exp.direct"
    let configuredMetroPort = ProcessInfo.processInfo.environment["RCT_METRO_PORT"] ?? "443"
    let configuredMetroScheme = ProcessInfo.processInfo.environment["RCT_METRO_SCHEME"] ?? "https"

    let hostWithPort = "\(configuredMetroHost):\(configuredMetroPort)"

    let bundleProvider = RCTBundleURLProvider.sharedSettings()
    bundleProvider.packagerScheme = configuredMetroScheme
    bundleProvider.jsLocation = hostWithPort
    NSLog("[MetroURL] Configured RCTBundleURLProvider jsLocation=\(hostWithPort) scheme=\(configuredMetroScheme)")
#endif

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    if let bridgeURL = bridge.bundleURL {
      NSLog("[MetroURL] Using bridge.bundleURL: \(bridgeURL.absoluteString)")
      return bridgeURL
    }

    return bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    let bundlePath = ".expo/.virtual-metro-entry.bundle?platform=ios&dev=true&minify=false"

    if let metroHost = ProcessInfo.processInfo.environment["RCT_METRO_HOST"], !metroHost.isEmpty {
      let metroPort = ProcessInfo.processInfo.environment["RCT_METRO_PORT"] ?? "8081"
      let metroScheme = ProcessInfo.processInfo.environment["RCT_METRO_SCHEME"] ?? "http"
      let bundleURL = URL(string: "\(metroScheme)://\(metroHost):\(metroPort)/\(bundlePath)")
      if let resolvedURL = bundleURL {
        NSLog("[MetroURL] Using env override bundle URL: \(resolvedURL.absoluteString)")
      } else {
        NSLog("[MetroURL] Failed to build env override URL with host=\(metroHost), port=\(metroPort), scheme=\(metroScheme)")
      }
      return bundleURL
    }

    let provider = RCTBundleURLProvider.sharedSettings()
    if let configuredHost = provider.jsLocation, !configuredHost.isEmpty {
      let configuredScheme = provider.packagerScheme
      let directProviderURL = URL(string: "\(configuredScheme)://\(configuredHost)/\(bundlePath)")
      if let resolvedURL = directProviderURL {
        NSLog("[MetroURL] Using provider direct bundle URL: \(resolvedURL.absoluteString)")
      } else {
        NSLog("[MetroURL] Failed provider direct URL with host=\(configuredHost), scheme=\(configuredScheme)")
      }
      return directProviderURL
    }

    let fallbackURL = RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
    if let resolvedURL = fallbackURL {
      NSLog("[MetroURL] Using RCTBundleURLProvider fallback URL: \(resolvedURL.absoluteString)")
    } else {
      NSLog("[MetroURL] RCTBundleURLProvider returned nil bundle URL")
    }
    return fallbackURL
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
