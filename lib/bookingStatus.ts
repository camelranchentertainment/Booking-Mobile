import { colors } from './theme';

/** All values of the Postgres `booking_status` enum, in their natural pipeline order. */
export const BOOKING_STATUSES = [
  'pitch',
  'followup',
  'negotiation',
  'hold',
  'contract',
  'confirmed',
  'advancing',
  'completed',
  'cancelled',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

const STATUS_LABELS: Record<BookingStatus, string> = {
  pitch: 'Pitched',
  followup: 'Follow-up',
  negotiation: 'Negotiating',
  hold: 'On Hold',
  contract: 'Contract Out',
  confirmed: 'Confirmed',
  advancing: 'Advancing',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<BookingStatus, string> = {
  pitch: colors.statusPitch,
  followup: colors.statusPitch,
  negotiation: colors.statusNegotiating,
  hold: colors.statusHold,
  contract: colors.statusContract,
  confirmed: colors.statusConfirmed,
  advancing: colors.statusConfirmed,
  completed: colors.statusDone,
  cancelled: colors.statusCancelled,
};

export function bookingStatusLabel(status: string): string {
  return STATUS_LABELS[status as BookingStatus] ?? status;
}

export function bookingStatusColor(status: string): string {
  return STATUS_COLORS[status as BookingStatus] ?? colors.statusDone;
}
