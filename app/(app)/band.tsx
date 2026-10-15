import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RetroButton, RetroStripes, ScreenHeader, StateMessage } from '../../components/retro';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchActName, fetchBandRoster, type BandPerson } from '../../lib/band';
import { avatarColors, colors, radius, space, touchTarget, type } from '../../lib/theme';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  band_admin: 'Band admin',
  member: 'Member',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '');
  return letters.toUpperCase() || '?';
}

/** Everyone on the act's roster with tap-to-call, plus account info and sign-out. */
export default function BandScreen() {
  const { profile, user, signOut } = useAuth();
  const actId = profile?.act_id ?? null;

  const { data, error, loading, refreshing, refresh } = useAsyncData(
    `band:${actId ?? 'none'}`,
    async () => {
      if (!actId) return { roster: [] as BandPerson[], actName: null as string | null };
      const [roster, actName] = await Promise.all([fetchBandRoster(actId), fetchActName(actId)]);
      return { roster, actName };
    },
    "We couldn't load your band. Check your connection and try again."
  );
  const people = data?.roster ?? null;
  const actName = data?.actName ?? null;
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const version = Constants.expoConfig?.version ?? '';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.orange}
            colors={[colors.orange]}
          />
        }>
        <ScreenHeader title="The Band" subtitle={actName ?? undefined} />
        <RetroStripes height={4} gap={2} style={styles.stripes} />

        {loading && <StateMessage kind="loading" />}
        {error && <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} />}
        {people !== null && !error && people.length === 0 && (
          <Text style={styles.muted}>
            No one on the roster yet. Your band admin can add the band and crew under Members on camelranchbooking.com.
          </Text>
        )}

        <View style={styles.list}>
          {(people ?? []).map((p, i) => {
            const fill = avatarColors[i % avatarColors.length] ?? colors.orange;
            return (
              <View key={p.id} style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: fill }]} aria-hidden>
                  <Text style={styles.avatarText}>{initials(p.name)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.name} numberOfLines={1}>
                    {p.name}
                  </Text>
                  {p.role ? (
                    <Text style={styles.role} numberOfLines={1}>
                      {p.role}
                    </Text>
                  ) : null}
                </View>
                {p.phone ? (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`Call ${p.name}`}
                    onPress={() =>
                      Linking.openURL(`tel:${(p.phone ?? '').replace(/[^\d+]/g, '')}`).catch((e: unknown) =>
                        console.warn('[band] could not open dialer', e)
                      )
                    }
                    style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}>
                    <Ionicons name="call" size={20} color={colors.onInteractive} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>YOUR ACCOUNT</Text>
        <View style={styles.account}>
          <Text style={styles.accountName}>{profile?.display_name ?? user?.email ?? 'Signed in'}</Text>
          {user?.email ? <Text style={styles.muted2}>{user.email}</Text> : null}
          {profile?.role ? <Text style={styles.muted2}>{ROLE_LABELS[profile.role] ?? profile.role}</Text> : null}
          <View style={styles.signOut}>
            <RetroButton label="Sign out" variant="outline" busy={signingOut} onPress={handleSignOut} />
          </View>
        </View>
        {version ? <Text style={styles.version}>Camel Ranch Booking · v{version}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { paddingBottom: space['4xl'] },
  stripes: { marginBottom: space.lg },
  muted: { ...type.base, color: colors.textMuted, paddingHorizontal: space.xl },
  list: { paddingHorizontal: space.xl, gap: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    minHeight: 72,
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...type.lg, color: colors.onInteractive },
  name: { ...type.lg, color: colors.cream },
  role: { ...type.sm, color: colors.textMuted },
  callBtn: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  sectionTitle: { ...type.label, color: colors.orange, paddingHorizontal: space.xl, marginTop: space['3xl'], marginBottom: space.sm },
  account: { marginHorizontal: space.xl, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: 2 },
  accountName: { ...type.lg, color: colors.cream },
  muted2: { ...type.sm, color: colors.textMuted },
  signOut: { marginTop: space.lg },
  version: { ...type.sm, color: colors.textSubtle, textAlign: 'center', marginTop: space.xl },
});
