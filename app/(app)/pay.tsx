import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountButton } from '../../components/AccountButton';
import { RetroStripes, ScreenHeader, StateMessage } from '../../components/retro';
import { useAsyncData } from '../../hooks/useAsyncData';
import { formatCardDate, parseLocalDate, toISODate } from '../../lib/dates';
import { fetchMemberShows, type MemberShow } from '../../lib/memberShows';
import { formatMoney } from '../../lib/money';
import { colors, radius, space, touchTarget, type } from '../../lib/theme';

/** Sum of known pay; shows with no rate on file count as $0 and are flagged separately. */
function total(shows: MemberShow[]): number {
  return shows.reduce((sum, s) => sum + (s.pay?.amount ?? 0), 0);
}

/**
 * The signed-in person's own pay: what's coming up and what they've earned
 * in a chosen calendar year (money is always scoped to one year, never
 * all-time). Data comes from the website's member API, so it shows exactly
 * what the band admin set — never anyone else's pay, never the band's fee.
 */
export default function PayScreen() {
  const router = useRouter();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);

  const { data, error, loading, refreshing, refresh } = useAsyncData(
    'member-pay',
    fetchMemberShows,
    "We couldn't load your pay. Check your connection and try again."
  );

  const header = (
    <>
      <ScreenHeader title="Pay" subtitle="Your pay per show" right={<AccountButton />} />
      <RetroStripes height={4} gap={2} style={styles.stripes} />
    </>
  );

  if (loading || error || !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {header}
        {loading && <StateMessage kind="loading" />}
        {error && <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} />}
      </SafeAreaView>
    );
  }

  const today = toISODate(new Date());
  const playing = data.filter((s) => s.rsvp !== 'declined');
  const upcoming = playing.filter((s) => (s.booking.showDate ?? '') >= today);
  const played = playing
    .filter((s) => {
      const d = s.booking.showDate ?? '';
      return d < today && parseLocalDate(d)?.getFullYear() === year;
    })
    .reverse(); // most recent first
  const years = new Set(playing.map((s) => parseLocalDate(s.booking.showDate)?.getFullYear()).filter(Boolean));
  const minYear = Math.min(thisYear, ...([...years] as number[]));

  if (data.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        {header}
        <StateMessage
          kind="empty"
          title="No pay yet"
          message="Pay shows up here for shows you're on the roster for. Once your band admin adds you to a show, you'll see it here."
          actionLabel="Refresh"
          onAction={refresh}
        />
      </SafeAreaView>
    );
  }

  const openShow = (s: MemberShow) => router.push({ pathname: '/daysheet', params: { show: s.booking.id } });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} colors={[colors.orange]} />}>
        {header}

        <View style={styles.summaryRow}>
          <View style={[styles.summary, styles.summaryHot]}>
            <Text style={styles.summaryLabelHot}>COMING UP</Text>
            <Text style={styles.summaryAmountHot}>{formatMoney(total(upcoming))}</Text>
            <Text style={styles.summaryNoteHot}>
              {upcoming.length} {upcoming.length === 1 ? 'show' : 'shows'}
            </Text>
          </View>
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>EARNED IN {year}</Text>
            <Text style={styles.summaryAmount}>{formatMoney(total(played))}</Text>
            <Text style={styles.summaryNote}>
              {played.length} {played.length === 1 ? 'show' : 'shows'} played
            </Text>
          </View>
        </View>

        <Section title="UPCOMING">
          {upcoming.length === 0 ? (
            <Text style={styles.muted}>No upcoming shows.</Text>
          ) : (
            upcoming.map((s) => <PayRow key={s.assignmentId} show={s} onPress={() => openShow(s)} />)
          )}
        </Section>

        <View style={styles.yearRow}>
          <Text style={styles.sectionTitle}>PLAYED</Text>
          <View style={styles.yearPicker}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous year"
              accessibilityState={{ disabled: year <= minYear }}
              disabled={year <= minYear}
              onPress={() => setYear((y) => y - 1)}
              style={[styles.yearBtn, year <= minYear && styles.disabled]}>
              <Ionicons name="chevron-back" size={20} color={colors.cream} />
            </Pressable>
            <Text style={styles.yearText} accessibilityLiveRegion="polite">
              {year}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next year"
              accessibilityState={{ disabled: year >= thisYear }}
              disabled={year >= thisYear}
              onPress={() => setYear((y) => y + 1)}
              style={[styles.yearBtn, year >= thisYear && styles.disabled]}>
              <Ionicons name="chevron-forward" size={20} color={colors.cream} />
            </Pressable>
          </View>
        </View>
        <View style={styles.list}>
          {played.length === 0 ? (
            <Text style={styles.muted}>No shows played in {year}.</Text>
          ) : (
            played.map((s) => <PayRow key={s.assignmentId} show={s} onPress={() => openShow(s)} />)
          )}
        </View>

        <Text style={styles.footnote}>
          “Set” means your band admin entered your pay for that show. “Estimate” is your usual rate until they do.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Text style={[styles.sectionTitle, styles.sectionPad]}>{title}</Text>
      <View style={styles.list}>{children}</View>
    </>
  );
}

