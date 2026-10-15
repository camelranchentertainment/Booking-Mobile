import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DaySheetModal } from '../../components/DaySheetModal';
import { RetroStripes, ScreenHeader, StateMessage } from '../../components/retro';
import { ShowCard } from '../../components/ShowCard';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { fetchUpcomingBookings, type UpcomingBooking } from '../../lib/bookings';
import { colors, space } from '../../lib/theme';

/** Upcoming shows, soonest first. Tap a show for its day sheet; admins can edit there. */
export default function ShowsScreen() {
  const { profile } = useAuth();
  // UI gate only — RLS on `bookings` is the real write boundary (see lib/bookings.ts).
  const canEdit = profile?.role === 'band_admin' || profile?.role === 'superadmin';

  const { data, error, loading, refreshing, refresh } = useAsyncData(
    'upcoming',
    fetchUpcomingBookings,
    "We couldn't load your shows. Check your connection and try again."
  );
  // Saved edits from the day sheet, layered over the fetched rows until the next refresh.
  const [edits, setEdits] = useState<Record<string, UpcomingBooking>>({});
  const [selected, setSelected] = useState<UpcomingBooking | null>(null);
  const bookings = data ? data.map((b) => edits[b.id] ?? b) : null;

  const firstName = profile?.display_name?.split(' ')[0];
  const count = bookings?.length ?? 0;
  const subtitle =
    bookings === null
      ? undefined
      : `${firstName ? `Hey ${firstName} — ` : ''}${count} upcoming ${count === 1 ? 'show' : 'shows'} on the books`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Your Shows" subtitle={subtitle} />
      <RetroStripes height={4} gap={2} style={styles.stripes} />

      {loading && <StateMessage kind="loading" />}

      {error && (
        <StateMessage kind="error" title="Feedback on the line" message={error} actionLabel="Try again" onAction={refresh} />
      )}

      {bookings !== null && !error && bookings.length === 0 && (
        <StateMessage
          kind="empty"
          title="Quiet on the road"
          message="No upcoming shows yet. Once a show is booked on camelranchbooking.com it shows up here."
          actionLabel="Refresh"
          onAction={refresh}
        />
      )}

      {bookings !== null && !error && bookings.length > 0 && (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} colors={[colors.orange]} />
          }
          renderItem={({ item }) => <ShowCard booking={item} onPress={() => setSelected(item)} />}
        />
      )}

      <DaySheetModal
        booking={selected}
        canEdit={canEdit}
        onClose={() => setSelected(null)}
        onUpdated={(updated) => {
          setSelected(updated);
          setEdits((prev) => ({ ...prev, [updated.id]: updated }));
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  stripes: { marginBottom: space.lg },
  list: { paddingHorizontal: space.xl, paddingBottom: space['4xl'] },
});
