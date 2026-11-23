export const vietnamDepartures = [
  { tripSlug: "vietnam-southern-charms-central-heritage", departure: "2027-06-01", label: "June 1, 2027", dateRange: "June 1–8, 2027", endDate: "2027-06-08", timing: "june_2027", minimum: 4, capacity: 8 },
  { tripSlug: "vietnam-southern-charms-central-heritage", departure: "2027-12-27", label: "December 27, 2027", dateRange: "December 27, 2027–January 3, 2028", endDate: "2028-01-03", timing: "december_2027", minimum: 4, capacity: 8 },
] as const;
export const vietnamDeparture = vietnamDepartures[0];
export const isVietnamDeparture = (value: string) => vietnamDepartures.some(item => item.departure === value);

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
  return { booked, capacity, remaining, full: remaining === 0 };
}
