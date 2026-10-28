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
import { fetchYearExpenseList, type Expense } from './adminExpenses';
import { toISODate } from './dates';
import { API_BASE, authHeader } from './memberShows';
import { summarizeYear, type BookingRow, type YearMoney } from './moneySummary';
import { supabase } from './supabase';

export type { MoneyShow, MoneyShowState, YearMoney } from './moneySummary';

/** The year's figures plus the expense rows behind them (newest first), for the expenses list. */
export type YearMoneyDetail = YearMoney & { expenseList: Expense[] };

/**
 * Loads and summarizes one year of the band's money.
 *
 * @throws Error when either request fails (the screen shows a retry)
 */
export async function fetchYearMoney(year: number): Promise<YearMoneyDetail> {
  const [bookingsRes, expenses] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, show_date, status, fee, agreed_amount, actual_amount_received, payment_status, venue:venues(name, city, state)')
      .gte('show_date', `${year}-01-01`)
      .lte('show_date', `${year}-12-31`)
      .in('status', ['confirmed', 'completed'])
      .order('show_date', { ascending: true }),
    fetchYearExpenseList(year),
  ]);
  if (bookingsRes.error) throw bookingsRes.error;
  const summary = summarizeYear(year, (bookingsRes.data ?? []) as unknown as BookingRow[], expenses, toISODate(new Date()));
  return { ...summary, expenseList: expenses };
}

/**
 * Records that a played show has been paid: marks it completed and "received"
 * with the amount, through the website's /api/bookings/settle (band admins
 * only, enforced on the server — web PR #168). The website then reminds the
 * admin to send the venue a thank-you.
 *
 * @throws Error with the server's message when the save is refused
 */
export async function markShowPaid(bookingId: string, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter the amount received.');
  const res = await fetch(`${API_BASE}/api/bookings/settle`, {
    method: 'POST',
    headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId, actual_amount_received: amount, payment_status: 'received' }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error || `Couldn't mark it paid (${res.status}).`);
  }
}
