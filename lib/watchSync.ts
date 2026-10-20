// lib/watchSync.ts
//
// Builds the small, money-free show list the Apple Watch app displays and
// sends it over. The watch only ever gets: date, venue, city, address and
// show-day times. Fees, deal notes and pay never leave the phone.
import { isWatchSyncSupported, sendShowsToWatch } from '../modules/watch-sync';
import type { UpcomingBooking } from './bookings';
import { addMinutes, formatTime, toISODate } from './dates';

/** Must match `WatchShow` in targets/watch and targets/watch-complication. */
export interface WatchShow {
  id: string;
  date: string; // "YYYY-MM-DD"
  venue: string;
  city: string;
  address: string | null;
  loadIn: string | null;
  soundcheck: string | null;
  doors: string | null;
  set: string | null;
  setEnd: string | null;
  status: string;
}

/** How many upcoming shows the watch keeps. */
export const WATCH_SHOW_LIMIT = 10;

/**
 * Upcoming, non-cancelled shows in date order, trimmed to what the watch shows.
 *
 * @param bookings bookings from the shows feed (any order)
 * @param today local date "YYYY-MM-DD"; shows before it are dropped
 */
export function toWatchShows(bookings: readonly UpcomingBooking[], today: string = toISODate(new Date())): WatchShow[] {
  return bookings
    .filter((b) => !!b.showDate && b.showDate >= today && b.status !== 'cancelled')
    .sort((a, b) => (a.showDate ?? '').localeCompare(b.showDate ?? ''))
    .slice(0, WATCH_SHOW_LIMIT)
    .map((b) => ({
      id: b.id,
      date: b.showDate as string,
      venue: b.venue?.name?.trim() || 'Venue TBD',
      city: [b.venue?.city, b.venue?.state].filter(Boolean).join(', '),
      address: b.venue?.address ?? null,
      loadIn: formatTime(b.loadInTime),
      soundcheck: formatTime(b.soundcheckTime),
      doors: formatTime(b.doorTime),
      set: formatTime(b.setTime),
      setEnd: b.endTime
        ? formatTime(b.endTime)
        : b.setTime && b.setLengthMin
          ? formatTime(addMinutes(b.setTime, b.setLengthMin))
          : null,
      status: b.status,
    }));
}

/** Sends the current shows to the watch (no-op without a watch). */
export function syncShowsToWatch(bookings: readonly UpcomingBooking[]): void {
  if (!isWatchSyncSupported()) return;
  sendShowsToWatch(JSON.stringify(toWatchShows(bookings)));
}

/** Clears the watch, e.g. on sign-out, so it never shows the last user's shows. */
export function clearWatchShows(): void {
  if (!isWatchSyncSupported()) return;
  sendShowsToWatch('[]');
}
