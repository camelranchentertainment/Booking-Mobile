// app/(app)/more/setlists.tsx
// Band admins: every upcoming show with its set list status, plus reusable
// templates. Tap a show to open its list, or start one (blank or copied).
// Same data as the website's Set Lists page (lib/adminSetLists.ts).
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../../../components/BackButton';
import { RetroStripes, ScreenHeader, StateMessage } from '../../../components/retro';
import { NewSetListSheet, shortDate, type NewTarget } from '../../../components/setlists/NewSetListSheet';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  fetchSetLists,
  fetchUpcomingShows,
  pushState,
  type SetListHeader,
  type SetListShow,
} from '../../../lib/adminSetLists';
import { formatCardDate, toISODate } from '../../../lib/dates';
import { READABLE_MAX_WIDTH } from '../../../lib/layout';
import { colors, radius, space, touchTarget, type } from '../../../lib/theme';

interface Overview {
  shows: SetListShow[];
  lists: SetListHeader[];
}

/** Status chip text and colour for a list (or for a show with none). */
function chip(list: SetListHeader | undefined): { text: string; color: string } {
  if (!list) return { text: 'NO SET LIST', color: colors.textSubtle };
  const st = pushState(list);
  if (st.kind === 'draft') return { text: 'NOT PUSHED', color: colors.mustard };
  if (st.kind === 'changed') return { text: 'CHANGES NOT PUSHED', color: colors.mustard };
  return { text: `PUSHED · V${st.version}`, color: colors.statusConfirmed };
}

export default function SetListsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const actId = profile?.act_id ?? null;
  const { data, error, loading, refreshing, refresh } = useAsyncData<Overview>(
    `admin-setlists:${actId ?? 'none'}`,
    async () => {
      if (!actId) return { shows: [], lists: [] };
      const [shows, lists] = await Promise.all([fetchUpcomingShows(actId, toISODate(new Date())), fetchSetLists(actId)]);
      return { shows, lists };
    },
    "We couldn't load your set lists. Check your connection and try again."
  );
  const [creating, setCreating] = useState<NewTarget | null>(null);

  // Coming back from the builder: pick up saves and pushes made there. The
  // first focus is the initial load, which useAsyncData already does. refresh
  // changes identity every render, so it's read through a ref to keep the
  // focus callback stable (otherwise it would refire on every render).
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) void refreshRef.current();
      focusedOnce.current = true;
    }, [])
  );

  const byShow = new Map<string, SetListHeader>();
  for (const l of data?.lists ?? []) if (l.bookingId) byShow.set(l.bookingId, l);
  const templates = (data?.lists ?? []).filter((l) => l.isTemplate);
  const showsById = new Map((data?.shows ?? []).map((sh) => [sh.id, sh]));
  const showLabel = (bookingId: string): string | null => {
    const sh = showsById.get(bookingId);
    return sh ? `${sh.venueName ?? 'Show'} · ${shortDate(sh.showDate)}` : null;
  };

  const openList = (id: string) => router.push({ pathname: '/more/setlist/[id]', params: { id } });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} colors={[colors.orange]} />}>
        <ScreenHeader title="Set Lists" subtitle="Build a set, push it to the band's phones" right={<BackButton fallback={'/more'} />} />
        <RetroStripes height={4} gap={2} style={styles.stripes} />

        {loading && !data ? <StateMessage kind="loading" /> : null}
        {error ? <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} /> : null}

        {data && !error ? (
          <>
            <Text style={styles.section}>UPCOMING SHOWS</Text>
            <View style={styles.list}>
              {data.shows.length === 0 ? (
                <Text style={styles.note}>No confirmed shows coming up. Set lists hang off a show, so add or confirm one first.</Text>
              ) : (
                data.shows.map((sh) => {
                  const list = byShow.get(sh.id);
                  const c = chip(list);
                  return (
                    <Pressable
                      key={sh.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${sh.venueName ?? 'Venue TBD'}, ${formatCardDate(sh.showDate)}, ${c.text.toLowerCase()}`}
                      accessibilityHint={list ? 'Opens the set list' : 'Starts a set list for this show'}
                      onPress={() => (list ? openList(list.id) : setCreating({ kind: 'show', show: sh }))}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                      <View style={styles.flex}>
                        <Text style={styles.date}>{formatCardDate(sh.showDate)}</Text>
                        <Text style={styles.name} numberOfLines={1}>{sh.venueName ?? 'Venue TBD'}</Text>
                        {sh.place ? <Text style={styles.meta} numberOfLines={1}>{sh.place}</Text> : null}
                        <Text style={[styles.chip, { color: c.color }]}>{c.text}</Text>
                      </View>
                      <Ionicons name={list ? 'chevron-forward' : 'add-circle-outline'} size={24} color={list ? colors.textMuted : colors.orange} aria-hidden />
                    </Pressable>
                  );
                })
              )}
            </View>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionInline}>TEMPLATES</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New template"
                onPress={() => setCreating({ kind: 'template' })}
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
                <Ionicons name="add" size={18} color={colors.onInteractive} />
                <Text style={styles.addBtnText}>New</Text>
              </Pressable>
            </View>
            <View style={styles.list}>
              {templates.length === 0 ? (
                <Text style={styles.note}>Save the set you play most as a template, then copy it onto each show and tweak it.</Text>
              ) : (
                templates.map((t) => (
                  <Pressable
                    key={t.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Template: ${t.name}`}
                    onPress={() => openList(t.id)}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                    <Ionicons name="copy-outline" size={22} color={colors.mustard} aria-hidden />
                    <Text style={[styles.name, styles.flex]} numberOfLines={1}>{t.name}</Text>
                    <Ionicons name="chevron-forward" size={24} color={colors.textMuted} aria-hidden />
                  </Pressable>
                ))
              )}
            </View>
            <Text style={styles.footnote}>Song details like tempo and notes, and printing, are on the website under Set Lists.</Text>
          </>
        ) : null}
      </ScrollView>

      {actId && data ? (
        <NewSetListSheet
          actId={actId}
          target={creating}
          lists={data.lists}
          showLabel={showLabel}
          onClose={() => setCreating(null)}
          onCreated={(id) => {
            setCreating(null);
            openList(id);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: READABLE_MAX_WIDTH, alignSelf: 'center', backgroundColor: colors.background },
  scroll: { paddingBottom: space['4xl'] },
  stripes: { marginBottom: space.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  section: { ...type.label, color: colors.orange, paddingHorizontal: space.xl, marginBottom: space.sm },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    marginTop: space['2xl'],
    marginBottom: space.sm,
  },
  sectionInline: { ...type.label, color: colors.orange },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.orange },
  addBtnText: { ...type.md, color: colors.onInteractive },
  list: { paddingHorizontal: space.xl, gap: space.md },
  note: { ...type.sm, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    minHeight: touchTarget + 16,
  },
  date: { ...type.eyebrow, fontSize: 14, color: colors.mustard },
  name: { ...type.lg, color: colors.cream },
  meta: { ...type.sm, color: colors.textMuted },
  chip: { ...type.xs, letterSpacing: 1, marginTop: space.xxs },
  footnote: { ...type.sm, color: colors.textSubtle, textAlign: 'center', paddingHorizontal: space.xl, marginTop: space['2xl'] },
});
