// components/AddShowModal.tsx
// Band admins add a show from the phone: pick (or add) a venue, date, status,
// times and the deal. Validates on blur, keeps everything typed on failure.
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAsyncData } from '../hooks/useAsyncData';
import { bookingStatusColor, bookingStatusLabel } from '../lib/bookingStatus';
import type { UpcomingBooking } from '../lib/bookings';
import { READABLE_MAX_WIDTH } from '../lib/layout';
import {
  EMPTY_FORM,
  NEW_SHOW_STATUSES,
  createShow,
  findShowsOnDate,
  parseShowDate,
  validateNewShow,
  type FieldErrors,
  type NewShowForm,
} from '../lib/newShow';
import { colors, radius, space, touchTarget, type } from '../lib/theme';
import { fetchVenues, filterVenues, placeLabel, type VenueSummary } from '../lib/venues';
import { ModalScreen } from './ModalScreen';
import { RetroButton } from './retro';

interface Props {
  visible: boolean;
  actId: string;
  userId: string;
  onClose: () => void;
  onCreated: (booking: UpcomingBooking) => void;
}

type VenueMode = 'pick' | 'new' | 'tbd';

export function AddShowModal({ visible, actId, userId, onClose, onCreated }: Props) {
  const [form, setForm] = useState<NewShowForm>(EMPTY_FORM);
  const [venueMode, setVenueMode] = useState<VenueMode>('pick');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<VenueSummary | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sameDay, setSameDay] = useState<string[] | null>(null);

  const venues = useAsyncData(
    `addshow-venues:${visible ? actId : 'closed'}`,
    () => (visible ? fetchVenues(actId) : Promise.resolve([] as VenueSummary[])),
    "We couldn't load your venues."
  );

  const effective: NewShowForm = {
    ...form,
    venueId: venueMode === 'pick' ? (picked?.id ?? null) : null,
    newVenue: venueMode === 'new' ? (form.newVenue ?? { name: '', city: '', state: '' }) : null,
  };
  const errors: FieldErrors = validateNewShow(effective);
  const venueMissing = venueMode === 'pick' && !picked;
  const show = (k: string) => (submitted || touched.has(k)) && errors[k as keyof FieldErrors];
  const blur = (k: string) => () => setTouched((t) => new Set(t).add(k));
  const set = <K extends keyof NewShowForm>(k: K, v: NewShowForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setVenue = (k: 'name' | 'city' | 'state', v: string) =>
    setForm((f) => ({ ...f, newVenue: { ...(f.newVenue ?? { name: '', city: '', state: '' }), [k]: v } }));

  const reset = () => {
    setForm(EMPTY_FORM);
    setVenueMode('pick');
    setQuery('');
    setPicked(null);
    setTouched(new Set());
    setSubmitted(false);
    setSaveError(null);
    setSameDay(null);
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const save = async (confirmedDuplicate = false) => {
    setSubmitted(true);
    setSaveError(null);
    if (Object.keys(errors).length || venueMissing || saving) return;
    setSaving(true);
    try {
      if (!confirmedDuplicate) {
        const others = await findShowsOnDate(actId, parseShowDate(form.date)!);
        if (others.length) {
          setSameDay(others.map((o) => o.venueName ?? 'Venue TBD'));
          return;
        }
      }
      const created = await createShow({ actId, userId, form: effective });
      reset();
      onCreated(created);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'The show could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const list = filterVenues(venues.data ?? [], query).slice(0, 8);

  return (
    <ModalScreen visible={visible} onClose={close}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Add a show</Text>

            {/* ── Venue ─────────────────────────────── */}
            <Text style={styles.section}>VENUE</Text>
            <View style={styles.segment} accessibilityRole="radiogroup">
              {(
                [
                  ['pick', 'My venues'],
                  ['new', 'New venue'],
                  ['tbd', 'TBD'],
                ] as const
              ).map(([mode, label]) => (
                <Pressable
                  key={mode}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: venueMode === mode }}
                  onPress={() => setVenueMode(mode)}
                  style={[styles.segmentItem, venueMode === mode && styles.segmentOn]}>
                  <Text style={[styles.segmentText, venueMode === mode && styles.segmentTextOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {venueMode === 'pick' ? (
              picked ? (
                <View style={styles.pickedRow}>
                  <View style={styles.flex}>
                    <Text style={styles.pickedName}>{picked.name}</Text>
                    <Text style={styles.muted}>{placeLabel(picked)}</Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => setPicked(null)} style={styles.change}>
                    <Text style={styles.link}>Change</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search your venues"
                    placeholderTextColor={colors.textSubtle}
                    accessibilityLabel="Search your venues"
                    autoCorrect={false}
                  />
                  {venues.loading ? <Text style={styles.muted}>Loading venues…</Text> : null}
                  {venues.error ? <Text style={styles.error}>{venues.error}</Text> : null}
                  {list.map((v) => (
                    <Pressable key={v.id} accessibilityRole="button" onPress={() => setPicked(v)} style={styles.venueRow}>
                      <Text style={styles.venueName}>{v.name}</Text>
                      <Text style={styles.muted}>{placeLabel(v)}</Text>
                    </Pressable>
                  ))}
                  {venues.data && query && list.length === 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setVenueMode('new');
                        setVenue('name', query);
                      }}>
                      <Text style={styles.link}>No match. Add “{query}” as a new venue</Text>
                    </Pressable>
                  ) : null}
                  {submitted && venueMissing ? <Text style={styles.error}>Pick a venue, add a new one, or choose TBD.</Text> : null}
                </>
              )
            ) : null}

            {venueMode === 'new' ? (
              <>
                <Field label="Venue name" error={show('venueName')}>
                  <TextInput
                    style={[styles.input, show('venueName') && styles.inputBad]}
                    value={form.newVenue?.name ?? ''}
                    onChangeText={(v) => setVenue('name', v)}
                    onBlur={blur('venueName')}
                    accessibilityLabel="Venue name"
                  />
                </Field>
                <View style={styles.row2}>
                  <View style={styles.grow}>
                    <Field label="City" error={show('venueCity')}>
                      <TextInput
                        style={[styles.input, show('venueCity') && styles.inputBad]}
                        value={form.newVenue?.city ?? ''}
                        onChangeText={(v) => setVenue('city', v)}
                        onBlur={blur('venueCity')}
                        accessibilityLabel="City"
                      />
                    </Field>
                  </View>
                  <View style={styles.stateCol}>
                    <Field label="State" error={show('venueState')}>
                      <TextInput
                        style={[styles.input, show('venueState') && styles.inputBad]}
                        value={form.newVenue?.state ?? ''}
                        onChangeText={(v) => setVenue('state', v.toUpperCase())}
                        onBlur={blur('venueState')}
                        maxLength={2}
                        autoCapitalize="characters"
                        accessibilityLabel="State, two letters"
                      />
                    </Field>
                  </View>
                </View>
              </>
            ) : null}

            {venueMode === 'tbd' ? <Text style={styles.muted}>You can add the venue later from the website.</Text> : null}

            {/* ── When ──────────────────────────────── */}
            <Text style={styles.section}>WHEN</Text>
            <Field label="Date (MM/DD/YYYY)" error={show('date')}>
              <TextInput
                style={[styles.input, show('date') && styles.inputBad]}
                value={form.date}
                onChangeText={(v) => {
                  set('date', v);
                  setSameDay(null);
                }}
                onBlur={blur('date')}
                placeholder="11/20/2026"
                placeholderTextColor={colors.textSubtle}
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="Show date, month day year"
              />
            </Field>

            <Text style={styles.label}>Status</Text>
            <View style={styles.chips}>
              {NEW_SHOW_STATUSES.map((s) => {
                const on = form.status === s;
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => set('status', s)}
                    style={[styles.chip, { backgroundColor: on ? bookingStatusColor(s) : colors.surface }]}>
                    <Text style={styles.chipText}>{bookingStatusLabel(s)}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ── Schedule ──────────────────────────── */}
            <Text style={styles.section}>SCHEDULE (24-HOUR, OPTIONAL)</Text>
            <View style={styles.row2}>
              <TimeField label="Load-in" k="loadIn" form={form} set={set} show={show} blur={blur} placeholder="17:00" />
              <TimeField label="Sound check" k="soundcheck" form={form} set={set} show={show} blur={blur} placeholder="18:00" />
            </View>
            <View style={styles.row2}>
              <TimeField label="Doors" k="doors" form={form} set={set} show={show} blur={blur} placeholder="19:00" />
              <TimeField label="Set time" k="setTime" form={form} set={set} show={show} blur={blur} placeholder="20:00" />
            </View>
            <View style={styles.row2}>
              <TimeField
                label="Set length (min)"
                k="setLength"
                form={form}
                set={set}
                show={show}
                blur={blur}
                placeholder="90"
                keyboardType="number-pad"
              />
              <TimeField
                label="Agreed pay ($)"
                k="fee"
                form={form}
                set={set}
                show={show}
                blur={blur}
                placeholder="500"
                keyboardType="decimal-pad"
              />
            </View>

            <Field label="Notes (admins only)">
              <TextInput
                style={[styles.input, styles.multiline]}
                value={form.notes}
                onChangeText={(v) => set('notes', v)}
                multiline
                accessibilityLabel="Notes, admins only"
              />
            </Field>

            {sameDay ? (
              <View style={styles.warn} accessibilityRole="alert">
                <Ionicons name="warning-outline" size={20} color={colors.mustard} />
                <View style={styles.flex}>
                  <Text style={styles.warnText}>Already on this date: {sameDay.join(', ')}.</Text>
                  <Pressable accessibilityRole="button" onPress={() => save(true)}>
                    <Text style={styles.link}>Add it anyway</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {saveError ? (
              <Text style={styles.error} accessibilityRole="alert">
                {saveError}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <View style={styles.flex}>
                <RetroButton label="Cancel" variant="outline" onPress={close} disabled={saving} />
              </View>
              <View style={styles.flex}>
                <RetroButton label="Save show" onPress={() => save(false)} busy={saving} />
              </View>
            </View>
          </ScrollView>
    </ModalScreen>
  );
}

function Field({ label, error, children }: { label: string; error?: string | false; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function TimeField(props: {
  label: string;
  k: 'loadIn' | 'soundcheck' | 'doors' | 'setTime' | 'setLength' | 'fee';
  form: NewShowForm;
  set: <K extends keyof NewShowForm>(k: K, v: NewShowForm[K]) => void;
  show: (k: string) => string | false | undefined;
  blur: (k: string) => () => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
}) {
  const { label, k, form, set, show, blur, placeholder, keyboardType } = props;
  const bad = show(k);
  return (
    <View style={styles.grow}>
      <Field label={label} error={bad}>
        <TextInput
          style={[styles.input, bad && styles.inputBad]}
          value={form[k]}
          onChangeText={(v) => set(k, v)}
          onBlur={blur(k)}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          keyboardType={keyboardType ?? 'numbers-and-punctuation'}
          accessibilityLabel={label}
        />
      </Field>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  grow: { flex: 1 },
  content: { width: '100%', maxWidth: READABLE_MAX_WIDTH, alignSelf: 'center', padding: space.xl, paddingBottom: space['4xl'] },
  title: { ...type.title, color: colors.cream },
  section: { ...type.label, color: colors.orange, marginTop: space['2xl'], marginBottom: space.sm },
  label: { ...type.xs, color: colors.textMuted, marginBottom: space.xs, textTransform: 'uppercase' },
  field: { marginBottom: space.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: touchTarget,
    fontSize: 16,
    fontFamily: type.base.fontFamily,
  },
  inputBad: { borderColor: colors.danger },
  multiline: { minHeight: 90, paddingTop: space.md, textAlignVertical: 'top' },
  error: { ...type.sm, color: colors.danger, marginTop: space.xs },
  muted: { ...type.sm, color: colors.textMuted },
  link: { ...type.md, color: colors.interactive, paddingVertical: space.sm },
  segment: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', marginBottom: space.md },
  segmentItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  segmentOn: { backgroundColor: colors.orange },
  segmentText: { ...type.md, color: colors.cream },
  segmentTextOn: { color: colors.onInteractive },
  venueRow: { minHeight: touchTarget, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: space.sm },
  venueName: { ...type.md, color: colors.cream },
  pickedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: space.md },
  pickedName: { ...type.lg, color: colors.cream },
  change: { minHeight: 44, justifyContent: 'center' },
  row2: { flexDirection: 'row', gap: space.md },
  stateCol: { width: 90 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  chip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' },
  chipText: { ...type.xs, color: colors.cream },
  warn: { flexDirection: 'row', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, marginTop: space.md },
  warnText: { ...type.sm, color: colors.mustard },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space['2xl'] },
});
