// lib/moneySummary.ts
// Pure year-money math for the admin Money screen (no network, no React), so
// it can be checked on its own. Rules mirror the website's Financials page;
// see lib/adminMoney.ts for the data loading.

export type MoneyShowState = 'paid' | 'unpaid' | 'upcoming' | 'other';

export interface MoneyShow {
  id: string;
  date: string; // YYYY-MM-DD
  status: string;
  venue: string;
  place: string;
  /** agreed_amount, else fee; null when none set */
  fee: number | null;
  received: number | null;
  state: MoneyShowState;
}

export interface YearMoney {
  year: number;
  earned: number;
  upcoming: number;
  expenses: number;
  bandPay: number;
  net: number;
  shows: MoneyShow[];
  /** Dated before today and not marked received — money still owed to the band. */
  unpaid: MoneyShow[];
}

export interface BookingRow {
  id: string;
  show_date: string | null;
  status: string;
  fee: number | string | null;
  agreed_amount: number | string | null;
  actual_amount_received: number | string | null;
  payment_status: string | null;
  venue: { name: string | null; city: string | null; state: string | null } | null;
}

export interface ExpenseRow {
  expense_date: string;
  amount: number | string;
  category: string;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Pure year summary from raw rows; exported so it can be checked in isolation.
 *
 * @param today local date YYYY-MM-DD
 */
export function summarizeYear(year: number, bookings: readonly BookingRow[], expenses: readonly ExpenseRow[], today: string): YearMoney {
  const prefix = `${year}-`;
  const shows: MoneyShow[] = bookings
    .filter((b) => b.show_date?.startsWith(prefix) && (b.status === 'confirmed' || b.status === 'completed'))
    .map((b) => {
      const fee = num(b.agreed_amount) ?? num(b.fee);
      const received = num(b.actual_amount_received);
      const paid = b.payment_status === 'received';
      // Past shows not marked received are money still owed, whether or not
      // the show was moved to "completed" yet.
      let state: MoneyShowState = 'other';
      if (b.status === 'completed' && paid) state = 'paid';
      else if (b.show_date! < today) state = 'unpaid';
      else if (b.status === 'confirmed') state = 'upcoming';
      return {
        id: b.id,
        date: b.show_date!,
        status: b.status,
        venue: b.venue?.name ?? 'Venue TBA',
        place: [b.venue?.city, b.venue?.state].filter(Boolean).join(', '),
        fee,
        received,
        state,
      };
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const earned = cents(shows.filter((s) => s.state === 'paid').reduce((t, s) => t + (s.received ?? 0), 0));
  const upcoming = cents(shows.filter((s) => s.state === 'upcoming').reduce((t, s) => t + (s.fee ?? 0), 0));
  const yearExpenses = expenses.filter((e) => e.expense_date?.startsWith(prefix));
  const expenseTotal = cents(yearExpenses.reduce((t, e) => t + (num(e.amount) ?? 0), 0));
  const bandPay = cents(
    yearExpenses.filter((e) => e.category === 'band_pay' || e.category === 'Band Member Payments').reduce((t, e) => t + (num(e.amount) ?? 0), 0)
  );

  return {
    year,
    earned,
    upcoming,
    expenses: expenseTotal,
    bandPay,
    net: cents(earned - expenseTotal),
    shows,
    unpaid: shows.filter((s) => s.state === 'unpaid'),
  };
}
