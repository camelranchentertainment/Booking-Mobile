/**
 * The pushed set list on the Day Sheet, for members and admins.
 *
 * Shows the frozen copy the admin last pushed (never a half-edited draft),
 * with the running time against the booked set length, and a Stage view: the
 * same list full-screen in big type, for reading off the floor mid-set.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ModalScreen } from './ModalScreen';
import { RetroButton } from './retro';
import { useAsyncData } from '../hooks/useAsyncData';
import { READABLE_MAX_WIDTH } from '../lib/layout';
import {
  fetchPushedSetList,
  formatDuration,
  formatRunTime,
  pushedTotals,
  songNumbers,
  type PushedSetItem,
  type PushedSetList,
} from '../lib/setLists';
import { colors, radius, space, touchTarget, type } from '../lib/theme';

interface Props {
  bookingId: string;
  /** Booked set length in minutes, to say whether the list runs long. */
  setLengthMin: number | null;
  /** Admins see a nudge when the list was edited after its last push. */
  isAdmin: boolean;
  /** Bumped by the screen's pull-to-refresh so the set list reloads too. */
  refreshToken: number;
}

/** "Pushed Nov 18" from an ISO timestamp, in the phone's own time zone. */
function pushedLabel(list: PushedSetList): string {
  const when = list.pushedAt ? new Date(list.pushedAt) : null;
  const date = when && !Number.isNaN(when.getTime())
    ? when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;
  return date ? `Version ${list.version} · pushed ${date}` : `Version ${list.version}`;
}

/** One line under the heading: songs, running time, and how it fits the booked set. */
function totalsLine(list: PushedSetList, setLengthMin: number | null): { text: string; over: boolean } {
  const t = pushedTotals(list.items);
  const parts = [`${t.songs} song${t.songs === 1 ? '' : 's'}`];
  const run = formatRunTime(t.seconds);
  if (run) parts.push(t.missingLengths > 0 ? `${run}+` : run);
  const over = !!setLengthMin && t.seconds > setLengthMin * 60;
  if (setLengthMin) parts.push(over ? `over the ${setLengthMin} min set` : `${setLengthMin} min set`);
  return { text: parts.join(' · '), over };
}

export function SetListSection({ bookingId, setLengthMin, isAdmin, refreshToken }: Props) {
  const [stageOpen, setStageOpen] = useState(false);
  const { data, error, loading, refresh } = useAsyncData(
    `setlist:${bookingId}:${refreshToken}`,
    () => fetchPushedSetList(bookingId),
    "We couldn't load the set list. Check your connection and try again."
  );

  if (loading) {
    return (
      <View style={styles.card} accessibilityLabel="Loading the set list" accessibilityRole="progressbar">
        <ActivityIndicator color={colors.interactive} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.error} accessibilityRole="alert">{error}</Text>
        <RetroButton label="Try again" variant="outline" onPress={() => void refresh()} />
      </View>
    );
  }

  if (!data) {
    return (
      <Text style={styles.muted}>
        {isAdmin
          ? 'No set list pushed for this show yet. Build one under More → Set Lists, then push it to the band.'
          : 'No set list yet. When your band admin pushes one, it shows up here.'}
      </Text>
    );
  }

  const totals = totalsLine(data, setLengthMin);
  const numbers = songNumbers(data.items);

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.listName}>{data.name}</Text>
        <Text style={[styles.meta, totals.over && styles.metaOver]}>{totals.text}</Text>
        <Text style={styles.meta}>{pushedLabel(data)}</Text>
        {isAdmin && data.hasUnpushedChanges ? (
          <Text style={styles.nudge}>
            You&apos;ve changed this list since it was pushed. The band still sees this version until you push again.
          </Text>
        ) : null}
        {data.notes ? <Text style={styles.listNotes}>{data.notes}</Text> : null}

        <View style={styles.rows} accessibilityRole="list">
          {data.items.map((item, i) => (
            <SetRow key={`${item.position}-${item.title}`} item={item} number={numbers[i] ?? 0} />
          ))}
        </View>

        {data.items.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open stage view"
            accessibilityHint="Shows the set list full screen in large type"
            onPress={() => setStageOpen(true)}
            style={({ pressed }) => [styles.stageBtn, pressed && styles.pressed]}>
            <Ionicons name="expand-outline" size={20} color={colors.interactive} />
            <Text style={styles.stageBtnText}>Stage view</Text>
          </Pressable>
        ) : null}
      </View>

      <ModalScreen visible={stageOpen} onClose={() => setStageOpen(false)}>
        <StageView list={data} />
      </ModalScreen>
    </>
  );
}

