import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingRequests } from "@/db/schema";
import { availabilitySummary, countBookedSpots } from "./trip-availability";

export async function getPublicTripAvailability(tripSlug: string, departure: string, capacity: number) {
  try {
    const bookings = await getDb().select({
      partySize: bookingRequests.partySize,
      status: bookingRequests.status,
      squareEnvironment: bookingRequests.squareEnvironment,
      squareDepositInvoiceStatus: bookingRequests.squareDepositInvoiceStatus,
    }).from(bookingRequests).where(and(
      eq(bookingRequests.tripSlug, tripSlug),
      eq(bookingRequests.departure, departure),
      eq(bookingRequests.squareEnvironment, "production"),
    ));
    return availabilitySummary(countBookedSpots(bookings), capacity);
  } catch {
    // An unavailable database is not evidence of zero bookings.
    console.error("Public trip availability could not be loaded.");
    return null;
  }
}
