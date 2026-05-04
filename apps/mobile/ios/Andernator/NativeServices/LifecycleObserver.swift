import UIKit

enum AppLifecycleState: String {
    case active
    case inactive
    case background
}

/// App lifecycle observer to support resume-safe behavior.
///
/// TODO(ios-native): bridge lifecycle events to TS for game session safety.
final class LifecycleObserver {
    private(set) var tokens: [NSObjectProtocol] = []

    func start(_ emit: @escaping (AppLifecycleState) -> Void) {
        let center = NotificationCenter.default

        tokens.append(center.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { _ in emit(.active) })

        tokens.append(center.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { _ in emit(.inactive) })

        tokens.append(center.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { _ in emit(.background) })
    }

    func stop() {
        let center = NotificationCenter.default
        tokens.forEach { center.removeObserver($0) }
        tokens.removeAll()
    }
}
