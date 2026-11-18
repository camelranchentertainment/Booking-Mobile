// app/(app)/more/setlist/[id].tsx
// Band admins: build one set list on the phone. Add songs from the library (or
// a new song), breaks and notes; move rows up and down; set a key or note for
// this show; Save; then Push to Band, which freezes this version for the
// band's phones and sends them a notification.
//
// Saving replaces the rows through save_set_list_items() (one transaction);
// pushing goes through the website's /api/set-lists/:id/publish so members are
// notified exactly as when pushing from the website.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../../../../components/BackButton';
import { RetroButton, RetroStripes, ScreenHeader, StateMessage } from '../../../../components/retro';
import { ItemSheet } from '../../../../components/setlists/ItemSheet';
import { shortDate } from '../../../../components/setlists/NewSetListSheet';
import { SongPickerSheet } from '../../../../components/setlists/SongPickerSheet';
import { useAuth } from '../../../../contexts/AuthContext';
import { useAsyncData } from '../../../../hooks/useAsyncData';
import {
  fetchSetList,
  fetchShow,
  fetchSongs,
  fingerprint,
  LIMITS,
  moveItem,
  newItemKey,
  pushRecipients,
  pushSetList,
  pushState,
  saveSetList,
  type BuilderItem,
  type SetListHeader,
  type SetListShow,
  type Song,
} from '../../../../lib/adminSetLists';
import { READABLE_MAX_WIDTH } from '../../../../lib/layout';
import { formatDuration, formatRunTime, songNumbers } from '../../../../lib/setLists';
import { colors, radius, space, touchTarget, type } from '../../../../lib/theme';

interface Loaded {
  header: SetListHeader;
  items: BuilderItem[];
  songs: Song[];
  show: SetListShow | null;
}

