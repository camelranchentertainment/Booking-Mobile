// targets/watch/WatchShow.swift
// One upcoming show, exactly as lib/watchSync.ts sends it. No money fields.
// Keep in sync with targets/watch-complication/WatchShow.swift.
import Foundation

struct WatchShow: Codable, Identifiable, Hashable {
  let id: String
  let date: String  // "YYYY-MM-DD", the venue's local date
  let venue: String
  let city: String
  let address: String?
  let loadIn: String?
  let soundcheck: String?
  let doors: String?
  let set: String?
  let setEnd: String?
  let status: String

  private static let isoDay: DateFormatter = {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f
  }()

  private static let shortDay: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US")
    f.dateFormat = "EEE MMM d"
    return f
  }()

  var day: Date? { WatchShow.isoDay.date(from: date) }

  /// Whole days from today (0 = today); nil when the date can't be read.
  var daysAway: Int? {
    guard let day else { return nil }
    let cal = Calendar.current
    return cal.dateComponents([.day], from: cal.startOfDay(for: Date()), to: cal.startOfDay(for: day)).day
  }

  /// "Tonight", "Tomorrow" or "Wed Oct 21".
  var whenLabel: String {
    switch daysAway {
    case 0: return "Tonight"
    case 1: return "Tomorrow"
    default: return day.map { WatchShow.shortDay.string(from: $0) } ?? "Date TBD"
    }
  }

  var isHold: Bool { status == "hold" || status == "pending" || status == "inquiry" }
}

/// Where the watch app keeps the last shows it received, shared with the complication.
enum WatchShowStorage {
  static let appGroup = "group.com.camelranchbooking.app"
  static let key = "shows.json"

  static func load() -> [WatchShow] {
    guard let data = UserDefaults(suiteName: appGroup)?.data(forKey: key) else { return [] }
    return (try? JSONDecoder().decode([WatchShow].self, from: data)) ?? []
  }

  static func save(_ json: String) -> [WatchShow] {
    let data = Data(json.utf8)
    guard let shows = try? JSONDecoder().decode([WatchShow].self, from: data) else { return load() }
    UserDefaults(suiteName: appGroup)?.set(data, forKey: key)
    return shows
  }
}
