// lib/adminSetLists.ts
//
// Band admins build and push set lists from the phone. Same tables, database
// functions and push endpoint as the website's Set List Builder, so a list
// started on one is finished on the other:
//
//   songs, set_lists       direct reads/writes under the admin's own session;
//                          RLS (songs_admin_all, set_lists_admin_all) allows
//                          them only for the band's admins
//   save_set_list_items()  replaces a list's rows in one transaction
//   POST /api/set-lists/:id/publish
//                          freezes the list (publish_set_list) and notifies the
//                          show's lineup; GET returns how many will be told
//
// The band (act_id) comes from the signed-in admin's profile, never from user
// input; database triggers also reject a show or song from another band.
import { API_BASE, ApiError, authHeader } from './memberShows';
import { supabase } from './supabase';
import type { SetItemType } from './setLists';

export interface Song {
  id: string;
  title: string;
  artist: string | null;
  key: string | null;
  bpm: number | null;
  durationSec: number | null;
  notes: string | null;
}

export interface SetListHeader {
  id: string;
  name: string;
  bookingId: string | null;
  isTemplate: boolean;
  publishedVersion: number;
  publishedAt: string | null;
  updatedAt: string;
}

/** An upcoming show a set list can belong to. */
export interface SetListShow {
  id: string;
  showDate: string;
  setLengthMin: number | null;
  venueName: string | null;
  place: string;
}

/** One row in the builder. `key` is a client-only id for React lists. */
export interface BuilderItem {
  key: string;
  type: SetItemType;
  songId: string | null;
  label: string | null;
  keyOverride: string | null;
  notes: string | null;
}

export type PushState =
  | { kind: 'draft' }
  | { kind: 'pushed'; version: number }
  | { kind: 'changed'; version: number };

/** Mirrors the database CHECK constraints so the phone fails early and clearly. */
export const LIMITS = { items: 200, title: 200, artist: 200, key: 12, label: 200, itemNotes: 500, name: 200 } as const;

/** Show statuses a set list can be built for (same as the website). */
const SHOW_STATUSES = ['contract', 'confirmed', 'advancing'] as const;

const SONG_COLUMNS = 'id, title, artist, song_key, tempo_bpm, duration_sec, notes';
const LIST_COLUMNS = 'id, name, booking_id, is_template, published_version, published_at, updated_at';
const ITEM_COLUMNS = 'id, position, item_type, song_id, label, key_override, notes';

/** A Supabase/PostgREST error, as far as we read it. */
interface DbError { code?: string | null; message?: string | null }

/**
 * A short sentence an admin can act on. Our own trigger messages are written
 * for people; raw constraint text and SQL never reach the screen.
 */
export function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  const e = (err ?? {}) as DbError;
  const message = e.message ?? '';
  switch (e.code) {
    case '23505':
      if (message.includes('songs_act_title_artist_uniq')) return 'That song is already in your library.';
      if (message.includes('set_lists_one_per_booking')) return 'That show already has a set list. Open it instead.';
      return 'That already exists.';
    case '23514':
      if (/does not belong|not in this band|cannot be moved/i.test(message)) return message;
      return 'One of the fields is too long or out of range.';
    case '42501':
      return 'Only band admins can change set lists.';
    case 'P0002':
      return 'That set list no longer exists. Go back and refresh.';
    case '22023':
      return message || fallback;
    default:
      return fallback;
  }
}

/** Logs the raw error for debugging and throws a friendly one for the screen. */
function fail(where: string, err: unknown, fallback: string): never {
  const e = (err ?? {}) as DbError;
  console.error(`[adminSetLists] ${where} failed`, { code: e.code, message: e.message });
  throw new Error(friendlyError(err, fallback));
}

/** Whether the band has the latest version (matches publish_set_list()). */
export function pushState(h: Pick<SetListHeader, 'publishedAt' | 'publishedVersion' | 'updatedAt'>): PushState {
  if (!h.publishedAt || h.publishedVersion < 1) return { kind: 'draft' };
  return Date.parse(h.updatedAt) > Date.parse(h.publishedAt)
    ? { kind: 'changed', version: h.publishedVersion }
    : { kind: 'pushed', version: h.publishedVersion };
}

type ListRow = {
  id: string; name: string; booking_id: string | null; is_template: boolean;
  published_version: number; published_at: string | null; updated_at: string;
};
const toHeader = (r: ListRow): SetListHeader => ({
  id: r.id, name: r.name, bookingId: r.booking_id, isTemplate: r.is_template,
  publishedVersion: r.published_version, publishedAt: r.published_at, updatedAt: r.updated_at,
});

type SongRowDb = {
  id: string; title: string; artist: string | null; song_key: string | null;
  tempo_bpm: number | null; duration_sec: number | null; notes: string | null;
};
const toSong = (r: SongRowDb): Song => ({
  id: r.id, title: r.title, artist: r.artist, key: r.song_key, bpm: r.tempo_bpm, durationSec: r.duration_sec, notes: r.notes,
});

