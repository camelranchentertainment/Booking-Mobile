/**
 * Full-screen modal frame shared by the day sheet and Add a show.
 *
 * A React Native <Modal> opens in its own native window, so the app's
 * safe-area provider does not reach inside it. Without a provider of its own
 * the insets read as zero and anything at the top — the Close button —
 * slides up under the status bar, notch or camera cutout, where it can't be
 * tapped. This frame gives every modal its own SafeAreaProvider and pins the
 * Close button in a bar above the scrolling content, so it is always visible
 * and always reachable.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { READABLE_MAX_WIDTH } from '../lib/layout';
import { colors, fonts } from '../lib/theme';

interface Props {
  visible: boolean;
  /** Called by the Close button and the Android back gesture. */
  onClose: () => void;
  children: ReactNode;
}

/** Retro outlined '✕ Close' pill: 44pt tall, inset from the corner. */
export function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole='button'
      accessibilityLabel='Close'
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.close, pressed && styles.pressed]}
    >
      <Ionicons name='close' size={20} color={colors.interactive} />
      <Text style={styles.closeText}>Close</Text>
    </Pressable>
  );
}

/**
 * Slide-up full-screen modal with a pinned Close bar and safe-area padding on
 * every edge. Children are the scrolling body.
 */
export function ModalScreen({ visible, onClose, children }: Props) {
  return (
    <Modal visible={visible} animationType='slide' onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView
          style={styles.flex}
          edges={['top', 'left', 'right', 'bottom']}
        >
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.topBar}>
              <CloseButton onPress={onClose} />
            </View>
            {children}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  topBar: {
    width: '100%',
    maxWidth: READABLE_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  close: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.interactive,
  },
  pressed: { opacity: 0.6 },
  closeText: {
    color: colors.interactive,
    fontSize: 16,
    fontFamily: fonts.bodySemibold,
  },
});
