import UIKit

/// Accessibility announcement helper for gameplay state transitions.
///
/// TODO(ios-native): expose via a bridge method `announceForAccessibility(message:)`.
enum VoiceOverAnnouncer {
    static func announce(_ message: String) {
        guard UIAccessibility.isVoiceOverRunning else { return }
        UIAccessibility.post(notification: .announcement, argument: message)
    }
}
