// lib/adminTours.ts
//
// Band admins follow and steer their tours from the app (More → Tours):
// the list of tours with progress, one tour's targets grouped by where they
// stand, moving a target along (target → follow up → declined / thank you),
// and editing the tour's name, dates and status.
//
// Reads use the admin's own session (RLS scopes tours and targets to the
// band). Target status changes go through the website's PATCH
// /api/tours/venues, the same call the Tours page makes, so the booking
// pipeline stays in sync (statusSync). Tour edits write `tours` directly;
// RLS allows that for the band's admins only.
import { parseLocalDate } from './dates';
import { API_BASE, authHeader } from './memberShows';
import { supabase } from './supabase';

export type TourStatus = 'planning' | 'active' | 'completed' | 'cancelled';
export type TargetStatus = 'target' | 'follow_up' | 'confirmed' | 'declined' | 'thank_you';

export const TOUR_STATUS_LABEL: Record<TourStatus, string> = {
  planning: 'Planning',
  active: 'On the road',
  completed: 'Done',
  cancelled: 'Cancelled',
};

export const TARGET_STATUS_LABEL: Record<TargetStatus, string> = {
  target: 'To pitch',
  follow_up: 'Following up',
  confirmed: 'Booked',
  thank_you: 'Thanked',
  declined: 'Declined',
};

/** Display order for the target groups on a tour. */
export const TARGET_ORDER: readonly TargetStatus[] = ['follow_up', 'target', 'confirmed', 'thank_you', 'declined'];

/**
 * Statuses a target can be moved to from the app. "Booked" is left to adding
 * the show itself (the Shows tab +, or the website), so a booked target always
 * has a real show behind it.
 */
export const MOVABLE_TO: readonly TargetStatus[] = ['target', 'follow_up', 'declined', 'thank_you'];

export interface TourSummary {
  id: string;
  name: string;
  status: TourStatus;
  startDate: string | null;
  endDate: string | null;
  targets: number;
  booked: number;
  followUps: number;
}

export interface TourTarget {
  id: string;
  status: TargetStatus;
  lastContactedAt: string | null;
  notes: string | null;
  venue: { id: string | null; name: string; city: string | null; state: string | null; phone: string | null; email: string | null };
}

export interface TourDetail extends TourSummary {
  actId: string | null;
  description: string | null;
  list: TourTarget[];
}

export interface TourEdit {
  name: string;
  startDate: string;
  endDate: string;
  status: TourStatus;
}

const asStatus = (s: unknown): TargetStatus =>
  s === 'follow_up' || s === 'confirmed' || s === 'declined' || s === 'thank_you' ? s : 'target';
const asTourStatus = (s: unknown): TourStatus =>
  s === 'active' || s === 'completed' || s === 'cancelled' ? s : 'planning';

function summarize(row: Record<string, unknown>, statuses: TargetStatus[]): TourSummary {
  return {
    id: row.id as string,
    name: (row.name as string | null) || 'Untitled tour',
    status: asTourStatus(row.status),
    startDate: (row.start_date as string | null) ?? null,
    endDate: (row.end_date as string | null) ?? null,
    targets: statuses.length,
    booked: statuses.filter((s) => s === 'confirmed' || s === 'thank_you').length,
    followUps: statuses.filter((s) => s === 'follow_up').length,
  };
}

/**
 * The band's tours: on the road first, then planning, then the rest; newest
 * start first within each. The act filter keeps a superadmin to their own band.
 */
export async function fetchTours(actId: string): Promise<TourSummary[]> {
  const { data, error } = await supabase
    .from('tours')
    .select('id, name, status, start_date, end_date, tour_venues(status)')
    .eq('act_id', actId)
    .order('start_date', { ascending: false, nullsFirst: true });
  if (error) throw error;
  const rank: Record<TourStatus, number> = { active: 0, planning: 1, completed: 2, cancelled: 3 };
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((r) => summarize(r, ((r.tour_venues as Array<{ status: unknown }> | null) ?? []).map((t) => asStatus(t.status))))
    .sort((a, b) => rank[a.status] - rank[b.status]);
}

