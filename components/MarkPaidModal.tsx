// components/MarkPaidModal.tsx
// Band admins record the money for a played show from the phone.
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { markShowPaid, type MoneyShow } from '../lib/adminMoney';
import { formatCardDate } from '../lib/dates';
import { colors, radius, space, touchTarget, type } from '../lib/theme';
import { RetroButton } from './retro';

interface Props {
  show: MoneyShow | null;
  onClose: () => void;
  onSaved: () => void;
}

/** "$1,250.50" / "1250.5" → 1250.5; null when it isn't a non-negative amount. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}

export function MarkPaidModal({ show, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState('');
  const [forShow, setForShow] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill with the agreed pay whenever a different show opens (during render, no effect).
  if (show && show.id !== forShow) {
    setForShow(show.id);
    setAmount(show.fee !== null ? String(show.fee) : '');
    setError(null);
  }

  const parsed = parseAmount(amount);
  const close = () => {
    if (!saving) onClose();
  };

  const save = async () => {
    if (!show || parsed === null || saving) return;
    setSaving(true);
    setError(null);
    try {
      await markShowPaid(show.id, parsed);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't mark it paid.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={show !== null} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
        {show ? (
          <View style={styles.sheet} accessibilityViewIsModal>
            <Text style={styles.eyebrow}>MARK PAID</Text>
            <Text style={styles.title}>{show.venue}</Text>
            <Text style={styles.meta}>{formatCardDate(show.date)}</Text>

            <Text style={styles.label}>Amount received ($)</Text>
            <TextInput
              style={[styles.input, amount !== '' && parsed === null && styles.inputBad]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              autoFocus
              accessibilityLabel="Amount received in dollars"
            />
            {amount !== '' && parsed === null ? <Text style={styles.error}>Enter a dollar amount, e.g. 450 or 450.50.</Text> : null}
            <Text style={styles.note}>Marks the show completed and paid. You can change it later on the website.</Text>
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <View style={styles.flex}>
                <RetroButton label="Cancel" variant="outline" onPress={close} disabled={saving} />
              </View>
              <View style={styles.flex}>
                <RetroButton label="Mark paid" onPress={save} busy={saving} disabled={parsed === null} />
              </View>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(10,17,32,0.7)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space.xl,
    paddingBottom: space['3xl'],
    gap: space.xs,
  },
  eyebrow: { ...type.eyebrow, color: colors.orange },
  title: { ...type.heading, color: colors.cream },
  meta: { ...type.sm, color: colors.textMuted, marginBottom: space.md },
  label: { ...type.xs, color: colors.textMuted, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundDeep,
    color: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: touchTarget,
    fontSize: 18,
    fontFamily: type.lg.fontFamily,
  },
  inputBad: { borderColor: colors.danger },
  note: { ...type.sm, color: colors.textMuted, marginTop: space.sm },
  error: { ...type.sm, color: colors.danger, marginTop: space.xs },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  flex: { flex: 1 },
});
