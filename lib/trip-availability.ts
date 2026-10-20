export const vietnamDeparture = {
  tripSlug: "vietnam-southern-charms-central-heritage",
  departure: "2027-06-01",
  label: "June 1, 2027",
  capacity: 15,
} as const;

export type AvailabilityBooking = {
  partySize: number;
  status: string;
  squareEnvironment: string;
  squareDepositInvoiceStatus: string;
};

// Reserved is an explicit owner confirmation. A payment also reserves the party.
// Inquiries and sandbox transactions must never create public booking activity.
export function countBookedSpots(bookings: AvailabilityBooking[]) {
  return bookings.reduce((count, booking) => {
    if (booking.squareEnvironment !== "production"
      || !["new", "considering", "booking_in_progress", "reserved", "contacted", "qualified"].includes(booking.status)
      || ["canceled", "refunded", "partially_refunded", "failed"].includes(booking.squareDepositInvoiceStatus)
      || !Number.isSafeInteger(booking.partySize) || booking.partySize < 1) return count;
    const confirmed = booking.status === "reserved"
      || ["paid", "partially_paid"].includes(booking.squareDepositInvoiceStatus);
    return count + (confirmed ? booking.partySize : 0);
  }, 0);
}

export function availabilitySummary(booked: number, capacity: number) {
  const remaining = Math.max(0, capacity - booked);
  const tierTarget = [8, 10, 12, capacity].find((tier) => tier <= capacity && tier > booked) ?? capacity;
  return { booked, capacity, remaining, tierTarget, full: remaining === 0 };
}
