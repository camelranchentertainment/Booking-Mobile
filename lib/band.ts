import { supabase } from './supabase';

export interface BandPerson {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
}

/**
 * Active people on the act's roster (band + crew), alphabetical.
 *
 * Reads `act_personnel`, which RLS already limits to the caller's own act
 * ("Act members can view personnel"). The explicit `act_id` filter keeps a
 * superadmin from seeing every act's roster at once. Pay columns
 * (`default_pay_amount`) are deliberately not selected: this screen is
 * visible to plain members.
 */
export async function fetchBandRoster(actId: string): Promise<BandPerson[]> {
  const { data, error } = await supabase
    .from('act_personnel')
    .select('id, name, instrument_role, phone')
    .eq('act_id', actId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string | null) ?? 'Unnamed',
    role: (row.instrument_role as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
  }));
}

/** The act's display name, or null if the row isn't visible to this user. */
export async function fetchActName(actId: string): Promise<string | null> {
  const { data, error } = await supabase.from('acts').select('act_name').eq('id', actId).maybeSingle();
  if (error) throw error;
  return (data?.act_name as string | null | undefined) ?? null;
}
