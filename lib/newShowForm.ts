// lib/newShowForm.ts
// Pure form logic for adding a show: no React Native or network imports, so
// it can be checked directly with node.
import type { BookingStatus } from './bookingStatus';

/** Statuses offered when adding a show (completed/cancelled make no sense for a new one). */
export const NEW_SHOW_STATUSES: BookingStatus[] = ['pitch', 'negotiation', 'hold', 'contract', 'confirmed', 'advancing'];

export interface NewShowForm {
  /** Existing venue, or null to create `newVenue`, or neither for "venue TBD". */
  venueId: string | null;
  newVenue: { name: string; city: string; state: string } | null;
  /** As typed: MM/DD/YYYY (or YYYY-MM-DD). */
  date: string;
  status: BookingStatus;
  /** 24-hour HH:MM or blank. */
  loadIn: string;
  soundcheck: string;
  doors: string;
  setTime: string;
  /** Whole minutes or blank. */
  setLength: string;
  /** Dollars or blank. Admin-only field. */
  fee: string;
  notes: string;
}

export const EMPTY_FORM: NewShowForm = {
  venueId: null,
  newVenue: null,
  date: '',
  status: 'confirmed',
  loadIn: '',
  soundcheck: '',
  doors: '',
  setTime: '',
  setLength: '',
  fee: '',
  notes: '',
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Parses MM/DD/YYYY, M/D/YYYY or YYYY-MM-DD into YYYY-MM-DD, rejecting
 * impossible dates (Feb 30). Returns null when it can't.
 */
export function parseShowDate(input: string): string | null {
  const s = input.trim();
  let y: number, m: number, d: number;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (us) [m, d, y] = [Number(us[1]), Number(us[2]), Number(us[3])];
  else if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** US state / Canadian province style code: two letters. */
const STATE = /^[A-Za-z]{2}$/;

export type FieldErrors = Partial<Record<keyof NewShowForm | 'venueName' | 'venueCity' | 'venueState', string>>;

/** Validates the form. Empty object means it can be saved. */
export function validateNewShow(form: NewShowForm): FieldErrors {
  const e: FieldErrors = {};
  if (!parseShowDate(form.date)) e.date = 'Enter the date as MM/DD/YYYY.';
  if (form.newVenue) {
    if (!form.newVenue.name.trim()) e.venueName = 'Venue name is required.';
    if (!form.newVenue.city.trim()) e.venueCity = 'City is required.';
    if (!STATE.test(form.newVenue.state.trim())) e.venueState = 'Two-letter state, e.g. TX.';
  }
  for (const k of ['loadIn', 'soundcheck', 'doors', 'setTime'] as const) {
    if (form[k] !== '' && !TIME.test(form[k])) e[k] = '24-hour time, e.g. 19:30.';
  }
  if (form.setLength !== '') {
    const n = Number(form.setLength);
    if (!/^\d{1,3}$/.test(form.setLength) || n < 1 || n > 600) e.setLength = 'Minutes, 1–600.';
  }
  if (form.fee !== '') {
    const n = Number(form.fee);
    if (!Number.isFinite(n) || n < 0) e.fee = 'Dollar amount, e.g. 500.';
  }
  return e;
}
