import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { AccessibilityInfo, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountButton } from '../../components/AccountButton';
import { DaySheetModal } from '../../components/DaySheetModal';
import { GroovyText, RetroButton, RetroStripes, RsvpPill, ScreenHeader, StateMessage } from '../../components/retro';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import type { UpcomingBooking } from '../../lib/bookings';
import { addMinutes, daysFromToday, formatCardDate, formatTime } from '../../lib/dates';
import { respondToShow, type Rsvp } from '../../lib/memberShows';
import { formatMoney } from '../../lib/money';
import { fetchDaySheetFeed } from '../../lib/showFeed';
import { colors, radius, space, touchTarget, type } from '../../lib/theme';

interface TimelineItem {
  time: string;
  label: string;
  highlight?: boolean;
}

/** Builds the show-day run of show from whatever times are filled in, in order. */
function buildTimeline(b: UpcomingBooking): TimelineItem[] {
  const setEnd = b.setTime && b.setLengthMin ? addMinutes(b.setTime, b.setLengthMin) : null;
  const rows: (TimelineItem | null)[] = [
    b.loadInTime ? { time: b.loadInTime, label: 'Load in' } : null,
    b.soundcheckTime ? { time: b.soundcheckTime, label: 'Soundcheck' } : null,
    b.doorTime ? { time: b.doorTime, label: 'Doors' } : null,
    b.setTime
      ? { time: b.setTime, label: b.setLengthMin ? `Our set · ${b.setLengthMin} min` : 'Our set', highlight: true }
      : null,
    b.endTime ? { time: b.endTime, label: 'Load out & settle' } : setEnd ? { time: setEnd, label: 'Set ends' } : null,
  ];
  return rows.filter((r): r is TimelineItem => r !== null);
}

function countdownLabel(dateStr: string | null): string | null {
  const days = daysFromToday(dateStr);
  if (days === null || days < 0) return null;
  if (days === 0) return 'TONIGHT';
  if (days === 1) return 'TOMORROW';
  return `IN ${days} DAYS`;
}

async function openSafely(url: string) {
  try {
    await Linking.openURL(url);
  } catch (err) {
    console.warn('[daysheet] could not open', url, err);
  }
}

function mapsUrl(query: string): string {
  const q = encodeURIComponent(query);
  return Platform.OS === 'ios' ? `maps:?q=${q}` : Platform.OS === 'android' ? `geo:0,0?q=${q}` : `https://maps.google.com/?q=${q}`;
}

/**
 * Show-day view of the next upcoming show; arrows step through the following
 * ones. Opening it from a show card (`?show=<bookingId>`) jumps to that show.
 * Members also answer whether they can make it and see their pay here.
 */
