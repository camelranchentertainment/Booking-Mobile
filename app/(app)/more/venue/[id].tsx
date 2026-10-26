// app/(app)/more/venue/[id].tsx
// One venue for band admins: the Venue Contact with one-tap call / email,
// directions and website, and editable contact + notes. Each show keeps its
// own day-of Show Contact; this is the venue's standing contact.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RetroButton, RetroStripes, ScreenHeader, StateMessage } from '../../../../components/retro';
import { useAsyncData } from '../../../../hooks/useAsyncData';
import { READABLE_MAX_WIDTH } from '../../../../lib/layout';
import { mapsUrl, openSafely, telUrl, webUrl } from '../../../../lib/links';
import { colors, fonts, radius, space, touchTarget, type } from '../../../../lib/theme';
import { fetchVenue, isPlausibleEmail, placeLabel, updateVenue, type VenueDetail, type VenueEdit } from '../../../../lib/venues';

type IconName = ComponentProps<typeof Ionicons>['name'];

function BackButton() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to venues"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/more/venues'))}
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
      <Ionicons name="chevron-back" size={28} color={colors.cream} />
    </Pressable>
  );
}

function Action({ icon, label, hint, onPress }: { icon: IconName; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <Ionicons name={icon} size={22} color={colors.onInteractive} aria-hidden />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function Input({
  id, label, value, onChangeText, multiline, keyboardType, invalid, placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  invalid?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text nativeID={id} style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabelledBy={id}
        aria-labelledby={id}
        aria-invalid={invalid}
        style={[styles.input, multiline && styles.multiline, invalid && styles.inputInvalid]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={keyboardType !== 'email-address'}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
      />
    </View>
  );
}

function toEdit(v: VenueDetail): VenueEdit {
  return { contactName: v.contactName ?? '', email: v.email ?? '', phone: v.phone ?? '', notes: v.notes ?? '' };
}

export default function VenueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, refreshing, refresh } = useAsyncData(
    `venue:${id}`,
    () => fetchVenue(String(id)),
    "We couldn't load this venue. Check your connection and try again."
  );

  // Local copy so a save shows immediately without a refetch flash.
  const [saved, setSaved] = useState<VenueDetail | null>(null);
  const venue = saved && saved.id === id ? saved : data;

  const [form, setForm] = useState<VenueEdit | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const emailInvalid = form ? !isPlausibleEmail(form.email) : false;

  const startEdit = () => {
    if (!venue) return;
    setSaveError('');
    setForm(toEdit(venue));
  };

  const save = async () => {
    if (!form || !venue || saving) return;
    if (emailInvalid) {
      setSaveError('That email address doesn’t look right.');
      AccessibilityInfo.announceForAccessibility('That email address doesn’t look right.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const updated = await updateVenue(venue.id, form);
      setSaved(updated);
      setForm(null);
      AccessibilityInfo.announceForAccessibility('Venue saved');
    } catch (err) {
      console.error('[venue] save failed', err);
      setSaveError('We couldn’t save your changes. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const header = <ScreenHeader title={venue?.name ?? 'Venue'} subtitle={venue ? placeLabel(venue) || undefined : undefined} right={<BackButton />} />;

  if (loading && !venue) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {header}
        <StateMessage kind="loading" />
      </SafeAreaView>
    );
  }
  if (error || !venue) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {header}
        <StateMessage
          kind={error ? 'error' : 'empty'}
          title={error ? 'Static on the line' : 'Venue not found'}
          message={error ?? 'It may have been removed on the website.'}
          actionLabel={error ? 'Try again' : undefined}
          onAction={error ? refresh : undefined}
        />
      </SafeAreaView>
    );
  }

  const addressLine = [venue.address, placeLabel(venue), venue.zip].filter(Boolean).join(', ');
  const directionsQuery = addressLine ? `${venue.name}, ${addressLine}` : venue.name;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            form ? undefined : <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} colors={[colors.orange]} />
          }>
          {header}
          <RetroStripes height={4} gap={2} style={styles.stripes} />

          <View style={styles.actions}>
            {venue.phone ? <Action icon="call" label="Call" hint={`Calls ${venue.phone}`} onPress={() => void openSafely(telUrl(venue.phone!))} /> : null}
            {venue.email ? <Action icon="mail" label="Email" hint={`Emails ${venue.email}`} onPress={() => void openSafely(`mailto:${venue.email}`)} /> : null}
            <Action
              icon="navigate"
              label="Directions"
              hint="Opens your maps app"
              onPress={() => void openSafely(venue.googleMapsUrl ?? mapsUrl(directionsQuery))}
            />
            {venue.website ? <Action icon="globe" label="Website" hint="Opens the venue's website" onPress={() => void openSafely(webUrl(venue.website!))} /> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>VENUE CONTACT</Text>
            {form ? (
              <>
                <Input id="venue-contact" label="Contact name" value={form.contactName} onChangeText={(v) => setForm({ ...form, contactName: v })} placeholder="Talent buyer or booking manager" />
                <Input id="venue-email" label="Booking email" value={form.email} onChangeText={(v) => setForm({ ...form, email: v })} keyboardType="email-address" invalid={emailInvalid} />
                <Input id="venue-phone" label="Phone" value={form.phone} onChangeText={(v) => setForm({ ...form, phone: v })} keyboardType="phone-pad" />
              </>
            ) : (
              <>
                <Field label="Contact name" value={venue.contactName} />
                <Field label="Booking email" value={venue.email} />
                <Field label="Phone" value={venue.phone} />
                {!venue.contactName && !venue.email && !venue.phone ? (
                  <Text style={styles.empty}>No contact yet. Tap Edit to add one.</Text>
                ) : null}
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>NOTES</Text>
            {form ? (
              <Input id="venue-notes" label="Notes" value={form.notes} onChangeText={(v) => setForm({ ...form, notes: v })} multiline placeholder="Anything worth remembering about this venue…" />
            ) : venue.notes ? (
              <Text style={styles.notes}>{venue.notes}</Text>
            ) : (
              <Text style={styles.empty}>No notes yet.</Text>
            )}
          </View>

          {saveError ? (
            <Text style={styles.error} accessibilityRole="alert">{saveError}</Text>
          ) : null}

          <View style={styles.buttons}>
            {form ? (
              <>
                <RetroButton label="Save" onPress={() => void save()} busy={saving} />
                <RetroButton label="Cancel" variant="outline" disabled={saving} onPress={() => { setForm(null); setSaveError(''); }} />
              </>
            ) : (
              <RetroButton label="Edit contact & notes" variant="outline" onPress={startEdit} />
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>ABOUT THE ROOM</Text>
            <Field label="Address" value={addressLine || null} />
            <Field label="Type" value={venue.venueType ? venue.venueType.replace(/_/g, ' ') : null} />
            <Field label="Capacity" value={venue.capacity ? venue.capacity.toLocaleString() : null} />
            <Field label="Backline" value={venue.backlineNotes} />
            <Field label="Pay" value={venue.payNotes} />
            <Text style={styles.hint}>Edit the rest of the venue on camelranchbooking.com.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: READABLE_MAX_WIDTH, alignSelf: 'center', backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { paddingBottom: space['4xl'] },
  stripes: { marginBottom: space.lg },
  iconBtn: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.xl, marginBottom: space.lg },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.orange,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: touchTarget,
  },
  actionText: { ...type.md, color: colors.onInteractive },
  card: { marginHorizontal: space.xl, marginBottom: space.lg, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  // Mustard, not orange: orange is 4.18:1 on the card surface (below AA 4.5:1); mustard is 6.95:1.
  cardTitle: { ...type.label, color: colors.mustard },
  field: { gap: 2 },
  fieldLabel: { ...type.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  fieldValue: { ...type.base, color: colors.cream },
  notes: { ...type.base, color: colors.cream },
  empty: { ...type.sm, color: colors.textMuted, fontStyle: 'italic' },
  hint: { ...type.sm, color: colors.textMuted },
  input: {
    backgroundColor: colors.background,
    color: colors.cream,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontFamily: fonts.body,
    fontSize: 16,
    minHeight: touchTarget,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  inputInvalid: { borderColor: colors.danger },
  error: { ...type.md, color: colors.danger, paddingHorizontal: space.xl, marginBottom: space.md },
  buttons: { paddingHorizontal: space.xl, marginBottom: space.lg, gap: space.sm },
});
