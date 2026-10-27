// lib/newShow.ts
// Adding a show from the phone (band admins). Mirrors the website's New
// Booking form: a direct insert under the caller's own session, so the
// bookings RLS policy ("Band admin can manage bookings") is the boundary and
// the venue-contact trigger copies day-of contacts onto the show.
import { parseShowDate, validateNewShow, type NewShowForm } from './newShowForm';
import { mapBookingRow, type UpcomingBooking } from './bookings';
import { supabase } from './supabase';

export * from './newShowForm';

/** Another non-cancelled show already on that date (any venue), for a warning. */
export async function findShowsOnDate(actId: string, isoDate: string): Promise<{ id: string; venueName: string | null }[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, venue:venue_id ( name )')
    .eq('act_id', actId)
    .eq('show_date', isoDate)
    .neq('status', 'cancelled');
  if (error) throw error;
  return (data ?? []).map((r) => {
    const v = (r as { venue?: { name?: string } | { name?: string }[] | null }).venue;
    const venue = Array.isArray(v) ? v[0] : v;
    return { id: String((r as { id: string }).id), venueName: venue?.name ?? null };
  });
}

const toTime = (v: string) => (v === '' ? null : `${v}:00`);

/**
 * Creates the venue (when new) and the show. The act always comes from the
 * caller's profile, never from user input.
 *
 * @throws Error when validation fails or the database rejects the insert
 */
export async function createShow(params: { actId: string; userId: string; form: NewShowForm }): Promise<UpcomingBooking> {
  const { actId, userId, form } = params;
  const errors = validateNewShow(form);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const showDate = parseShowDate(form.date)!;

  let venueId = form.venueId;
  if (!venueId && form.newVenue) {
    const { data, error } = await supabase
      .from('venues')
      .insert({
        act_id: actId,
        name: form.newVenue.name.trim(),
        city: form.newVenue.city.trim(),
        state: form.newVenue.state.trim().toUpperCase(),
      })
      .select('id')
      .single();
    if (error) throw error;
    venueId = String(data.id);
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      created_by: userId,
      act_id: actId,
      venue_id: venueId,
      status: form.status,
      show_date: showDate,
      load_in_time: toTime(form.loadIn),
      soundcheck_time: toTime(form.soundcheck),
      door_time: toTime(form.doors),
      set_time: toTime(form.setTime),
      set_length_min: form.setLength === '' ? null : Number(form.setLength),
      // The website's money pages read agreed_amount (Potential); the app's day
      // sheet still shows `fee`. Write both so the show reads the same everywhere.
      agreed_amount: form.fee === '' ? null : Number(form.fee),
      fee: form.fee === '' ? null : Number(form.fee),
      internal_notes: form.notes.trim() || null,
      pitched_at: form.status === 'pitch' ? new Date().toISOString() : null,
      source: 'mobile_app',
    })
    .select(
      `id, show_date, load_in_time, soundcheck_time, set_time, door_time, end_time, set_length_min, status,
       sound_system, special_requirements, venue_contact_name, day_of_contact_phone, sound_engineer_name,
       sound_engineer_phone, meals_provided, drinks_provided, hotel_booked, lodging_details, fee, deal_notes,
       internal_notes, venue:venue_id ( id, name, city, state, address, capacity, booking_contact, phone )`
    )
    .single();
  if (error) throw error;
  return mapBookingRow(data);
}