/** One tour with its targets. */
export async function fetchTour(id: string): Promise<TourDetail> {
  const { data, error } = await supabase
    .from('tours')
    .select('id, act_id, name, status, start_date, end_date, description, tour_venues(id, status, last_contacted_at, notes, venue:venues(id, name, city, state, phone, email))')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This tour was not found.');
  const row = data as Record<string, unknown>;
  const list: TourTarget[] = ((row.tour_venues as Array<Record<string, unknown>> | null) ?? []).map((t) => {
    const vRaw = t.venue as Record<string, unknown> | Array<Record<string, unknown>> | null;
    const v = (Array.isArray(vRaw) ? vRaw[0] : vRaw) ?? null;
    return {
      id: t.id as string,
      status: asStatus(t.status),
      lastContactedAt: (t.last_contacted_at as string | null) ?? null,
      notes: (t.notes as string | null) ?? null,
      venue: {
        id: (v?.id as string | undefined) ?? null,
        name: (v?.name as string | undefined) || 'Venue',
        city: (v?.city as string | null | undefined) ?? null,
        state: (v?.state as string | null | undefined) ?? null,
        phone: (v?.phone as string | null | undefined) ?? null,
        email: (v?.email as string | null | undefined) ?? null,
      },
    };
  });
  list.sort((a, b) => a.venue.name.localeCompare(b.venue.name));
  return {
    ...summarize(row, list.map((t) => t.status)),
    actId: (row.act_id as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    list,
  };
}

/**
 * Moves a target to a new status through the website, which keeps any show
 * at that venue in step.
 *
 * @throws Error with the server's message when refused
 */
export async function setTargetStatus(targetId: string, status: TargetStatus): Promise<void> {
  const res = await fetch(`${API_BASE}/api/tours/venues`, {
    method: 'PATCH',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: targetId, status }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(res.status === 403 ? 'Only the tour’s owner can change its targets.' : json.error || `Couldn't update the target (${res.status}).`);
  }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The first problem with a tour edit, or null. Dates are optional but must be YYYY-MM-DD and in order. */
export function validateTourEdit(e: TourEdit): string | null {
  if (!e.name.trim()) return 'Give the tour a name.';
  if (e.startDate && !ISO.test(e.startDate)) return 'Write the start date like 2026-11-07.';
  if (e.endDate && !ISO.test(e.endDate)) return 'Write the end date like 2026-11-21.';
  if (e.startDate && e.endDate && e.endDate < e.startDate) return 'The end date is before the start date.';
  return null;
}

/**
 * Saves the tour's name, dates and status.
 *
 * @throws Error with a readable message when refused
 */
export async function updateTour(id: string, e: TourEdit): Promise<void> {
  const problem = validateTourEdit(e);
  if (problem) throw new Error(problem);
  const { error } = await supabase
    .from('tours')
    .update({ name: e.name.trim(), start_date: e.startDate || null, end_date: e.endDate || null, status: e.status })
    .eq('id', id);
  if (error) throw new Error(`Couldn't save the tour: ${error.message}`);
}

/** "Nov 7 – Nov 21, 2026", "From Nov 7, 2026", or "Dates not set". */
export function tourDates(start: string | null, end: string | null): string {
  const f = (d: string, year: boolean) =>
    parseLocalDate(d)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}) }) ?? d;
  if (start && end) return `${f(start, false)} – ${f(end, true)}`;
  if (start) return `From ${f(start, true)}`;
  if (end) return `Until ${f(end, true)}`;
  return 'Dates not set';
}

/**
 * The website's new-show form, prefilled with this venue and tour, so the
 * show is linked to the tour and the target counts as booked.
 */
export function bookShowUrl(base: string, venueId: string | null, tourId: string, actId: string | null): string {
  const qs = new URLSearchParams({ tour: tourId });
  if (venueId) qs.set('venue', venueId);
  if (actId) qs.set('act', actId);
  return `${base}/bookings/new?${qs.toString()}`;
}
