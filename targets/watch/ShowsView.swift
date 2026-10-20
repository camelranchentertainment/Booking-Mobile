// targets/watch/ShowsView.swift
// Watch screens: the next shows, and a show-day view for each.
import SwiftUI

enum Brand {
  static let orange = Color(red: 0.91, green: 0.38, blue: 0.17)   // #E8622C
  static let mustard = Color(red: 0.92, green: 0.66, blue: 0.20)  // #EBA834
  static let cream = Color(red: 0.96, green: 0.91, blue: 0.82)    // #F6E8D0
}

struct ShowsView: View {
  @EnvironmentObject private var store: ShowStore

  var body: some View {
    NavigationStack {
      Group {
        if store.upcoming.isEmpty {
          EmptyShowsView()
        } else {
          List(store.upcoming) { show in
            NavigationLink(value: show) {
              ShowRow(show: show)
            }
          }
        }
      }
      .navigationTitle("Shows")
      .navigationDestination(for: WatchShow.self) { ShowDetailView(show: $0) }
    }
    .tint(Brand.orange)
  }
}

private struct EmptyShowsView: View {
  var body: some View {
    VStack(spacing: 8) {
      Image(systemName: "music.note.list")
        .font(.title2)
        .foregroundStyle(Brand.orange)
        .accessibilityHidden(true)
      Text("No shows yet")
        .font(.headline)
      Text("Open Camel Ranch on your iPhone to load your schedule.")
        .font(.footnote)
        .multilineTextAlignment(.center)
        .foregroundStyle(.secondary)
    }
    .padding()
  }
}

private struct ShowRow: View {
  let show: WatchShow

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack {
        Text(show.whenLabel.uppercased())
          .font(.caption2.weight(.bold))
          .foregroundStyle(show.daysAway == 0 ? Brand.orange : Brand.mustard)
        if show.isHold {
          Text("HOLD")
            .font(.caption2.weight(.bold))
            .foregroundStyle(.secondary)
        }
      }
      Text(show.venue)
        .font(.headline)
        .foregroundStyle(Brand.cream)
        .lineLimit(2)
      if !show.city.isEmpty {
        Text(show.city)
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
      if let set = show.set {
        Text("Set \(set)")
          .font(.footnote)
          .foregroundStyle(Brand.mustard)
      }
    }
    .padding(.vertical, 4)
    .accessibilityElement(children: .combine)
  }
}

private struct TimelineRow: Identifiable {
  let time: String
  let label: String
  let highlight: Bool
  var id: String { label }
}

struct ShowDetailView: View {
  let show: WatchShow

  private var timeline: [TimelineRow] {
    var rows: [TimelineRow] = []
    if let t = show.loadIn { rows.append(TimelineRow(time: t, label: "Load in", highlight: false)) }
    if let t = show.soundcheck { rows.append(TimelineRow(time: t, label: "Soundcheck", highlight: false)) }
    if let t = show.doors { rows.append(TimelineRow(time: t, label: "Doors", highlight: false)) }
    if let t = show.set { rows.append(TimelineRow(time: t, label: "Our set", highlight: true)) }
    if let t = show.setEnd { rows.append(TimelineRow(time: t, label: "Set ends", highlight: false)) }
    return rows
  }

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 10) {
        Text(show.whenLabel.uppercased())
          .font(.caption.weight(.bold))
          .foregroundStyle(Brand.orange)
        Text(show.venue)
          .font(.title3.weight(.bold))
          .foregroundStyle(Brand.cream)
        if !show.city.isEmpty {
          Text(show.city).font(.footnote).foregroundStyle(.secondary)
        }

        if timeline.isEmpty {
          Text("Times not set yet").font(.footnote).foregroundStyle(.secondary)
        } else {
          VStack(alignment: .leading, spacing: 6) {
            ForEach(timeline) { row in
              HStack(alignment: .firstTextBaseline) {
                Text(row.time)
                  .font(.footnote.weight(.semibold).monospacedDigit())
                  .foregroundStyle(row.highlight ? Brand.orange : Brand.mustard)
                  .frame(minWidth: 62, alignment: .leading)
                Text(row.label).font(.footnote)
              }
              .accessibilityElement(children: .combine)
            }
          }
          .padding(.top, 4)
        }

        if let address = show.address, !address.isEmpty {
          Divider()
          Label(address, systemImage: "mappin.and.ellipse")
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 4)
    }
    .navigationTitle(show.whenLabel)
  }
}
