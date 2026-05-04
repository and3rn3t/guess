//
//  BridgeContract.swift
//  Andernator
//
//  Native bridge contract for React Native communication.
//
//  Why native: Defines the TypeScript-to-Swift API surface for native-only capabilities
//  that exceed Expo's built-in abstractions (haptics, VoiceOver, reduced motion, lifecycle).
//
//  TS contract: All modules expose RCTBridgeModule interface with promise-based methods.
//
//  Fallback: If bridge is unavailable, TS callers receive rejected promises or no-op behavior.
//

import Foundation
import React

/// Protocol defining the contract for all native service modules exposed to React Native.
/// Conforming types must be NSObject subclasses and implement RCTBridgeModule.
@objc protocol NativeServiceModule: AnyObject {
  /// Human-readable name for the module, used in error reporting and logging.
  static var moduleName: String { get }
  
  /// Whether the module should be initialized eagerly on app launch.
  /// Default: false (lazy initialization)
  @objc optional static var requiresMainQueueSetup: Bool { get }
}

/// Error types that can be returned across the bridge.
enum BridgeError: Error, LocalizedError {
  case notAvailable(String)
  case invalidParameters(String)
  case systemError(String)
  
  var errorDescription: String? {
    switch self {
    case .notAvailable(let message):
      return "Native feature not available: \(message)"
    case .invalidParameters(let message):
      return "Invalid parameters: \(message)"
    case .systemError(let message):
      return "System error: \(message)"
    }
  }
  
  /// Convert to dictionary format suitable for React Native promise rejection.
  var bridgeErrorDict: [String: Any] {
    return [
      "message": errorDescription ?? "Unknown error",
      "code": errorCode
    ]
  }
  
  private var errorCode: String {
    switch self {
    case .notAvailable: return "E_NOT_AVAILABLE"
    case .invalidParameters: return "E_INVALID_PARAMS"
    case .systemError: return "E_SYSTEM_ERROR"
    }
  }
}

/// Helper extensions for promise-based bridge methods.
extension RCTPromiseResolveBlock {
  /// Resolve with success and optional data.
  func resolve(with value: Any? = nil) {
    self(value)
  }
}

extension RCTPromiseRejectBlock {
  /// Reject with a BridgeError.
  func reject(with error: BridgeError) {
    let dict = error.bridgeErrorDict
    self(dict["code"] as? String, dict["message"] as? String, nil)
  }
  
  /// Reject with a custom message.
  func reject(code: String, message: String) {
    self(code, message, nil)
  }
}
