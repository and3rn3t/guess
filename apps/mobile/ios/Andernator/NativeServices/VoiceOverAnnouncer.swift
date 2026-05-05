import Foundation
import UIKit
import React

@objc(VoiceOverAnnouncer)
class VoiceOverAnnouncer: NSObject, NativeServiceModule, RCTBridgeModule {

    static var serviceName: String { "NativeVoiceOver" }

    @objc
    static func moduleName() -> String! {
        return serviceName
    }

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    @objc
    func announce(_ message: String, priority: String?, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        guard !message.isEmpty else {
            rejectPromise(rejecter, with: .invalidParameters("Message cannot be empty"))
            return
        }

        let announcementPriority = mapPriority(priority ?? "default")

        DispatchQueue.main.async {
            let announcement: Any

            if #available(iOS 11.0, *) {
                let attributedAnnouncement = NSAttributedString(
                    string: message,
                    attributes: [.accessibilitySpeechQueueAnnouncement: announcementPriority == .high]
                )
                announcement = attributedAnnouncement
            } else {
                announcement = message
            }

            UIAccessibility.post(notification: .announcement, argument: announcement)
            resolver(nil)
        }
    }

    @objc
    func isVoiceOverRunning(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        let isRunning = UIAccessibility.isVoiceOverRunning
        resolver(isRunning)
    }

    @objc
    func announceScreenChange(_ message: String?, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            UIAccessibility.post(notification: .screenChanged, argument: message)
            resolver(nil)
        }
    }

    @objc
    func announceLayoutChange(_ message: String?, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            UIAccessibility.post(notification: .layoutChanged, argument: message)
            resolver(nil)
        }
    }

    private enum AnnouncementPriority {
        case low
        case `default`
        case high
    }

    private func mapPriority(_ priority: String) -> AnnouncementPriority {
        switch priority.lowercased() {
        case "low":
            return .low
        case "high":
            return .high
        default:
            return .default
        }
    }
}
