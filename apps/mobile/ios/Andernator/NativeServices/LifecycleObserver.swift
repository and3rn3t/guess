import Foundation
import UIKit
import React

@objc(LifecycleObserver)
class LifecycleObserver: RCTEventEmitter, NativeServiceModule {

    static var serviceName: String { "NativeLifecycle" }

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
        return ["lifecycleChanged"]
    }

    override func startObserving() {
        hasListeners = true

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillResignActive),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )

        if #available(iOS 13.0, *) {
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(sceneDidBecomeActive),
                name: UIScene.didActivateNotification,
                object: nil
            )

            NotificationCenter.default.addObserver(
                self,
                selector: #selector(sceneWillResignActive),
                name: UIScene.willDeactivateNotification,
                object: nil
            )

            NotificationCenter.default.addObserver(
                self,
                selector: #selector(sceneDidEnterBackground),
                name: UIScene.didEnterBackgroundNotification,
                object: nil
            )

            NotificationCenter.default.addObserver(
                self,
                selector: #selector(sceneWillEnterForeground),
                name: UIScene.willEnterForegroundNotification,
                object: nil
            )
        }
    }

    override func stopObserving() {
        hasListeners = false
        NotificationCenter.default.removeObserver(self)
    }

    @objc
    func getCurrentState(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
        let state = currentStateString()
        resolver(state)
    }

    @objc
    private func appDidBecomeActive() {
        emitStateChange("active")
    }

    @objc
    private func appWillResignActive() {
        emitStateChange("inactive")
    }

    @objc
    private func appDidEnterBackground() {
        emitStateChange("background")
    }

    @objc
    private func appWillEnterForeground() {
        emitStateChange("inactive")
    }

    @available(iOS 13.0, *)
    @objc
    private func sceneDidBecomeActive(_ notification: Notification) {
        emitStateChange("active")
    }

    @available(iOS 13.0, *)
    @objc
    private func sceneWillResignActive(_ notification: Notification) {
        emitStateChange("inactive")
    }

    @available(iOS 13.0, *)
    @objc
    private func sceneDidEnterBackground(_ notification: Notification) {
        emitStateChange("background")
    }

    @available(iOS 13.0, *)
    @objc
    private func sceneWillEnterForeground(_ notification: Notification) {
        emitStateChange("inactive")
    }

    private func currentStateString() -> String {
        switch UIApplication.shared.applicationState {
        case .active:
            return "active"
        case .inactive:
            return "inactive"
        case .background:
            return "background"
        @unknown default:
            return "inactive"
        }
    }

    private func emitStateChange(_ state: String) {
        guard hasListeners else { return }
        sendEvent(withName: "lifecycleChanged", body: ["state": state])
    }
}
