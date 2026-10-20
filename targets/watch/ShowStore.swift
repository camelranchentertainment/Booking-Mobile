// targets/watch/ShowStore.swift
// Receives the show list from the iPhone app over WatchConnectivity, keeps it
// on the watch so it works without the phone nearby, and refreshes the
// watch-face complication when it changes.
import Foundation
import WatchConnectivity
import WidgetKit

@MainActor
final class ShowStore: NSObject, ObservableObject {
  @Published private(set) var shows: [WatchShow] = WatchShowStorage.load()
  @Published private(set) var lastUpdated: Date?

  override init() {
    super.init()
    if WCSession.isSupported() {
      WCSession.default.delegate = self
      WCSession.default.activate()
    }
  }

  /// Upcoming only: anything before today drops off even if the phone hasn't synced since.
  var upcoming: [WatchShow] {
    shows.filter { ($0.daysAway ?? 0) >= 0 }
  }

  fileprivate func apply(showsJson: String, updatedAt: Double?) {
    shows = WatchShowStorage.save(showsJson)
    if let updatedAt { lastUpdated = Date(timeIntervalSince1970: updatedAt) }
    WidgetCenter.shared.reloadAllTimelines()
  }

  /// Pulls the Sendable parts out of a context before hopping to the main actor.
  nonisolated fileprivate func receive(_ context: [String: Any]) {
    guard let json = context["shows"] as? String else { return }
    let updatedAt = context["updatedAt"] as? Double
    Task { @MainActor in self.apply(showsJson: json, updatedAt: updatedAt) }
  }
}

extension ShowStore: WCSessionDelegate {
  nonisolated func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    // Pick up whatever the phone sent while the watch app wasn't running.
    let context = session.receivedApplicationContext
    guard !context.isEmpty else { return }
    receive(context)
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    receive(applicationContext)
  }
}
