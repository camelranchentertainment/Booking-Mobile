// app/(agent)/index.tsx
// Booking Agent: every upcoming show across the agent's bands.
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RetroStripes, ScreenHeader, StateMessage } from '../../components/retro';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchAgentBands, fetchUpcomingAgentShows, showStatusLine, type AgentShow } from '../../lib/agent';
import { formatCardDate } from '../../lib/dates';
import { READABLE_MAX_WIDTH } from '../../lib/layout';
import { colors, radius, space, type } from '../../lib/theme';

function ShowRow({ show, bandName }: { show: AgentShow; bandName: string }) {
  const where = [show.venueName ?? 'Venue to be set', show.venueCity].filter(Boolean).join(', ');
  return (
    <View style={styles.row} accessible>
      <Text style={styles.date}>{formatCardDate(show.showDate)}</Text>
      <Text style={styles.band} numberOfLines={1}>{bandName}</Text>
      <Text style={styles.meta} numberOfLines={2}>{where}</Text>
      <Text style={show.answerBy ? styles.deadline : styles.meta}>
        {showStatusLine(show)}
        {show.fee !== null ? ` · $${show.fee.toLocaleString('en-US')}` : ''}
      </Text>
    </View>
  );
}

export default function AgentShowsScreen() {
  const { agentWorkspace } = useAuth();
  const { data, error, loading, refreshing, refresh } = useAsyncData(
    `agent-shows:${agentWorkspace?.id ?? 'none'}`,
    async () => {
      const [shows, bands] = await Promise.all([fetchUpcomingAgentShows(), fetchAgentBands()]);
      return { shows, bandNames: new Map(bands.map((b) => [b.id, b.name])) };
    },
    "We couldn't load your shows. Check your connection and try again."
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FlatList
        data={error ? [] : (data?.shows ?? [])}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <ShowRow show={item} bandName={data?.bandNames.get(item.rosterId) ?? 'Band'} />}
        ListHeaderComponent={
          <>
            <ScreenHeader title="Shows" subtitle={agentWorkspace?.agencyName} />
            <RetroStripes height={4} gap={2} style={styles.stripes} />
          </>
        }
        ListEmptyComponent={
          loading ? (
            <StateMessage kind="loading" />
          ) : error ? (
            <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} />
          ) : (
            <StateMessage kind="empty" title="No upcoming shows" message="Add shows on camelranchbooking.com and they'll show up here." />
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
  date: { ...type.label, color: colors.mustard },
  band: { ...type.lg, color: colors.cream, marginTop: space.xs },
  meta: { ...type.sm, color: colors.textMuted, marginTop: space.xxs },
  deadline: { ...type.sm, color: colors.mustard, marginTop: space.xxs },
});
