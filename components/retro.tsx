/**
 * Shared 70s-styled building blocks: groovy stacked-shadow type, the
 * three-band stripe, screen headers, status pills, and the loading /
 * error / empty states every data screen needs.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { bookingStatusColor, bookingStatusLabel } from '../lib/bookingStatus';
import type { Rsvp } from '../lib/memberShows';
import { colors, fonts, radius, retroStripe, space, touchTarget, type } from '../lib/theme';

type ShadowSet = readonly [string, string, string];
const WARM_SHADOWS: ShadowSet = [colors.mustard, colors.orange, colors.rust];
const DEEP_SHADOWS: ShadowSet = [colors.orange, colors.rust, colors.brown];
/** For type sitting on an orange panel, where an orange shadow layer would vanish. */
const ON_ORANGE_SHADOWS: ShadowSet = [colors.rust, colors.brown, colors.brown];

interface GroovyTextProps {
  children: string;
  size?: number;
  color?: string;
  /**
   * 'warm' = mustard/orange/rust under cream text (default);
   * 'deep' = orange/rust/brown under mustard text;
   * 'onOrange' = rust/brown under cream text, for orange panels.
   */
  variant?: 'warm' | 'deep' | 'onOrange';
  /** Pixel offset per shadow layer. Scales with size if omitted. */
  step?: number;
  align?: TextStyle['textAlign'];
  style?: StyleProp<ViewStyle>;
  numberOfLines?: number;
  accessibilityRole?: 'header' | 'text';
}

/**
 * Shrikhand text with the stacked retro drop shadow from the Reel.
 * The shadow copies are decorative and hidden from screen readers, so
 * VoiceOver/TalkBack read the phrase exactly once.
 */
export function GroovyText({
  children,
  size = 28,
  color,
  variant = 'warm',
  step,
  align = 'left',
  style,
  numberOfLines,
  accessibilityRole = 'header',
}: GroovyTextProps) {
  const shadows = variant === 'deep' ? DEEP_SHADOWS : variant === 'onOrange' ? ON_ORANGE_SHADOWS : WARM_SHADOWS;
  const fill = color ?? (variant === 'deep' ? colors.mustard : colors.cream);
  const offset = step ?? Math.max(1, Math.round(size / 18));
  const base: TextStyle = {
    fontFamily: fonts.groovy,
    fontSize: size,
    lineHeight: Math.round(size * 1.36),
    textAlign: align,
  };
  return (
    <View
      style={[
        styles.groovyWrap,
        { paddingRight: offset * 3, paddingBottom: offset * 3, alignSelf: align === 'center' ? 'center' : 'flex-start' },
        style,
      ]}>
      {[3, 2, 1].map((layer) => (
        <Text
          key={layer}
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          numberOfLines={numberOfLines}
          style={[
            base,
            styles.groovyShadow,
            { color: shadows[layer - 1], left: layer * offset, top: layer * offset, right: 3 * offset - layer * offset },
          ]}>
          {children}
        </Text>
      ))}
      <Text accessibilityRole={accessibilityRole} numberOfLines={numberOfLines} style={[base, { color: fill }]}>
        {children}
      </Text>
    </View>
  );
}

/** Three horizontal 70s stripes (mustard, orange, rust). */
export function RetroStripes({ height = 6, gap = 3, style }: { height?: number; gap?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap }, style]} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {retroStripe.map((c) => (
        <View key={c} style={{ height, backgroundColor: c }} />
      ))}
    </View>
  );
}

/** "CAMEL RANCH" eyebrow + groovy screen title, with an optional right-side action. */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>CAMEL RANCH</Text>
          <GroovyText size={30}>{title}</GroovyText>
        </View>
        {right}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Small colored pill showing a booking's pipeline status. Text is navy for contrast on every status fill. */
export function StatusPill({ status }: { status: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bookingStatusColor(status) }]}>
      <Text style={styles.pillText}>{bookingStatusLabel(status)}</Text>
    </View>
  );
}

const RSVP_STYLE: Record<Rsvp, { label: string; color: string }> = {
  confirmed: { label: "You're in", color: colors.statusConfirmed },
  pending: { label: 'Answer needed', color: colors.mustard },
  declined: { label: "Can't make it", color: colors.statusCancelled },
};

/** A member's own answer for a show. */
export function RsvpPill({ rsvp }: { rsvp: Rsvp }) {
  const { label, color } = RSVP_STYLE[rsvp];
  return (
    <View style={[styles.pill, { backgroundColor: color }]}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline';
  /** Shows the button as the chosen answer (green fill, not dimmed) and makes it inert. */
  selected?: boolean;
  disabled?: boolean;
  busy?: boolean;
  accessibilityHint?: string;
}

/** Primary (orange fill) or outline button with a 48dp target and pressed/disabled/busy states. */
export function RetroButton({ label, onPress, variant = 'primary', selected, disabled, busy, accessibilityHint }: ButtonProps) {
  const isPrimary = variant === 'primary' || !!selected;
  const inert = !!disabled || !!busy || !!selected;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inert, busy: !!busy, selected: !!selected }}
      disabled={inert}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonOutline,
        selected && styles.buttonSelected,
        (disabled || busy) && !selected && styles.buttonDisabled,
        pressed && !inert && styles.buttonPressed,
      ]}>
      {busy ? (
        <ActivityIndicator color={isPrimary ? colors.onInteractive : colors.interactive} />
      ) : (
        <Text style={[styles.buttonText, { color: isPrimary ? colors.onInteractive : colors.interactive }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Centered loading / error / empty message used by every data screen. */
export function StateMessage({
  kind,
  title,
  message,
  actionLabel,
  onAction,
}: {
  kind: 'loading' | 'error' | 'empty';
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  if (kind === 'loading') {
    return (
      <View style={styles.center} accessibilityLabel="Loading" accessibilityRole="progressbar">
        <ActivityIndicator size="large" color={colors.interactive} />
      </View>
    );
  }
  return (
    <View style={styles.center}>
      {title ? (
        <GroovyText size={22} align="center" variant={kind === 'error' ? 'deep' : 'warm'}>
          {title}
        </GroovyText>
      ) : null}
      {message ? (
        <Text style={styles.centerMessage} accessibilityLiveRegion={kind === 'error' ? 'assertive' : 'none'}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.centerAction}>
          <RetroButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  groovyWrap: { position: 'relative', alignSelf: 'flex-start' },
  groovyShadow: { position: 'absolute' },
  header: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  eyebrow: { ...type.eyebrow, color: colors.orange },
  subtitle: { ...type.sm, color: colors.textMuted, marginTop: space.xxs },
  pill: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 3, alignSelf: 'flex-start' },
  pillText: { ...type.xs, color: colors.onInteractive },
  button: {
    minHeight: touchTarget,
    borderRadius: radius.pill,
    paddingHorizontal: space['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.interactive },
  buttonOutline: { borderWidth: 2, borderColor: colors.interactive },
  buttonDisabled: { opacity: 0.55 },
  buttonSelected: { backgroundColor: colors.statusConfirmed },
  buttonPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  buttonText: { ...type.label, fontSize: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space['2xl'], gap: space.md },
  centerMessage: { ...type.base, color: colors.textMuted, textAlign: 'center', maxWidth: 320 },
  centerAction: { marginTop: space.sm, minWidth: 180 },
});
