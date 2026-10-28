// app/(app)/more/tour/[id].tsx
// One tour for band admins: progress, then the targets grouped by where they
// stand (following up first). Tap a target to move it along — to pitch,
// following up, declined or thanked — or call / email the venue. Edit sets
// the tour's name, dates and status. Booking a target opens the website's
// new-show form with the venue and tour filled in, so "Booked" always has a
// real show behind it, linked to the tour.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../../../../components/BackButton';
import { RetroButton, RetroStripes, ScreenHeader, StateMessage } from '../../../../components/retro';
import { useAsyncData } from '../../../../hooks/useAsyncData';
import {
  bookShowUrl, fetchTour, MOVABLE_TO, setTargetStatus, TARGET_ORDER, TARGET_STATUS_LABEL, TOUR_STATUS_LABEL, tourDates, updateTour, validateTourEdit,
  type TargetStatus, type TourDetail, type TourEdit, type TourStatus, type TourTarget,
} from '../../../../lib/adminTours';
import { READABLE_MAX_WIDTH } from '../../../../lib/layout';
import { openSafely, telUrl } from '../../../../lib/links';
import { API_BASE } from '../../../../lib/memberShows';
import { colors, radius, space, touchTarget, type } from '../../../../lib/theme';

const STATUS_COLOR: Record<TargetStatus, string> = {
  follow_up: colors.mustard,
  target: colors.statusPitch,
  confirmed: colors.statusConfirmed,
  thank_you: colors.teal,
  declined: colors.statusDone,
};

/** "Last emailed 3 days ago" from an ISO timestamp. */
function lastContact(iso: string | null): string {
  if (!iso) return 'Not contacted yet';
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return 'Not contacted yet';
  if (days <= 0) return 'Contacted today';
  if (days === 1) return 'Contacted yesterday';
  return `Contacted ${days} days ago`;
}

