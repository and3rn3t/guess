import Foundation
import React

/// Protocol defining the contract for all native service modules exposed to React Native.
/// Conforming types must be NSObject subclasses and implement RCTBridgeModule.
protocol NativeServiceModule: AnyObject {
    /// Human-readable name for the module, used in error reporting and logging.
    static var serviceName: String { get }
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

/// Reject a React Native promise with a typed bridge error.
func rejectPromise(_ rejecter: RCTPromiseRejectBlock, with error: BridgeError) {
    let dict = error.bridgeErrorDict
    rejecter(dict["code"] as? String, dict["message"] as? String, nil)
}

/// Reject a React Native promise with a custom code/message pair.
func rejectPromise(_ rejecter: RCTPromiseRejectBlock, code: String, message: String) {
    rejecter(code, message, nil)
}
