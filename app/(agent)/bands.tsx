// app/(agent)/bands.tsx
// Booking Agent: the agent's bands, with one tap to reach each contact.
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AgentContactLinks } from '../../components/AgentContactLinks';
import { RetroStripes, ScreenHeader, StateMessage } from '../../components/retro';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchAgentBands, type AgentBand } from '../../lib/agent';
import { READABLE_MAX_WIDTH } from '../../lib/layout';
import { colors, radius, space, type } from '../../lib/theme';

function BandRow({ band }: { band: AgentBand }) {
  const details = [band.genre, band.place, band.commissionPct !== null ? `${band.commissionPct}% commission` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.row}>
      <Text style={styles.name} numberOfLines={1}>{band.name}</Text>
      {details ? <Text style={styles.meta}>{details}</Text> : null}
      {band.contactName ? <Text style={styles.meta}>Contact: {band.contactName}</Text> : null}
      <AgentContactLinks phone={band.contactPhone} email={band.contactEmail} />
    </View>
  );
}

export default function AgentBandsScreen() {
  const { agentWorkspace } = useAuth();
  const { data, error, loading, refreshing, refresh } = useAsyncData(
    `agent-bands:${agentWorkspace?.id ?? 'none'}`,
    fetchAgentBands,
    "We couldn't load your bands. Check your connection and try again."
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FlatList
        data={error ? [] : (data ?? [])}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => <BandRow band={item} />}
        ListHeaderComponent={
          <>
            <ScreenHeader title="Bands" />
            <RetroStripes height={4} gap={2} style={styles.stripes} />
          </>
        }
        ListEmptyComponent={
          loading ? (
            <StateMessage kind="loading" />
          ) : error ? (
            <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} />
          ) : (
            <StateMessage kind="empty" title="No bands yet" message="Add bands on camelranchbooking.com and they'll show up here." />
          )
        }
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} colors={[colors.orange]} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: READABLE_MAX_WIDTH, alignSelf: 'center', backgroundColor: colors.background },
  listContent: { paddingBottom: space['4xl'] },
  stripes: { marginBottom: space.lg },
  sep: { height: space.md },
  row: { marginHorizontal: space.xl, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.lg },
  name: { ...type.lg, color: colors.cream },
  meta: { ...type.sm, color: colors.textMuted, marginTop: space.xxs },
});
