// app/(app)/more/roster.tsx
// Band admins: the band and crew roster — add people, edit their role,
// contact details and usual pay, take people off the roster or bring them
// back. Writes are allowed by RLS for band admins only (lib/adminRoster.ts).
// Logins and invites stay on the website (Members page).
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../../../components/BackButton';
import { PersonModal } from '../../../components/PersonModal';
import { RetroStripes, ScreenHeader, StateMessage } from '../../../components/retro';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchRoster, type RosterPerson } from '../../../lib/adminRoster';
import { READABLE_MAX_WIDTH } from '../../../lib/layout';
import { formatMoney } from '../../../lib/money';
import { avatarColors, colors, radius, space, touchTarget, type } from '../../../lib/theme';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '');
  return letters.toUpperCase() || '?';
}

function PersonRow({ person, index, onPress }: { person: RosterPerson; index: number; onPress: () => void }) {
  const fill = person.active ? (avatarColors[index % avatarColors.length] ?? colors.orange) : colors.surfaceRaised;
  const details = [person.role, person.pay != null ? `${formatMoney(person.pay)} / show` : null].filter(Boolean).join(' · ');
  return (
    <View style={[styles.row, !person.active && styles.rowInactive]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${person.name}${details ? `, ${details}` : ''}${person.active ? '' : ', off the roster'}`}
        accessibilityHint="Edit this person"
        onPress={onPress}
        style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
        <View style={[styles.avatar, { backgroundColor: fill }]} aria-hidden>
          <Text style={[styles.avatarText, !person.active && { color: colors.textMuted }]}>{initials(person.name)}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
          {details ? <Text style={styles.meta} numberOfLines={1}>{details}</Text> : null}
          {person.hasLogin ? <Text style={styles.badge}>HAS A LOGIN</Text> : null}
        </View>
        <Ionicons name="create-outline" size={20} color={colors.textMuted} aria-hidden />
      </Pressable>
      {person.phone && person.active ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Call ${person.name}`}
          onPress={() => Linking.openURL(`tel:${(person.phone ?? '').replace(/[^\d+]/g, '')}`).catch((e: unknown) => console.warn('[roster] could not open dialer', e))}
          style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}>
          <Ionicons name="call" size={20} color={colors.onInteractive} />
        </Pressable>
      ) : null}
    </View>
  );
}

export default function RosterScreen() {
  const { profile } = useAuth();
  const actId = profile?.act_id ?? null;
  const { data, error, loading, refreshing, refresh } = useAsyncData(
    `admin-roster:${actId ?? 'none'}`,
    async () => (actId ? fetchRoster(actId) : []),
    "We couldn't load the roster. Check your connection and try again."
  );
  const [editing, setEditing] = useState<RosterPerson | 'new' | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const active = (data ?? []).filter((p) => p.active);
  const inactive = (data ?? []).filter((p) => !p.active);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} colors={[colors.orange]} />}>
        <ScreenHeader title="Roster" subtitle="Band and crew, roles and usual pay" right={<BackButton fallback={'/more'} />} />
        <RetroStripes height={4} gap={2} style={styles.stripes} />

        {loading && !data ? <StateMessage kind="loading" /> : null}
        {error ? <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} /> : null}

        {data && !error ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>ON THE ROSTER ({active.length})</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a person to the roster"
                onPress={() => setEditing('new')}
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
                <Ionicons name="person-add" size={18} color={colors.onInteractive} />
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
            <View style={styles.list}>
              {active.length === 0 ? (
                <Text style={styles.note}>No one on the roster yet. Add your band and crew so you can put them on shows and track their pay.</Text>
              ) : (
                active.map((p, i) => <PersonRow key={p.id} person={p} index={i} onPress={() => setEditing(p)} />)
              )}
            </View>

            {inactive.length > 0 ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showInactive }}
                  onPress={() => setShowInactive((v) => !v)}
                  style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
                  <Ionicons name={showInactive ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.textMuted} />
                  <Text style={styles.toggleText}>Off the roster ({inactive.length})</Text>
                </Pressable>
                {showInactive ? (
                  <View style={styles.list}>
                    {inactive.map((p, i) => <PersonRow key={p.id} person={p} index={i} onPress={() => setEditing(p)} />)}
                  </View>
                ) : null}
              </>
            ) : null}

            <Text style={styles.footnote}>Logins and invites are on the website under Members.</Text>
          </>
        ) : null}
      </ScrollView>
      {actId ? (
        <PersonModal
          actId={actId}
          person={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
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
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl, marginBottom: space.sm },
  section: { ...type.label, color: colors.orange },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.orange },
  addBtnText: { ...type.md, color: colors.onInteractive },
  list: { paddingHorizontal: space.xl, gap: space.md },
  note: { ...type.sm, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.lg, paddingRight: space.md },
  rowInactive: { opacity: 0.7 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, minHeight: 72 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...type.lg, color: colors.onInteractive },
  name: { ...type.lg, color: colors.cream },
  meta: { ...type.sm, color: colors.textMuted },
  badge: { ...type.xs, color: colors.mustard, letterSpacing: 1, marginTop: 2 },
  callBtn: { width: touchTarget, height: touchTarget, borderRadius: touchTarget / 2, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: touchTarget, paddingHorizontal: space.xl, marginTop: space.lg },
  toggleText: { ...type.md, color: colors.textMuted },
  footnote: { ...type.sm, color: colors.textSubtle, textAlign: 'center', paddingHorizontal: space.xl, marginTop: space['2xl'] },
});
