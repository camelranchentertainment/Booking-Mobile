// app/(app)/more/money.tsx
// Band admins: the band's money for one calendar year — earned, upcoming,
// expenses (incl. band pay) and net — plus played-but-unpaid shows and every
// show's fee. Same rules as the website's Financials page (lib/adminMoney.ts).
// View-only: expenses and payments are entered on the website.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../../../components/BackButton';
import { RetroStripes, ScreenHeader, StateMessage } from '../../../components/retro';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchYearMoney, type MoneyShow } from '../../../lib/adminMoney';
import { formatCardDate } from '../../../lib/dates';
import { READABLE_MAX_WIDTH } from '../../../lib/layout';
import { formatMoney } from '../../../lib/money';
import { colors, radius, space, touchTarget, type } from '../../../lib/theme';

const STATE_LABEL: Record<MoneyShow['state'], string> = {
  paid: 'Paid',
  unpaid: 'Not paid yet',
  upcoming: 'Upcoming',
  other: 'Booked',
};

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${formatMoney(value)}${sub ? `. ${sub}` : ''}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{formatMoney(value)}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function ShowRow({ show, onPress }: { show: MoneyShow; onPress: () => void }) {
  const amount = show.state === 'paid' ? show.received : show.fee;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatCardDate(show.date)}, ${show.venue}. ${STATE_LABEL[show.state]}. ${amount !== null ? formatMoney(amount) : 'No fee set'}`}
      accessibilityHint="Opens the day sheet"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <Text style={styles.rowDate}>{formatCardDate(show.date)}</Text>
        <Text style={styles.rowVenue} numberOfLines={1}>{show.venue}</Text>
        {show.place ? <Text style={styles.rowMeta} numberOfLines={1}>{show.place}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>{amount !== null ? formatMoney(amount) : '—'}</Text>
        <Text style={[styles.rowState, show.state === 'unpaid' && styles.owed]}>{STATE_LABEL[show.state]}</Text>
      </View>
    </Pressable>
  );
}

export default function MoneyScreen() {
  const router = useRouter();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);

  const { data, error, loading, refreshing, refresh } = useAsyncData(
    `admin-money:${year}`,
    () => fetchYearMoney(year),
    "We couldn't load the band's money. Check your connection and try again."
  );

  const openShow = (s: MoneyShow) => router.push({ pathname: '/daysheet', params: { show: s.id } });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} colors={[colors.orange]} />}>
        <ScreenHeader title="Money" subtitle="The band's year at a glance" right={<BackButton fallback={'/more'} />} />
        <RetroStripes height={4} gap={2} style={styles.stripes} />

        <View style={styles.yearPicker}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous year"
            onPress={() => setYear((y) => y - 1)}
            style={({ pressed }) => [styles.yearBtn, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={22} color={colors.cream} />
          </Pressable>
          <Text style={styles.yearText} accessibilityLiveRegion="polite" accessibilityLabel={`Year ${year}`}>{year}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next year"
            accessibilityState={{ disabled: year >= thisYear + 1 }}
            disabled={year >= thisYear + 1}
            onPress={() => setYear((y) => y + 1)}
            style={({ pressed }) => [styles.yearBtn, year >= thisYear + 1 && styles.disabled, pressed && styles.pressed]}>
            <Ionicons name="chevron-forward" size={22} color={colors.cream} />
          </Pressable>
        </View>

        {loading && !data ? <StateMessage kind="loading" /> : null}
        {error ? <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} /> : null}

        {data && !error ? (
          <>
            <View style={styles.stats}>
              <Stat label="EARNED" value={data.earned} sub="Played and paid" />
              <Stat label="UPCOMING" value={data.upcoming} sub="Confirmed shows ahead" />
              <Stat label="EXPENSES" value={data.expenses} sub={data.bandPay > 0 ? `Incl. ${formatMoney(data.bandPay)} band pay` : undefined} />
              <Stat label="NET" value={data.net} sub="Earned minus expenses" />
            </View>

            {data.unpaid.length > 0 ? (
              <>
                <Text style={styles.section}>STILL OWED ({data.unpaid.length})</Text>
                <Text style={styles.note}>Played but not marked paid. Mark them paid on the website once the money’s in.</Text>
                <View style={styles.list}>
                  {data.unpaid.map((s) => <ShowRow key={s.id} show={s} onPress={() => openShow(s)} />)}
                </View>
              </>
            ) : null}

            <Text style={styles.section}>SHOWS IN {year}</Text>
            <View style={styles.list}>
              {data.shows.length === 0 ? (
                <Text style={styles.note}>No confirmed or played shows in {year}.</Text>
              ) : (
                data.shows.map((s) => <ShowRow key={s.id} show={s} onPress={() => openShow(s)} />)
              )}
            </View>

            <Text style={styles.footnote}>
              Same numbers as Financials on camelranchbooking.com. Add expenses and mark shows paid there.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: READABLE_MAX_WIDTH, alignSelf: 'center', backgroundColor: colors.background },
  scroll: { paddingBottom: space['4xl'] },
  stripes: { marginBottom: space.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.35 },
  yearPicker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg, marginBottom: space.lg },
  yearBtn: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearText: { ...type.title, color: colors.cream, minWidth: 90, textAlign: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.xl },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: 2 },
  statLabel: { ...type.label, color: colors.mustard },
  statValue: { ...type.heading, color: colors.cream },
  statSub: { ...type.sm, color: colors.textMuted },
  // Attention text on cards uses mustard (6.95:1); the danger red is only 4.11:1 on the card surface.
  owed: { color: colors.mustard, fontFamily: type.md.fontFamily },
  section: { ...type.label, color: colors.orange, paddingHorizontal: space.xl, marginTop: space['2xl'], marginBottom: space.sm },
  note: { ...type.sm, color: colors.textMuted, paddingHorizontal: space.xl, marginBottom: space.sm },
  list: { paddingHorizontal: space.xl, gap: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    minHeight: touchTarget + 16,
  },
  rowDate: { ...type.label, color: colors.mustard },
  rowVenue: { ...type.lg, color: colors.cream },
  rowMeta: { ...type.sm, color: colors.textMuted },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowAmount: { ...type.lg, color: colors.cream },
  rowState: { ...type.sm, color: colors.textMuted },
  footnote: { ...type.sm, color: colors.textSubtle, textAlign: 'center', paddingHorizontal: space.xl, marginTop: space['2xl'] },
});
