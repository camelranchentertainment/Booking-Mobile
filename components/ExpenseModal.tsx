// components/ExpenseModal.tsx
// Band admins add or edit an expense from the phone (More → Money), and can
// archive one. Same fields and rules as the website's Financials page: every
// expense belongs to a tour, has a date, a category and an amount above $0.
// Archiving takes it off the totals but keeps it on record.
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { archiveExpense, categoryLabel, EXPENSE_CATEGORIES, isISODate, saveExpense, type Expense, type TourOption } from '../lib/adminExpenses';
import { toISODate } from '../lib/dates';
import { colors, radius, space, touchTarget, type } from '../lib/theme';
import { parseAmount } from './MarkPaidModal';
import { RetroButton } from './retro';

interface Props {
  /** The expense to edit, `'new'` to add one, or null when closed. */
  expense: Expense | 'new' | null;
  tours: readonly TourOption[];
  onClose: () => void;
  onSaved: () => void;
}

interface Form {
  key: string;
  date: string;
  tourId: string;
  category: string;
  amount: string;
  notes: string;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && !selected && styles.pressed]}>
      <Text style={[styles.chipText, selected && styles.chipTextOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function ExpenseModal({ expense, tours, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fill the form whenever a different expense opens (during render, no effect).
  const key = expense === null ? null : expense === 'new' ? 'new' : expense.id;
  if (key !== null && form?.key !== key) {
    const e = expense === 'new' ? null : (expense as Expense);
    setForm({
      key,
      date: e?.expense_date ?? toISODate(new Date()),
      tourId: e?.tour_id ?? (tours.length === 1 ? (tours[0]?.id ?? '') : ''),
      category: e?.category ?? '',
      amount: e ? String(e.amount) : '',
      notes: e?.notes ?? '',
    });
    setError(null);
  }
  if (key === null && form !== null) setForm(null);

  const editing = expense !== null && expense !== 'new' ? expense : null;
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const amount = form ? parseAmount(form.amount) : null;
  const dateOk = form ? isISODate(form.date) : false;
  const ready = !!form && dateOk && !!form.tourId && !!form.category && amount !== null && amount > 0;

  const close = () => {
    if (!saving) onClose();
  };

  const save = async () => {
    if (!form || !ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveExpense({ id: editing?.id, expense_date: form.date, tour_id: form.tourId, category: form.category, amount: amount!, notes: form.notes });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the expense.");
    } finally {
      setSaving(false);
    }
  };

  const archive = () => {
    if (!editing || saving) return;
    Alert.alert('Archive this expense?', 'It comes off your totals but stays on record.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          setError(null);
          try {
            await archiveExpense(editing.id);
            onSaved();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't archive the expense.");
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  // Keep a category that isn't in today's list (older entries) selectable when editing.
  const categories: string[] = [...EXPENSE_CATEGORIES];
  if (form?.category && !categories.includes(form.category)) categories.push(form.category);

  return (
    <Modal visible={expense !== null} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
        {form ? (
          <View style={styles.sheet} accessibilityViewIsModal>
            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.eyebrow}>{editing ? 'EDIT EXPENSE' : 'ADD EXPENSE'}</Text>

              <Text style={styles.label}>Date</Text>
              <View style={styles.chips} accessibilityRole="radiogroup">
                <Chip label="Today" selected={form.date === daysAgo(0)} onPress={() => set({ date: daysAgo(0) })} />
                <Chip label="Yesterday" selected={form.date === daysAgo(1)} onPress={() => set({ date: daysAgo(1) })} />
              </View>
              <TextInput
                style={[styles.input, !dateOk && styles.inputBad]}
                value={form.date}
                onChangeText={(t) => set({ date: t.trim() })}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSubtle}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Date, written year dash month dash day"
              />
              {!dateOk ? <Text style={styles.error}>Write the date like 2026-10-28.</Text> : null}

              <Text style={styles.label}>Tour</Text>
              {tours.length === 0 ? (
                <Text style={styles.note}>Expenses belong to a tour. Make a tour on the website first.</Text>
              ) : (
                <View style={styles.chips} accessibilityRole="radiogroup">
                  {tours.map((t) => <Chip key={t.id} label={t.name} selected={form.tourId === t.id} onPress={() => set({ tourId: t.id })} />)}
                </View>
              )}

              <Text style={styles.label}>Category</Text>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {categories.map((c) => <Chip key={c} label={categoryLabel(c)} selected={form.category === c} onPress={() => set({ category: c })} />)}
              </View>
              {form.category === 'Band Member Payments' ? (
                <Text style={styles.note}>To count toward a band member’s 1099 total, pay them on the show’s Lineup on the website instead.</Text>
              ) : null}

              <Text style={styles.label}>Amount ($)</Text>
              <TextInput
                style={[styles.input, form.amount !== '' && amount === null && styles.inputBad]}
                value={form.amount}
                onChangeText={(t) => set({ amount: t })}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textSubtle}
                accessibilityLabel="Amount in dollars"
              />
              {form.amount !== '' && amount === null ? <Text style={styles.error}>Enter a dollar amount, e.g. 45 or 45.50.</Text> : null}

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.notes]}
                value={form.notes}
                onChangeText={(t) => set({ notes: t })}
                placeholder="Optional"
                placeholderTextColor={colors.textSubtle}
                multiline
                maxLength={500}
                accessibilityLabel="Notes"
              />

              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

              <View style={styles.actions}>
                <View style={styles.flex}>
                  <RetroButton label="Cancel" variant="outline" onPress={close} disabled={saving} />
                </View>
                <View style={styles.flex}>
                  <RetroButton label={editing ? 'Save' : 'Add expense'} onPress={save} busy={saving} disabled={!ready} />
                </View>
              </View>
              {editing ? (
                <Pressable accessibilityRole="button" onPress={archive} disabled={saving} style={({ pressed }) => [styles.archive, pressed && styles.pressed]}>
                  <Text style={styles.archiveText}>Archive this expense</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,17,32,0.7)' },
  sheet: {
    maxHeight: '92%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  sheetBody: { padding: space.xl, paddingBottom: space['3xl'], gap: space.xs },
  eyebrow: { ...type.eyebrow, color: colors.orange, marginBottom: space.sm },
  label: { ...type.xs, color: colors.textMuted, textTransform: 'uppercase', marginTop: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.xs },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundDeep,
    maxWidth: '100%',
  },
  chipOn: { backgroundColor: colors.interactive, borderColor: colors.interactive },
  chipText: { ...type.md, color: colors.cream },
  chipTextOn: { color: colors.onInteractive },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundDeep,
    color: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: touchTarget,
    fontSize: 17,
    fontFamily: type.lg.fontFamily,
  },
  notes: { minHeight: 72, paddingTop: space.sm, textAlignVertical: 'top', fontFamily: type.base.fontFamily, fontSize: 15 },
  inputBad: { borderColor: colors.danger },
  note: { ...type.sm, color: colors.textMuted },
  error: { ...type.sm, color: colors.danger, marginTop: space.xs },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  archive: { minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  archiveText: { ...type.md, color: colors.mustard },
});
