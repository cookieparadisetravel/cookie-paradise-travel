import { and, eq } from "drizzle-orm";
import { bookingRequests, travelers } from "@/db/schema";
import { getDb } from "@/db";
import { requireOwner } from "@/lib/owner-auth";
import { hasValidOrigin } from "@/lib/same-origin";

type PriceInput = { travelerId: number; tripPriceCents: number; occupancy: "shared" | "private" };

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await requireOwner("/admin/inquiries"))) return Response.json({ error: "Not authorized" }, { status: 403 });

  const { id: rawId } = await context.params;
  const inquiryId = Number(rawId);
  if (!Number.isInteger(inquiryId) || inquiryId < 1) {
    return Response.json({ error: "Invalid inquiry" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || !("prices" in body) || !Array.isArray(body.prices)) {
    return Response.json({ error: "Provide one confirmed Trip Price for every traveler." }, { status: 400 });
  }

  const prices: PriceInput[] = [];
  for (const item of body.prices) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return Response.json({ error: "Every traveler price must be valid." }, { status: 400 });
    }
    const travelerId = "travelerId" in item ? item.travelerId : null;
    const tripPriceCents = "tripPriceCents" in item ? item.tripPriceCents : null;
    const occupancy = "occupancy" in item ? item.occupancy : null;
    if (!Number.isInteger(travelerId) || !Number.isSafeInteger(tripPriceCents) || Number(tripPriceCents) < 50_000 || Number(tripPriceCents) > 10_000_000) {
      return Response.json({ error: "Enter a valid Trip Price of at least $500 for every traveler." }, { status: 400 });
    }
    if (occupancy !== "shared" && occupancy !== "private") {
      return Response.json({ error: "Choose shared or private-room occupancy for every traveler." }, { status: 400 });
    }
    prices.push({ travelerId: Number(travelerId), tripPriceCents: Number(tripPriceCents), occupancy });
  }

  const db = getDb();
  const [inquiry] = await db.select({
    partySize: bookingRequests.partySize,
    invoiceId: bookingRequests.squareDepositInvoiceId,
    invoiceStatus: bookingRequests.squareDepositInvoiceStatus,
    confirmedBookingTotalCents: bookingRequests.confirmedBookingTotalCents,
  })
    .from(bookingRequests).where(eq(bookingRequests.id, inquiryId)).limit(1);
  if (!inquiry) return Response.json({ error: "Inquiry not found" }, { status: 404 });

  const records = await db.select({
    id: travelers.id,
    confirmedTripPriceCents: travelers.confirmedTripPriceCents,
  }).from(travelers).where(eq(travelers.bookingRequestId, inquiryId));
  const recordIds = new Set(records.map((traveler) => traveler.id));
  const submittedIds = new Set(prices.map((price) => price.travelerId));
  if (records.length !== inquiry.partySize || prices.length !== records.length || submittedIds.size !== records.length || prices.some((price) => !recordIds.has(price.travelerId))) {
    return Response.json({ error: "The submitted prices must match every traveler on this inquiry exactly once." }, { status: 409 });
  }
  const submittedTotal = prices.reduce((sum, price) => sum + price.tripPriceCents, 0);
  if (inquiry.invoiceId) {
    const legacyDraftCanBeInitialized = inquiry.invoiceStatus === "draft"
      && records.every((traveler) => traveler.confirmedTripPriceCents === null)
      && inquiry.confirmedBookingTotalCents === submittedTotal;
    if (!legacyDraftCanBeInitialized) {
      return Response.json({ error: "Traveler prices cannot be changed after the Square draft invoice is created." }, { status: 409 });
    }
  }

  for (const price of prices) {
    await db.update(travelers).set({ confirmedTripPriceCents: price.tripPriceCents, confirmedOccupancy: price.occupancy }).where(and(
      eq(travelers.id, price.travelerId),
      eq(travelers.bookingRequestId, inquiryId),
    ));
  }

  return Response.json({
    totalCents: submittedTotal,
    prices,
  });
}
