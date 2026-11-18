// lib/setLists.ts
//
// Set lists pushed from the website's Set List Builder (or the app's Set Lists
// screen). When an admin taps "Push to Band", publish_set_list() freezes the
// list into set_lists.published_snapshot; that frozen copy is what members and
// admins read here, so the phone always shows exactly what was pushed, never a
// half-edited draft.
//
// RLS decides who may read: set_lists_member_read_published lets anyone in the
// band read a pushed snapshot; set_lists_admin_all lets admins read everything.
import { supabase } from './supabase';

export type SetItemType = 'song' | 'break' | 'note';

/** One row of a pushed set list, as publish_set_list() writes it. */
export interface PushedSetItem {
  position: number;
  type: SetItemType;
  title: string;
  artist: string | null;
  key: string | null;
  bpm: number | null;
  durationSec: number | null;
  songNotes: string | null;
  notes: string | null;
}

/** The set list members see for a show. */
export interface PushedSetList {
  id: string;
  name: string;
  notes: string | null;
  version: number;
  pushedAt: string | null;
  items: PushedSetItem[];
  /** Admins only: the list was edited after the last push, so members have an older copy. */
  hasUnpushedChanges: boolean;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Reads one snapshot item defensively. The snapshot is JSON written by the
 * database, but a row that isn't a song, break or note drops out rather than
 * crashing the day sheet.
 */
function parseItem(raw: unknown): PushedSetItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const type = r.type === 'song' || r.type === 'break' || r.type === 'note' ? r.type : null;
  if (!type) return null;
  // Same fallbacks as the website's member page, so both show the same rows.
  const title = str(r.title) ?? (type === 'break' ? 'Break' : type === 'note' ? 'Note' : 'Untitled song');
  return {
    position: num(r.position) ?? 0,
    type,
    title,
    artist: str(r.artist),
    key: str(r.key),
    bpm: num(r.bpm),
    durationSec: num(r.duration_sec),
    songNotes: str(r.song_notes),
    notes: str(r.notes),
  };
}

/** Turns a set_lists row into what the screen draws; null when nothing has been pushed. */
export function parsePushedSetList(row: {
  id: string;
  published_snapshot: unknown;
  published_version: number | null;
  published_at: string | null;
  updated_at: string | null;
}): PushedSetList | null {
  const snap = row.published_snapshot;
  if (!snap || typeof snap !== 'object') return null;
  const s = snap as Record<string, unknown>;
  const items = (Array.isArray(s.items) ? s.items : [])
    .map(parseItem)
    .filter((i): i is PushedSetItem => i !== null)
    .sort((a, b) => a.position - b.position);
  const pushedAt = row.published_at;
  const changed = !!pushedAt && !!row.updated_at && Date.parse(row.updated_at) > Date.parse(pushedAt);
  return {
    id: row.id,
    name: str(s.name) ?? 'Set list',
    notes: str(s.notes),
    version: num(s.version) ?? row.published_version ?? 1,
    pushedAt,
    items,
    hasUnpushedChanges: changed,
  };
}

/**
 * The pushed set list for a show, or null when the show has none yet.
 *
 * @param bookingId the show
 * @throws the Supabase error when the read fails (the caller shows a retry)
 */
export async function fetchPushedSetList(bookingId: string): Promise<PushedSetList | null> {
  const { data, error } = await supabase
    .from('set_lists')
    .select('id, published_snapshot, published_version, published_at, updated_at')
    .eq('booking_id', bookingId)
    .is('deleted_at', null)
    .not('published_snapshot', 'is', null)
    .maybeSingle();
  if (error) throw error;
  return data ? parsePushedSetList(data) : null;
}

/** Song count and known running time; breaks and notes don't count. */
export function pushedTotals(items: readonly PushedSetItem[]): { songs: number; seconds: number; missingLengths: number } {
  let songs = 0;
  let seconds = 0;
  let missingLengths = 0;
  for (const item of items) {
    if (item.type !== 'song') continue;
    songs += 1;
    if (item.durationSec && item.durationSec > 0) seconds += item.durationSec;
    else missingLengths += 1;
  }
  return { songs, seconds, missingLengths };
}

/** 225 → "3:45"; 3750 → "1:02:30"; null → "". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** Running time for headers: "48 min" / "1 hr 12 min"; "" when unknown. */
export function formatRunTime(seconds: number): string {
  if (seconds <= 0) return '';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** Song numbers in running order (1, 2, 3…); breaks and notes get null. */
export function songNumbers(items: readonly { type: SetItemType }[]): (number | null)[] {
  let n = 0;
  return items.map((item) => (item.type === 'song' ? ++n : null));
}
