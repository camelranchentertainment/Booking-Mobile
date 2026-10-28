// app/(app)/more/tours.tsx
// Band admins: the band's tours with how each is going — targets, how many
// are booked, how many are waiting on a follow-up. Tap a tour to work its
// targets and edit it. New tours are planned on the website (venue search,
// routing and pitch emails live there).
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../../../components/BackButton';
import { RetroStripes, ScreenHeader, StateMessage } from '../../../components/retro';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchTours, TOUR_STATUS_LABEL, tourDates, type TourSummary } from '../../../lib/adminTours';
import { READABLE_MAX_WIDTH } from '../../../lib/layout';
import { openSafely } from '../../../lib/links';
import { API_BASE } from '../../../lib/memberShows';
import { colors, radius, space, touchTarget, type } from '../../../lib/theme';

const STATUS_COLOR: Record<TourSummary['status'], string> = {
  active: colors.orange,
  planning: colors.mustard,
  completed: colors.statusDone,
  cancelled: colors.statusCancelled,
};

function TourCard({ tour, onPress }: { tour: TourSummary; onPress: () => void }) {
  const pct = tour.targets ? Math.round((tour.booked / tour.targets) * 100) : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tour.name}, ${TOUR_STATUS_LABEL[tour.status]}, ${tourDates(tour.startDate, tour.endDate)}. ${tour.booked} of ${tour.targets} targets booked${tour.followUps ? `, ${tour.followUps} to follow up` : ''}.`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { borderLeftColor: STATUS_COLOR[tour.status] }, pressed && styles.pressed]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={1}>{tour.name}</Text>
        <Text style={[styles.cardStatus, { color: STATUS_COLOR[tour.status] }]}>{TOUR_STATUS_LABEL[tour.status].toUpperCase()}</Text>
      </View>
      <Text style={styles.cardDates}>{tourDates(tour.startDate, tour.endDate)}</Text>
      <View style={styles.meter} aria-hidden>
        <View style={[styles.meterBar, { width: `${pct}%` }]} />
      </View>
      <View style={styles.cardNums}>
        <Text style={styles.num}><Text style={styles.numStrong}>{tour.booked}</Text> of {tour.targets} booked</Text>
        {tour.followUps ? <Text style={[styles.num, { color: colors.mustard }]}>{tour.followUps} to follow up</Text> : null}
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

export default function ToursScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const actId = profile?.act_id ?? null;
  const { data, error, loading, refreshing, refresh } = useAsyncData(
    `admin-tours:${actId ?? 'none'}`,
    async () => (actId ? fetchTours(actId) : []),
    "We couldn't load your tours. Check your connection and try again."
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.orange} colors={[colors.orange]} />}>
        <ScreenHeader title="Tours" subtitle="Targets, follow-ups and what's booked" right={<BackButton fallback={'/more'} />} />
        <RetroStripes height={4} gap={2} style={styles.stripes} />

        {loading && !data ? <StateMessage kind="loading" /> : null}
        {error ? <StateMessage kind="error" title="Static on the line" message={error} actionLabel="Try again" onAction={refresh} /> : null}

        {data && !error ? (
          data.length === 0 ? (
            <StateMessage
              kind="empty"
              title="No tours yet"
              message="Plan a tour on the website: pick the region, find venues and send the pitches. Then follow it here."
              actionLabel="Open Tours on the website"
              onAction={() => void openSafely(`${API_BASE}/tours`)}
            />
          ) : (
            <View style={styles.list}>
              {data.map((t) => (
                <TourCard key={t.id} tour={t} onPress={() => router.push({ pathname: '/more/tour/[id]', params: { id: t.id } })} />
              ))}
            </View>
          )
        ) : null}

        <Pressable
          accessibilityRole="link"
          accessibilityHint="Opens Tours on camelranchbooking.com"
          onPress={() => void openSafely(`${API_BASE}/tours`)}
          style={({ pressed }) => [styles.webLink, pressed && styles.pressed]}>
          <Ionicons name="open-outline" size={18} color={colors.orange} />
          <Text style={styles.webLinkText}>Plan a new tour on the website</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: READABLE_MAX_WIDTH, alignSelf: 'center', backgroundColor: colors.background },
  scroll: { paddingBottom: space['4xl'] },
  stripes: { marginBottom: space.lg },
  pressed: { opacity: 0.8 },
  list: { paddingHorizontal: space.xl, gap: space.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.xs, borderLeftWidth: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  cardName: { ...type.heading, color: colors.cream, flex: 1 },
  cardStatus: { ...type.label, fontSize: 15 },
  cardDates: { ...type.sm, color: colors.textMuted },
  meter: { height: 6, borderRadius: 3, backgroundColor: colors.backgroundDeep, overflow: 'hidden', marginTop: space.xs },
  meterBar: { height: '100%', backgroundColor: colors.orange, borderRadius: 3 },
  cardNums: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs },
  num: { ...type.sm, color: colors.textMuted, flexShrink: 1 },
  numStrong: { ...type.md, color: colors.cream },
  webLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: touchTarget, marginTop: space['2xl'] },
  webLinkText: { ...type.md, color: colors.orange },
});
