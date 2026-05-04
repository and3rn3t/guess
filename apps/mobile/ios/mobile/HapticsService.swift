//
//  HapticsService.swift
//  Andernator
//
//  Provides native haptic feedback for game interactions.
//
//  Why native: React Native Haptics module provides basic feedback, but iOS offers more
//  nuanced haptic patterns (UIImpactFeedbackGenerator with varying weights, UINotificationFeedbackGenerator)
//  that better match game state transitions and user actions per HIG.
//
//  TS contract: Exported as `NativeHaptics` module with methods:
//    - trigger(style: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid'): Promise<void>
//    - success(): Promise<void>
//    - warning(): Promise<void>
//    - error(): Promise<void>
//    - selection(): Promise<void>
//
//  Fallback: If unavailable (simulator, older devices), promises resolve without haptic output.
//

import Foundation
import UIKit
import React

@objc(HapticsService)
class HapticsService: NSObject, NativeServiceModule, RCTBridgeModule {
  
  static var moduleName: String { "NativeHaptics" }
  
  @objc
  static func moduleName() -> String! {
    return moduleName
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  // MARK: - Feedback Generators
  
  private var impactGenerators: [UIImpactFeedbackGenerator.FeedbackStyle: UIImpactFeedbackGenerator] = [:]
  private var notificationGenerator: UINotificationFeedbackGenerator?
  private var selectionGenerator: UISelectionFeedbackGenerator?
  
  // MARK: - Public Methods
  
  /// Trigger an impact haptic with the specified style.
  @objc
  func trigger(_ style: String, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    guard isHapticsAvailable else {
      resolver(nil)
      return
    }
    
    guard let feedbackStyle = mapStyleToFeedback(style) else {
      rejecter.reject(with: .invalidParameters("Invalid haptic style: \(style)"))
      return
    }
    
    DispatchQueue.main.async { [weak self] in
      self?.performImpact(style: feedbackStyle)
      resolver(nil)
    }
  }
  
  /// Trigger a success notification haptic.
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
  
  /// Trigger a warning notification haptic.
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
  
  /// Trigger an error notification haptic.
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
  
  /// Trigger a selection haptic.
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
  
  // MARK: - Private Helpers
  
  private var isHapticsAvailable: Bool {
    // Haptics require a physical device with Taptic Engine
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
      } else {
        return .light
      }
    case "rigid":
      if #available(iOS 13.0, *) {
        return .rigid
      } else {
        return .heavy
      }
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
