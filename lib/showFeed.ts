/**
 * One place that decides *which* shows each role sees, so every tab agrees.
 *
 * - Band admins / superadmin: the act's whole booking pipeline (pitches,
 *   holds, confirmed) straight from `bookings`, including the fee.
 * - Members: only the shows they're on the roster for, with their own
 *   RSVP and pay, and never the band's fee or deal notes.
 */
import {
  fetchBookingsInRange,
  fetchUpcomingBookings,
  fetchUpcomingConfirmed,
  type UpcomingBooking,
} from './bookings';
import { toISODate } from './dates';
import { fetchMemberShows, type MemberShow } from './memberShows';

export interface ShowItem {
  booking: UpcomingBooking;
  /** Present when the viewer is a member: their RSVP and pay for this show. */
  member: MemberShow | null;
}

const asItems = (bookings: UpcomingBooking[]): ShowItem[] => bookings.map((booking) => ({ booking, member: null }));
const fromMember = (shows: MemberShow[]): ShowItem[] => shows.map((m) => ({ booking: m.booking, member: m }));

const today = () => toISODate(new Date());
const isUpcoming = (s: MemberShow) => (s.booking.showDate ?? '') >= today();

/** Shows tab. */
export async function fetchShowsFeed(isMember: boolean): Promise<ShowItem[]> {
  if (!isMember) return asItems(await fetchUpcomingBookings());
  return fromMember((await fetchMemberShows()).filter(isUpcoming));
}

/** Calendar tab: everything with a date in [start, end]. */
export async function fetchCalendarFeed(isMember: boolean, start: string, end: string): Promise<ShowItem[]> {
  if (!isMember) return asItems(await fetchBookingsInRange(start, end));
  return fromMember(
    (await fetchMemberShows()).filter((s) => {
      const d = s.booking.showDate ?? '';
      return d >= start && d <= end;
    })
  );
}

/** Day Sheet tab: upcoming shows that are happening (members: ones they haven't declined). */
export async function fetchDaySheetFeed(isMember: boolean): Promise<ShowItem[]> {
  if (!isMember) return asItems(await fetchUpcomingConfirmed());
  return fromMember((await fetchMemberShows()).filter((s) => isUpcoming(s) && s.rsvp !== 'declined'));
}
