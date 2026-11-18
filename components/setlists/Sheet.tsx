/**
 * Bottom sheet and form field used by the set list screens. Same look as the
 * roster's PersonModal: dimmed backdrop (tap to close), rounded sheet, retro
 * labels, 48pt inputs.
 */
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

import { colors, radius, space, touchTarget, type } from '../../lib/theme';

export function Sheet({ visible, title, onClose, children }: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        {visible ? (
          <View style={styles.sheet} accessibilityViewIsModal>
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.eyebrow} accessibilityRole="header">{title}</Text>
              {children}
            </ScrollView>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Field({ label, value, onChange, placeholder, keyboardType, autoCapitalize, maxLength, multiline }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  maxLength?: number;
  multiline?: boolean;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
        maxLength={maxLength}
        multiline={multiline}
        accessibilityLabel={label}
      />
    </>
  );
}

export const sheetStyles = StyleSheet.create({
  hint: { ...type.sm, color: colors.textMuted },
  error: { ...type.sm, color: colors.danger, marginTop: space.xs },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
  secondary: { minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  secondaryText: { ...type.md, color: colors.mustard },
  dangerText: { ...type.md, color: colors.danger },
  label: { ...type.xs, color: colors.textMuted, textTransform: 'uppercase', marginTop: space.md },
});

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
  body: { padding: space.xl, paddingBottom: space['3xl'], gap: space.xs },
  eyebrow: { ...type.eyebrow, color: colors.orange, marginBottom: space.sm },
  label: sheetStyles.label,
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
  multiline: { minHeight: 88, paddingTop: space.sm, textAlignVertical: 'top' },
});
