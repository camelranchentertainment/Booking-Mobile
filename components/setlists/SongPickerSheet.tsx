/**
 * Add songs to a set list from the band's library, or add a brand-new song to
 * the library and the list in one go. Stays open so several songs can be
 * added in a row; each tap is announced for screen readers.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { addSong, LIMITS, validateSong, type Song, type SongDraft } from '../../lib/adminSetLists';
import { formatDuration } from '../../lib/setLists';
import { colors, radius, space, touchTarget, type } from '../../lib/theme';
import { RetroButton } from '../retro';
import { Field, Sheet, sheetStyles as s } from './Sheet';

interface Props {
  visible: boolean;
  actId: string;
  songs: readonly Song[];
  /** Song ids already on the list, marked so they aren't added twice by accident. */
  onList: ReadonlySet<string>;
  onClose: () => void;
  onPick: (song: Song) => void;
  /** A new song was saved to the library (the caller adds it to its copy). */
  onCreated: (song: Song) => void;
}

const EMPTY: SongDraft = { title: '', artist: '', key: '', length: '' };

export function SongPickerSheet({ visible, actId, songs, onList, onClose, onPick, onCreated }: Props) {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<SongDraft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((song) => song.title.toLowerCase().includes(q) || (song.artist ?? '').toLowerCase().includes(q));
  }, [query, songs]);

  const close = () => {
    setQuery('');
    setCreating(false);
    setDraft(EMPTY);
    setError(null);
    onClose();
  };

  const pick = (song: Song) => {
    onPick(song);
    AccessibilityInfo.announceForAccessibility(`Added ${song.title}`);
  };

  const startNew = () => {
    setDraft({ ...EMPTY, title: query.trim() });
    setError(null);
    setCreating(true);
  };

  const saveNew = async () => {
    setSaving(true);
    setError(null);
    try {
      const song = await addSong(actId, draft);
      onCreated(song);
      pick(song);
      setCreating(false);
      setDraft(EMPTY);
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't add that song.");
    } finally {
      setSaving(false);
    }
  };

  const problem = validateSong(draft);

  return (
    <Sheet visible={visible} title={creating ? 'NEW SONG' : 'ADD SONGS'} onClose={close}>
      {creating ? (
        <>
          <Field label="Title" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} autoCapitalize="words" maxLength={LIMITS.title} />
          <Field label="Artist (if it's a cover)" value={draft.artist} onChange={(v) => setDraft({ ...draft, artist: v })} placeholder="Optional" autoCapitalize="words" maxLength={LIMITS.artist} />
          <Field label="Key" value={draft.key} onChange={(v) => setDraft({ ...draft, key: v })} placeholder="e.g. G, F#m" autoCapitalize="none" maxLength={LIMITS.key} />
          <Field label="Length" value={draft.length} onChange={(v) => setDraft({ ...draft, length: v })} placeholder="e.g. 3:45" keyboardType="numbers-and-punctuation" />
          <Text style={s.hint}>Saved to your song library, so it&apos;s there for every set list. Tempo and notes can be added on the website.</Text>
          {draft.title !== '' && problem ? <Text style={s.error}>{problem}</Text> : null}
          {error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}
          <View style={s.actions}>
            <View style={s.flex}>
              <RetroButton label="Back" variant="outline" onPress={() => setCreating(false)} disabled={saving} />
            </View>
            <View style={s.flex}>
              <RetroButton label="Add song" onPress={() => void saveNew()} busy={saving} disabled={!!problem} />
            </View>
          </View>
        </>
      ) : (
        <>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search your songs"
            placeholderTextColor={colors.textSubtle}
            autoCorrect={false}
            accessibilityLabel="Search your songs"
            clearButtonMode="while-editing"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={query.trim() ? `Add "${query.trim()}" as a new song` : 'Add a new song to your library'}
            onPress={startNew}
            style={({ pressed }) => [styles.newRow, pressed && s.pressed]}>
            <Ionicons name="add-circle" size={24} color={colors.orange} />
            <Text style={styles.newText}>{query.trim() ? `New song: "${query.trim()}"` : 'New song'}</Text>
          </Pressable>
          {songs.length === 0 ? (
            <Text style={s.hint}>Your song library is empty. Add your first song above.</Text>
          ) : matches.length === 0 ? (
            <Text style={s.hint}>No songs match &quot;{query.trim()}&quot;.</Text>
          ) : (
            matches.map((song) => {
              const already = onList.has(song.id);
              const meta = [song.artist, song.key, formatDuration(song.durationSec)].filter(Boolean).join(' · ');
              return (
                <Pressable
                  key={song.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${song.title}${meta ? `, ${meta}` : ''}${already ? ', already on this set list' : ''}`}
                  accessibilityHint="Adds it to the end of the set list"
                  onPress={() => pick(song)}
                  style={({ pressed }) => [styles.songRow, pressed && s.pressed]}>
                  <View style={s.flex}>
                    <Text style={styles.songTitle}>{song.title}</Text>
                    {meta ? <Text style={s.hint}>{meta}</Text> : null}
                  </View>
                  {already ? <Text style={styles.onList}>ON LIST</Text> : null}
                  <Ionicons name="add" size={24} color={colors.interactive} />
                </Pressable>
              );
            })
          )}
          <View style={styles.done}>
            <RetroButton label="Done" variant="outline" onPress={close} />
          </View>
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundDeep,
    color: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: touchTarget,
    fontSize: 17,
    fontFamily: type.lg.fontFamily,
  },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touchTarget, marginTop: space.sm },
  newText: { ...type.md, color: colors.orange },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: touchTarget + 8,
    paddingVertical: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  songTitle: { ...type.md, color: colors.cream },
  onList: { ...type.xs, color: colors.mustard, letterSpacing: 1 },
  done: { marginTop: space.lg },
});
