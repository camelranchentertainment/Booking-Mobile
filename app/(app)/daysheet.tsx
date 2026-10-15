import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DaySheetModal } from '../../components/DaySheetModal';
import { GroovyText, RetroButton, RetroStripes, ScreenHeader, StateMessage } from '../../components/retro';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchUpcomingConfirmed, type UpcomingBooking } from '../../lib/bookings';
import { addMinutes, daysFromToday, formatCardDate, formatTime } from '../../lib/dates';
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

/** Show-day view of the next confirmed show; arrows step through the following ones. */
export default function DaySheetScreen() {
  const { profile } = useAuth();
  const canEdit = profile?.role === 'band_admin' || profile?.role === 'superadmin';

  const { data, error, loading, refreshing, refresh } = useAsyncData(
    'upcoming-confirmed',
    fetchUpcomingConfirmed,
    "We couldn't load your day sheet. Check your connection and try again."
  );
  const [edits, setEdits] = useState<Record<string, UpcomingBooking>>({});
  const [rawIndex, setIndex] = useState(0);
  const [editing, setEditing] = useState<UpcomingBooking | null>(null);
  const shows = data ? data.map((b) => edits[b.id] ?? b) : null;
  // Clamp during render so a refresh that returns fewer shows can't leave us past the end.
  const index = shows ? Math.min(rawIndex, Math.max(0, shows.length - 1)) : 0;

  const show = shows?.[index] ?? null;

  const header = (
    <>
      <ScreenHeader title="Day Sheet" />
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
            title="No confirmed shows"
            message="When a show is confirmed, its load-in, doors and set times land here."
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

      <DaySheetModal
        booking={editing}
        canEdit={canEdit}
        onClose={() => setEditing(null)}
        onUpdated={(updated) => {
          setEditing(updated);
          setEdits((prev) => ({ ...prev, [updated.id]: updated }));
        }}
      />
    </SafeAreaView>
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
  editWrap: { paddingHorizontal: space.xl, marginTop: space['2xl'] },
});
