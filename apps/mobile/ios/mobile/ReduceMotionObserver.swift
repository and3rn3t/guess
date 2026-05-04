//
//  ReduceMotionObserver.swift
//  Andernator
//
//  Observes and reports Reduce Motion accessibility setting changes.
//
//  Why native: React Native's AccessibilityInfo.isReduceMotionEnabled provides one-time checks,
//  but doesn't expose a reliable event emitter for dynamic changes. iOS notifications
//  (UIAccessibility.reduceMotionStatusDidChangeNotification) provide real-time updates needed
//  for responsive animation adjustments during gameplay.
//
//  TS contract: Exported as `NativeReduceMotion` module with:
//    - isEnabled(): Promise<boolean>
//    - addListener(eventType: 'reduceMotionChanged'): EventSubscription
//    Event payload: { isEnabled: boolean }
//
//  Fallback: If bridge is unavailable, TS callers should assume reduce motion is off
//  and gracefully degrade to simpler animations.
//

import Foundation
import UIKit
import React

@objc(ReduceMotionObserver)
class ReduceMotionObserver: RCTEventEmitter, NativeServiceModule {
  
  static var moduleName: String { "NativeReduceMotion" }
  
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
  
  // MARK: - Public Methods
  
  /// Get the current reduce motion setting.
  @objc
  func isEnabled(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let isEnabled = UIAccessibility.isReduceMotionEnabled
    resolver(isEnabled)
  }
  
  /// Get additional motion-related settings (iOS 13+).
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
  
  // MARK: - Private Helpers
  
  @objc
  private func reduceMotionStatusChanged() {
    guard hasListeners else { return }
    
    let isEnabled = UIAccessibility.isReduceMotionEnabled
    sendEvent(withName: "reduceMotionChanged", body: ["isEnabled": isEnabled])
  }
}
