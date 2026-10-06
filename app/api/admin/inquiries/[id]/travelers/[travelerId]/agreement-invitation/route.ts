import { and, eq, isNull } from "drizzle-orm";
import { agreementAcceptances, agreementInvitations, bookingRequests, travelers } from "@/db/schema";
import { getDb } from "@/db";
import { requireOwner } from "@/lib/owner-auth";
import { hasValidOrigin } from "@/lib/same-origin";
import { sendAgreementInvitationEmail } from "@/lib/mailersend-transactional";
import {
  buildPersonalizedTravelerAgreement,
  canonicalizeAgreement,
  currentTravelerAgreement,
  hashAgreementDocument,
  hashInvitationToken,
} from "@/lib/traveler-agreement";
import { isPaymentPreference } from "@/lib/payment-preference-invitation";
import { todayInIndiana } from "@/lib/payment-schedule";

const INVITATION_LIFETIME_DAYS = 14;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; travelerId: string }> },
) {
  if (!hasValidOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  if (!(await requireOwner("/admin/inquiries"))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }
  if (!currentTravelerAgreement) {
    return Response.json({
      error: "Agreement invitations remain disabled until the legally approved agreement is activated.",
    }, { status: 409 });
  }

  const { id: rawInquiryId, travelerId: rawTravelerId } = await context.params;
  const inquiryId = Number(rawInquiryId);
  const travelerId = Number(rawTravelerId);
  if (!Number.isInteger(inquiryId) || inquiryId < 1 || !Number.isInteger(travelerId) || travelerId < 1) {
    return Response.json({ error: "Invalid traveler" }, { status: 400 });
  }

  const db = getDb();
  const [traveler] = await db.select({
    id: travelers.id,
    firstName: travelers.firstName,
    lastName: travelers.lastName,
    email: travelers.email,
    travelerType: travelers.travelerType,
    guardianLegalName: travelers.guardianLegalName,
    confirmedTripPriceCents: travelers.confirmedTripPriceCents,
    confirmedOccupancy: travelers.confirmedOccupancy,
  })
    .from(travelers)
    .where(and(
      eq(travelers.id, travelerId),
      eq(travelers.bookingRequestId, inquiryId),
    ))
    .limit(1);
  if (!traveler) return Response.json({ error: "Traveler not found" }, { status: 404 });

  const [inquiry] = await db.select().from(bookingRequests)
    .where(eq(bookingRequests.id, inquiryId))
    .limit(1);
  if (!inquiry) return Response.json({ error: "Inquiry not found" }, { status: 404 });
  if (!inquiry.confirmedBookingTotalCents || !isPaymentPreference(inquiry.paymentPreference) || !inquiry.companyAcceptedAt || !inquiry.companyAcceptedBy) {
    return Response.json({
      error: "Record the confirmed traveler prices and have the primary contact choose a payment option before sending agreement links.",
    }, { status: 409 });
  }
  if (inquiry.squareDepositInvoiceStatus !== "draft" || !inquiry.squareDepositInvoiceId) {
    return Response.json({
      error: "The matching Square draft invoice must be prepared before agreement links are sent.",
    }, { status: 409 });
  }

  const bookingTravelers = await db.select({
    id: travelers.id,
    confirmedTripPriceCents: travelers.confirmedTripPriceCents,
    confirmedOccupancy: travelers.confirmedOccupancy,
  }).from(travelers).where(eq(travelers.bookingRequestId, inquiryId));
  if (bookingTravelers.length !== inquiry.partySize) {
    return Response.json({ error: "The traveler count must exactly match the inquiry party size before agreements are sent." }, { status: 409 });
  }
  if (bookingTravelers.some((record) => !record.confirmedTripPriceCents || record.confirmedTripPriceCents < 1 || (record.confirmedOccupancy !== "shared" && record.confirmedOccupancy !== "private"))) {
    return Response.json({ error: "Save a confirmed Trip Price and occupancy for every traveler before sending agreement links." }, { status: 409 });
  }
  const allocatedTotal = bookingTravelers.reduce((sum, record) => sum + (record.confirmedTripPriceCents ?? 0), 0);
  if (allocatedTotal !== inquiry.confirmedBookingTotalCents) {
    return Response.json({ error: "The individual traveler prices must add up exactly to the confirmed booking total." }, { status: 409 });
  }
  if (!traveler.confirmedTripPriceCents || (traveler.confirmedOccupancy !== "shared" && traveler.confirmedOccupancy !== "private")) {
    return Response.json({ error: "Save this traveler’s confirmed Trip Price and occupancy before sending the agreement." }, { status: 409 });
  }

  const personalizedAgreement = buildPersonalizedTravelerAgreement({
    travelerName: `${traveler.firstName} ${traveler.lastName}`,
    departure: inquiry.departure,
    occupancy: traveler.confirmedOccupancy === "private" ? "Private room supplement" : "Shared double/twin room",
    tripPriceCents: traveler.confirmedTripPriceCents,
    paymentPreference: inquiry.paymentPreference,
    acceptanceDate: todayInIndiana(new Date(inquiry.companyAcceptedAt)),
  });

  const agreementHash = await hashAgreementDocument(personalizedAgreement);
  const [existingAcceptance] = await db.select({ id: agreementAcceptances.id })
    .from(agreementAcceptances)
    .where(and(
      eq(agreementAcceptances.travelerId, travelerId),
      eq(agreementAcceptances.agreementVersion, currentTravelerAgreement.version),
      eq(agreementAcceptances.agreementDocumentHash, agreementHash),
    ))
    .limit(1);
  if (existingAcceptance) {
    return Response.json({ error: "This traveler has already accepted the current agreement." }, { status: 409 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_DAYS * 86_400_000).toISOString();
  const token = createInvitationToken();
  const tokenHash = await hashInvitationToken(token);

  await db.update(agreementInvitations)
    .set({ revokedAt: now.toISOString() })
    .where(and(
      eq(agreementInvitations.travelerId, travelerId),
      isNull(agreementInvitations.acceptedAt),
      isNull(agreementInvitations.revokedAt),
    ));

  const [invitation] = await db.insert(agreementInvitations).values({
    travelerId,
    tokenHash,
    agreementVersion: currentTravelerAgreement.version,
    agreementDocumentHash: agreementHash,
    agreementDocumentJson: canonicalizeAgreement(personalizedAgreement),
    recipientEmail: traveler.email.trim().toLowerCase(),
    expiresAt,
  }).returning({ id: agreementInvitations.id });

  const invitationUrl = new URL(
    `/traveler-agreement/${encodeURIComponent(token)}`,
    request.url,
  ).toString();

  try {
    const delivery = await sendAgreementInvitationEmail({
      toEmail: traveler.email,
      toName: traveler.travelerType === "minor"
        ? traveler.guardianLegalName || `${traveler.firstName} ${traveler.lastName}`
        : `${traveler.firstName} ${traveler.lastName}`,
      travelerName: `${traveler.firstName} ${traveler.lastName}`,
      invitationUrl,
      expiresAt,
    });
    await db.update(agreementInvitations)
      .set({
        invitationEmailSentAt: delivery.sentAt,
        invitationEmailMessageId: delivery.messageId,
      })
      .where(eq(agreementInvitations.id, invitation.id));

    return Response.json({
      sentTo: traveler.email,
      sentAt: delivery.sentAt,
      expiresAt,
    }, { status: 201 });
  } catch (cause) {
    await db.update(agreementInvitations)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(agreementInvitations.id, invitation.id));
    return Response.json({
      error: cause instanceof Error ? cause.message : "The agreement email could not be sent.",
    }, { status: 502 });
  }
}

function createInvitationToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
