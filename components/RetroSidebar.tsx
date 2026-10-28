/**
 * Left-hand navigation for tablets and Mac, laid out like the website's
 * sidebar but dressed in the app's 70s look: the emblem and groovy wordmark,
 * the three retro stripes, then one row per section, with the account at the
 * bottom.
 *
 * Two widths (lib/layout.ts):
 *   - 'sidebar' (iPad landscape, Mac): logo, wordmark, band name, icon + label rows
 *   - 'rail'    (iPad portrait, split screen, unfolded Duo): icon over a small label
 *
 * It is passed to <Tabs tabBar={...}> with tabBarPosition 'left', so the tab
 * navigator still owns the screens; this only draws the buttons. Every row is
 * a 48pt-tall button with its selected state announced.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState, type ComponentProps } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { fetchActName } from '../lib/band';
import { NAV_RAIL_WIDTH, NAV_SIDEBAR_WIDTH, type NavStyle } from '../lib/layout';
import { colors, radius, space, touchTarget, type } from '../lib/theme';
import { GroovyText, RetroStripes } from './retro';

const EMBLEM = require('../assets/images/logo-emblem.png');

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface NavItem {
  /** Route name in the (app) tab navigator. */
  name: string;
  label: string;
  icon: IconName;
  activeIcon: IconName;
}

interface Props extends BottomTabBarProps {
  items: readonly NavItem[];
  variant: Exclude<NavStyle, 'tabs'>;
}

export function RetroSidebar({ state, navigation, items, variant }: Props) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [actName, setActName] = useState<string | null>(null);
  const full = variant === 'sidebar';

  useEffect(() => {
    if (!profile?.act_id || !full) return;
    let cancelled = false;
    fetchActName(profile.act_id)
      .then((name) => { if (!cancelled) setActName(name); })
      .catch(() => { /* the band name is a nicety; the sidebar works without it */ });
    return () => { cancelled = true; };
  }, [profile?.act_id, full]);

  const focusedName = state.routes[state.index]?.name;

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (focusedName !== name && !event.defaultPrevented) navigation.navigate(route.name, route.params);
  };

  const renderRow = (item: NavItem) => {
    const active = focusedName === item.name;
    return (
      <Pressable
        key={item.name}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        onPress={() => go(item.name)}
        style={({ pressed }) => [
          full ? styles.row : styles.railRow,
          active && styles.rowActive,
          pressed && !active && styles.rowPressed,
        ]}>
        <Ionicons name={active ? item.activeIcon : item.icon} size={full ? 22 : 24} color={active ? colors.onInteractive : colors.cream} />
        <Text
          style={[full ? styles.rowLabel : styles.railLabel, { color: active ? colors.onInteractive : colors.cream }]}
          numberOfLines={1}>
          {full ? item.label.toUpperCase() : item.label}
        </Text>
      </Pressable>
    );
  };

  const bandActive = focusedName === 'band';

  return (
    <View
      style={[
        styles.root,
        { width: (full ? NAV_SIDEBAR_WIDTH : NAV_RAIL_WIDTH) + insets.left, paddingLeft: insets.left, paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.md },
      ]}
      accessibilityRole="tablist">
      <View style={full ? styles.brand : styles.railBrand}>
        <Image source={EMBLEM} style={full ? styles.emblem : styles.railEmblem} accessibilityIgnoresInvertColors accessible={false} />
        {full && (
          <View style={styles.brandText}>
            <GroovyText size={19} accessibilityRole="text" numberOfLines={1}>Camel Ranch</GroovyText>
            {actName ? <Text style={styles.band} numberOfLines={2}>{actName}</Text> : null}
          </View>
        )}
      </View>
      <RetroStripes height={full ? 4 : 3} gap={2} style={styles.stripes} />

      <ScrollView contentContainerStyle={styles.items} showsVerticalScrollIndicator={false}>
        {full && <Text style={styles.section}>NAVIGATION</Text>}
        {items.map(renderRow)}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel="Band and account"
          accessibilityState={{ selected: bandActive }}
          onPress={() => go('band')}
          style={({ pressed }) => [full ? styles.row : styles.railRow, bandActive && styles.rowActive, pressed && !bandActive && styles.rowPressed]}>
          <Ionicons name={bandActive ? 'person-circle' : 'person-circle-outline'} size={full ? 24 : 26} color={bandActive ? colors.onInteractive : colors.cream} />
          {full ? (
            <View style={styles.accountText}>
              <Text style={[styles.accountName, bandActive && { color: colors.onInteractive }]} numberOfLines={1}>
                {profile?.display_name || 'Your account'}
              </Text>
              <Text style={[styles.accountRole, bandActive && { color: colors.onInteractive }]}>
                {profile?.role === 'member' ? 'BAND MEMBER' : profile?.role === 'superadmin' ? 'SUPERADMIN' : 'BAND ADMIN'}
              </Text>
            </View>
          ) : (
            <Text style={[styles.railLabel, { color: bandActive ? colors.onInteractive : colors.cream }]}>Band</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.tabBar,
    borderRightWidth: 2,
    borderRightColor: colors.orange,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  railBrand: { alignItems: 'center' },
  emblem: { width: 52, height: 52, borderRadius: radius.md },
  railEmblem: { width: 48, height: 48, borderRadius: radius.md },
  brandText: { flex: 1, minWidth: 0 },
  band: { ...type.xs, color: colors.textMuted, marginTop: space.xxs },
  stripes: { marginTop: space.lg, marginBottom: space.md },
  items: { gap: space.xs, paddingHorizontal: space.sm, paddingBottom: space.lg },
  section: { ...type.eyebrow, fontSize: 14, color: colors.orange, paddingHorizontal: space.md, marginTop: space.xs, marginBottom: space.xs },
  row: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  railRow: {
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxs,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  rowActive: { backgroundColor: colors.interactive },
  rowPressed: { backgroundColor: colors.surface },
  rowLabel: { ...type.label, flexShrink: 1 },
  railLabel: { ...type.xs, textAlign: 'center' },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.sm,
    paddingHorizontal: space.sm,
  },
  accountText: { flex: 1, minWidth: 0 },
  accountName: { ...type.md, color: colors.cream },
  accountRole: { ...type.xs, color: colors.textMuted, letterSpacing: 1 },
});
