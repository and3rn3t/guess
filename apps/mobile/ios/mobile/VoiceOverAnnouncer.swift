//
//  VoiceOverAnnouncer.swift
//  Andernator
//
//  Provides VoiceOver announcements for game state changes.
//
//  Why native: React Native Accessibility APIs don't provide fine-grained control over
//  announcement priority, queuing, and interruption behavior needed for real-time game feedback.
//  UIAccessibility.post with custom notification types allows proper announcement prioritization.
//
//  TS contract: Exported as `NativeVoiceOver` module with methods:
//    - announce(message: string, priority?: 'low' | 'default' | 'high'): Promise<void>
//    - isVoiceOverRunning(): Promise<boolean>
//
//  Fallback: If VoiceOver is off, announcements are no-ops. Promises always resolve.
//

import Foundation
import UIKit
import React

@objc(VoiceOverAnnouncer)
class VoiceOverAnnouncer: NSObject, NativeServiceModule, RCTBridgeModule {
  
  static var moduleName: String { "NativeVoiceOver" }
  
  @objc
  static func moduleName() -> String! {
    return moduleName
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  // MARK: - Public Methods
  
  /// Announce a message to VoiceOver users with optional priority.
  @objc
  func announce(_ message: String, priority: String?, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    
    guard !message.isEmpty else {
      rejecter.reject(with: .invalidParameters("Message cannot be empty"))
      return
    }
    
    let announcementPriority = mapPriority(priority ?? "default")
    
    DispatchQueue.main.async {
      // Create announcement with priority
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
      
      // Post the announcement
      UIAccessibility.post(notification: .announcement, argument: announcement)
      
      resolver(nil)
    }
  }
  
  /// Check if VoiceOver is currently running.
  @objc
  func isVoiceOverRunning(_ resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    let isRunning = UIAccessibility.isVoiceOverRunning
    resolver(isRunning)
  }
  
  /// Announce a screen change (for navigation).
  @objc
  func announceScreenChange(_ message: String?, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      UIAccessibility.post(notification: .screenChanged, argument: message)
      resolver(nil)
    }
  }
  
  /// Announce a layout change (for content updates).
  @objc
  func announceLayoutChange(_ message: String?, resolver: @escaping RCTPromiseResolveBlock, rejecter: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      UIAccessibility.post(notification: .layoutChanged, argument: message)
      resolver(nil)
    }
  }
  
  // MARK: - Private Helpers
  
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
