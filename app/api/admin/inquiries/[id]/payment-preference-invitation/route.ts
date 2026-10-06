import { and, eq, isNull } from "drizzle-orm";
import { bookingRequests, paymentPreferenceInvitations, travelers } from "@/db/schema";
import { getDb } from "@/db";
import { requireOwner } from "@/lib/owner-auth";
import { createPaymentPlan, todayInIndiana } from "@/lib/payment-schedule";
import { getAgreementReadiness } from "@/lib/agreement-readiness";
import { hasValidOrigin } from "@/lib/same-origin";
import { hashInvitationToken } from "@/lib/traveler-agreement";
import { calculateExpectedBookingTotalCents, isPublishedPerTravelerPriceCents } from "@/lib/trip-pricing";

const INVITATION_LIFETIME_DAYS = 7;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const owner = await requireOwner("/admin/inquiries");
  if (!owner) return Response.json({ error: "Not authorized" }, { status: 403 });

  const { id: rawId } = await context.params;
  const bookingRequestId = Number(rawId);
  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return Response.json({ error: "Invalid inquiry" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  const bookingTotalDollars = "bookingTotalDollars" in body && typeof body.bookingTotalDollars === "number"
    ? body.bookingTotalDollars
    : NaN;
  if (!Number.isFinite(bookingTotalDollars) || bookingTotalDollars <= 0 || bookingTotalDollars > 100_000) {
    return Response.json({ error: "Enter the confirmed total booking price before creating the secure link." }, { status: 400 });
  }
  const bookingTotalCents = Math.round(bookingTotalDollars * 100);
  const perTravelerPriceCents = "perTravelerPriceCents" in body && typeof body.perTravelerPriceCents === "number"
    ? body.perTravelerPriceCents
    : NaN;
  const privateRoomCount = "privateRoomCount" in body && typeof body.privateRoomCount === "number"
    ? body.privateRoomCount
    : NaN;
  const priceMismatchConfirmed = "priceMismatchConfirmed" in body && body.priceMismatchConfirmed === true;
  if (!Number.isInteger(perTravelerPriceCents) || !isPublishedPerTravelerPriceCents(perTravelerPriceCents)) {
    return Response.json({ error: "Choose one of the published per-traveler prices for the accuracy check." }, { status: 400 });
  }

  const db = getDb();
  const [inquiry] = await db.select().from(bookingRequests)
    .where(eq(bookingRequests.id, bookingRequestId))
    .limit(1);
  if (!inquiry) return Response.json({ error: "Inquiry not found" }, { status: 404 });
  if (inquiry.squareDepositInvoiceId) {
    return Response.json({ error: "A Square invoice already exists, so the payment preference can no longer be changed here." }, { status: 409 });
  }
  if (inquiry.departure === "flexible") {
    return Response.json({ error: "Assign a specific departure before requesting a payment preference." }, { status: 400 });
  }
  const agreementReadiness = await getAgreementReadiness(bookingRequestId, inquiry.partySize);
  if (!agreementReadiness.readyForInvoice) {
    return Response.json({
      error: `The payment-choice link is locked. ${agreementReadiness.message}`,
    }, { status: 409 });
  }

  let expectedBookingTotalCents: number;
  try {
    expectedBookingTotalCents = calculateExpectedBookingTotalCents({
      partySize: inquiry.partySize,
      perTravelerPriceCents,
      privateRoomCount,
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "The price accuracy check could not be calculated.",
    }, { status: 400 });
  }
  if (bookingTotalCents !== expectedBookingTotalCents && !priceMismatchConfirmed) {
    return Response.json({
      error: `The entered booking total (${formatMoney(bookingTotalCents)}) does not match the checked price (${formatMoney(expectedBookingTotalCents)}). Review the difference and confirm it before creating the secure link.`,
    }, { status: 409 });
  }

  const bookingTravelers = await db.select({
    confirmedTripPriceCents: travelers.confirmedTripPriceCents,
    confirmedOccupancy: travelers.confirmedOccupancy,
  }).from(travelers).where(eq(travelers.bookingRequestId, bookingRequestId));
  if (bookingTravelers.length !== inquiry.partySize) {
    return Response.json({ error: "Enter exactly one traveler record for each person before creating the payment-choice link." }, { status: 409 });
  }
  if (bookingTravelers.some((traveler) => !traveler.confirmedTripPriceCents || traveler.confirmedTripPriceCents < 1 || (traveler.confirmedOccupancy !== "shared" && traveler.confirmedOccupancy !== "private"))) {
    return Response.json({ error: "Save a confirmed Trip Price and occupancy for every traveler before creating the payment-choice link." }, { status: 409 });
  }
  const allocatedTotal = bookingTravelers.reduce((sum, traveler) => sum + (traveler.confirmedTripPriceCents ?? 0), 0);
  if (allocatedTotal !== bookingTotalCents) {
    return Response.json({ error: `The individual traveler prices total ${formatMoney(allocatedTotal)}, but the confirmed booking total is ${formatMoney(bookingTotalCents)}.` }, { status: 409 });
  }

  try {
    createPaymentPlan({
      bookingTotalCents,
      partySize: inquiry.partySize,
      departure: inquiry.departure,
      acceptanceDate: todayInIndiana(),
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "The payment schedule could not be calculated.",
    }, { status: 400 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_DAYS * 86_400_000).toISOString();
  const token = createInvitationToken();
  const tokenHash = await hashInvitationToken(token);

  await db.update(paymentPreferenceInvitations).set({ revokedAt: now.toISOString() }).where(and(
    eq(paymentPreferenceInvitations.bookingRequestId, bookingRequestId),
    isNull(paymentPreferenceInvitations.completedAt),
    isNull(paymentPreferenceInvitations.revokedAt),
  ));
  await db.update(bookingRequests).set({
    confirmedBookingTotalCents: bookingTotalCents,
    paymentPreference: null,
    paymentPreferenceSelectedAt: null,
  }).where(eq(bookingRequests.id, bookingRequestId));
  const createdAt = now.toISOString();
  const [createdInvitation] = await db.insert(paymentPreferenceInvitations).values({
    bookingRequestId,
    tokenHash,
    createdBy: owner.email,
    expiresAt,
    createdAt,
  }).returning({ id: paymentPreferenceInvitations.id });
  if (!createdInvitation) {
    return Response.json({ error: "The payment-choice invitation could not be saved." }, { status: 500 });
  }

  const invitationUrl = new URL(`/payment-preference/${encodeURIComponent(token)}`, request.url).toString();
  return Response.json({
    invitationUrl,
    invitationId: createdInvitation.id,
    createdAt,
    expiresAt,
    primaryContactName: inquiry.fullName,
    primaryContactEmail: inquiry.email,
    bookingTotalCents,
  }, { status: 201 });
}

function createInvitationToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
