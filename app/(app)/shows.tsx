import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DaySheetModal } from '../../components/DaySheetModal';
import { useAuth } from '../../contexts/AuthContext';
import { bookingStatusColor, bookingStatusLabel } from '../../lib/bookingStatus';
import { fetchUpcomingBookings, type UpcomingBooking } from '../../lib/bookings';

const COLORS = {
  background: '#0E1628',
  accent: '#E8602A',
  text: '#F5EDD9',
  textMuted: '#8A96B5',
  border: '#2A3655',
  errorRed: '#E85A5A',
};

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return 'TBD';
  const parts = dateStr.split('-').map(Number);
  const date = new Date(parts[0] ?? 1970, (parts[1] ?? 1) - 1, parts[2] ?? 1);
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function ShowsScreen() {
  // Only band_admin/superadmin can see the edit button. Note this is a
  // UI-level restriction — see the comment on updateBooking() in
  // lib/bookings.ts for the database-level caveat.
  const { profile } = useAuth();
  const canEdit = profile?.role === 'band_admin' || profile?.role === 'superadmin';

  const [bookings, setBookings] = useState<UpcomingBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<UpcomingBooking | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const rows = await fetchUpcomingBookings();
      setBookings(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shows.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Text style={styles.title}>Upcoming Shows</Text>

        {bookings === null && !error && (
          <View style={styles.centerFill}>
            <ActivityIndicator color={COLORS.accent} />
          </View>
        )}

        {error && (
          <View style={styles.centerFill}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={load} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {bookings !== null && !error && bookings.length === 0 && (
          <View style={styles.centerFill}>
            <Text style={styles.mutedText}>No upcoming shows on the books yet.</Text>
          </View>
        )}

        {bookings !== null && bookings.length > 0 && (
          <FlatList
            data={bookings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={onRefresh}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelected(item)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <View style={styles.rowDate}>
                  <Text style={styles.rowDateText}>{formatShortDate(item.showDate)}</Text>
                </View>
                <View style={styles.rowMain}>
                  <Text style={styles.rowVenue} numberOfLines={1}>
                    {item.venue?.name ?? 'Venue TBD'}
                  </Text>
                  {(item.venue?.city || item.venue?.state) && (
                    <Text style={styles.rowLocation} numberOfLines={1}>
                      {[item.venue?.city, item.venue?.state].filter(Boolean).join(', ')}
                    </Text>
                  )}
                </View>
                <View
                  style={[styles.statusDot, { backgroundColor: bookingStatusColor(item.status) }]}
                  accessibilityLabel={bookingStatusLabel(item.status)}
                />
              </Pressable>
            )}
          />
        )}

        <DaySheetModal
          booking={selected}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setSelected(updated);
            setBookings((prev) =>
              prev ? prev.map((b) => (b.id === updated.id ? updated : b)) : prev
            );
          }}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  safeArea: { flex: 1 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  mutedText: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center' },
  errorText: { color: COLORS.errorRed, textAlign: 'center' },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: { color: COLORS.background, fontWeight: '700' },
  listContent: { paddingHorizontal: 24, paddingBottom: 48, gap: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    minHeight: 44,
  },
  rowPressed: { opacity: 0.6 },
  rowDate: { width: 72 },
  rowDateText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  rowMain: { flex: 1 },
  rowVenue: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  rowLocation: { fontSize: 13, color: COLORS.textMuted, marginTop: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
});
