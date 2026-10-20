import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountButton } from '../../components/AccountButton';
import { DaySheetModal } from '../../components/DaySheetModal';
import { RetroStripes, ScreenHeader, StateMessage } from '../../components/retro';
import { ShowCard } from '../../components/ShowCard';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncData } from '../../hooks/useAsyncData';
import { useLayout } from '../../hooks/useLayout';
import type { UpcomingBooking } from '../../lib/bookings';
import { fetchShowsFeed } from '../../lib/showFeed';
import { syncShowsToWatch } from '../../lib/watchSync';
import { colors, space } from '../../lib/theme';
import { CONTENT_MAX_WIDTH, padToColumns } from '../../lib/layout';

/**
 * Upcoming shows, soonest first.
 * - Admins: the whole pipeline; tapping opens the editable day sheet.
 * - Members: only shows they're on, with their own answer; tapping opens
 *   that show on the Day Sheet tab (where they can answer and see pay).
 */
export default function ShowsScreen() {
  const router = useRouter();
  // 1 column on phones, 2 on iPad portrait / iPhone Duo unfolded, 3 on iPad landscape / Mac.
  const { columns } = useLayout();
  const { profile } = useAuth();
  const isMember = profile?.role === 'member';
  // UI gate only — RLS on `bookings` is the real write boundary (see lib/bookings.ts).
  const canEdit = profile?.role === 'band_admin' || profile?.role === 'superadmin';

  const { data, error, loading, refreshing, refresh } = useAsyncData(
    `shows:${isMember ? 'member' : 'admin'}`,
    () => fetchShowsFeed(isMember),
    "We couldn't load your shows. Check your connection and try again.",
  );
  // Saved edits from the admin day sheet, layered over the fetched rows until the next refresh.
  const [edits, setEdits] = useState<Record<string, UpcomingBooking>>({});
  const [selected, setSelected] = useState<UpcomingBooking | null>(null);
  const items = data ? data.map((it) => ({ ...it, booking: edits[it.booking.id] ?? it.booking })) : null;

  // Keep the Apple Watch app's show list current whenever fresh shows load (no-op without a watch).
  useEffect(() => {
    if (data) syncShowsToWatch(data.map((it) => it.booking));
  }, [data]);

  const firstName = profile?.display_name?.split(' ')[0];
  const count = items?.length ?? 0;
  const needAnswer = items?.filter((it) => it.member?.rsvp === 'pending').length ?? 0;
  const subtitle =
    items === null
      ? undefined
      : `${firstName ? `Hey ${firstName} — ` : ''}${count} upcoming ${count === 1 ? 'show' : 'shows'}` +
        (isMember ? (needAnswer ? ` · ${needAnswer} need your answer` : '') : ' on the books');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenHeader title={isMember ? 'My Shows' : 'Your Shows'} subtitle={subtitle} right={<AccountButton />} />
      <RetroStripes height={4} gap={2} style={styles.stripes} />

      {loading && <StateMessage kind="loading" />}

      {error && (
        <StateMessage
          kind="error"
          title="Feedback on the line"
          message={error}
          actionLabel="Try again"
          onAction={refresh}
        />
      )}

      {items !== null && !error && items.length === 0 && (
        <StateMessage
          kind="empty"
          title="Quiet on the road"
          message={
            isMember
              ? "You're not on any upcoming shows yet. When your band admin adds you to a show, it lands here."
              : 'No upcoming shows yet. Once a show is booked on camelranchbooking.com it shows up here.'
          }
          actionLabel="Refresh"
          onAction={refresh}
        />
      )}

      {items !== null && !error && items.length > 0 && (
        <FlatList
          // numColumns can't change on a mounted FlatList; remount when the window crosses a breakpoint.
          key={`cols-${columns}`}
          numColumns={columns}
          data={padToColumns(items, columns)}
          keyExtractor={(it, index) => (it ? (it.member?.assignmentId ?? it.booking.id) : `filler-${index}`)}
          contentContainerStyle={styles.list}
          columnWrapperStyle={columns > 1 ? styles.row : undefined}
          ItemSeparatorComponent={() => <View style={{ height: space.md }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.orange}
              colors={[colors.orange]}
            />
          }
          renderItem={({ item }) =>
            item === null ? (
              // Keeps the last row's cards the same width as the rows above.
              <View style={styles.cell} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
            ) : (
              <View style={styles.cell}>
                <ShowCard
                  booking={item.booking}
                  rsvp={item.member?.rsvp}
                  onPress={() =>
                    isMember
                      ? router.push({ pathname: '/daysheet', params: { show: item.booking.id } })
                      : setSelected(item.booking)
                  }
                />
              </View>
            )
          }
        />
      )}

      {!isMember && (
        <DaySheetModal
          booking={selected}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setSelected(updated);
            setEdits((prev) => ({ ...prev, [updated.id]: updated }));
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Wide windows get a centered frame; the grid inside picks 1–3 columns.
  container: {
    flex: 1,
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  stripes: { marginBottom: space.lg },
  list: { paddingHorizontal: space.xl, paddingBottom: space['4xl'] },
  row: { gap: space.md },
  cell: { flex: 1 },
});