/** A song, a break divider, or a note, in the compact day-sheet style. */
function SetRow({ item, number }: { item: PushedSetItem; number: number }) {
  if (item.type === 'break') {
    return (
      <View style={styles.breakRow} accessibilityLabel={`Break: ${item.title}`}>
        <View style={styles.breakLine} />
        <Text style={styles.breakText}>{item.title.toUpperCase()}</Text>
        <View style={styles.breakLine} />
      </View>
    );
  }
  if (item.type === 'note') {
    return <Text style={styles.noteRow} accessibilityLabel={`Note: ${item.title}`}>{item.title}</Text>;
  }
  const length = formatDuration(item.durationSec);
  const label = [
    `Song ${number}: ${item.title}`,
    item.key ? `key of ${item.key}` : null,
    length ? `${length} long` : null,
    item.notes,
  ].filter(Boolean).join(', ');
  return (
    <View style={styles.songRow} accessible accessibilityLabel={label}>
      <Text style={styles.songNum}>{number}</Text>
      <View style={styles.flex}>
        <Text style={styles.songTitle}>{item.title}</Text>
        {item.notes ? <Text style={styles.songNotes}>{item.notes}</Text> : null}
      </View>
      {item.key ? (
        <View style={styles.keyChip}>
          <Text style={styles.keyText}>{item.key}</Text>
        </View>
      ) : null}
      {length ? <Text style={styles.length}>{length}</Text> : null}
    </View>
  );
}

/** Full-screen, large-type version for reading on stage. */
function StageView({ list }: { list: PushedSetList }) {
  const numbers = songNumbers(list.items);
  return (
    <ScrollView contentContainerStyle={styles.stageScroll}>
      <Text style={styles.stageName} accessibilityRole="header">{list.name}</Text>
      {list.items.map((item, i) => {
        if (item.type === 'break') {
          return (
            <Text key={`${item.position}-b`} style={styles.stageBreak}>— {item.title.toUpperCase()} —</Text>
          );
        }
        if (item.type === 'note') {
          return <Text key={`${item.position}-n`} style={styles.stageNote}>{item.title}</Text>;
        }
        return (
          <View key={`${item.position}-s`} style={styles.stageRow}>
            <Text style={styles.stageNum}>{numbers[i]}</Text>
            <View style={styles.flex}>
              <Text style={styles.stageTitle}>{item.title}</Text>
              {item.notes ? <Text style={styles.stageSongNotes}>{item.notes}</Text> : null}
            </View>
            {item.key ? <Text style={styles.stageKey}>{item.key}</Text> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    marginHorizontal: space.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  muted: { ...type.base, color: colors.textMuted, paddingHorizontal: space.xl },
  error: { ...type.md, color: colors.danger, marginBottom: space.sm },
  listName: { ...type.lg, color: colors.cream },
  meta: { ...type.sm, color: colors.textMuted },
  metaOver: { color: colors.mustard },
  nudge: { ...type.sm, color: colors.mustard, marginTop: space.xs },
  listNotes: { ...type.base, color: colors.cream, marginTop: space.xs },
  rows: { marginTop: space.md },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: touchTarget,
    paddingVertical: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  songNum: { ...type.time, fontSize: 20, color: colors.mustard, width: 28, textAlign: 'right' },
  songTitle: { ...type.md, color: colors.cream },
  songNotes: { ...type.sm, color: colors.textMuted },
  keyChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.mustard,
    paddingHorizontal: space.sm,
    paddingVertical: 1,
  },
  keyText: { ...type.xs, color: colors.mustard },
  length: { ...type.sm, color: colors.textMuted, minWidth: 40, textAlign: 'right' },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  breakLine: { flex: 1, height: 2, backgroundColor: colors.orange, borderRadius: 1 },
  breakText: { ...type.eyebrow, color: colors.orange },
  noteRow: { ...type.sm, fontStyle: 'italic', color: colors.textMuted, paddingVertical: space.xs, paddingLeft: 40 },
  stageBtn: {
    marginTop: space.md,
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.interactive,
  },
  stageBtnText: { ...type.md, color: colors.interactive },
  pressed: { opacity: 0.6 },
  stageScroll: {
    width: '100%',
    maxWidth: READABLE_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingBottom: space['4xl'],
    gap: space.sm,
  },
  stageName: { ...type.heading, color: colors.orange, marginBottom: space.md },
  stageRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md, paddingVertical: space.xs },
  stageNum: { ...type.time, fontSize: 30, lineHeight: 36, color: colors.mustard, width: 40, textAlign: 'right' },
  stageTitle: { fontFamily: type.lg.fontFamily, fontSize: 30, lineHeight: 36, color: colors.cream },
  stageSongNotes: { ...type.md, fontSize: 18, lineHeight: 24, color: colors.textMuted },
  stageKey: { ...type.time, fontSize: 28, lineHeight: 34, color: colors.mustard },
  stageBreak: { ...type.label, fontSize: 24, lineHeight: 30, color: colors.orange, textAlign: 'center', paddingVertical: space.md },
  stageNote: { ...type.md, fontSize: 20, lineHeight: 26, fontStyle: 'italic', color: colors.textMuted, paddingLeft: 56 },
});
