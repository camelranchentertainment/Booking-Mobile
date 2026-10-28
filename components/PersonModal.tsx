// components/PersonModal.tsx
// Band admins add someone to the roster or edit them: name, role, phone,
// email and usual pay per show. Editing also offers "Take off the roster"
// (or "Bring back"), which keeps their history — nobody is deleted.
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { addPerson, setPersonActive, updatePerson, validatePerson, type PersonDraft, type RosterPerson } from '../lib/adminRoster';
import { colors, radius, space, touchTarget, type } from '../lib/theme';
import { RetroButton } from './retro';

interface Props {
  actId: string;
  /** The person to edit, `'new'` to add one, or null when closed. */
  person: RosterPerson | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY: PersonDraft = { name: '', role: '', phone: '', email: '', pay: '' };

function Field({ label, value, onChange, keyboardType, placeholder, autoCapitalize }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: KeyboardTypeOptions;
  placeholder?: string;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
        accessibilityLabel={label}
      />
    </>
  );
}

export function PersonModal({ actId, person, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<PersonDraft>(EMPTY);
  const [forKey, setForKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fill the form whenever a different person opens (during render, no effect).
  const key = person === null ? null : person === 'new' ? 'new' : person.id;
  if (key !== forKey) {
    setForKey(key);
    setError(null);
    const p = person && person !== 'new' ? person : null;
    setDraft(p ? { name: p.name, role: p.role ?? '', phone: p.phone ?? '', email: p.email ?? '', pay: p.pay != null ? String(p.pay) : '' } : EMPTY);
  }

  const editing = person && person !== 'new' ? person : null;
  const problem = validatePerson(draft);
  const set = (patch: Partial<PersonDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const close = () => {
    if (!saving) onClose();
  };

  const save = async () => {
    if (problem || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) await updatePerson(editing.id, draft);
      else await addPerson(actId, draft);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = () => {
    if (!editing || saving) return;
    const run = async () => {
      setSaving(true);
      setError(null);
      try {
        await setPersonActive(editing.id, !editing.active);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save.");
      } finally {
        setSaving(false);
      }
    };
    if (!editing.active) {
      void run();
      return;
    }
    Alert.alert(
      `Take ${editing.name} off the roster?`,
      "They won't be offered for new shows. Past shows and pay keep their name, and you can bring them back any time.",
      [
        { text: 'Keep them', style: 'cancel' },
        { text: 'Take off roster', style: 'destructive', onPress: () => void run() },
      ]
    );
  };

  return (
    <Modal visible={person !== null} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
        {person !== null ? (
          <View style={styles.sheet} accessibilityViewIsModal>
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.eyebrow}>{editing ? 'EDIT PERSON' : 'ADD TO ROSTER'}</Text>
              <Field label="Name" value={draft.name} onChange={(v) => set({ name: v })} autoCapitalize="words" />
              <Field label="Role" value={draft.role} onChange={(v) => set({ role: v })} placeholder="e.g. Drums, Sound tech" autoCapitalize="words" />
              <Field label="Usual pay per show ($)" value={draft.pay} onChange={(v) => set({ pay: v })} keyboardType="decimal-pad" placeholder="Optional" />
              <Text style={styles.hint}>Used as their pay on new shows until you set it per show. Only band admins see pay rates.</Text>
              <Field label="Phone" value={draft.phone} onChange={(v) => set({ phone: v })} keyboardType="phone-pad" placeholder="Optional" />
              <Field label="Email" value={draft.email} onChange={(v) => set({ email: v })} keyboardType="email-address" placeholder="Optional" autoCapitalize="none" />
              {editing?.hasLogin ? <Text style={styles.hint}>{editing.name} has their own login, linked to this spot.</Text> : null}

              {draft.name !== '' && problem ? <Text style={styles.error}>{problem}</Text> : null}
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

              <View style={styles.actions}>
                <View style={styles.flex}>
                  <RetroButton label="Cancel" variant="outline" onPress={close} disabled={saving} />
                </View>
                <View style={styles.flex}>
                  <RetroButton label={editing ? 'Save' : 'Add'} onPress={save} busy={saving} disabled={!!problem} />
                </View>
              </View>
              {editing ? (
                <Pressable accessibilityRole="button" onPress={toggleActive} disabled={saving} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                  <Text style={styles.secondaryText}>{editing.active ? 'Take off the roster' : 'Bring back to the roster'}</Text>
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
  sheet: { maxHeight: '92%', width: '100%', maxWidth: 640, alignSelf: 'center', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  body: { padding: space.xl, paddingBottom: space['3xl'], gap: space.xs },
  eyebrow: { ...type.eyebrow, color: colors.orange, marginBottom: space.sm },
  label: { ...type.xs, color: colors.textMuted, textTransform: 'uppercase', marginTop: space.md },
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
  hint: { ...type.sm, color: colors.textMuted },
  error: { ...type.sm, color: colors.danger, marginTop: space.xs },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  secondary: { minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  secondaryText: { ...type.md, color: colors.mustard },
});
