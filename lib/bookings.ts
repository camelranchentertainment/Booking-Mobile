import { supabase } from './supabase';
import type { BookingStatus } from './bookingStatus';

const BOOKING_SELECT = `id, show_date, load_in_time, set_time, door_time, set_length_min, fee, status,
       deal_notes, internal_notes, sound_system, special_requirements,
       venue:venue_id ( id, name, city, state, address, capacity, booking_contact, phone )`;

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
  setTime: string | null;
  doorTime: string | null;
  setLengthMin: number | null;
  fee: number | null;
  status: string;
  dealNotes: string | null;
  internalNotes: string | null;
  soundSystem: string | null;
  specialRequirements: string | null;
  venue: BookingVenue | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBookingRow(row: any): UpcomingBooking {
  const venueRaw = Array.isArray(row.venue) ? (row.venue[0] ?? null) : (row.venue ?? null);
  return {
    id: row.id,
    showDate: row.show_date,
    loadInTime: row.load_in_time,
    setTime: row.set_time,
    doorTime: row.door_time,
    setLengthMin: row.set_length_min,
    fee: row.fee,
    status: row.status,
    dealNotes: row.deal_notes,
    internalNotes: row.internal_notes,
    soundSystem: row.sound_system,
    specialRequirements: row.special_requirements,
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
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .gte('show_date', today)
    .order('show_date', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(mapBookingRow);
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
