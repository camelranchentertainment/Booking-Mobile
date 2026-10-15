import { Pressable, StyleSheet, Text, View } from 'react-native';

import { bookingStatusColor, bookingStatusLabel } from '../lib/bookingStatus';
import type { UpcomingBooking } from '../lib/bookings';
import { formatCardDate } from '../lib/dates';
import type { Rsvp } from '../lib/memberShows';
import { colors, radius, space, touchTarget, type } from '../lib/theme';
import { RsvpPill, StatusPill } from './retro';

const RSVP_EDGE: Record<Rsvp, string> = {
  confirmed: colors.statusConfirmed,
  pending: colors.mustard,
  declined: colors.statusCancelled,
};
const RSVP_SPOKEN: Record<Rsvp, string> = {
  confirmed: "you're in",
  pending: 'your answer is needed',
  declined: "you can't make it",
};

/**
 * One show as a card: status-colored edge, "SAT · NOV 1" date, venue and
 * city, plus a pill. Admins see the booking's pipeline status; members
 * (when `rsvp` is passed) see their own answer instead. Tapping opens the
 * full day sheet.
 */
export function ShowCard({ booking, rsvp, onPress }: { booking: UpcomingBooking; rsvp?: Rsvp; onPress: () => void }) {
  const venue = booking.venue?.name ?? 'Venue TBD';
  const place = [booking.venue?.city, booking.venue?.state].filter(Boolean).join(', ');
  const dateLabel = formatCardDate(booking.showDate);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${venue}, ${dateLabel}${place ? `, ${place}` : ''}, ${rsvp ? RSVP_SPOKEN[rsvp] : bookingStatusLabel(booking.status)}`}
      accessibilityHint="Opens the day sheet"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.edge, { backgroundColor: rsvp ? RSVP_EDGE[rsvp] : bookingStatusColor(booking.status) }]} />
      <View style={styles.main}>
        <Text style={styles.date}>{dateLabel}</Text>
        <Text style={styles.venue} numberOfLines={1}>
          {venue}
        </Text>
        {place ? (
          <Text style={styles.place} numberOfLines={1}>
            {place}
          </Text>
        ) : null}
      </View>
      {rsvp ? <RsvpPill rsvp={rsvp} /> : <StatusPill status={booking.status} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: touchTarget + space.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingRight: space.lg,
    gap: space.md,
    overflow: 'hidden',
  },
  pressed: { backgroundColor: colors.surfaceRaised },
  edge: { width: 6, alignSelf: 'stretch', borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  main: { flex: 1, gap: 2 },
  date: { ...type.label, fontSize: 16, color: colors.mustard },
  venue: { ...type.lg, color: colors.onSurface },
  place: { ...type.sm, color: colors.textMuted },
});
