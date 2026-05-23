import Foundation
import LocalAuthentication

@objc(SuperPrintLocalAuthentication)
class SuperPrintLocalAuthentication: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(authenticate:resolver:rejecter:)
  func authenticate(
    _ reason: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let context = LAContext()
    context.localizedCancelTitle = "Sign in instead"
    context.localizedFallbackTitle = "Use device passcode"

    var error: NSError?
    let policy = LAPolicy.deviceOwnerAuthentication

    guard context.canEvaluatePolicy(policy, error: &error) else {
      resolve(false)
      return
    }

    context.evaluatePolicy(policy, localizedReason: reason) { success, _ in
      resolve(success)
    }
  }
}
