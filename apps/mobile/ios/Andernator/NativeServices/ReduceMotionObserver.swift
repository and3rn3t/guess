import UIKit

/// Observer for iOS Reduce Motion preference.
///
/// TODO(ios-native): expose `getReduceMotionEnabled` and status-change events to JS.
final class ReduceMotionObserver {
    static let shared = ReduceMotionObserver()

    private init() {}

    var isReduceMotionEnabled: Bool {
        UIAccessibility.isReduceMotionEnabled
    }

    func startObserving(_ handler: @escaping (Bool) -> Void) -> NSObjectProtocol {
        NotificationCenter.default.addObserver(
            forName: UIAccessibility.reduceMotionStatusDidChangeNotification,
            object: nil,
            queue: .main
        ) { _ in
            handler(UIAccessibility.isReduceMotionEnabled)
        }
    }

    func stopObserving(_ token: NSObjectProtocol) {
        NotificationCenter.default.removeObserver(token)
    }
}
