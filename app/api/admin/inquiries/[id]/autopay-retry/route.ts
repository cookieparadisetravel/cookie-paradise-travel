import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import {
  autopayAuthorizationInvitations,
  autopayAuthorizations,
  bookingRequests,
} from "@/db/schema";
import { getDb } from "@/db";
import { createAutopayAuthorizationToken } from "@/lib/autopay-authorization-invitation";
import { activateRecordedAutopayAuthorization } from "@/lib/autopay-authorization-service";
import { sendAutopayAuthorizationInvitationEmail } from "@/lib/mailersend-transactional";
import { requireOwner } from "@/lib/owner-auth";
import { hasValidOrigin } from "@/lib/same-origin";
import { findAutopayCardAndSchedule } from "@/lib/square";
import { hashInvitationToken } from "@/lib/traveler-agreement";

const STALE_AFTER_MS = 10 * 60_000;
const INVITATION_LIFETIME_MS = 14 * 86_400_000;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const owner = await requireOwner("/admin/inquiries");
  if (!owner) return Response.json({ error: "Not authorized" }, { status: 403 });

  const { id: rawId } = await context.params;
  const inquiryId = Number(rawId);
  if (!Number.isInteger(inquiryId) || inquiryId < 1) return Response.json({ error: "Invalid inquiry" }, { status: 400 });

  const db = getDb();
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const retryClaimedAt = new Date().toISOString();
  const [booking] = await db.update(bookingRequests).set({ installmentAutopayClaimedAt: retryClaimedAt }).where(and(
    eq(bookingRequests.id, inquiryId),
    or(
      eq(bookingRequests.installmentAutopayStatus, "authorization_sending"),
      eq(bookingRequests.installmentAutopayStatus, "activating"),
    ),
    or(
      isNull(bookingRequests.installmentAutopayClaimedAt),
      lt(bookingRequests.installmentAutopayClaimedAt, staleBefore),
    ),
  )).returning({
    id: bookingRequests.id,
    status: bookingRequests.installmentAutopayStatus,
    fullName: bookingRequests.fullName,
    email: bookingRequests.email,
    squareCustomerId: bookingRequests.squareCustomerId,
    squareOrderId: bookingRequests.squareDepositOrderId,
    squareInvoiceId: bookingRequests.squareDepositInvoiceId,
  });
  if (!booking) return Response.json({ error: "This automatic-installment operation is no longer stale or has already been retried." }, { status: 409 });

  if (booking.status === "authorization_sending") {
    return retryInvitationEmail(request.url, booking, retryClaimedAt);
  }

  const [authorization] = await db.select({ id: autopayAuthorizations.id })
    .from(autopayAuthorizations)
    .where(and(
      eq(autopayAuthorizations.bookingRequestId, inquiryId),
      eq(autopayAuthorizations.status, "saving"),
    ))
    .orderBy(desc(autopayAuthorizations.createdAt))
    .limit(1);
  if (!authorization) {
    await db.update(bookingRequests).set({
      installmentAutopayStatus: "error",
      installmentAutopayError: "No saved authorization record was found for recovery.",
      installmentAutopayClaimedAt: null,
    }).where(and(
      eq(bookingRequests.id, inquiryId),
      eq(bookingRequests.installmentAutopayClaimedAt, retryClaimedAt),
    ));
    return Response.json({ error: "No saved authorization record was found for recovery." }, { status: 409 });
  }

  const result = await activateRecordedAutopayAuthorization(authorization.id);
  return result.ok
    ? Response.json(result)
    : Response.json({ error: result.error, status: result.status }, { status: 502 });
}

async function retryInvitationEmail(
  requestUrl: string,
  booking: {
    id: number;
    fullName: string;
    email: string;
    squareCustomerId: string | null;
    squareOrderId: string | null;
    squareInvoiceId: string | null;
  },
  retryClaimedAt: string,
) {
  const db = getDb();
  if (!booking.squareCustomerId || !booking.squareOrderId || !booking.squareInvoiceId) {
    await finishInvitationRetry(booking.id, retryClaimedAt, "error", "The Square invoice information is incomplete.");
    return Response.json({ error: "The Square invoice information is incomplete." }, { status: 409 });
  }

  try {
    const readiness = await findAutopayCardAndSchedule({
      customerId: booking.squareCustomerId,
      orderId: booking.squareOrderId,
      invoiceId: booking.squareInvoiceId,
    });
    if (readiness.status !== "ready") {
      await finishInvitationRetry(booking.id, retryClaimedAt, readiness.status, readiness.message);
      return Response.json({ error: readiness.message }, { status: 409 });
    }

    const token = createAutopayAuthorizationToken();
    const tokenHash = await hashInvitationToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS).toISOString();
    await db.update(autopayAuthorizationInvitations).set({ revokedAt: now.toISOString() }).where(and(
      eq(autopayAuthorizationInvitations.bookingRequestId, booking.id),
      isNull(autopayAuthorizationInvitations.completedAt),
      isNull(autopayAuthorizationInvitations.revokedAt),
    ));
    const [invitation] = await db.insert(autopayAuthorizationInvitations).values({
      bookingRequestId: booking.id,
      tokenHash,
      recipientEmail: booking.email.trim().toLowerCase(),
      expiresAt,
      createdAt: now.toISOString(),
    }).returning({ id: autopayAuthorizationInvitations.id });
    if (!invitation) throw new Error("Invitation record was not returned.");

    const authorizationUrl = new URL(`/autopay-authorization/${encodeURIComponent(token)}`, requestUrl).toString();
    const delivery = await sendAutopayAuthorizationInvitationEmail({
      toEmail: booking.email,
      toName: booking.fullName,
      authorizationUrl,
      expiresAt,
    });
    await db.update(autopayAuthorizationInvitations).set({
      invitationEmailSentAt: delivery.sentAt,
      invitationEmailMessageId: delivery.messageId,
    }).where(eq(autopayAuthorizationInvitations.id, invitation.id));
    await finishInvitationRetry(booking.id, retryClaimedAt, "authorization_sent", null);
    return Response.json({ status: "authorization_sent", sentAt: delivery.sentAt });
  } catch {
    console.error("Automatic-installment invitation recovery failed", { inquiryId: booking.id });
    await finishInvitationRetry(booking.id, retryClaimedAt, "error", "The optional automatic-installment authorization email could not be sent.");
    return Response.json({ error: "The authorization email could not be sent. Please try again." }, { status: 502 });
  }
}

async function finishInvitationRetry(
  inquiryId: number,
  retryClaimedAt: string,
  status: string,
  error: string | null,
) {
  await getDb().update(bookingRequests).set({
    installmentAutopayStatus: status,
    installmentAutopayError: error,
    installmentAutopayClaimedAt: null,
  }).where(and(
    eq(bookingRequests.id, inquiryId),
    eq(bookingRequests.installmentAutopayClaimedAt, retryClaimedAt),
  ));
}
