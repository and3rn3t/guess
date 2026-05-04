//
//  LifecycleObserver.swift
//  Andernator
//
//  Observes and reports app lifecycle state changes for game pause/resume behavior.
//
//  Why native: React Native AppState module provides basic foreground/background events,
//  but doesn't expose fine-grained UIScene lifecycle events needed for proper multi-window
//  support and precise timing of game state saves. iOS scene delegates provide more accurate
//  state transition hooks for game pause/resume logic.
//
//  TS contract: Exported as `NativeLifecycle` module with:
//    - getCurrentState(): Promise<'active' | 'inactive' | 'background'>
//    - addListener(eventType: 'lifecycleChanged'): EventSubscription
//    Event payload: { state: 'active' | 'inactive' | 'background' }
//
//  Fallback: If unavailable, TS callers should use React Native's AppState module as fallback.
//

import Foundation
import UIKit
import React

@objc(LifecycleObserver)
class LifecycleObserver: RCTEventEmitter, NativeServiceModule {
  
  static var moduleName: String { "NativeLifecycle" }
  
  private var hasListeners = false
  
  @objc
  override static func moduleName() -> String! {
    return moduleName
  }
  
  @objc
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  // MARK: - Lifecycle
  
  override init() {
    super.init()
    startObserving()
  }
  
  deinit {
    stopObserving()
  }
  
  // MARK: - RCTEventEmitter Overrides
  
  override func supportedEvents() -> [String]! {
    return ["lifecycleChanged"]
  }
  
  override func startObserving() {
    hasListeners = true
    
    // Register for app lifecycle notifications
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
    
    // iOS 13+ scene lifecycle notifications
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
  
  // MARK: - Public Methods
  
  /// Get the current app lifecycle state.
  @objc
  func getCurrentState(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let state = currentStateString()
    resolver(state)
  }
  
  // MARK: - App Lifecycle Observers
  
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
  
  // MARK: - Scene Lifecycle Observers (iOS 13+)
  
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
  
  // MARK: - Private Helpers
  
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
