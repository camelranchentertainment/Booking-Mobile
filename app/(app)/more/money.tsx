// app/(app)/more/money.tsx
// Band admins: the band's money for one calendar year — earned, upcoming,
// expenses (incl. band pay) and net — plus played-but-unpaid shows and every
// show's fee. Same rules as the website's Financials page (lib/adminMoney.ts).
// Played-but-unpaid shows can be marked paid here, and expenses can be added,
// edited and archived (through the website's /api/expenses, lib/adminExpenses.ts).
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../../../components/BackButton';
import { ExpenseModal } from '../../../components/ExpenseModal';
import { MarkPaidModal } from '../../../components/MarkPaidModal';
import { RetroStripes, ScreenHeader, StateMessage } from '../../../components/retro';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { categoryLabel, fetchTourOptions, isEditableInApp, type Expense } from '../../../lib/adminExpenses';
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

function ShowRow({ show, onPress, onMarkPaid }: { show: MoneyShow; onPress: () => void; onMarkPaid?: () => void }) {
  const amount = show.state === 'paid' ? show.received : show.fee;
  const row = (
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
  if (!onMarkPaid) return row;
  return (
    <View style={styles.owedWrap}>
      {row}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mark ${show.venue} paid`}
        onPress={onMarkPaid}
        style={({ pressed }) => [styles.markPaid, pressed && styles.pressed]}>
        <Ionicons name="checkmark-circle-outline" size={20} color={colors.onInteractive} />
        <Text style={styles.markPaidText}>Mark paid</Text>
      </Pressable>
    </View>
  );
}

function ExpenseRow({ expense, onPress }: { expense: Expense; onPress?: () => void }) {
  const amount = Number(expense.amount) || 0;
  const label = categoryLabel(expense.category);
  const content = (
    <>
      <View style={styles.flex}>
        <Text style={styles.rowDate}>{formatCardDate(expense.expense_date)}</Text>
        <Text style={styles.rowVenue} numberOfLines={1}>{label}</Text>
        {expense.notes ? <Text style={styles.rowMeta} numberOfLines={1}>{expense.notes}</Text> : null}
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>{formatMoney(amount)}</Text>
        <Text style={styles.rowState}>{onPress ? 'Edit' : 'On the website'}</Text>
      </View>
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={`${formatCardDate(expense.expense_date)}, ${label}, ${formatMoney(amount)}. Band pay is edited on the show's lineup on the website.`}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatCardDate(expense.expense_date)}, ${label}, ${formatMoney(amount)}`}
      accessibilityHint="Edit or archive this expense"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {content}
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
  const [paying, setPaying] = useState<MoneyShow | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | 'new' | null>(null);
  const tours = useAsyncData('admin-tour-options', fetchTourOptions, "We couldn't load your tours.");

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
                <Text style={styles.note}>Played but not marked paid. Tap Mark paid once the money’s in.</Text>
                <View style={styles.list}>
                  {data.unpaid.map((s) => (
                    <ShowRow key={s.id} show={s} onPress={() => openShow(s)} onMarkPaid={() => setPaying(s)} />
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.sectionRow}>
              <Text style={[styles.section, styles.sectionInRow]}>EXPENSES IN {year} ({data.expenseList.length})</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add an expense"
                onPress={() => setEditingExpense('new')}
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
                <Ionicons name="add" size={20} color={colors.onInteractive} />
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
            <View style={styles.list}>
              {data.expenseList.length === 0 ? (
                <Text style={styles.note}>No expenses in {year} yet. Tap Add to record gas, a hotel, food or gear.</Text>
              ) : (
                data.expenseList.map((e) => (
                  <ExpenseRow key={e.id} expense={e} onPress={isEditableInApp(e) ? () => setEditingExpense(e) : undefined} />
                ))
              )}
            </View>

            <Text style={styles.section}>SHOWS IN {year}</Text>
            <View style={styles.list}>
              {data.shows.length === 0 ? (
                <Text style={styles.note}>No confirmed or played shows in {year}.</Text>
              ) : (
                data.shows.map((s) => <ShowRow key={s.id} show={s} onPress={() => openShow(s)} />)
              )}
            </View>

            <Text style={styles.footnote}>
              Same numbers as Financials on camelranchbooking.com. Band pay is set on each show’s lineup there.
            </Text>
          </>
        ) : null}
      </ScrollView>
      <ExpenseModal
        expense={editingExpense}
        tours={tours.data ?? []}
        onClose={() => setEditingExpense(null)}
        onSaved={() => {
          setEditingExpense(null);
          void refresh();
        }}
      />
      <MarkPaidModal
        show={paying}
        onClose={() => setPaying(null)}
        onSaved={() => {
          setPaying(null);
          void refresh();
        }}
      />
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
  sectionRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingRight: space.xl, marginTop: space['2xl'], marginBottom: space.sm },
  sectionInRow: { marginTop: 0, marginBottom: 0, flexShrink: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 40, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: colors.orange },
  addBtnText: { ...type.md, color: colors.onInteractive },
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
  owedWrap: { gap: space.xs },
  markPaid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.orange,
  },
  markPaidText: { ...type.md, color: colors.onInteractive },
  footnote: { ...type.sm, color: colors.textSubtle, textAlign: 'center', paddingHorizontal: space.xl, marginTop: space['2xl'] },
});
