// lib/adminRoster.ts
//
// Band admins manage the roster (band and crew) from the app: add people,
// edit their role, contact details and usual pay, and take people off the
// active roster or bring them back. Nobody is deleted — past shows and pay
// history keep pointing at them.
//
// Reads and writes use the admin's own session; RLS on act_personnel
// ("Band admin can manage personnel") allows writes only for the act's band
// admins and superadmin, so a member's phone can't change the roster even if
// it tried. Same table and fields as the website's Members page.
import { supabase } from './supabase';

export interface RosterPerson {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  /** Usual pay per show; admins only. */
  pay: number | null;
  /** Has a login linked to this roster spot. */
  hasLogin: boolean;
  active: boolean;
}

export interface PersonDraft {
  name: string;
  role: string;
  phone: string;
  email: string;
  /** Dollars as typed; '' for none. */
  pay: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "150" / "$1,250.50" → number; '' → null; anything else → NaN. */
export function parsePay(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  return /^\d+(\.\d{1,2})?$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

/** The first problem with a draft, or null when it can be saved. */
export function validatePerson(d: PersonDraft): string | null {
  if (!d.name.trim()) return 'Enter a name.';
  if (d.name.trim().length > 120) return 'That name is too long.';
  if (d.email.trim() && !EMAIL.test(d.email.trim())) return 'Enter a full email address, like name@example.com.';
  if (Number.isNaN(parsePay(d.pay) as number)) return 'Enter pay as a dollar amount, e.g. 150.';
  return null;
}

function toRow(d: PersonDraft) {
  return {
    name: d.name.trim(),
    instrument_role: d.role.trim() || null,
    phone: d.phone.trim() || null,
    email: d.email.trim().toLowerCase() || null,
    default_pay_amount: parsePay(d.pay),
  };
}

/** Everyone on the act's roster, active first, then by name. */
export async function fetchRoster(actId: string): Promise<RosterPerson[]> {
  const { data, error } = await supabase
    .from('act_personnel')
    .select('id, name, instrument_role, default_pay_amount, phone, email, linked_user_id, is_active')
    .eq('act_id', actId)
    .order('name', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((r) => ({
      id: r.id as string,
      name: (r.name as string | null) ?? 'Unnamed',
      role: (r.instrument_role as string | null) ?? null,
      phone: (r.phone as string | null) ?? null,
      email: (r.email as string | null) ?? null,
      pay: r.default_pay_amount == null ? null : Number(r.default_pay_amount),
      hasLogin: r.linked_user_id != null,
      active: r.is_active !== false,
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

/**
 * Adds a person to the act's roster.
 *
 * @throws Error with a readable message when the save is refused
 */
export async function addPerson(actId: string, d: PersonDraft): Promise<void> {
  const problem = validatePerson(d);
  if (problem) throw new Error(problem);
  const { error } = await supabase.from('act_personnel').insert({ act_id: actId, ...toRow(d) });
  if (error) throw new Error(`Couldn't add ${d.name.trim()}: ${error.message}`);
}

/**
 * Saves changes to a person.
 *
 * @throws Error with a readable message when the save is refused
 */
export async function updatePerson(id: string, d: PersonDraft): Promise<void> {
  const problem = validatePerson(d);
  if (problem) throw new Error(problem);
  const { error } = await supabase.from('act_personnel').update(toRow(d)).eq('id', id);
  if (error) throw new Error(`Couldn't save: ${error.message}`);
}

/**
 * Takes someone off the active roster (or brings them back). Past shows and
 * pay keep their name either way.
 *
 * @throws Error with a readable message when the save is refused
 */
export async function setPersonActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('act_personnel').update({ is_active: active }).eq('id', id);
  if (error) throw new Error(`Couldn't ${active ? 'bring them back' : 'take them off the roster'}: ${error.message}`);
}