function PayRow({ show, onPress }: { show: MemberShow; onPress: () => void }) {
  const venue = show.booking.venue?.name ?? 'Venue TBD';
  const date = formatCardDate(show.booking.showDate);
  const amount = show.pay ? formatMoney(show.pay.amount) : '—';
  const tag = !show.pay ? 'Not set' : show.pay.source === 'confirmed' ? 'Set' : 'Estimate';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${venue}, ${date}, ${show.pay ? `${amount}, ${tag}` : 'pay not set'}`}
      accessibilityHint="Opens the day sheet"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <Text style={styles.rowDate}>{date}</Text>
        <Text style={styles.rowVenue} numberOfLines={1}>
          {venue}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, !show.pay && styles.rowAmountMissing]}>{amount}</Text>
        <Text style={[styles.rowTag, show.pay?.source === 'confirmed' && styles.rowTagSet]}>{tag}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { paddingBottom: space['4xl'] },
  stripes: { marginBottom: space.lg },
  summaryRow: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.xl },
  summary: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: 2 },
  summaryHot: { backgroundColor: colors.orange },
  summaryLabel: { ...type.eyebrow, color: colors.mustard },
  summaryLabelHot: { ...type.eyebrow, color: colors.background },
  summaryAmount: { fontFamily: type.title.fontFamily, fontSize: 28, lineHeight: 38, color: colors.cream },
  summaryAmountHot: { fontFamily: type.title.fontFamily, fontSize: 28, lineHeight: 38, color: colors.cream },
  summaryNote: { ...type.sm, color: colors.textMuted },
  summaryNoteHot: { ...type.sm, color: colors.background, fontFamily: type.md.fontFamily },
  sectionTitle: { ...type.label, color: colors.orange },
  sectionPad: { paddingHorizontal: space.xl, marginTop: space['2xl'], marginBottom: space.sm },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space.xl,
    paddingRight: space.sm,
    marginTop: space.xl,
    marginBottom: space.xs,
  },
  yearPicker: { flexDirection: 'row', alignItems: 'center' },
  yearBtn: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  yearText: { ...type.lg, color: colors.cream, minWidth: 48, textAlign: 'center' },
  disabled: { opacity: 0.3 },
  list: { paddingHorizontal: space.xl, gap: space.sm },
  muted: { ...type.base, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: touchTarget + space.lg,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  rowDate: { ...type.label, fontSize: 15, color: colors.mustard },
  rowVenue: { ...type.lg, color: colors.cream },
  rowRight: { alignItems: 'flex-end' },
  rowAmount: { ...type.lg, fontSize: 19, color: colors.cream },
  rowAmountMissing: { color: colors.textSubtle },
  rowTag: { ...type.xs, color: colors.textMuted },
  rowTagSet: { color: colors.statusConfirmed },
  footnote: { ...type.sm, color: colors.textSubtle, paddingHorizontal: space.xl, marginTop: space.xl },
});
