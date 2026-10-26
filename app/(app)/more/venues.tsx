// app/(app)/more/venues.tsx
// Band admins: the band's venue book with instant search. Tap a venue for its
// contact, directions and notes.
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../../../components/BackButton';
import { RetroStripes, ScreenHeader, StateMessage } from '../../../components/retro';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { READABLE_MAX_WIDTH } from '../../../lib/layout';
import { colors, fonts, radius, space, touchTarget, type } from '../../../lib/theme';
import { fetchVenues, filterVenues, placeLabel, type VenueSummary } from '../../../lib/venues';


function VenueRow({ venue, onPress }: { venue: VenueSummary; onPress: () => void }) {
  const place = placeLabel(venue);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${venue.name}${place ? `, ${place}` : ''}`}
      accessibilityHint="Opens the venue"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>{venue.name}</Text>
        {place ? <Text style={styles.meta} numberOfLines={1}>{place}</Text> : null}
        {venue.contactName ? (
          <Text style={styles.contact} numberOfLines={1}>Contact: {venue.contactName}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} aria-hidden />
    </Pressable>
  );
}

export default function VenuesScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const actId = profile?.act_id ?? null;
  const [query, setQuery] = useState('');

  const { data, error, loading, refreshing, refresh } = useAsyncData(
    `venues:${actId ?? 'none'}`,
    async () => (actId ? fetchVenues(actId) : []),
    "We couldn't load your venues. Check your connection and try again."
  );
  const shown = useMemo(() => filterVenues(data ?? [], query), [data, query]);
  const total = data?.length ?? 0;

  const header = (
    <>
      <ScreenHeader
        title="Venues"
        subtitle={data ? `${total} in your book` : undefined}
        right={<BackButton fallback={'/more'} />}
      />
      <RetroStripes height={4} gap={2} style={styles.stripes} />
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textMuted} aria-hidden />
        <TextInput
          accessibilityLabel="Search venues"
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Name, town or contact"
          placeholderTextColor={colors.textSubtle}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FlatList
        data={error ? [] : shown}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <VenueRow venue={item} onPress={() => router.push({ pathname: '/more/venue/[id]', params: { id: item.id } })} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <StateMessage kind="loading" />
          ) : error ? (
            <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} />
          ) : total === 0 ? (
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
  flex: { flex: 1 },
  pressed: { opacity: 0.75 },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.md,
    minHeight: touchTarget + 16,
  },
  sep: { height: space.md },
  name: { ...type.lg, color: colors.cream },
  meta: { ...type.sm, color: colors.textMuted },
  contact: { ...type.sm, color: colors.mustard, marginTop: 2 },
});