export default function SetListBuilderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const actId = profile?.act_id ?? null;
  const navigation = useNavigation();

  const { data, error, loading, refreshing, refresh } = useAsyncData<Loaded | null>(
    `admin-setlist:${actId ?? 'none'}:${id ?? ''}`,
    async () => {
      if (!actId || !id) return null;
      const [list, songs] = await Promise.all([fetchSetList(actId, id), fetchSongs(actId)]);
      if (!list) return null;
      const show = list.header.bookingId ? await fetchShow(actId, list.header.bookingId) : null;
      return { ...list, songs, show };
    },
    "We couldn't load this set list. Check your connection and try again."
  );

  // Local working copy. Reset from the server whenever a fresh load arrives
  // (first open, after Save/Push), adjusted during render — no effect needed.
  const [synced, setSynced] = useState<Loaded | null>(null);
  const [name, setName] = useState('');
  const [items, setItems] = useState<readonly BuilderItem[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [savedPrint, setSavedPrint] = useState('');
  if (data && data !== synced) {
    setSynced(data);
    setName(data.header.name);
    setItems(data.items);
    setSongs(data.songs);
    setSavedPrint(fingerprint(data.header.name, data.items));
  }

  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'push' | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const dirty = !!data && fingerprint(name, items) !== savedPrint;

  // Leaving with unsaved changes asks first (back button, swipe back, Android back).
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  });
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      Alert.alert('Leave without saving?', 'Your changes to this set list will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard changes', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation]);

  const header = (
    <ScreenHeader title="Set List" subtitle={synced?.header.isTemplate ? 'Template' : undefined} right={<BackButton fallback={'/more/setlists'} />} />
  );

  if (!data || error) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {header}
        <RetroStripes height={4} gap={2} style={styles.stripes} />
        {loading ? <StateMessage kind="loading" /> : null}
        {error ? <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} /> : null}
        {!loading && !error && !data ? (
          <StateMessage kind="empty" title="Set list not found" message="It may have been deleted on the website." />
        ) : null}
      </SafeAreaView>
    );
  }

  const songsById = new Map(songs.map((s) => [s.id, s]));
  const numbers = songNumbers(items);
  const onList = new Set(items.filter((i) => i.songId).map((i) => i.songId as string));
  const editing = editingKey ? (items.find((i) => i.key === editingKey) ?? null) : null;

  // Running time against the booked set length.
  let songCount = 0;
  let seconds = 0;
  let missing = 0;
  for (const i of items) {
    if (i.type !== 'song' || !i.songId) continue;
    songCount += 1;
    const len = songsById.get(i.songId)?.durationSec;
    if (len && len > 0) seconds += len;
    else missing += 1;
  }
  const setLen = data.show?.setLengthMin ?? null;
  const over = !!setLen && seconds > setLen * 60;
  const run = formatRunTime(seconds);
  const totals = [
    `${songCount} song${songCount === 1 ? '' : 's'}`,
    run ? (missing ? `${run}+` : run) : null,
    setLen ? (over ? `over the ${setLen} min set` : `${setLen} min set`) : null,
  ].filter(Boolean).join(' · ');

  const status = pushState(data.header);
  const statusText = dirty
    ? 'Unsaved changes'
    : status.kind === 'draft'
      ? 'Saved · not pushed to the band yet'
      : status.kind === 'changed'
        ? `Saved · the band has version ${status.version}, push to update them`
        : `Pushed · the band has version ${status.version}`;

  const append = (item: Omit<BuilderItem, 'key'>) => {
    if (items.length >= LIMITS.items) {
      setMessage({ kind: 'error', text: `A set list can have at most ${LIMITS.items} rows.` });
      return null;
    }
    const next = { ...item, key: newItemKey() };
    setItems((prev) => [...prev, next]);
    setMessage(null);
    return next;
  };

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => moveItem(prev, index, dir));
    const title = rowTitle(items[index], songsById);
    AccessibilityInfo.announceForAccessibility(`Moved ${title} ${dir === -1 ? 'up' : 'down'}`);
  };

  const trimmedName = name.trim();
  const nameProblem = !trimmedName ? 'Give the set list a name.' : trimmedName.length > LIMITS.name ? 'That name is too long.' : null;

  /** Saves if needed. Returns false when the save failed (message already shown). */
  const saveIfDirty = async (): Promise<boolean> => {
    if (!dirty || !actId || !id) return true;
    if (nameProblem) {
      setMessage({ kind: 'error', text: nameProblem });
      return false;
    }
    try {
      await saveSetList(actId, id, trimmedName !== data.header.name ? trimmedName : null, items);
      return true;
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : "We couldn't save your changes." });
      return false;
    }
  };

  const save = async () => {
    setBusy('save');
    setMessage(null);
    const ok = await saveIfDirty();
    if (ok) {
      await refresh();
      setMessage({ kind: 'ok', text: 'Saved.' });
      AccessibilityInfo.announceForAccessibility('Set list saved');
    }
    setBusy(null);
  };

  const doPush = async () => {
    setBusy('push');
    setMessage(null);
    try {
      const result = await pushSetList(id as string);
      await refresh();
      const text = !result.changed
        ? 'Nothing changed since the last push, so nobody was notified again.'
        : result.notified > 0
          ? `Pushed version ${result.version}. ${result.notified} ${result.notified === 1 ? 'person was' : 'people were'} notified.`
          : `Pushed version ${result.version}. It's on the show's day sheet; nobody on the lineup has a login to notify yet.`;
      setMessage({ kind: 'ok', text });
      AccessibilityInfo.announceForAccessibility(text);
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : "We couldn't push the set list." });
    } finally {
      setBusy(null);
    }
  };

  /** Push to Band: save first if needed, confirm who will be told, then push. */
  const push = async () => {
    if (!id) return;
    setBusy('push');
    setMessage(null);
    const ok = await saveIfDirty();
    if (!ok) {
      setBusy(null);
      return;
    }
    let count: number;
    try {
      count = await pushRecipients(id);
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : "We couldn't check who's on this show." });
      if (dirty) await refresh();
      setBusy(null);
      return;
    }
    if (dirty) await refresh();
    setBusy(null);
    Alert.alert(
      'Push to the band?',
      count > 0
        ? `${count} ${count === 1 ? 'person' : 'people'} on this show will get a notification, and this version shows on their day sheet.`
        : "Nobody on this show's lineup has a login yet, so no one will be notified. It will still show on the day sheet.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Push', onPress: () => void doPush() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          // Pull-to-refresh would throw away unsaved edits, so it's off while there are any.
          <RefreshControl refreshing={refreshing} onRefresh={refresh} enabled={!dirty} tintColor={colors.orange} colors={[colors.orange]} />
        }>
        {header}
        <RetroStripes height={4} gap={2} style={styles.stripes} />

        <View style={styles.pad}>
          <Text style={styles.label}>NAME</Text>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            maxLength={LIMITS.name}
            accessibilityLabel="Set list name"
            placeholder="Set list name"
            placeholderTextColor={colors.textSubtle}
          />
          {data.show ? (
            <Text style={styles.meta}>
              {data.show.venueName ?? 'Show'} · {shortDate(data.show.showDate)}{data.show.place ? ` · ${data.show.place}` : ''}
            </Text>
          ) : data.header.isTemplate ? (
            <Text style={styles.meta}>Template — copy it onto a show from Set Lists to push it to the band.</Text>
          ) : (
            <Text style={styles.meta}>The show for this set list is no longer upcoming.</Text>
          )}
          <Text style={[styles.meta, over && styles.over]}>{totals}</Text>
          <Text style={[styles.status, dirty && styles.statusDirty]} accessibilityLiveRegion="polite">{statusText}</Text>
        </View>

        <View style={styles.rows} accessibilityRole="list">
          {items.length === 0 ? (
            <Text style={styles.empty}>No songs yet. Add songs, breaks and notes below.</Text>
          ) : (
            items.map((item, index) => (
              <Row
                key={item.key}
                item={item}
                number={numbers[index] ?? null}
                song={item.songId ? (songsById.get(item.songId) ?? null) : null}
                first={index === 0}
                last={index === items.length - 1}
                onUp={() => move(index, -1)}
                onDown={() => move(index, 1)}
                onEdit={() => setEditingKey(item.key)}
              />
            ))
          )}
        </View>

        <View style={styles.toolbar}>
          <ToolButton icon="musical-note" label="Song" onPress={() => setPickerOpen(true)} />
          <ToolButton icon="pause" label="Break" onPress={() => append({ type: 'break', songId: null, label: 'Break', keyOverride: null, notes: null })} />
          <ToolButton
            icon="chatbox-ellipses-outline"
            label="Note"
            onPress={() => {
              const added = append({ type: 'note', songId: null, label: '', keyOverride: null, notes: null });
              if (added) setEditingKey(added.key);
            }}
          />
        </View>

        {message ? (
          <Text style={[styles.message, message.kind === 'error' && styles.messageError]} accessibilityRole={message.kind === 'error' ? 'alert' : undefined}>
            {message.text}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <View style={styles.flex}>
            <RetroButton label={dirty ? 'Save' : 'Saved'} variant="outline" onPress={() => void save()} disabled={!dirty || busy !== null} busy={busy === 'save'} />
          </View>
          {data.header.bookingId && data.show ? (
            <View style={styles.flex}>
              <RetroButton
                label={dirty ? 'Save & push' : 'Push to band'}
                onPress={() => void push()}
                disabled={busy !== null || items.length === 0}
                busy={busy === 'push'}
                accessibilityHint="Sends this version to the phones of everyone on the show"
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {actId ? (
        <SongPickerSheet
          visible={pickerOpen}
          actId={actId}
          songs={songs}
          onList={onList}
          onClose={() => setPickerOpen(false)}
          onPick={(song) => append({ type: 'song', songId: song.id, label: null, keyOverride: null, notes: null })}
          onCreated={(song) => setSongs((prev) => [...prev, song].sort((a, b) => a.title.localeCompare(b.title)))}
        />
      ) : null}
      <ItemSheet
        item={editing}
        song={editing?.songId ? (songsById.get(editing.songId) ?? null) : null}
        onClose={() => {
          // A note left empty when first added is dropped rather than saved as "Note".
          if (editing?.type === 'note' && !(editing.label ?? '').trim() && !(editing.notes ?? '').trim()) {
            setItems((prev) => prev.filter((i) => i.key !== editing.key));
          }
          setEditingKey(null);
        }}
        onSave={(next) => {
          setItems((prev) => prev.map((i) => (i.key === next.key ? next : i)));
          setEditingKey(null);
        }}
        onRemove={(key) => {
          setItems((prev) => prev.filter((i) => i.key !== key));
          setEditingKey(null);
          AccessibilityInfo.announceForAccessibility('Removed from the set list');
        }}
      />
    </SafeAreaView>
  );
}

function rowTitle(item: BuilderItem | undefined, songsById: ReadonlyMap<string, Song>): string {
  if (!item) return '';
  if (item.type === 'song') return (item.songId ? songsById.get(item.songId)?.title : null) ?? 'Removed song';
  return (item.label ?? '').trim() || (item.type === 'break' ? 'Break' : 'Note');
}

function Row({ item, number, song, first, last, onUp, onDown, onEdit }: {
  item: BuilderItem;
  number: number | null;
  song: Song | null;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onEdit: () => void;
}) {
  const isSong = item.type === 'song';
  const title = isSong ? (song?.title ?? 'Removed song') : (item.label ?? '').trim() || (item.type === 'break' ? 'Break' : 'Note');
  const key = isSong ? (item.keyOverride?.trim() || song?.key || null) : null;
  const length = isSong ? formatDuration(song?.durationSec) : '';
  const detail = [key ? `Key ${key}` : null, length || null, item.notes?.trim() || null].filter(Boolean).join(' · ');
  const kind = isSong ? `Song ${number}` : item.type === 'break' ? 'Break' : 'Note';

  return (
    <View style={[styles.row, item.type === 'break' && styles.rowBreak]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${kind}: ${title}${detail ? `, ${detail}` : ''}`}
        accessibilityHint="Edit or remove"
        onPress={onEdit}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
        <Text style={styles.num}>{isSong ? number : item.type === 'break' ? '—' : '✎'}</Text>
        <View style={styles.flex}>
          <Text style={[styles.rowTitle, !isSong && styles.rowTitleAlt, isSong && !song && styles.missing]} numberOfLines={2}>{title}</Text>
          {detail ? <Text style={styles.rowDetail} numberOfLines={2}>{detail}</Text> : null}
        </View>
      </Pressable>
      <MoveButton icon="chevron-up" label={`Move ${title} up`} disabled={first} onPress={onUp} />
      <MoveButton icon="chevron-down" label={`Move ${title} down`} disabled={last} onPress={onDown} />
    </View>
  );
}

function MoveButton({ icon, label, disabled, onPress }: { icon: 'chevron-up' | 'chevron-down'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.moveBtn, disabled && styles.moveDisabled, pressed && styles.pressed]}>
      <Ionicons name={icon} size={22} color={colors.cream} />
    </Pressable>
  );
}

function ToolButton({ icon, label, onPress }: { icon: 'musical-note' | 'pause' | 'chatbox-ellipses-outline'; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${label.toLowerCase()}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tool, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={colors.onInteractive} />
      <Text style={styles.toolText}>+ {label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: READABLE_MAX_WIDTH, alignSelf: 'center', backgroundColor: colors.background },
  scroll: { paddingBottom: space['4xl'] },
  stripes: { marginBottom: space.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  pad: { paddingHorizontal: space.xl, gap: space.xs },
  label: { ...type.xs, color: colors.textMuted, letterSpacing: 1 },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundDeep,
    color: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: touchTarget,
    fontSize: 18,
    fontFamily: type.lg.fontFamily,
    marginBottom: space.xs,
  },
  meta: { ...type.sm, color: colors.textMuted },
  over: { color: colors.mustard },
  status: { ...type.md, color: colors.textMuted, marginTop: space.xs },
  statusDirty: { color: colors.mustard },
  rows: { paddingHorizontal: space.xl, marginTop: space.lg, gap: space.sm },
  empty: { ...type.base, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, paddingRight: space.xs },
  rowBreak: { backgroundColor: colors.surfaceRaised },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: touchTarget + 8 },
  num: { ...type.time, fontSize: 20, color: colors.mustard, width: 28, textAlign: 'right' },
  rowTitle: { ...type.md, color: colors.cream },
  rowTitleAlt: { color: colors.orange },
  missing: { color: colors.textMuted, fontStyle: 'italic' },
  rowDetail: { ...type.sm, color: colors.textMuted },
  moveBtn: { width: 44, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  moveDisabled: { opacity: 0.25 },
  toolbar: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.xl, marginTop: space.lg },
  tool: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: touchTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.orange,
  },
  toolText: { ...type.md, color: colors.onInteractive },
  message: { ...type.md, color: colors.statusConfirmed, paddingHorizontal: space.xl, marginTop: space.lg },
  messageError: { color: colors.danger },
  actions: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.xl, marginTop: space.lg },
});
