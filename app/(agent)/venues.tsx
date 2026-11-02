// app/(agent)/venues.tsx
// Booking Agent: the agent's venue book with instant search.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AgentContactLinks } from '../../components/AgentContactLinks';
import { RetroStripes, ScreenHeader, StateMessage } from '../../components/retro';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchAgentVenues, filterAgentVenues, type AgentVenue } from '../../lib/agent';
import { READABLE_MAX_WIDTH } from '../../lib/layout';
import { colors, fonts, radius, space, touchTarget, type } from '../../lib/theme';

function VenueRow({ venue }: { venue: AgentVenue }) {
  const mapQuery = [venue.name, venue.address, venue.place].filter(Boolean).join(', ');
  return (
    <View style={styles.row}>
      <Text style={styles.name} numberOfLines={1}>{venue.name}</Text>
      {venue.place ? <Text style={styles.meta}>{venue.place}</Text> : null}
      <AgentContactLinks phone={venue.phone} email={venue.email} website={venue.website} mapQuery={mapQuery} />
    </View>
  );
}

export default function AgentVenuesScreen() {
  const { agentWorkspace } = useAuth();
  const [query, setQuery] = useState('');
  const { data, error, loading, refreshing, refresh } = useAsyncData(
    `agent-venues:${agentWorkspace?.id ?? 'none'}`,
    fetchAgentVenues,
    "We couldn't load your venues. Check your connection and try again."
  );
  const shown = useMemo(() => filterAgentVenues(data ?? [], query), [data, query]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FlatList
        data={error ? [] : shown}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => <VenueRow venue={item} />}
        ListHeaderComponent={
          <>
            <ScreenHeader title="Venues" subtitle={data ? `${data.length} in your book` : undefined} />
            <RetroStripes height={4} gap={2} style={styles.stripes} />
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color={colors.textMuted} aria-hidden />
              <TextInput
                accessibilityLabel="Search venues"
                style={styles.search}
                value={query}
                onChangeText={setQuery}
                placeholder="Name or town"
                placeholderTextColor={colors.textSubtle}
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <StateMessage kind="loading" />
          ) : error ? (
            <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} />
          ) : (data?.length ?? 0) === 0 ? (
            <StateMessage kind="empty" title="No venues yet" message="Add venues on camelranchbooking.com and they'll show up here." />
          ) : (
            <StateMessage kind="empty" title="No match" message={`Nothing matches "${query.trim()}".`} />
          )
        }
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.xl,
    marginBottom: space.lg,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: touchTarget,
  },
  search: { flex: 1, color: colors.cream, fontFamily: fonts.body, fontSize: 16, paddingVertical: space.sm },
  row: { marginHorizontal: space.xl, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.lg },
  name: { ...type.lg, color: colors.cream },
  meta: { ...type.sm, color: colors.textMuted, marginTop: space.xxs },
});
