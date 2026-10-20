// targets/watch-complication/NextShowComplication.swift
// "Next show" on the watch face, from the shows the watch app last received.
import SwiftUI
import WidgetKit

struct NextShowEntry: TimelineEntry {
  let date: Date
  let show: WatchShow?
}

struct NextShowProvider: TimelineProvider {
  private static let sample = WatchShow(
    id: "sample", date: "2026-11-07", venue: "Southbound", city: "Tulsa, OK", address: nil,
    loadIn: "5:00 PM", soundcheck: nil, doors: nil, set: "9:00 PM", setEnd: nil, status: "confirmed")

  func placeholder(in context: Context) -> NextShowEntry {
    NextShowEntry(date: Date(), show: Self.sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (NextShowEntry) -> Void) {
    completion(NextShowEntry(date: Date(), show: context.isPreview ? Self.sample : nextShow()))
  }

  /// One entry now and one at midnight, so "Tonight"/"Tomorrow" roll over on their own.
  /// The watch app also reloads this whenever new shows arrive from the phone.
  func getTimeline(in context: Context, completion: @escaping (Timeline<NextShowEntry>) -> Void) {
    let now = Date()
    let midnight = Calendar.current.startOfDay(for: now.addingTimeInterval(86_400))
    let entries = [
      NextShowEntry(date: now, show: nextShow()),
      NextShowEntry(date: midnight, show: nextShow(asOf: midnight)),
    ]
    completion(Timeline(entries: entries, policy: .after(midnight)))
  }

  private func nextShow(asOf date: Date = Date()) -> WatchShow? {
    let cal = Calendar.current
    let start = cal.startOfDay(for: date)
    return WatchShowStorage.load()
      .filter { show in show.day.map { cal.startOfDay(for: $0) >= start } ?? false }
      .min { $0.date < $1.date }
  }
}

struct NextShowView: View {
  @Environment(\.widgetFamily) private var family
  let entry: NextShowEntry

  var body: some View {
    switch family {
    case .accessoryCircular:
      ZStack {
        AccessoryWidgetBackground()
        VStack(spacing: 0) {
          Image(systemName: "music.note")
            .font(.caption2)
            .accessibilityHidden(true)
          Text(daysText)
            .font(.headline)
            .minimumScaleFactor(0.6)
        }
      }
      .widgetLabel(entry.show?.venue ?? "No shows")
    case .accessoryInline:
      if let show = entry.show {
        Text("\(show.venue) · \(show.whenLabel)")
      } else {
        Text("No upcoming shows")
      }
    case .accessoryCorner:
      Image(systemName: "music.note")
        .widgetLabel(entry.show.map { "\($0.venue) · \($0.whenLabel)" } ?? "No shows")
    default:
      VStack(alignment: .leading, spacing: 1) {
        if let show = entry.show {
          Text(show.whenLabel.uppercased())
            .font(.caption2.weight(.bold))
            .widgetAccentable()
          Text(show.venue)
            .font(.headline)
            .lineLimit(1)
          Text(detailLine(show))
            .font(.caption2)
            .lineLimit(1)
        } else {
          Text("CAMEL RANCH").font(.caption2.weight(.bold)).widgetAccentable()
          Text("No upcoming shows").font(.footnote)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  private var daysText: String {
    guard let days = entry.show?.daysAway else { return "—" }
    return days == 0 ? "Today" : "\(days)d"
  }

  private func detailLine(_ show: WatchShow) -> String {
    if let loadIn = show.loadIn { return "Load in \(loadIn)" }
    if let set = show.set { return "Set \(set)" }
    return show.city
  }
}

struct NextShowComplication: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "NextShow", provider: NextShowProvider()) { entry in
      NextShowView(entry: entry)
        .containerBackground(for: .widget) { Color.clear }
    }
    .configurationDisplayName("Next Show")
    .description("Your next show and when it is.")
    .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline, .accessoryCorner])
  }
}

@main
struct CamelRanchComplications: WidgetBundle {
  var body: some Widget {
    NextShowComplication()
  }
}
