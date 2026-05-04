import Foundation

/// Bridge contract notes for Xcode-first implementation.
///
/// Planned JS bridge methods:
/// - triggerHaptic(style: String)
/// - announceForAccessibility(message: String)
/// - getReduceMotionEnabled() -> Bool
/// - observeLifecycle(callback)
///
/// Keep business logic in TS/app-core. Native code provides capabilities only.
enum BridgeContract {
    static let plannedMethods: [String] = [
        "triggerHaptic(style:)",
        "announceForAccessibility(message:)",
        "getReduceMotionEnabled()",
        "observeLifecycle(callback:)"
    ]
}
