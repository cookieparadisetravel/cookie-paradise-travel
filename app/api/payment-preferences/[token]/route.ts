import { and, eq, isNull, or, sql } from "drizzle-orm";
import { bookingRequests, paymentPreferenceInvitations } from "@/db/schema";
import { getDb } from "@/db";
import { createBookingInvoice } from "@/lib/booking-invoice";
import { sendOwnerPaymentPreferenceNotification } from "@/lib/owner-notification";
import { getPaymentPreferenceInvitation, isPaymentPreference } from "@/lib/payment-preference-invitation";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const invitation = await getPaymentPreferenceInvitation(token);
  if (invitation.status === "completed") {
    return Response.json({ error: "This payment preference has already been submitted." }, { status: 409 });
  }
  if (invitation.status !== "ready") {
    return Response.json({ error: "This payment-preference link is invalid, expired or unavailable." }, { status: invitation.status === "expired" ? 410 : 404 });
  }
  const invitationId = invitation.invitationId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  const paymentPreference = "paymentPreference" in body ? body.paymentPreference : null;
  if (!isPaymentPreference(paymentPreference)) {
    return Response.json({ error: "Choose a payment option before continuing." }, { status: 400 });
  }
  if (invitation.fullPaymentRequired && paymentPreference !== "full") {
    return Response.json({ error: "This booking is within 90 days of departure and requires full payment." }, { status: 400 });
  }

  const db = getDb();
  const completedAt = new Date().toISOString();
  const claimedInvitations = await db.update(paymentPreferenceInvitations).set({ completedAt }).where(and(
    eq(paymentPreferenceInvitations.id, invitationId),
    isNull(paymentPreferenceInvitations.completedAt),
    isNull(paymentPreferenceInvitations.revokedAt),
  )).returning({ id: paymentPreferenceInvitations.id });
  if (claimedInvitations.length === 0) {
    return Response.json({ error: "This payment preference has already been submitted." }, { status: 409 });
  }

  async function releaseClaim() {
    await db.update(paymentPreferenceInvitations).set({ completedAt: null }).where(and(
      eq(paymentPreferenceInvitations.id, invitationId),
      eq(paymentPreferenceInvitations.completedAt, completedAt),
      isNull(paymentPreferenceInvitations.revokedAt),
    ));
  }

  try {
    const updated = await db.update(bookingRequests).set({
      paymentPreference,
      paymentPreferenceSelectedAt: completedAt,
      companyAcceptedAt: sql`coalesce(${bookingRequests.companyAcceptedAt}, ${completedAt})`,
      companyAcceptedBy: sql`coalesce(${bookingRequests.companyAcceptedBy}, ${invitation.createdBy ?? "Secure payment-choice link"})`,
    }).where(and(
      eq(bookingRequests.id, invitation.bookingRequestId),
      eq(bookingRequests.confirmedBookingTotalCents, invitation.bookingTotalCents),
      or(
        isNull(bookingRequests.squareDepositInvoiceId),
        eq(bookingRequests.paymentPreference, paymentPreference),
      ),
    )).returning({ id: bookingRequests.id });
    if (updated.length === 0) {
      await releaseClaim();
      return Response.json({ error: "The booking changed before this preference was saved. Please request a new secure link." }, { status: 409 });
    }
  } catch {
    try {
      await releaseClaim();
    } catch {
      return Response.json({ error: "Your preference could not be saved, and the secure link could not be restored. Please contact Cookie Paradise Travel Company for a new link." }, { status: 500 });
    }
    return Response.json({ error: "Your payment preference could not be saved. Please try again." }, { status: 500 });
  }

  const invoiceResult = await createBookingInvoice({
    inquiryId: invitation.bookingRequestId,
    acceptedBy: invitation.createdBy ?? "Secure payment-choice link",
    publish: false,
  });
  if (!invoiceResult.ok) {
    try {
      await releaseClaim();
    } catch {
      return Response.json({ error: "Your preference was saved, but the Square draft could not be prepared and the secure link could not be restored. Please contact Cookie Paradise Travel Company." }, { status: 500 });
    }
    return Response.json({
      error: invoiceResult.error,
    }, { status: invoiceResult.status });
  }

  const ownerNotificationStatus = await sendOwnerPaymentPreferenceNotification({
    inquiryId: invitation.bookingRequestId,
    primaryContactName: invitation.primaryContactName,
    departure: invitation.departure,
    bookingTotalCents: invitation.bookingTotalCents,
    paymentPreference,
  });
  if (ownerNotificationStatus === "error") {
    console.error("Payment preference was saved, but the owner notification could not be delivered", {
      bookingRequestId: invitation.bookingRequestId,
      invitationId,
    });
  }

  return Response.json({ completedAt, paymentPreference }, { status: 201 });
}
