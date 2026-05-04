import UIKit

/// Native haptics entry point for iOS-specific feedback tuning.
///
/// TODO(ios-native): expose via a bridge method `triggerHaptic(style:)`.
final class HapticsService {
    static let shared = HapticsService()

    private let light = UIImpactFeedbackGenerator(style: .light)
    private let medium = UIImpactFeedbackGenerator(style: .medium)
    private let heavy = UIImpactFeedbackGenerator(style: .heavy)
    private let notify = UINotificationFeedbackGenerator()

    private init() {
        [light, medium, heavy].forEach { $0.prepare() }
        notify.prepare()
    }

    func trigger(_ style: String) {
        switch style {
        case "light":
            light.impactOccurred(intensity: 0.7)
        case "medium":
            medium.impactOccurred(intensity: 0.9)
        case "heavy":
            heavy.impactOccurred(intensity: 1.0)
        case "success":
            notify.notificationOccurred(.success)
        case "warning":
            notify.notificationOccurred(.warning)
        default:
            notify.notificationOccurred(.error)
        }

        [light, medium, heavy].forEach { $0.prepare() }
        notify.prepare()
    }
}
