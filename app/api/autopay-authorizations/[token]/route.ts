import { and, eq, isNull } from "drizzle-orm";
import { autopayAuthorizationInvitations, bookingRequests } from "@/db/schema";
import { getDb } from "@/db";
import { getAutopayAuthorizationInvitation } from "@/lib/autopay-authorization-invitation";
import { hasValidOrigin } from "@/lib/same-origin";
import { activateSquareInvoiceAutopay } from "@/lib/square";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!hasValidOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const { token } = await context.params;
  let invitation: Awaited<ReturnType<typeof getAutopayAuthorizationInvitation>>;
  try {
    invitation = await getAutopayAuthorizationInvitation(token);
  } catch (error) {
    console.error("Automatic-installment authorization could not load the Square schedule", error);
    return Response.json({ error: "The Square schedule is temporarily unavailable. Please try again in a few minutes." }, { status: 502 });
  }
  if (invitation.status === "completed") return Response.json({ error: "This automatic-payment authorization has already been submitted." }, { status: 409 });
  if (invitation.status !== "ready") {
    return Response.json({ error: "This automatic-payment authorization link is invalid, expired or unavailable." }, { status: invitation.status === "expired" ? 410 : 404 });
  }
  const readyInvitation = invitation;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  const authorized = "authorized" in body && body.authorized === true;
  const payerName = "payerName" in body && typeof body.payerName === "string" ? body.payerName.trim() : "";
  if (!authorized) return Response.json({ error: "Review the schedule and check the authorization box before continuing." }, { status: 400 });
  if (payerName.length < 2 || payerName.length > 120) return Response.json({ error: "Enter the cardholder's full legal name." }, { status: 400 });

  const db = getDb();
  const completedAt = new Date().toISOString();
  const [claimed] = await db.update(autopayAuthorizationInvitations).set({ completedAt }).where(and(
    eq(autopayAuthorizationInvitations.id, readyInvitation.invitationId),
    isNull(autopayAuthorizationInvitations.completedAt),
    isNull(autopayAuthorizationInvitations.revokedAt),
  )).returning({ id: autopayAuthorizationInvitations.id });
  if (!claimed) return Response.json({ error: "This automatic-payment authorization has already been submitted." }, { status: 409 });

  async function releaseClaim() {
    await db.update(autopayAuthorizationInvitations).set({ completedAt: null }).where(and(
      eq(autopayAuthorizationInvitations.id, readyInvitation.invitationId),
      eq(autopayAuthorizationInvitations.completedAt, completedAt),
      isNull(autopayAuthorizationInvitations.revokedAt),
    ));
  }

  const [booking] = await db.update(bookingRequests).set({
    installmentAutopayAuthorized: true,
    installmentAutopayAuthorizedAt: completedAt,
    installmentAutopayPayerName: payerName,
    installmentAutopayStatus: "activating",
    installmentAutopayError: null,
  }).where(and(
    eq(bookingRequests.id, readyInvitation.bookingRequestId),
    eq(bookingRequests.paymentPreference, "payment_plan"),
  )).returning({
    id: bookingRequests.id,
    squareCustomerId: bookingRequests.squareCustomerId,
    squareOrderId: bookingRequests.squareDepositOrderId,
    squareInvoiceId: bookingRequests.squareDepositInvoiceId,
  });
  if (!booking?.squareCustomerId || !booking.squareOrderId || !booking.squareInvoiceId) {
    await releaseClaim();
    return Response.json({ error: "The Square invoice information is incomplete. Please contact Cookie Paradise Travel Company." }, { status: 409 });
  }

  try {
    const result = await activateSquareInvoiceAutopay({
      inquiryId: booking.id,
      invoiceId: booking.squareInvoiceId,
      orderId: booking.squareOrderId,
      customerId: booking.squareCustomerId,
    });
    if (result.status !== "active") {
      await db.update(bookingRequests).set({ installmentAutopayStatus: result.status, installmentAutopayError: result.message }).where(eq(bookingRequests.id, booking.id));
      await releaseClaim();
      return Response.json({ error: result.message }, { status: 409 });
    }
    await db.update(bookingRequests).set({
      installmentAutopayStatus: "active",
      installmentAutopayCardBrand: result.cardBrand,
      installmentAutopayCardLast4: result.cardLast4,
      installmentAutopayError: null,
      squareDepositInvoiceVersion: result.invoiceVersion,
      squareDepositInvoiceStatus: result.invoiceStatus,
    }).where(eq(bookingRequests.id, booking.id));
    return Response.json({ completedAt, status: "active" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Square could not enable automatic installments.";
    console.error("Post-deposit automatic-installment activation failed", { inquiryId: booking.id, error: message });
    await db.update(bookingRequests).set({ installmentAutopayStatus: "error", installmentAutopayError: message }).where(eq(bookingRequests.id, booking.id));
    await releaseClaim();
    return Response.json({ error: "Square could not enable automatic installments. Please try again or continue paying manually." }, { status: 502 });
  }
}
