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
  pitch: '#6B7A99',
  followup: '#D6A24C',
  negotiation: '#D6A24C',
  hold: '#D6A24C',
  contract: '#6B8FB5',
  confirmed: '#4E9F5C',
  advancing: '#4E9F5C',
  completed: '#5A6685',
  cancelled: '#E85A5A',
};

export function bookingStatusLabel(status: string): string {
  return STATUS_LABELS[status as BookingStatus] ?? status;
}

export function bookingStatusColor(status: string): string {
  return STATUS_COLORS[status as BookingStatus] ?? '#6B7A99';
}
