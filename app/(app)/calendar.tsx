import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountButton } from '../../components/AccountButton';
import { DaySheetModal } from '../../components/DaySheetModal';
import { RetroStripes, ScreenHeader, StateMessage } from '../../components/retro';
import { ShowCard } from '../../components/ShowCard';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { bookingStatusColor } from '../../lib/bookingStatus';
import type { UpcomingBooking } from '../../lib/bookings';
import { toISODate } from '../../lib/dates';
import type { Rsvp } from '../../lib/memberShows';
import { fetchCalendarFeed, type ShowItem } from '../../lib/showFeed';
import { colors, radius, space, touchTarget, type } from '../../lib/theme';
import { READABLE_MAX_WIDTH } from '../../lib/layout';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MAX_BARS = 2;
const RSVP_BAR: Record<Rsvp, string> = {
  confirmed: colors.statusConfirmed,
  pending: colors.mustard,
  declined: colors.statusCancelled,
};

/** Bar color: a member sees their own answer; an admin sees the booking's pipeline status. */
const barColor = (it: ShowItem) => (it.member ? RSVP_BAR[it.member.rsvp] : bookingStatusColor(it.booking.status));

interface MonthCursor {
  year: number;
  month: number; // 0-11
}

function monthBounds({ year, month }: MonthCursor) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return { first, last, start: toISODate(first), end: toISODate(last) };
}

/** Month grid with a colored bar per show (status color), plus the list for the selected day or month. */
export default function CalendarScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const isMember = profile?.role === 'member';
  const canEdit = profile?.role === 'band_admin' || profile?.role === 'superadmin';

  const now = new Date();
  const todayISO = toISODate(now);
  const [cursor, setCursor] = useState<MonthCursor>({ year: now.getFullYear(), month: now.getMonth() });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [openShow, setOpenShow] = useState<UpcomingBooking | null>(null);
  const [edits, setEdits] = useState<Record<string, UpcomingBooking>>({});

  const { first, last, start, end } = monthBounds(cursor);
  const { data, error, loading, refreshing, refresh } = useAsyncData(
    `${isMember ? 'member' : 'admin'}:${start}..${end}`,
    () => fetchCalendarFeed(isMember, start, end),
    "We couldn't load this month. Check your connection and try again."
  );
  const bookings = data ? data.map((it) => ({ ...it, booking: edits[it.booking.id] ?? it.booking })) : null;

  const byDay = useMemo(() => {
    const map = new Map<string, ShowItem[]>();
    for (const it of bookings ?? []) {
      if (!it.booking.showDate) continue;
      const key = it.booking.showDate.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), it]);
    }
    return map;
  }, [bookings]);

  const shiftMonth = (delta: number) => {
    setSelectedDay(null);
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const monthLabel = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const leadingBlanks = first.getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: last.getDate() }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const listed = selectedDay ? (byDay.get(selectedDay) ?? []) : (bookings ?? []);
  const listTitle = selectedDay
    ? new Date(`${selectedDay}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()
    : `ALL SHOWS IN ${first.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()}`;

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
        <ScreenHeader title="Calendar" right={<AccountButton />} />
        <RetroStripes height={4} gap={2} style={styles.stripes} />

        <View style={styles.monthRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={() => shiftMonth(-1)}
            style={styles.arrow}
            hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.cream} />
          </Pressable>
          <Text style={styles.monthLabel} accessibilityRole="header">
            {monthLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={() => shiftMonth(1)}
            style={styles.arrow}
            hitSlop={8}>
            <Ionicons name="chevron-forward" size={24} color={colors.cream} />
          </Pressable>
        </View>

        <View style={styles.grid}>
          {WEEKDAYS.map((d, i) => (
            <Text key={`wd-${i}`} style={styles.weekday} aria-hidden>
              {d}
            </Text>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <View key={`blank-${i}`} style={styles.cellSlot} />;
            const iso = toISODate(new Date(cursor.year, cursor.month, day));
            const shows = byDay.get(iso) ?? [];
            const isToday = iso === todayISO;
            const isSelected = iso === selectedDay;
            return (
              <View key={iso} style={styles.cellSlot}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${monthLabel.split(' ')[0]} ${day}${isToday ? ', today' : ''}, ${
                    shows.length === 0 ? 'no shows' : `${shows.length} ${shows.length === 1 ? 'show' : 'shows'}`
                  }`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelectedDay(isSelected ? null : iso)}
                  style={({ pressed }) => [
                    styles.cell,
                    isToday && styles.cellToday,
                    isSelected && styles.cellSelected,
                    pressed && styles.cellPressed,
                  ]}>
                  <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>{day}</Text>
                  <View style={styles.bars}>
                    {shows.slice(0, MAX_BARS).map((s) => (
                      <View key={s.member?.assignmentId ?? s.booking.id} style={[styles.bar, { backgroundColor: barColor(s) }]} />
                    ))}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{listTitle}</Text>
          {selectedDay ? (
            <Pressable accessibilityRole="button" onPress={() => setSelectedDay(null)} hitSlop={10} style={styles.showAll}>
              <Text style={styles.showAllText}>Show whole month</Text>
            </Pressable>
          ) : null}
        </View>

        {loading && <StateMessage kind="loading" />}
        {error && <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} />}
        {bookings !== null && !error && listed.length === 0 && (
          <Text style={styles.emptyText}>
            {selectedDay ? 'Nothing booked this day.' : 'Nothing on the calendar this month yet.'}
          </Text>
        )}
        <View style={styles.list}>
          {listed.map((it) => (
            <ShowCard
              key={it.member?.assignmentId ?? it.booking.id}
              booking={it.booking}
              rsvp={it.member?.rsvp}
              onPress={() =>
                isMember
                  ? router.push({ pathname: '/daysheet', params: { show: it.booking.id } })
                  : setOpenShow(it.booking)
              }
            />
          ))}
        </View>
      </ScrollView>

      {!isMember && (
      <DaySheetModal
        booking={openShow}
        canEdit={canEdit}
        onClose={() => setOpenShow(null)}
        onUpdated={(updated) => {
          setOpenShow(updated);
          setEdits((prev) => ({ ...prev, [updated.id]: updated }));
        }}
      />
      )}
    </SafeAreaView>
  );
}

