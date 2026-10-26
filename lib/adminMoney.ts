// lib/adminMoney.ts
//
// The band's money for one calendar year, for band admins (More → Money).
// Mirrors the website's Financials page (Booking-Platform pages/financials.tsx)
// so the two never disagree:
//
//   Earned   = actual_amount_received on completed shows marked "received"
//   Upcoming = agreed_amount (else fee) on confirmed shows dated today or later
//   Expenses = the admin's expenses dated in the year (incl. band pay), via the
//              website's /api/expenses (expenses RLS is per user, so the app
//              reads them through the same server route the website uses)
//   Net      = Earned − Expenses
//
// Bookings are read with the admin's own session; RLS limits them to the band.
import { toISODate } from './dates';
import { API_BASE, authHeader } from './memberShows';
import { summarizeYear, type BookingRow, type ExpenseRow, type YearMoney } from './moneySummary';
import { supabase } from './supabase';

export type { MoneyShow, MoneyShowState, YearMoney } from './moneySummary';

async function fetchYearExpenses(year: number): Promise<ExpenseRow[]> {
  const qs = new URLSearchParams({ start_date: `${year}-01-01`, end_date: `${year}-12-31` });
  const res = await fetch(`${API_BASE}/api/expenses?${qs.toString()}`, { headers: await authHeader() });
  if (!res.ok) throw new Error(`Expenses request failed (${res.status})`);
  const json = (await res.json()) as { expenses?: ExpenseRow[] };
  return json.expenses ?? [];
}

/**
 * Loads and summarizes one year of the band's money.
 *
 * @throws Error when either request fails (the screen shows a retry)
 */
export async function fetchYearMoney(year: number): Promise<YearMoney> {
  const [bookingsRes, expenses] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, show_date, status, fee, agreed_amount, actual_amount_received, payment_status, venue:venues(name, city, state)')
      .gte('show_date', `${year}-01-01`)
      .lte('show_date', `${year}-12-31`)
      .in('status', ['confirmed', 'completed'])
      .order('show_date', { ascending: true }),
    fetchYearExpenses(year),
  ]);
  if (bookingsRes.error) throw bookingsRes.error;
  return summarizeYear(year, (bookingsRes.data ?? []) as unknown as BookingRow[], expenses, toISODate(new Date()));
}
