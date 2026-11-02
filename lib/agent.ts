// lib/agent.ts
//
// Booking Agent accounts in the app. Reads go through the signed-in session, so
// Row Level Security on the booker_* tables limits an agent to their own rows.
// "booker" is the database's code name for the Booking Agent role; it is never
// shown to anyone.
import { toISODate } from './dates';
import { supabase } from './supabase';

export interface AgentWorkspace {
  id: string;
  agencyName: string;
}

export type AgentShowStatus = 'hold' | 'pending' | 'confirmed' | 'played' | 'cancelled';

export interface AgentShow {
  id: string;
  rosterId: string;
  showDate: string;
  status: AgentShowStatus;
  venueName: string | null;
  venueCity: string | null;
  fee: number | null;
  holdRank: number | null;
  answerBy: string | null;
}

export interface AgentBand {
  id: string;
  name: string;
  genre: string | null;
  place: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  commissionPct: number | null;
}

export interface AgentVenue {
  id: string;
  name: string;
  place: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
}

/** "Austin, TX", or null when both parts are empty. */
function joinPlace(city: string | null, state: string | null): string | null {
  return [city, state].filter(Boolean).join(', ') || null;
}

/** Same rule as the website: only a band-less, non-member login can be an agent. */
export function couldBeAgent(role: string | null | undefined, actId: string | null | undefined): boolean {
  return role !== 'superadmin' && role !== 'member' && !actId;
}

/** The user's active agent workspace, or null when they don't have one. */
export async function fetchAgentWorkspace(userId: string): Promise<AgentWorkspace | null> {
  const { data, error } = await supabase
    .from('booker_profiles')
    .select('id, agency_name')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, agencyName: data.agency_name } : null;
}

/** Shows from today on, soonest first, without cancelled ones. */
export async function fetchUpcomingAgentShows(): Promise<AgentShow[]> {
  const { data, error } = await supabase
    .from('booker_shows')
    .select('id, roster_id, show_date, status, venue_name, venue_city, fee, hold_rank, answer_by')
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .gte('show_date', toISODate(new Date()))
    .order('show_date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((s) => ({
    id: s.id,
    rosterId: s.roster_id,
    showDate: s.show_date,
    status: s.status,
    venueName: s.venue_name,
    venueCity: s.venue_city,
    fee: s.fee,
    holdRank: s.hold_rank,
    answerBy: s.answer_by,
  }));
}

/** The agent's active bands, A to Z. */
export async function fetchAgentBands(): Promise<AgentBand[]> {
  const { data, error } = await supabase
    .from('booker_roster')
    .select('id, band_name, genre, home_city, home_state, contact_name, contact_email, contact_phone, commission_pct')
    .is('deleted_at', null)
    .eq('status', 'active')
    .order('band_name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((b) => ({
    id: b.id,
    name: b.band_name,
    genre: b.genre,
    place: joinPlace(b.home_city, b.home_state),
    contactName: b.contact_name,
    contactEmail: b.contact_email,
    contactPhone: b.contact_phone,
    commissionPct: b.commission_pct,
  }));
}

/** The agent's venue book, A to Z. */
export async function fetchAgentVenues(): Promise<AgentVenue[]> {
  const { data, error } = await supabase
    .from('booker_venues')
    .select('id, name, address, city, state, email, phone, website')
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    place: joinPlace(v.city, v.state),
    address: v.address,
    email: v.email,
    phone: v.phone,
    website: v.website,
  }));
}

/** Case-insensitive match on venue name or town. */
export function filterAgentVenues(venues: AgentVenue[], query: string): AgentVenue[] {
  const q = query.trim().toLowerCase();
  if (!q) return venues;
  return venues.filter((v) => v.name.toLowerCase().includes(q) || (v.place ?? '').toLowerCase().includes(q));
}

/** The one line that tells an agent what a show needs: its hold position and any deadline. */
export function showStatusLine(show: Pick<AgentShow, 'status' | 'holdRank' | 'answerBy'>): string {
  const labels: Record<AgentShowStatus, string> = {
    hold: 'Hold',
    pending: 'Offer out',
    confirmed: 'Confirmed',
    played: 'Played',
    cancelled: 'Cancelled',
  };
  const parts = [labels[show.status]];
  if (show.status === 'hold' && show.holdRank) parts[0] = `Hold #${show.holdRank}`;
  if (show.answerBy) parts.push(`answer by ${show.answerBy}`);
  return parts.join(' · ');
}
