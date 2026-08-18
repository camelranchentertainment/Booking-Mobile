import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BOOKING_STATUSES,
  bookingStatusColor,
  bookingStatusLabel,
  type BookingStatus,
} from '../lib/bookingStatus';
import { updateBooking, type BookingEditableFields, type UpcomingBooking } from '../lib/bookings';

const COLORS = {
  background: '#0E1628',
  surface: '#1A2540',
  border: '#2A3655',
  accent: '#E8602A',
  text: '#F5EDD9',
  textMuted: '#8A96B5',
  taglineBlue: '#6B8FB5',
  errorRed: '#E85A5A',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Date TBD';
  // show_date is a Postgres `date` (no time component) — parse as local,
  // not UTC, so it doesn't shift a day depending on the device's timezone.
  const parts = dateStr.split('-').map(Number);
  const date = new Date(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(timeStr: string | null): string | null {
  if (!timeStr) return null;
  const segments = timeStr.split(':');
  const hour = Number(segments[0] ?? 0);
  const minute = Number(segments[1] ?? 0);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

function formatFee(fee: number | null): string | null {
  if (fee === null) return null;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(fee);
}

/** Accepts 24-hour "HH:MM" only — the same shape the schedule inputs collect. */
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

interface EditState {
  status: BookingStatus;
  loadInTime: string;
  setTime: string;
  doorTime: string;
  fee: string;
  dealNotes: string;
  internalNotes: string;
}

function toEditState(booking: UpcomingBooking): EditState {
  return {
    status: (booking.status as BookingStatus) ?? 'pitch',
    loadInTime: booking.loadInTime?.slice(0, 5) ?? '',
    setTime: booking.setTime?.slice(0, 5) ?? '',
    doorTime: booking.doorTime?.slice(0, 5) ?? '',
    fee: booking.fee !== null ? String(booking.fee) : '',
    dealNotes: booking.dealNotes ?? '',
    internalNotes: booking.internalNotes ?? '',
  };
}

interface Props {
  booking: UpcomingBooking | null;
  /** Whether the signed-in user is allowed to see the "Edit show details"
   *  affordance at all — band_admin/superadmin only. This is a UI
   *  convenience; the real permission boundary is the database's RLS
   *  policy (see lib/bookings.ts). */
  canEdit: boolean;
  onClose: () => void;
  /** Called with the fresh row after a successful save, so the caller can
   *  splice it back into its own list without a full refetch. */
  onUpdated: (booking: UpcomingBooking) => void;
}

/**
 * Full "day sheet" for a single show — load-in, set, doors, fee, venue
 * contact, and any notes ops needs on show day. Presented as a native
 * modal so it works identically on iOS/Android/web without adding a
 * second navigator on top of the app's Stack layout. Also doubles as the
 * editor for the same fields when `canEdit` is true.
 */
export function DaySheetModal({ booking, canEdit, onClose, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (booking) {
      setForm(toEditState(booking));
      setEditing(false);
      setSaveError(null);
    }
  }, [booking?.id]);

  if (!booking || !form) {
    return (
      <Modal visible={booking !== null} animationType="slide" onRequestClose={onClose}>
        <SafeAreaView style={styles.flex} />
      </Modal>
    );
  }

  const timeFieldsValid =
    (form.loadInTime === '' || TIME_PATTERN.test(form.loadInTime)) &&
    (form.setTime === '' || TIME_PATTERN.test(form.setTime)) &&
    (form.doorTime === '' || TIME_PATTERN.test(form.doorTime));
  const feeValid = form.fee === '' || !Number.isNaN(Number(form.fee));
  const canSave = timeFieldsValid && feeValid && !saving;

  const handleClose = () => {
    setEditing(false);
    onClose();
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);

    const patch: Partial<BookingEditableFields> = {
      status: form.status,
      loadInTime: form.loadInTime === '' ? null : `${form.loadInTime}:00`,
      setTime: form.setTime === '' ? null : `${form.setTime}:00`,
      doorTime: form.doorTime === '' ? null : `${form.doorTime}:00`,
      fee: form.fee === '' ? null : Number(form.fee),
      dealNotes: form.dealNotes === '' ? null : form.dealNotes,
      internalNotes: form.internalNotes === '' ? null : form.internalNotes,
    };

    try {
      const updated = await updateBooking(booking.id, patch);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
              <Text style={styles.venueName}>{booking.venue?.name ?? 'Venue TBD'}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={handleClose}
                hitSlop={12}
                style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>

            <Text style={styles.date}>{formatDate(booking.showDate)}</Text>

            {booking.venue && (booking.venue.city || booking.venue.state) && (
              <Text style={styles.location}>
                {[booking.venue.city, booking.venue.state].filter(Boolean).join(', ')}
              </Text>
            )}

            {!editing ? (
              <>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: bookingStatusColor(booking.status) },
                  ]}>
                  <Text style={styles.statusPillText}>{bookingStatusLabel(booking.status)}</Text>
                </View>

                <Section title="Schedule">
                  <Row label="Load-in" value={formatTime(booking.loadInTime)} />
                  <Row label="Sound check / set" value={formatTime(booking.setTime)} />
                  <Row label="Doors" value={formatTime(booking.doorTime)} />
                  <Row
                    label="Set length"
                    value={booking.setLengthMin ? `${booking.setLengthMin} min` : null}
                  />
                </Section>

                <Section title="Pay">
                  <Row label="Fee" value={formatFee(booking.fee)} />
                </Section>

                {booking.venue && (
                  <Section title="Venue">
                    <Row label="Address" value={booking.venue.address} />
                    <Row label="Capacity" value={booking.venue.capacity?.toString() ?? null} />
                    <Row label="Booking contact" value={booking.venue.bookingContact} />
                    <Row label="Phone" value={booking.venue.phone} />
                  </Section>
                )}

                {(booking.soundSystem || booking.specialRequirements) && (
                  <Section title="Production">
                    <Row label="Sound system" value={booking.soundSystem} />
                    <Row label="Special requirements" value={booking.specialRequirements} />
                  </Section>
                )}

                {(booking.dealNotes || booking.internalNotes) && (
                  <Section title="Notes">
                    {booking.dealNotes && (
                      <Text style={styles.noteText}>{booking.dealNotes}</Text>
                    )}
                    {booking.internalNotes && (
                      <Text style={styles.noteText}>{booking.internalNotes}</Text>
                    )}
                  </Section>
                )}

                {canEdit && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setEditing(true)}
                    style={styles.editButton}>
                    <Text style={styles.editButtonText}>Edit show details</Text>
                  </Pressable>
                )}
              </>
            ) : (
              <>
                <Section title="Status">
                  <View style={styles.chipRow}>
                    {BOOKING_STATUSES.map((status) => {
                      const selected = form.status === status;
                      return (
                        <Pressable
                          key={status}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setForm({ ...form, status })}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected
                                ? bookingStatusColor(status)
                                : COLORS.surface,
                            },
                          ]}>
                          <Text style={styles.chipText}>{bookingStatusLabel(status)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Section>

                <Section title="Schedule (24-hour, e.g. 18:30)">
                  <EditRow
                    label="Load-in"
                    value={form.loadInTime}
                    onChangeText={(v) => setForm({ ...form, loadInTime: v })}
                    placeholder="17:00"
                    invalid={form.loadInTime !== '' && !TIME_PATTERN.test(form.loadInTime)}
                  />
                  <EditRow
                    label="Sound check / set"
                    value={form.setTime}
                    onChangeText={(v) => setForm({ ...form, setTime: v })}
                    placeholder="20:00"
                    invalid={form.setTime !== '' && !TIME_PATTERN.test(form.setTime)}
                  />
                  <EditRow
                    label="Doors"
                    value={form.doorTime}
                    onChangeText={(v) => setForm({ ...form, doorTime: v })}
                    placeholder="19:00"
                    invalid={form.doorTime !== '' && !TIME_PATTERN.test(form.doorTime)}
                  />
                </Section>

                <Section title="Pay">
                  <EditRow
                    label="Fee ($)"
                    value={form.fee}
                    onChangeText={(v) => setForm({ ...form, fee: v })}
                    placeholder="500"
                    keyboardType="decimal-pad"
                    invalid={form.fee !== '' && Number.isNaN(Number(form.fee))}
                  />
                </Section>

                <Section title="Notes">
                  <Text style={styles.fieldLabel}>Deal notes</Text>
                  <TextInput
                    style={styles.multiline}
                    value={form.dealNotes}
                    onChangeText={(v) => setForm({ ...form, dealNotes: v })}
                    multiline
                    placeholder="Deal terms, split, guarantee..."
                    placeholderTextColor={COLORS.textMuted}
                  />
                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Internal notes</Text>
                  <TextInput
                    style={styles.multiline}
                    value={form.internalNotes}
                    onChangeText={(v) => setForm({ ...form, internalNotes: v })}
                    multiline
                    placeholder="Notes just for the band..."
                    placeholderTextColor={COLORS.textMuted}
                  />
                </Section>

                {saveError && (
                  <Text style={styles.errorText} accessibilityRole="alert">
                    {saveError}
                  </Text>
                )}

                <View style={styles.editActionsRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setForm(toEditState(booking));
                      setEditing(false);
                      setSaveError(null);
                    }}
                    style={[styles.actionButton, styles.cancelButton]}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSave }}
                    disabled={!canSave}
                    onPress={handleSave}
                    style={[
                      styles.actionButton,
                      styles.saveButton,
                      !canSave && styles.saveButtonDisabled,
                    ]}>
                    {saving ? (
                      <ActivityIndicator color={COLORS.background} />
                    ) : (
                      <Text style={styles.saveButtonText}>Save</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function EditRow({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  invalid,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad';
  invalid: boolean;
}) {
  return (
    <View style={styles.editRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.textInput, invalid && styles.textInputInvalid]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 48, backgroundColor: COLORS.background },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  venueName: { fontSize: 24, fontWeight: '700', flex: 1, color: COLORS.text },
  closeButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { color: COLORS.accent, fontSize: 16, fontWeight: '600' },
  date: { fontSize: 15, color: COLORS.taglineBlue, marginTop: 4 },
  location: { fontSize: 15, color: COLORS.textMuted, marginTop: 2 },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 10,
  },
  statusPillText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  section: { marginTop: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.textMuted,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowLabel: { fontSize: 15, color: COLORS.textMuted },
  rowValue: { fontSize: 15, fontWeight: '500', flexShrink: 1, textAlign: 'right', color: COLORS.text },
  noteText: { fontSize: 15, lineHeight: 21, marginBottom: 8, color: COLORS.text },
  editButton: {
    marginTop: 32,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonText: { color: COLORS.accent, fontSize: 16, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  editRow: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, color: COLORS.textMuted, marginBottom: 4, fontWeight: '600' },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 44,
  },
  textInputInvalid: { borderColor: COLORS.errorRed },
  multiline: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  errorText: { color: COLORS.errorRed, marginTop: 16 },
  editActionsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: { borderWidth: 1, borderColor: COLORS.border },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  saveButton: { backgroundColor: COLORS.accent },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: COLORS.background, fontSize: 16, fontWeight: '700' },
});
