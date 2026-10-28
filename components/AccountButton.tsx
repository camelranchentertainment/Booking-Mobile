import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useLayout } from '../hooks/useLayout';
import { colors, touchTarget } from '../lib/theme';

/**
 * Header button that opens the Band & account screen (roster, sign out).
 * Phones only: on tablets the sidebar has its own account row at the bottom.
 */
export function AccountButton() {
  const router = useRouter();
  const { nav } = useLayout();
  if (nav !== 'tabs') return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Band and account"
      onPress={() => router.push('/band')}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
      <Ionicons name="person-circle-outline" size={32} color={colors.cream} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
