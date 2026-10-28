// lib/adminExpenses.ts
//
// Band admins add, edit and archive expenses from the app (More → Money).
// Every write goes through the website's /api/expenses routes, the same ones
// the Financials page uses, so the two always agree:
//   GET    /api/expenses?start_date&end_date   the band's, not archived
//   POST   /api/expenses                       add (tour, date, category, amount required)
//   PUT    /api/expenses/:id                   edit
//   DELETE /api/expenses/:id                   ARCHIVE — financial records are never deleted
// The server checks the caller is a band admin and the row is the band's
// (any admin of the band may edit it); RLS on `expenses` is per user, so the
// app never reads the table directly.
import { API_BASE, authHeader } from './memberShows';
import { supabase } from './supabase';

/** Categories offered when adding by hand (the website's list). */
export const EXPENSE_CATEGORIES = ['Gas / Mileage', 'Hotel / Lodging', 'Band Member Payments', 'Food / Meals', 'Equipment', 'Other'] as const;

/** Band pay recorded on a show's Lineup — tied to a band member, edited on the website. */
export const BAND_PAY = 'band_pay';

export interface Expense {
  id: string;
  expense_date: string;
  category: string;
  amount: number | string;
  notes: string | null;
  tour_id: string | null;
  booking_id: string | null;
  personnel_id: string | null;
}

export interface ExpenseDraft {
  id?: string;
  expense_date: string;
  tour_id: string;
  category: string;
  amount: number;
  notes: string | null;
}

export interface TourOption {
  id: string;
  name: string;
}

/** "Band pay (lineup)" for lineup rows, the stored name otherwise. */
export function categoryLabel(category: string): string {
  return category === BAND_PAY ? 'Band pay (lineup)' : category;
}

/** Lineup band pay can't be edited here: it belongs to a band member on a show. */
export function isEditableInApp(e: Pick<Expense, 'category'>): boolean {
  return e.category !== BAND_PAY;
}

/** True for a real calendar date written YYYY-MM-DD. */
export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  return json.error || `${fallback} (${res.status})`;
}

/**
 * The admin's expenses dated in `year`, newest first.
 *
 * @throws Error when the request fails
 */
export async function fetchYearExpenseList(year: number): Promise<Expense[]> {
  const qs = new URLSearchParams({ start_date: `${year}-01-01`, end_date: `${year}-12-31` });
  const res = await fetch(`${API_BASE}/api/expenses?${qs.toString()}`, { headers: await authHeader() });
  if (!res.ok) throw new Error(await readError(res, 'Expenses request failed'));
  const json = (await res.json()) as { expenses?: Expense[] };
  return json.expenses ?? [];
}

/** The band's tours that aren't cancelled, by name — expenses belong to a tour. RLS scopes them to the band. */
export async function fetchTourOptions(): Promise<TourOption[]> {
  const { data, error } = await supabase.from('tours').select('id, name, status').neq('status', 'cancelled').order('name');
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; name: string | null }>).map((t) => ({ id: t.id, name: t.name || 'Untitled tour' }));
}

/**
 * Adds (no id) or updates an expense.
 *
 * @throws Error with the server's message when refused
 */
export async function saveExpense(draft: ExpenseDraft): Promise<void> {
  if (!isISODate(draft.expense_date)) throw new Error('Enter the date as YYYY-MM-DD.');
  if (!draft.tour_id) throw new Error('Pick the tour this expense belongs to.');
  if (!draft.category) throw new Error('Pick a category.');
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) throw new Error('Enter an amount above $0.');
  const body = JSON.stringify({
    expense_date: draft.expense_date,
    tour_id: draft.tour_id,
    category: draft.category,
    amount: draft.amount,
    notes: draft.notes?.trim() || null,
  });
  const res = await fetch(`${API_BASE}/api/expenses${draft.id ? `/${encodeURIComponent(draft.id)}` : ''}`, {
    method: draft.id ? 'PUT' : 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(await readError(res, "Couldn't save the expense"));
}

/**
 * Archives an expense: it leaves the totals but stays on record.
 *
 * @throws Error with the server's message when refused
 */
export async function archiveExpense(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/expenses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: await authHeader(),
  });
  if (!res.ok) throw new Error(await readError(res, "Couldn't archive the expense"));
}
