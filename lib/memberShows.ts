import Constants from 'expo-constants';

import { fetchMemberBookingDetails, type UpcomingBooking } from './bookings';
import { supabase } from './supabase';

/**
 * A member's own shows, from the website's `/api/member/shows` route.
 *
 * Why the web API instead of querying Supabase directly: per-show pay lives
 * in `expenses`, whose RLS only lets the band admin who wrote a row read it.
 * The web route reads it server-side, scoped to the caller's own
 * `booking_personnel` rows, and never exposes anyone else's pay. Reusing it
 * means no new database policy is needed for the app.
 */

export const API_BASE: string =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'https://www.camelranchbooking.com';

export type Rsvp = 'pending' | 'confirmed' | 'declined';

export interface MemberPay {
  amount: number;
  /** 'confirmed' = amount the band admin set for this show; 'estimated' = the member's default rate. */
  source: 'confirmed' | 'estimated';
}

export interface MemberShow {
  /** booking_personnel.id — the member's spot on this show. */
  assignmentId: string;
  rsvp: Rsvp;
  rsvpNotes: string | null;
  pay: MemberPay | null;
  booking: UpcomingBooking;
}

interface ApiMemberShow {
  id: string;
  booking_id: string | null;
  status: string;
  notes: string | null;
  show_date: string | null;
  booking_status: string | null;
  load_in_time: string | null;
  set_time: string | null;
  door_time: string | null;
  soundcheck_time: string | null;
  venue: { name: string | null; address: string | null; city: string | null; state: string | null } | null;
  pay: { amount: number; source: 'confirmed' | 'estimated' } | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function authHeader(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new ApiError('Not signed in', 401);
  return { Authorization: `Bearer ${session.access_token}` };
}

function normaliseRsvp(value: string): Rsvp {
  return value === 'confirmed' || value === 'declined' ? value : 'pending';
}

/** Minimal booking built from the API row, used if the detail query can't see the booking. */
function bookingFromApi(row: ApiMemberShow): UpcomingBooking {
  return {
    id: row.booking_id ?? row.id,
    showDate: row.show_date,
    loadInTime: row.load_in_time,
    soundcheckTime: row.soundcheck_time,
    endTime: null,
    venueContactName: null,
    setTime: row.set_time,
    doorTime: row.door_time,
    setLengthMin: null,
    fee: null,
    status: row.booking_status ?? 'confirmed',
    dealNotes: null,
    internalNotes: null,
    soundSystem: null,
    specialRequirements: null,
    mealsProvided: false,
    drinksProvided: false,
    hotelBooked: false,
    lodgingDetails: null,
    venue: row.venue
      ? {
          id: '',
          name: row.venue.name ?? 'Venue TBD',
          city: row.venue.city,
          state: row.venue.state,
          address: row.venue.address,
          capacity: null,
          bookingContact: null,
          phone: null,
        }
      : null,
  };
}

/**
 * Every show the signed-in person is on the roster for (past and future),
 * oldest first, with their RSVP and pay. Cancelled bookings are dropped.
 */
export async function fetchMemberShows(): Promise<MemberShow[]> {
  const res = await fetch(`${API_BASE}/api/member/shows`, { headers: await authHeader() });
  if (!res.ok) throw new ApiError(`Member shows request failed (${res.status})`, res.status);
  const json = (await res.json()) as { shows?: ApiMemberShow[] };
  const rows = json.shows ?? [];

  const ids = rows.map((r) => r.booking_id).filter((id): id is string => !!id);
  // Enrich with full show-day details (end time, logistics, venue phone).
  // If this fails we still show what the API gave us rather than nothing.
  let details = new Map<string, UpcomingBooking>();
  try {
    details = await fetchMemberBookingDetails(ids);
  } catch (err) {
    console.warn('[memberShows] detail enrichment failed; showing basic info', err);
  }

  return rows
    .map((r) => ({
      assignmentId: r.id,
      rsvp: normaliseRsvp(r.status),
      rsvpNotes: r.notes,
      pay: r.pay,
      booking: (r.booking_id && details.get(r.booking_id)) || bookingFromApi(r),
    }))
    .filter((s) => s.booking.status !== 'cancelled');
}

/**
 * Tells the band admin whether the member can make a show. The server
 * verifies the assignment belongs to the caller and ignores any pay fields.
 */
export async function respondToShow(assignmentId: string, rsvp: 'confirmed' | 'declined'): Promise<void> {
  const res = await fetch(`${API_BASE}/api/member/shows/${encodeURIComponent(assignmentId)}`, {
    method: 'PATCH',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: rsvp }),
  });
  if (!res.ok) throw new ApiError(`Could not save your answer (${res.status})`, res.status);
}