type VenueJoin = { name: string | null; city: string | null; state: string | null };
type ShowRowDb = { id: string; show_date: string; set_length_min: number | null; venue: VenueJoin | VenueJoin[] | null };
const toShow = (r: ShowRowDb): SetListShow => {
  const v = Array.isArray(r.venue) ? (r.venue[0] ?? null) : r.venue;
  return {
    id: r.id,
    showDate: r.show_date,
    setLengthMin: r.set_length_min,
    venueName: v?.name ?? null,
    place: [v?.city, v?.state].filter(Boolean).join(', '),
  };
};

/** Every set list for the band (shows and templates), newest edit first. */
export async function fetchSetLists(actId: string): Promise<SetListHeader[]> {
  const { data, error } = await supabase
    .from('set_lists')
    .select(LIST_COLUMNS)
    .eq('act_id', actId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) fail('fetchSetLists', error, "We couldn't load your set lists.");
  return ((data ?? []) as ListRow[]).map(toHeader);
}

/** Upcoming shows a set list can be built for, soonest first. */
export async function fetchUpcomingShows(actId: string, fromDate: string): Promise<SetListShow[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, show_date, set_length_min, venue:venue_id ( name, city, state )')
    .eq('act_id', actId)
    .in('status', [...SHOW_STATUSES])
    .gte('show_date', fromDate)
    .order('show_date', { ascending: true })
    .limit(150);
  if (error) fail('fetchUpcomingShows', error, "We couldn't load your upcoming shows.");
  return ((data ?? []) as unknown as ShowRowDb[]).map(toShow);
}

/** One show, for the builder's heading and set-length check. */
export async function fetchShow(actId: string, bookingId: string): Promise<SetListShow | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, show_date, set_length_min, venue:venue_id ( name, city, state )')
    .eq('act_id', actId)
    .eq('id', bookingId)
    .maybeSingle();
  if (error) fail('fetchShow', error, "We couldn't load the show for this set list.");
  return data ? toShow(data as unknown as ShowRowDb) : null;
}

/** The band's song library, A–Z. */
export async function fetchSongs(actId: string): Promise<Song[]> {
  const { data, error } = await supabase
    .from('songs')
    .select(SONG_COLUMNS)
    .eq('act_id', actId)
    .is('deleted_at', null)
    .order('title', { ascending: true });
  if (error) fail('fetchSongs', error, "We couldn't load your songs.");
  return ((data ?? []) as SongRowDb[]).map(toSong);
}

/** One set list with its rows, or null when it's gone. */
export async function fetchSetList(actId: string, id: string): Promise<{ header: SetListHeader; items: BuilderItem[] } | null> {
  const { data, error } = await supabase
    .from('set_lists')
    .select(LIST_COLUMNS)
    .eq('act_id', actId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) fail('fetchSetList', error, "We couldn't load that set list.");
  if (!data) return null;
  return { header: toHeader(data as ListRow), items: await fetchItems(id) };
}

async function fetchItems(setListId: string): Promise<BuilderItem[]> {
  const { data, error } = await supabase
    .from('set_list_items')
    .select(ITEM_COLUMNS)
    .eq('set_list_id', setListId)
    .order('position', { ascending: true });
  if (error) fail('fetchItems', error, "We couldn't load the songs on this set list.");
  return ((data ?? []) as {
    id: string; item_type: SetItemType; song_id: string | null; label: string | null;
    key_override: string | null; notes: string | null;
  }[]).map((r) => ({
    key: r.id, type: r.item_type, songId: r.song_id, label: r.label, keyOverride: r.key_override, notes: r.notes,
  }));
}

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

/**
 * The JSON array save_set_list_items() reads, in display order. Breaks and
 * notes without text get a label so the row is never rejected.
 *
 * @throws Error when the list is longer than the database allows
 */
export function toSavePayload(items: readonly BuilderItem[]) {
  if (items.length > LIMITS.items) throw new Error(`A set list can have at most ${LIMITS.items} rows.`);
  return items.map((i) =>
    i.type === 'song'
      ? { item_type: 'song' as const, song_id: i.songId, label: null, key_override: clean(i.keyOverride), notes: clean(i.notes) }
      : { item_type: i.type, song_id: null, label: clean(i.label) ?? (i.type === 'break' ? 'Break' : 'Note'), key_override: null, notes: clean(i.notes) }
  );
}

/**
 * Saves the name (when changed) and every row. The header goes first so a
 * bad name fails before the rows are replaced.
 */
export async function saveSetList(actId: string, id: string, name: string | null, items: readonly BuilderItem[]): Promise<void> {
  let payload;
  try {
    payload = toSavePayload(items);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'That set list is too long.');
  }
  if (name !== null) {
    const { error } = await supabase.from('set_lists').update({ name }).eq('id', id).eq('act_id', actId);
    if (error) fail('saveSetList.name', error, "We couldn't save the name.");
  }
  const { error } = await supabase.rpc('save_set_list_items', { p_set_list_id: id, p_items: payload });
  if (error) fail('saveSetList.items', error, "We couldn't save your changes. Nothing was lost — try again.");
}