function TargetRow({ t, onPress }: { t: TourTarget; onPress: () => void }) {
  const place = [t.venue.city, t.venue.state].filter(Boolean).join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.venue.name}${place ? `, ${place}` : ''}. ${TARGET_STATUS_LABEL[t.status]}. ${lastContact(t.lastContactedAt)}.`}
      accessibilityHint="Change status or contact the venue"
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderLeftColor: STATUS_COLOR[t.status] }, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <Text style={styles.rowName} numberOfLines={1}>{t.venue.name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{[place, lastContact(t.lastContactedAt)].filter(Boolean).join(' · ')}</Text>
      </View>
      <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

/** Bottom sheet for one target: move it along, or call / email the venue. */
function TargetSheet({ target, tour, onClose, onChanged }: { target: TourTarget | null; tour: TourDetail | null; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState<TargetStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forId, setForId] = useState<string | null>(null);
  if ((target?.id ?? null) !== forId) {
    setForId(target?.id ?? null);
    setError(null);
  }

  const move = async (status: TargetStatus) => {
    if (!target || busy) return;
    setBusy(status);
    setError(null);
    try {
      await setTargetStatus(target.id, status);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the target.");
    } finally {
      setBusy(null);
    }
  };

  const tel = target?.venue.phone ? telUrl(target.venue.phone) : null;
  return (
    <Modal visible={target !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        {target ? (
          <View style={styles.sheet} accessibilityViewIsModal>
            <Text style={styles.eyebrow}>{TARGET_STATUS_LABEL[target.status].toUpperCase()}</Text>
            <Text style={styles.sheetTitle}>{target.venue.name}</Text>
            <Text style={styles.sheetMeta}>{[target.venue.city, target.venue.state].filter(Boolean).join(', ')}</Text>
            {target.notes ? <Text style={styles.sheetNotes}>{target.notes}</Text> : null}

            {(tel || target.venue.email) ? (
              <View style={styles.contactRow}>
                {tel ? (
                  <Pressable accessibilityRole="link" accessibilityLabel={`Call ${target.venue.name}`} onPress={() => void openSafely(tel)} style={({ pressed }) => [styles.contactBtn, pressed && styles.pressed]}>
                    <Ionicons name="call" size={18} color={colors.onInteractive} /><Text style={styles.contactText}>Call</Text>
                  </Pressable>
                ) : null}
                {target.venue.email ? (
                  <Pressable accessibilityRole="link" accessibilityLabel={`Email ${target.venue.name}`} onPress={() => void openSafely(`mailto:${target.venue.email}`)} style={({ pressed }) => [styles.contactBtn, pressed && styles.pressed]}>
                    <Ionicons name="mail" size={18} color={colors.onInteractive} /><Text style={styles.contactText}>Email</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.label}>Move to</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {MOVABLE_TO.map((s) => {
                const on = target.status === s;
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on, busy: busy === s, disabled: on || !!busy }}
                    disabled={on || !!busy}
                    onPress={() => void move(s)}
                    style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{busy === s ? 'Saving…' : TARGET_STATUS_LABEL[s]}</Text>
                  </Pressable>
                );
              })}
            </View>
            {tour && target.status !== 'confirmed' && target.status !== 'thank_you' ? (
              <Pressable
                accessibilityRole="link"
                accessibilityHint="Opens the new-show form on camelranchbooking.com with this venue and tour filled in"
                onPress={() => void openSafely(bookShowUrl(API_BASE, target.venue.id, tour.id, tour.actId))}
                style={({ pressed }) => [styles.bookBtn, pressed && styles.pressed]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.onInteractive} />
                <Text style={styles.contactText}>Got a yes? Book the show</Text>
              </Pressable>
            ) : null}
            <Text style={styles.hint}>Booking opens the website with this venue and tour filled in, so the show stays linked to the tour.</Text>
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            <View style={styles.sheetActions}><RetroButton label="Done" variant="outline" onPress={onClose} /></View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** Bottom sheet to edit the tour's name, dates and status. */
function EditTourSheet({ tour, open, onClose, onSaved }: { tour: TourDetail; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<TourEdit | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (open && !form) setForm({ name: tour.name, startDate: tour.startDate ?? '', endDate: tour.endDate ?? '', status: tour.status });
  if (!open && form) setForm(null);
  const problem = form ? validateTourEdit(form) : null;

  const save = async () => {
    if (!form || problem || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateTour(tour.id, form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the tour.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => !saving && onClose()}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => !saving && onClose()} accessibilityLabel="Close" accessibilityRole="button" />
        {form ? (
          <View style={styles.sheet} accessibilityViewIsModal>
            <Text style={styles.eyebrow}>EDIT TOUR</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} accessibilityLabel="Tour name" autoCapitalize="words" />
            <View style={styles.dateRow}>
              <View style={styles.flex}>
                <Text style={styles.label}>Starts</Text>
                <TextInput style={styles.input} value={form.startDate} onChangeText={(v) => setForm({ ...form, startDate: v.trim() })} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSubtle} accessibilityLabel="Start date, year dash month dash day" autoCapitalize="none" />
              </View>
              <View style={styles.flex}>
                <Text style={styles.label}>Ends</Text>
                <TextInput style={styles.input} value={form.endDate} onChangeText={(v) => setForm({ ...form, endDate: v.trim() })} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSubtle} accessibilityLabel="End date, year dash month dash day" autoCapitalize="none" />
              </View>
            </View>
            <Text style={styles.label}>Status</Text>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {(Object.keys(TOUR_STATUS_LABEL) as TourStatus[]).map((s) => {
                const on = form.status === s;
                return (
                  <Pressable key={s} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setForm({ ...form, status: s })} style={[styles.chip, on && styles.chipOn]}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{TOUR_STATUS_LABEL[s]}</Text>
                  </Pressable>
                );
              })}
            </View>
            {problem ? <Text style={styles.error}>{problem}</Text> : null}
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            <View style={styles.sheetActions}>
              <View style={styles.flex}><RetroButton label="Cancel" variant="outline" onPress={onClose} disabled={saving} /></View>
              <View style={styles.flex}><RetroButton label="Save" onPress={save} busy={saving} disabled={!!problem} /></View>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function TourScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tourId = typeof id === 'string' ? id : '';
  const { data, error, loading, refreshing, refresh } = useAsyncData(
    `admin-tour:${tourId}`,
    () => fetchTour(tourId),
    "We couldn't load this tour. Check your connection and try again."
  );
  const [picked, setPicked] = useState<TourTarget | null>(null);
  const [editing, setEditing] = useState(false);

  const pct = data && data.targets ? Math.round((data.booked / data.targets) * 100) : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} colors={[colors.orange]} />}>
        <ScreenHeader title={data?.name ?? 'Tour'} subtitle={data ? `${TOUR_STATUS_LABEL[data.status]} · ${tourDates(data.startDate, data.endDate)}` : undefined} right={<BackButton fallback={'/more/tours'} />} />
        <RetroStripes height={4} gap={2} style={styles.stripes} />

        {loading && !data ? <StateMessage kind="loading" /> : null}
        {error ? <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} /> : null}

        {data && !error ? (
          <>
            <View style={styles.progress}>
              <View style={styles.progressTop}>
                <Text style={styles.progressBig}>{data.booked}<Text style={styles.progressOf}> of {data.targets} booked</Text></Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Edit tour name, dates and status" onPress={() => setEditing(true)} style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}>
                  <Ionicons name="create-outline" size={18} color={colors.onInteractive} /><Text style={styles.editText}>Edit</Text>
                </Pressable>
              </View>
              <View style={styles.meter} aria-hidden><View style={[styles.meterBar, { width: `${pct}%` }]} /></View>
              {data.followUps ? <Text style={styles.progressNote}>{data.followUps} waiting on a follow-up</Text> : null}
            </View>

            {data.list.length === 0 ? (
              <Text style={styles.note}>No targets on this tour yet. Add venues to it on the website.</Text>
            ) : (
              TARGET_ORDER.map((status) => {
                const group = data.list.filter((t) => t.status === status);
                if (group.length === 0) return null;
                return (
                  <View key={status}>
                    <Text style={[styles.section, { color: STATUS_COLOR[status] }]}>{TARGET_STATUS_LABEL[status].toUpperCase()} ({group.length})</Text>
                    <View style={styles.list}>
                      {group.map((t) => <TargetRow key={t.id} t={t} onPress={() => setPicked(t)} />)}
                    </View>
                  </View>
                );
              })
            )}
          </>
        ) : null}
      </ScrollView>

      <TargetSheet target={picked} tour={data ?? null} onClose={() => setPicked(null)} onChanged={() => { setPicked(null); void refresh(); }} />
      {data ? <EditTourSheet tour={data} open={editing} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void refresh(); }} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: READABLE_MAX_WIDTH, alignSelf: 'center', backgroundColor: colors.background },
  scroll: { paddingBottom: space['4xl'] },
  stripes: { marginBottom: space.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  progress: { marginHorizontal: space.xl, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  progressTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  progressBig: { ...type.title, color: colors.cream },
  progressOf: { ...type.md, color: colors.textMuted },
  progressNote: { ...type.sm, color: colors.mustard },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.orange },
  editText: { ...type.md, color: colors.onInteractive },
  meter: { height: 8, borderRadius: 4, backgroundColor: colors.backgroundDeep, overflow: 'hidden' },
  meterBar: { height: '100%', backgroundColor: colors.orange, borderRadius: 4 },
  section: { ...type.label, paddingHorizontal: space.xl, marginTop: space['2xl'], marginBottom: space.sm },
  note: { ...type.sm, color: colors.textMuted, paddingHorizontal: space.xl, marginTop: space.lg },
  list: { paddingHorizontal: space.xl, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, minHeight: touchTarget + 12, borderLeftWidth: 4 },
  rowName: { ...type.lg, color: colors.cream },
  rowMeta: { ...type.sm, color: colors.textMuted },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,17,32,0.7)' },
  sheet: { width: '100%', maxWidth: 640, alignSelf: 'center', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, paddingBottom: space['3xl'], gap: space.xs },
  eyebrow: { ...type.eyebrow, color: colors.orange },
  sheetTitle: { ...type.heading, color: colors.cream },
  sheetMeta: { ...type.sm, color: colors.textMuted },
  sheetNotes: { ...type.sm, color: colors.cream, marginTop: space.xs },
  contactRow: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: colors.orange },
  contactText: { ...type.md, color: colors.onInteractive },
  label: { ...type.xs, color: colors.textMuted, textTransform: 'uppercase', marginTop: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundDeep },
  chipOn: { backgroundColor: colors.interactive, borderColor: colors.interactive },
  chipText: { ...type.md, color: colors.cream },
  chipTextOn: { color: colors.onInteractive },
  hint: { ...type.sm, color: colors.textMuted, marginTop: space.sm },
  bookBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: touchTarget, marginTop: space.lg, borderRadius: radius.pill, backgroundColor: colors.statusConfirmed },
  error: { ...type.sm, color: colors.danger, marginTop: space.xs },
  sheetActions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundDeep, color: colors.cream, borderRadius: radius.md, paddingHorizontal: space.md, minHeight: touchTarget, fontSize: 17, fontFamily: type.lg.fontFamily },
  dateRow: { flexDirection: 'row', gap: space.md },
});
