// components/BackButton.tsx
// Header back button for screens inside a stack (e.g. the admin More tab).
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { colors, touchTarget } from '../lib/theme';

/**
 * Goes back when there is history, else to `fallback` (deep links, cold starts).
 */
export function BackButton({ fallback, label = 'Back' }: { fallback: Href; label?: string }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
      <Ionicons name="chevron-back" size={28} color={colors.cream} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
});
