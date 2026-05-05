import Foundation
import UIKit
import React

@objc(HapticsService)
class HapticsService: NSObject, NativeServiceModule, RCTBridgeModule {

    static var serviceName: String { "NativeHaptics" }

    @objc
    static func moduleName() -> String! {
        return serviceName
    }

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }

    private var impactGenerators: [UIImpactFeedbackGenerator.FeedbackStyle: UIImpactFeedbackGenerator] = [:]
    private var notificationGenerator: UINotificationFeedbackGenerator?
    private var selectionGenerator: UISelectionFeedbackGenerator?

    @objc
    func trigger(_ style: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        guard isHapticsAvailable else {
            resolver(nil)
            return
        }

        guard let feedbackStyle = mapStyleToFeedback(style) else {
            rejectPromise(rejecter, with: .invalidParameters("Invalid haptic style: \(style)"))
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.performImpact(style: feedbackStyle)
            resolver(nil)
        }
    }

    @objc
    func success(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        guard isHapticsAvailable else {
            resolver(nil)
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.performNotification(type: .success)
            resolver(nil)
        }
    }

    @objc
    func warning(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        guard isHapticsAvailable else {
            resolver(nil)
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.performNotification(type: .warning)
            resolver(nil)
        }
    }

    @objc
    func error(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        guard isHapticsAvailable else {
            resolver(nil)
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.performNotification(type: .error)
            resolver(nil)
        }
    }

    @objc
    func selection(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        guard isHapticsAvailable else {
            resolver(nil)
            return
        }

        DispatchQueue.main.async { [weak self] in
            self?.performSelection()
            resolver(nil)
        }
    }

    private var isHapticsAvailable: Bool {
        #if targetEnvironment(simulator)
        return false
        #else
        return UIDevice.current.userInterfaceIdiom == .phone
        #endif
    }

    private func mapStyleToFeedback(_ style: String) -> UIImpactFeedbackGenerator.FeedbackStyle? {
        switch style.lowercased() {
        case "light":
            return .light
        case "medium":
            return .medium
        case "heavy":
            return .heavy
        case "soft":
            if #available(iOS 13.0, *) {
                return .soft
            }
            return .light
        case "rigid":
            if #available(iOS 13.0, *) {
                return .rigid
            }
            return .heavy
        default:
            return nil
        }
    }

    private func performImpact(style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let generator: UIImpactFeedbackGenerator

        if let existing = impactGenerators[style] {
            generator = existing
        } else {
            generator = UIImpactFeedbackGenerator(style: style)
            impactGenerators[style] = generator
        }

        generator.prepare()
        generator.impactOccurred()
    }

    private func performNotification(type: UINotificationFeedbackGenerator.FeedbackType) {
        if notificationGenerator == nil {
            notificationGenerator = UINotificationFeedbackGenerator()
        }

        notificationGenerator?.prepare()
        notificationGenerator?.notificationOccurred(type)
    }

    private func performSelection() {
        if selectionGenerator == nil {
            selectionGenerator = UISelectionFeedbackGenerator()
        }

        selectionGenerator?.prepare()
        selectionGenerator?.selectionChanged()
    }
}
