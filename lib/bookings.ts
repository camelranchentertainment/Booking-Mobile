import { toISODate } from './dates';
import { supabase } from './supabase';
import type { BookingStatus } from './bookingStatus';

/** Show-day fields every role may see. */
const SHARED_COLUMNS = `id, show_date, load_in_time, soundcheck_time, set_time, door_time, end_time,
       set_length_min, status, sound_system, special_requirements, venue_contact_name,
       meals_provided, drinks_provided, hotel_booked, lodging_details,
       venue:venue_id ( id, name, city, state, address, capacity, booking_contact, phone )`;

/** Admin view adds the deal: fee and notes. */
const BOOKING_SELECT = `${SHARED_COLUMNS}, fee, deal_notes, internal_notes`;

/**
 * Member view never requests the band's fee or deal/internal notes. RLS lets
 * members read their act's bookings, so the column list is what keeps the
 * money private on a member's phone.
 */
const MEMBER_BOOKING_SELECT = SHARED_COLUMNS;

export interface BookingVenue {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  capacity: number | null;
  bookingContact: string | null;
  phone: string | null;
}

export interface UpcomingBooking {
  id: string;
  showDate: string | null;
  loadInTime: string | null;
  soundcheckTime: string | null;
  endTime: string | null;
  venueContactName: string | null;
  setTime: string | null;
  doorTime: string | null;
  setLengthMin: number | null;
  fee: number | null;
  status: string;
  dealNotes: string | null;
  internalNotes: string | null;
  soundSystem: string | null;
  specialRequirements: string | null;
  mealsProvided: boolean;
  drinksProvided: boolean;
  hotelBooked: boolean;
  lodgingDetails: string | null;
  venue: BookingVenue | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBookingRow(row: any): UpcomingBooking {
  const venueRaw = Array.isArray(row.venue) ? (row.venue[0] ?? null) : (row.venue ?? null);
  return {
    id: row.id,
    showDate: row.show_date,
    loadInTime: row.load_in_time,
    soundcheckTime: row.soundcheck_time,
    endTime: row.end_time,
    venueContactName: row.venue_contact_name,
    setTime: row.set_time,
    doorTime: row.door_time,
    setLengthMin: row.set_length_min,
    // Absent (undefined) on member queries — normalise to null.
    fee: row.fee ?? null,
    status: row.status,
    dealNotes: row.deal_notes ?? null,
    internalNotes: row.internal_notes ?? null,
    soundSystem: row.sound_system,
    specialRequirements: row.special_requirements,
    mealsProvided: row.meals_provided === true,
    drinksProvided: row.drinks_provided === true,
    hotelBooked: row.hotel_booked === true,
    lodgingDetails: row.lodging_details ?? null,
    venue: venueRaw
      ? {
          id: venueRaw.id,
          name: venueRaw.name,
          city: venueRaw.city,
          state: venueRaw.state,
          address: venueRaw.address,
          capacity: venueRaw.capacity,
          bookingContact: venueRaw.booking_contact,
          phone: venueRaw.phone,
        }
      : null,
  };
}

/**
 * Upcoming bookings, soonest first. Row-level security
 * (`bookings_member_select` / `bookings_act_access`) already scopes this
 * to the caller's own act — no `act_id` filter is applied client-side,
 * and none should be, since the database is the single source of truth
 * for who can see what.
 */
export async function fetchUpcomingBookings(limit = 25): Promise<UpcomingBooking[]> {
  // Local calendar date, not UTC: toISOString() rolls over to tomorrow
  // after ~7 PM in US time zones, which would hide tonight's show.
  const today = toISODate(new Date());

  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .gte('show_date', today)
    .order('show_date', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapBookingRow);
}

/** Statuses that never appear on the calendar or as "the next show". */
const HIDDEN_FROM_SCHEDULE = '(cancelled)';

/**
 * Every non-cancelled booking with a show date in [startDate, endDate]
 * (inclusive, "YYYY-MM-DD"), oldest first. Scoped by RLS like
 * fetchUpcomingBookings — members only receive what the database allows.
 */
export async function fetchBookingsInRange(startDate: string, endDate: string): Promise<UpcomingBooking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .gte('show_date', startDate)
    .lte('show_date', endDate)
    .not('status', 'in', HIDDEN_FROM_SCHEDULE)
    .order('show_date', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapBookingRow);
}

/**
 * Upcoming shows that are actually happening (confirmed, advancing or under
 * contract), soonest first — the source for the Day Sheet tab.
 */
export async function fetchUpcomingConfirmed(limit = 10): Promise<UpcomingBooking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .gte('show_date', toISODate(new Date()))
    .in('status', ['confirmed', 'advancing', 'contract'])
    .order('show_date', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapBookingRow);
}

/**
 * Member-safe details (no fee or deal notes) for specific bookings. Used to
 * enrich the member's own show list from the web API.
 */
export async function fetchMemberBookingDetails(ids: string[]): Promise<Map<string, UpcomingBooking>> {
  const map = new Map<string, UpcomingBooking>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase.from('bookings').select(MEMBER_BOOKING_SELECT).in('id', ids);
  if (error) throw error;
  for (const row of data ?? []) {
    const b = mapBookingRow(row);
    map.set(b.id, b);
  }
  return map;
}

export interface BookingEditableFields {
  status: BookingStatus;
  loadInTime: string | null;
  setTime: string | null;
  doorTime: string | null;
  fee: number | null;
  dealNotes: string | null;
  internalNotes: string | null;
}

/**
 * Updates the editable fields of a single booking and returns the fresh
 * row (re-joined with its venue) so the caller can splice it straight
 * back into local state without a second round trip.
 *
 * The app's edit UI is restricted to `band_admin`/`superadmin` (see
 * ShowsScreen), and as of the `restrict_bookings_write_to_admins`
 * migration this is also enforced by the database itself: row-level
 * security on `bookings` now grants INSERT/UPDATE/DELETE only to
 * `band_admin`/`superadmin` roles and an act's owner. A plain `member`
 * account calling this directly (bypassing the app entirely) will get
 * an RLS rejection from Postgres, not just a hidden button — the UI gate
 * and the database policy now agree.
 */
export async function updateBooking(
  id: string,
  fields: Partial<BookingEditableFields>
): Promise<UpcomingBooking> {
  const patch: Record<string, unknown> = {};
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.loadInTime !== undefined) patch.load_in_time = fields.loadInTime;
  if (fields.setTime !== undefined) patch.set_time = fields.setTime;
  if (fields.doorTime !== undefined) patch.door_time = fields.doorTime;
  if (fields.fee !== undefined) patch.fee = fields.fee;
  if (fields.dealNotes !== undefined) patch.deal_notes = fields.dealNotes;
  if (fields.internalNotes !== undefined) patch.internal_notes = fields.internalNotes;

  const { data, error } = await supabase
    .from('bookings')
    .update(patch)
    .eq('id', id)
    .select(BOOKING_SELECT)
    .single();

  if (error) throw error;
  return mapBookingRow(data);
}
