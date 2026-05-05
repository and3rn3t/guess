import Foundation
import UIKit
import React

@objc(ReduceMotionObserver)
class ReduceMotionObserver: RCTEventEmitter, NativeServiceModule {

    static var serviceName: String { "NativeReduceMotion" }

    private var hasListeners = false

    @objc
    override static func moduleName() -> String! {
        return serviceName
    }

    @objc
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    override init() {
        super.init()
        startObserving()
    }

    deinit {
        stopObserving()
    }

    override func supportedEvents() -> [String]! {
        return ["reduceMotionChanged"]
    }

    override func startObserving() {
        hasListeners = true
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(reduceMotionStatusChanged),
            name: UIAccessibility.reduceMotionStatusDidChangeNotification,
            object: nil
        )
    }

    override func stopObserving() {
        hasListeners = false
        NotificationCenter.default.removeObserver(
            self,
            name: UIAccessibility.reduceMotionStatusDidChangeNotification,
            object: nil
        )
    }

    @objc
    func isEnabled(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        let isEnabled = UIAccessibility.isReduceMotionEnabled
        resolver(isEnabled)
    }

    @objc
    func getMotionSettings(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        var settings: [String: Any] = [
            "reduceMotion": UIAccessibility.isReduceMotionEnabled
        ]

        if #available(iOS 13.0, *) {
            settings["differentiateWithoutColor"] = UIAccessibility.shouldDifferentiateWithoutColor
            settings["onOffSwitchLabels"] = UIAccessibility.isOnOffSwitchLabelsEnabled
        }

        if #available(iOS 14.0, *) {
            settings["reduceTransparency"] = UIAccessibility.isReduceTransparencyEnabled
        }

        resolver(settings)
    }

    @objc
    private func reduceMotionStatusChanged() {
        guard hasListeners else { return }

        let isEnabled = UIAccessibility.isReduceMotionEnabled
        sendEvent(withName: "reduceMotionChanged", body: ["isEnabled": isEnabled])
    }
}
