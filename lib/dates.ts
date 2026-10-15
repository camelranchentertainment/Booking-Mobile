/**
 * Date/time helpers for Postgres `date` and `time` columns.
 *
 * `show_date` has no time zone, so it is always parsed as a *local*
 * calendar date. Parsing it with `new Date('2026-11-01')` would treat it
 * as UTC midnight and shift the show a day earlier for anyone west of UTC.
 */

/** Parses "YYYY-MM-DD" as a local date. Returns null for null/invalid input. */
export function parseLocalDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats a local Date as "YYYY-MM-DD" (the shape Postgres `date` filters expect). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "HH:MM[:SS]" -> "7:30 PM". Returns null for null/invalid input. */
export function formatTime(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  const [hRaw, mRaw] = timeStr.split(':');
  const hour = Number(hRaw);
  const minute = Number(mRaw ?? 0);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

/** Adds minutes to an "HH:MM[:SS]" time, wrapping past midnight. */
export function addMinutes(timeStr: string | null | undefined, minutes: number): string | null {
  if (!timeStr) return null;
  const [hRaw, mRaw] = timeStr.split(':');
  const total = Number(hRaw) * 60 + Number(mRaw ?? 0) + minutes;
  if (Number.isNaN(total)) return null;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/** "SAT · NOV 1" style label used on cards. */
export function formatCardDate(dateStr: string | null | undefined): string {
  const date = parseLocalDate(dateStr);
  if (!date) return 'DATE TBD';
  const wd = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const md = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  return `${wd} · ${md}`;
}

/** "Saturday, November 1" */
export function formatLongDate(dateStr: string | null | undefined): string {
  const date = parseLocalDate(dateStr);
  if (!date) return 'Date TBD';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Whole days from today (local) to the given date; negative if past. */
export function daysFromToday(dateStr: string | null | undefined): number | null {
  const date = parseLocalDate(dateStr);
  if (!date) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((date.getTime() - start.getTime()) / 86_400_000);
}
