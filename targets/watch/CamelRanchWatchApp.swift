// targets/watch/CamelRanchWatchApp.swift
import SwiftUI

@main
struct CamelRanchWatchApp: App {
  @StateObject private var store = ShowStore()

  var body: some Scene {
    WindowGroup {
      ShowsView()
        .environmentObject(store)
    }
  }
}