export default function DaySheetScreen() {
  const { profile } = useAuth();
  const isMember = profile?.role === 'member';
  const canEdit = profile?.role === 'band_admin' || profile?.role === 'superadmin';
  const { show: showParam } = useLocalSearchParams<{ show?: string }>();

  const { data, error, loading, refreshing, refresh } = useAsyncData(
    `daysheet:${isMember ? 'member' : 'admin'}`,
    () => fetchDaySheetFeed(isMember),
    "We couldn't load your day sheet. Check your connection and try again."
  );
  const [edits, setEdits] = useState<Record<string, UpcomingBooking>>({});
  const [rsvpOverrides, setRsvpOverrides] = useState<Record<string, Rsvp>>({});
  const [rsvpBusy, setRsvpBusy] = useState<Rsvp | null>(null);
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [rawIndex, setIndex] = useState(0);
  const [editing, setEditing] = useState<UpcomingBooking | null>(null);
  const items = data ? data.map((it) => ({ ...it, booking: edits[it.booking.id] ?? it.booking })) : null;
  const shows = items ? items.map((it) => it.booking) : null;

  // Jump to the show that was tapped elsewhere — once per distinct param,
  // adjusted during render (no effect, no extra frame on the wrong show).
  const [appliedParam, setAppliedParam] = useState<string | undefined>(undefined);
  if (items && showParam && showParam !== appliedParam) {
    setAppliedParam(showParam);
    const found = items.findIndex((it) => it.booking.id === showParam);
    if (found >= 0) setIndex(found);
  }

  // Clamp during render so a refresh that returns fewer shows can't leave us past the end.
  const index = shows ? Math.min(rawIndex, Math.max(0, shows.length - 1)) : 0;

  const show = shows?.[index] ?? null;
  const member = items?.[index]?.member ?? null;
  const rsvp: Rsvp | null = member ? (rsvpOverrides[member.assignmentId] ?? member.rsvp) : null;

  const answer = async (next: 'confirmed' | 'declined') => {
    if (!member || rsvpBusy) return;
    setRsvpBusy(next);
    setRsvpError(null);
    try {
      await respondToShow(member.assignmentId, next);
      setRsvpOverrides((prev) => ({ ...prev, [member.assignmentId]: next }));
      AccessibilityInfo.announceForAccessibility(next === 'confirmed' ? "You're in for this show." : "Marked as can't make it.");
    } catch (err) {
      console.error('[daysheet] rsvp failed', err);
      setRsvpError("Your answer didn't save. Check your connection and try again.");
    } finally {
      setRsvpBusy(null);
    }
  };

  const header = (
    <>
      <ScreenHeader title="Day Sheet" right={<AccountButton />} />
      <RetroStripes height={4} gap={2} style={styles.stripes} />
    </>
  );

  if (shows === null || error || !show) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {header}
        {loading && <StateMessage kind="loading" />}
        {error && <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} />}
        {shows !== null && !error && !show && (
          <StateMessage
            kind="empty"
            title={isMember ? 'Nothing coming up' : 'No confirmed shows'}
            message={
              isMember
                ? "When you're on an upcoming show, its load-in, doors and set times land here."
                : 'When a show is confirmed, its load-in, doors and set times land here.'
            }
            actionLabel="Refresh"
            onAction={refresh}
          />
        )}
      </SafeAreaView>
    );
  }

  const timeline = buildTimeline(show);
  const place = [show.venue?.city, show.venue?.state].filter(Boolean).join(', ');
  const countdown = countdownLabel(show.showDate);
  const contactName = show.venueContactName ?? show.venue?.bookingContact ?? null;
  const phone = show.venue?.phone ?? null;
  const address = show.venue?.address ?? null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.orange}
            colors={[colors.orange]}
          />
        }>
        {header}

        <View style={styles.pager}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous show"
            accessibilityState={{ disabled: index === 0 }}
            disabled={index === 0}
            onPress={() => setIndex(Math.max(0, index - 1))}
            style={[styles.pagerBtn, index === 0 && styles.pagerBtnDisabled]}>
            <Ionicons name="chevron-back" size={22} color={colors.cream} />
          </Pressable>
          <Text style={styles.pagerText}>
            SHOW {index + 1} OF {shows.length}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next show"
            accessibilityState={{ disabled: index >= shows.length - 1 }}
            disabled={index >= shows.length - 1}
            onPress={() => setIndex(Math.min(shows.length - 1, index + 1))}
            style={[styles.pagerBtn, index >= shows.length - 1 && styles.pagerBtnDisabled]}>
            <Ionicons name="chevron-forward" size={22} color={colors.cream} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.heroDate}>{formatCardDate(show.showDate)}</Text>
            {countdown ? (
              <View style={styles.countdown}>
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            ) : null}
          </View>
          <GroovyText size={30} variant="onOrange" step={2}>
            {show.venue?.name ?? 'Venue TBD'}
          </GroovyText>
          {place ? <Text style={styles.heroPlace}>{place}</Text> : null}
        </View>

        {member && rsvp && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitleInline}>CAN YOU MAKE IT?</Text>
              <RsvpPill rsvp={rsvp} />
            </View>
            <View style={styles.rsvpRow}>
              <View style={styles.flex}>
                <RetroButton
                  label={rsvp === 'confirmed' ? "I'm in ✓" : "I'm in"}
                  onPress={() => answer('confirmed')}
                  selected={rsvp === 'confirmed'}
                  disabled={rsvpBusy !== null}
                  busy={rsvpBusy === 'confirmed'}
                />
              </View>
              <View style={styles.flex}>
                <RetroButton
                  label="Can't make it"
                  variant="outline"
                  onPress={() => answer('declined')}
                  disabled={rsvp === 'declined' || rsvpBusy !== null}
                  busy={rsvpBusy === 'declined'}
                />
              </View>
            </View>
            {rsvpError ? (
              <Text style={styles.error} accessibilityRole="alert">
                {rsvpError}
              </Text>
            ) : null}

            <Text style={styles.sectionTitle}>YOUR PAY</Text>
            <View style={[styles.card, styles.payCard]}>
              {member.pay ? (
                <>
                  <Text style={styles.payAmount}>{formatMoney(member.pay.amount)}</Text>
                  <Text style={styles.cardLabel}>
                    {member.pay.source === 'confirmed'
                      ? 'Set by your band admin for this show'
                      : 'Estimated from your usual rate'}
                  </Text>
                </>
              ) : (
                <Text style={styles.cardLabel}>No pay set for this show yet. Ask your band admin.</Text>
              )}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>RUN OF SHOW</Text>
        {timeline.length === 0 ? (
          <Text style={styles.muted}>Times haven&apos;t been set for this show yet.</Text>
        ) : (
          <View style={styles.timeline}>
            {timeline.map((item, i) => (
              <View key={`${item.label}-${i}`} style={styles.tlRow}>
                <View style={styles.tlRail}>
                  <View style={[styles.tlDot, item.highlight && styles.tlDotHot]} />
                  {i < timeline.length - 1 ? <View style={styles.tlLine} /> : null}
                </View>
                <Text style={[styles.tlTime, item.highlight && styles.tlTimeHot]}>{formatTime(item.time)}</Text>
                <Text style={styles.tlLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        {(contactName || phone || address) && (
          <>
            <Text style={styles.sectionTitle}>VENUE</Text>
            <View style={styles.card}>
              {contactName ? (
                <View style={styles.cardRow}>
                  <Ionicons name="person-circle-outline" size={22} color={colors.mustard} />
                  <View style={styles.flex}>
                    <Text style={styles.cardLabel}>Talent buyer</Text>
                    <Text style={styles.cardValue}>{contactName}</Text>
                  </View>
                </View>
              ) : null}
              {phone ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Call ${contactName ?? 'the venue'} at ${phone}`}
                  onPress={() => openSafely(`tel:${phone.replace(/[^\d+]/g, '')}`)}
                  style={({ pressed }) => [styles.cardRow, styles.tappable, pressed && styles.pressed]}>
                  <Ionicons name="call-outline" size={22} color={colors.orange} />
                  <View style={styles.flex}>
                    <Text style={styles.cardLabel}>Tap to call</Text>
                    <Text style={styles.cardValue}>{phone}</Text>
                  </View>
                </Pressable>
              ) : null}
              {address ? (
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={`Open directions to ${address}`}
                  onPress={() => openSafely(mapsUrl([show.venue?.name, address, place].filter(Boolean).join(', ')))}
                  style={({ pressed }) => [styles.cardRow, styles.tappable, pressed && styles.pressed]}>
                  <Ionicons name="navigate-outline" size={22} color={colors.orange} />
                  <View style={styles.flex}>
                    <Text style={styles.cardLabel}>Directions</Text>
                    <Text style={styles.cardValue}>{address}</Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          </>
        )}

        {(show.mealsProvided || show.drinksProvided || show.hotelBooked || show.lodgingDetails) && (
          <>
            <Text style={styles.sectionTitle}>HOSPITALITY</Text>
            <View style={styles.chips}>
              {show.mealsProvided ? <Chip icon="restaurant-outline" label="Meals provided" /> : null}
              {show.drinksProvided ? <Chip icon="beer-outline" label="Drinks provided" /> : null}
              {show.hotelBooked ? <Chip icon="bed-outline" label="Hotel booked" /> : null}
            </View>
            {show.lodgingDetails ? <Text style={[styles.note, styles.lodging]}>{show.lodgingDetails}</Text> : null}
          </>
        )}

        {(show.soundSystem || show.specialRequirements) && (
          <>
            <Text style={styles.sectionTitle}>PRODUCTION</Text>
            <View style={styles.card}>
              {show.soundSystem ? <Text style={styles.note}>Sound: {show.soundSystem}</Text> : null}
              {show.specialRequirements ? <Text style={styles.note}>{show.specialRequirements}</Text> : null}
            </View>
          </>
        )}

        {canEdit && (
          <View style={styles.editWrap}>
            <RetroButton label="Edit show details" variant="outline" onPress={() => setEditing(show)} />
          </View>
        )}
      </ScrollView>

      {canEdit && (
        <DaySheetModal
          booking={editing}
          canEdit={canEdit}
          onClose={() => setEditing(null)}
          onUpdated={(updated) => {
            setEditing(updated);
            setEdits((prev) => ({ ...prev, [updated.id]: updated }));
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Chip({ icon, label }: { icon: ComponentProps<typeof Ionicons>['name']; label: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={16} color={colors.mustard} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { paddingBottom: space['4xl'] },
  stripes: { marginBottom: space.md },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
  },
  pagerBtn: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  pagerBtnDisabled: { opacity: 0.3 },
  pagerText: { ...type.eyebrow, color: colors.textMuted },
  hero: {
    marginHorizontal: space.xl,
    marginTop: space.xs,
    backgroundColor: colors.orange,
    borderRadius: radius.xl,
    padding: space.xl,
    gap: space.xs,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroDate: { ...type.label, color: colors.background },
  countdown: { backgroundColor: colors.background, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 3 },
  countdownText: { ...type.eyebrow, fontSize: 14, color: colors.mustard },
  heroPlace: { ...type.md, color: colors.background },
  sectionTitle: {
    ...type.label,
    color: colors.orange,
    paddingHorizontal: space.xl,
    marginTop: space['2xl'],
    marginBottom: space.sm,
  },
  muted: { ...type.base, color: colors.textMuted, paddingHorizontal: space.xl },
  timeline: { paddingHorizontal: space.xl },
  tlRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 54 },
  tlRail: { width: 24, alignItems: 'center', alignSelf: 'stretch' },
  tlDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.mustard, marginTop: 5 },
  tlDotHot: { backgroundColor: colors.orange, width: 18, height: 18, borderRadius: 9, marginTop: 3 },
  tlLine: { flex: 1, width: 3, backgroundColor: colors.border, marginVertical: 4, borderRadius: 2 },
  tlTime: { ...type.time, color: colors.mustard, width: 104, marginLeft: space.md },
  tlTimeHot: { color: colors.orange },
  tlLabel: { ...type.md, fontSize: 16, color: colors.cream, flex: 1, marginTop: 2 },
  card: {
    marginHorizontal: space.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: space.xs,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: touchTarget,
  },
  tappable: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.surfaceRaised },
  cardLabel: { ...type.sm, color: colors.textMuted },
  cardValue: { ...type.md, color: colors.cream },
  note: { ...type.base, color: colors.cream, paddingHorizontal: space.lg, paddingVertical: space.sm },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    marginTop: space['2xl'],
    marginBottom: space.sm,
  },
  sectionTitleInline: { ...type.label, color: colors.orange },
  rsvpRow: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.xl },
  error: { ...type.md, color: colors.danger, paddingHorizontal: space.xl, marginTop: space.sm },
  payCard: { paddingHorizontal: space.lg, paddingVertical: space.lg, gap: space.xs },
  payAmount: { fontFamily: type.title.fontFamily, fontSize: 34, lineHeight: 44, color: colors.mustard },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.xl },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  chipText: { ...type.md, fontSize: 14, color: colors.cream },
  lodging: { paddingHorizontal: space.xl, marginTop: space.sm },
  editWrap: { paddingHorizontal: space.xl, marginTop: space['2xl'] },
});