const CELL_GAP = 4;

const styles = StyleSheet.create({
  // Centered readable column on wide windows (iPad, iPhone Duo unfolded, Mac).
  container: { flex: 1, width: '100%', maxWidth: READABLE_MAX_WIDTH, alignSelf: 'center', backgroundColor: colors.background },
  scroll: { paddingBottom: space['4xl'] },
  stripes: { marginBottom: space.md },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  arrow: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  monthLabel: { ...type.lg, fontSize: 19, color: colors.cream },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.lg - CELL_GAP / 2 },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    ...type.xs,
    color: colors.textSubtle,
    paddingVertical: space.xs,
  },
  cellSlot: { width: `${100 / 7}%`, padding: CELL_GAP / 2 },
  cell: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingTop: 5,
    paddingBottom: 6,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellToday: { borderColor: colors.mustard },
  cellSelected: { backgroundColor: colors.orange },
  cellPressed: { opacity: 0.8 },
  dayNum: { ...type.xs, fontSize: 13, color: colors.cream },
  dayNumSelected: { color: colors.onInteractive },
  bars: { gap: 3 },
  bar: { height: 5, borderRadius: 3 },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  listTitle: { ...type.label, color: colors.orange, flexShrink: 1 },
  showAll: { minHeight: 32, justifyContent: 'center' },
  showAllText: { ...type.sm, color: colors.mustard, fontFamily: type.md.fontFamily },
  emptyText: { ...type.base, color: colors.textMuted, paddingHorizontal: space.xl },
  list: { paddingHorizontal: space.xl, gap: space.md },
});
