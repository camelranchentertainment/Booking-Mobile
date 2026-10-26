// lib/venues.ts
//
// The band's venue book, for band admins in the app (More → Venues).
//
// Reads and writes `venues` directly with the signed-in user's session. Row
// level security is the boundary: band admins can read and update only their
// own act's venues (venues_select / venues_update policies), members can read
// but the Venues screen is not shown to them. The explicit act_id filter keeps
// a superadmin from seeing every act's venues at once.
import { supabase } from './supabase';

export interface VenueSummary {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  venueType: string | null;
  capacity: number | null;
  /** The venue's own contact (talent buyer / booking manager). */
  contactName: string | null;
  email: string | null;
  phone: string | null;
}

export interface VenueDetail extends VenueSummary {
  address: string | null;
  zip: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  notes: string | null;
  backlineNotes: string | null;
  payNotes: string | null;
}

/** Fields an admin can change from the app. Empty strings are saved as null. */
export interface VenueEdit {
  contactName: string;
  email: string;
  phone: string;
  notes: string;
}

const SUMMARY_COLUMNS = 'id, name, city, state, venue_type, capacity, booking_contact, email, phone';
const DETAIL_COLUMNS = `${SUMMARY_COLUMNS}, address, zip, website, google_maps_url, notes, backline_notes, pay_notes`;

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function toSummary(row: Record<string, unknown>): VenueSummary {
  return {
    id: String(row.id),
    name: str(row.name) ?? 'Unnamed venue',
    city: str(row.city),
    state: str(row.state),
    venueType: str(row.venue_type),
    capacity: typeof row.capacity === 'number' ? row.capacity : null,
    contactName: str(row.booking_contact),
    email: str(row.email),
    phone: str(row.phone),
  };
}

/** Every venue in the act's book, A–Z. */
export async function fetchVenues(actId: string): Promise<VenueSummary[]> {
  const { data, error } = await supabase
    .from('venues')
    .select(SUMMARY_COLUMNS)
    .eq('act_id', actId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toSummary(r as Record<string, unknown>));
}

/** One venue, or null when it doesn't exist or isn't the caller's. */
export async function fetchVenue(id: string): Promise<VenueDetail | null> {
  const { data, error } = await supabase.from('venues').select(DETAIL_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...toSummary(row),
    address: str(row.address),
    zip: str(row.zip),
    website: str(row.website),
    googleMapsUrl: str(row.google_maps_url),
    notes: str(row.notes),
    backlineNotes: str(row.backline_notes),
    payNotes: str(row.pay_notes),
  };
}

/**
 * Case-insensitive filter on name, city, state and contact. Pure, so the list
 * filters instantly as the admin types without another request.
 */
export function filterVenues(venues: readonly VenueSummary[], query: string): VenueSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...venues];
  return venues.filter((v) =>
    [v.name, v.city, v.state, v.contactName].some((field) => field?.toLowerCase().includes(q))
  );
}

/** Basic email shape check; the server stores whatever passes. */
export function isPlausibleEmail(value: string): boolean {
  const v = value.trim();
  return v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Saves the venue contact and notes. Returns the updated venue.
 *
 * @throws Error when the update is rejected (e.g. not the caller's venue)
 */
export async function updateVenue(id: string, edit: VenueEdit): Promise<VenueDetail> {
  const patch = {
    booking_contact: edit.contactName.trim() || null,
    email: edit.email.trim() || null,
    phone: edit.phone.trim() || null,
    notes: edit.notes.trim() || null,
  };
  const { data, error } = await supabase.from('venues').update(patch).eq('id', id).select('id');
  if (error) throw error;
  // RLS turns a forbidden update into "0 rows" rather than an error.
  if (!data || data.length === 0) throw new Error('Venue not updated (not found or not allowed)');
  const fresh = await fetchVenue(id);
  if (!fresh) throw new Error('Venue disappeared after update');
  return fresh;
}

/** "Tulsa, OK" / "Tulsa" / "" */
export function placeLabel(v: Pick<VenueSummary, 'city' | 'state'>): string {
  return [v.city, v.state].filter(Boolean).join(', ');
}
