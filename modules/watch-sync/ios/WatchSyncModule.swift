// modules/watch-sync/ios/WatchSyncModule.swift
//
// iPhone side of the Apple Watch sync. JS hands over the upcoming shows as a
// JSON string; we pass it to the watch with WatchConnectivity's application
// context, which keeps only the latest copy and delivers it whenever the
// watch app next wakes (no need for both apps to be open at once).
import ExpoModulesCore
import WatchConnectivity

/// Owns the WCSession for the app's lifetime. All state is touched on the
/// main queue, so the delegate callbacks (background queue) hop over first.
final class WatchSessionBridge: NSObject, WCSessionDelegate {
  static let shared = WatchSessionBridge()

  /// Latest context requested before the session finished activating.
  private var pending: [String: Any]?

  func activate() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    if session.delegate == nil { session.delegate = self }
    if session.activationState != .activated { session.activate() }
  }

  /// Sends the context now, or as soon as the session is active.
  func send(_ context: [String: Any]) {
    DispatchQueue.main.async {
      guard WCSession.isSupported() else { return }
      let session = WCSession.default
      guard session.activationState == .activated else {
        self.pending = context
        self.activate()
        return
      }
      // No paired watch or no watch app installed: nothing to do.
      guard session.isPaired, session.isWatchAppInstalled else { return }
      do {
        try session.updateApplicationContext(context)
      } catch {
        NSLog("[WatchSync] updateApplicationContext failed: %@", error.localizedDescription)
      }
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    if let error = error {
      NSLog("[WatchSync] activation failed: %@", error.localizedDescription)
    }
    DispatchQueue.main.async {
      guard activationState == .activated, let context = self.pending else { return }
      self.pending = nil
      self.send(context)
    }
  }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  /// Called when the user switches to a different watch; reactivate for the new one.
  func sessionDidDeactivate(_ session: WCSession) {
    session.activate()
  }
}

public class WatchSyncModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WatchSync")

    OnCreate {
      WatchSessionBridge.shared.activate()
    }

    /// True on iPhones that can pair with an Apple Watch.
    Function("isSupported") { () -> Bool in
      WCSession.isSupported()
    }

    /// `showsJson` is a JSON array of WatchShow objects (see lib/watchSync.ts).
    Function("updateShows") { (showsJson: String) in
      WatchSessionBridge.shared.send([
        "shows": showsJson,
        "updatedAt": Date().timeIntervalSince1970,
      ])
    }
  }
}
