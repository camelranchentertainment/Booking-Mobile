// app/(agent)/account.tsx
// Booking Agent: account details, the full workspace on the website, sign out.
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RetroButton, RetroStripes, ScreenHeader } from '../../components/retro';
import { useAuth } from '../../contexts/AuthContext';
import { READABLE_MAX_WIDTH } from '../../lib/layout';
import { openSafely } from '../../lib/links';
import { colors, radius, space, type } from '../../lib/theme';

const WORKSPACE_URL = 'https://www.camelranchbooking.com/agent';

export default function AgentAccountScreen() {
  const { agentWorkspace, user, signOut, deleteAccount } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    const result = await deleteAccount();
    if (result.ok) {
      // AuthContext has cleared the session; the root layout routes to sign-in.
      Alert.alert('Account deleted', 'Your Camel Ranch Booking account has been permanently deleted.');
      return;
    }
    setBusy(false);
    Alert.alert('Account not deleted', result.message);
  };

  const confirmDelete = () => {
    Alert.alert('Delete your account?', "This permanently deletes your login and agent workspace. This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void handleDelete() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Account" />
        <RetroStripes height={4} gap={2} style={styles.stripes} />
        <View style={styles.card}>
          <Text style={styles.name}>{agentWorkspace?.agencyName}</Text>
          {user?.email ? <Text style={styles.meta}>{user.email}</Text> : null}
        </View>
        <Text style={styles.note}>
          Adding shows, sending offers and email, commission and reports are on the website.
        </Text>
        <View style={styles.actions}>
          <RetroButton label="Open full workspace" onPress={() => void openSafely(WORKSPACE_URL)} />
          <RetroButton label="Sign out" variant="outline" onPress={() => void handleSignOut()} disabled={busy} />
          <RetroButton label="Delete account" variant="outline" onPress={confirmDelete} disabled={busy} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: READABLE_MAX_WIDTH, alignSelf: 'center', backgroundColor: colors.background },
  content: { paddingBottom: space['4xl'] },
  stripes: { marginBottom: space.lg },
  card: { marginHorizontal: space.xl, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.lg },
  name: { ...type.lg, color: colors.cream },
  meta: { ...type.sm, color: colors.textMuted, marginTop: space.xxs },
  note: { ...type.base, color: colors.textMuted, marginHorizontal: space.xl, marginTop: space.lg },
  actions: { gap: space.md, marginHorizontal: space.xl, marginTop: space.lg },
});