/**
 * Starts a set list for a show (or a template), optionally copying the rows of
 * another list. If the copy fails the new list is archived so nothing half-made
 * is left behind.
 */
export async function createSetList(
  actId: string,
  name: string,
  bookingId: string | null,
  copyFromId: string | null,
): Promise<string> {
  const source = copyFromId ? await fetchItems(copyFromId) : [];
  const { data, error } = await supabase
    .from('set_lists')
    .insert({ act_id: actId, name, booking_id: bookingId, is_template: bookingId === null })
    .select('id')
    .single();
  if (error || !data) fail('createSetList', error, "We couldn't start the set list.");
  const id = (data as { id: string }).id;
  if (source.length) {
    try {
      await saveSetList(actId, id, null, source);
    } catch (err) {
      await supabase.from('set_lists').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('act_id', actId);
      throw new Error(`We couldn't copy the songs over. ${err instanceof Error ? err.message : ''}`.trim());
    }
  }
  return id;
}

export interface SongDraft {
  title: string;
  artist: string;
  key: string;
  /** "3:45" or seconds, as typed. */
  length: string;
}

/** "3:45", "1:02:30" or "225" → seconds; '' → null; unreadable → undefined. */
export function parseLength(input: string): number | null | undefined {
  const text = input.trim();
  if (text === '') return null;
  if (/^\d+$/.test(text)) {
    const s = Number(text);
    return s >= 1 && s <= 3600 ? s : undefined;
  }
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(text);
  if (!m) return undefined;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const sec = Number(m[3]);
  if (sec > 59 || (m[1] !== undefined && min > 59)) return undefined;
  const total = h * 3600 + min * 60 + sec;
  return total >= 1 && total <= 3600 ? total : undefined;
}

/** The first problem with a new song, or null when it can be saved. */
export function validateSong(d: SongDraft): string | null {
  if (!d.title.trim()) return 'Enter the song title.';
  if (d.title.trim().length > LIMITS.title) return 'That title is too long.';
  if (d.artist.trim().length > LIMITS.artist) return 'That artist name is too long.';
  if (d.key.trim().length > LIMITS.key) return `Keep the key to ${LIMITS.key} characters, like "G" or "F#m".`;
  if (parseLength(d.length) === undefined) return 'Enter the length like 3:45.';
  return null;
}

/** Adds a song to the band's library. */
export async function addSong(actId: string, d: SongDraft): Promise<Song> {
  const problem = validateSong(d);
  if (problem) throw new Error(problem);
  const { data, error } = await supabase
    .from('songs')
    .insert({
      act_id: actId,
      title: d.title.trim(),
      artist: clean(d.artist),
      song_key: clean(d.key),
      duration_sec: parseLength(d.length) ?? null,
    })
    .select(SONG_COLUMNS)
    .single();
  if (error || !data) fail('addSong', error, "We couldn't add that song.");
  return toSong(data as SongRowDb);
}

/** How many people on the show will be told about a push (for the confirm). */
export async function pushRecipients(setListId: string): Promise<number> {
  const res = await fetch(`${API_BASE}/api/set-lists/${encodeURIComponent(setListId)}/publish`, {
    headers: await authHeader(),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { recipients?: number }; error?: { message?: string } };
  if (!res.ok) throw new ApiError(json.error?.message ?? "We couldn't check who's on this show.", res.status);
  return json.data?.recipients ?? 0;
}

export interface PushResult {
  version: number;
  /** False when nothing changed since the last push; nobody was told again. */
  changed: boolean;
  notified: number;
}

/** Push to Band: freezes the list for members and notifies the show's lineup. */
export async function pushSetList(setListId: string): Promise<PushResult> {
  const res = await fetch(`${API_BASE}/api/set-lists/${encodeURIComponent(setListId)}/publish`, {
    method: 'POST',
    headers: await authHeader(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    data?: { version?: number; changed?: boolean; notified?: number };
    error?: { message?: string };
  };
  if (!res.ok || !json.data) throw new ApiError(json.error?.message ?? "We couldn't push the set list. Nothing was sent — try again.", res.status);
  return { version: json.data.version ?? 0, changed: !!json.data.changed, notified: json.data.notified ?? 0 };
}

let keyCounter = 0;
/** A client-only id for a new builder row. */
export function newItemKey(): string {
  keyCounter += 1;
  return `new-${Date.now().toString(36)}-${keyCounter}`;
}

/** Moves one row up or down; returns the same array when it would fall off an end. */
export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): readonly T[] {
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved as T);
  return next;
}

/** Compact fingerprint of what Save would write, to tell whether anything changed. */
export function fingerprint(name: string, items: readonly BuilderItem[]): string {
  return JSON.stringify([name.trim(), toSavePayloadSafe(items)]);
}
function toSavePayloadSafe(items: readonly BuilderItem[]) {
  try {
    return toSavePayload(items);
  } catch {
    return items.length; // over the limit: still differs from any saved state
  }
}
