import { env } from "cloudflare:workers";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { getSquareBookingEnvironmentError } from "@/lib/square-config";
import { autopayAuthorizations, autopayEvents, bookingRequests } from "@/db/schema";
import { getDb } from "@/db";
import { sendAutopayStoppedEmail } from "@/lib/mailersend-transactional";
import { requireOwner } from "@/lib/owner-auth";
import { hasValidOrigin } from "@/lib/same-origin";
import { getSquareInvoiceVersion, setInvoiceAutopay } from "@/lib/square";

const stopSources = new Set(["customer_email", "owner_decision", "booking_cancelled"]);
const STOP_CLAIM_STALE_MS = 10 * 60_000;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const owner = await requireOwner("/admin/inquiries");
  if (!owner) return Response.json({ error: "Not authorized" }, { status: 403 });

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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }
  const stopSource = "stopSource" in body && typeof body.stopSource === "string" ? body.stopSource : "";
  if (!stopSources.has(stopSource)) {
    return Response.json({ error: "Choose how the automatic-payment stop was requested." }, { status: 400 });
  }

  const db = getDb();
  const [inquiry] = await db.select({ squareEnvironment: bookingRequests.squareEnvironment })
    .from(bookingRequests).where(eq(bookingRequests.id, inquiryId)).limit(1);
  if (!inquiry) return Response.json({ error: "Inquiry not found" }, { status: 404 });
  const environmentError = getSquareBookingEnvironmentError(
    inquiry.squareEnvironment,
    env as unknown as Record<string, string | undefined>,
  );
  if (environmentError) return Response.json({ error: environmentError }, { status: 409 });
  const [record] = await db.select({
    authorizationId: autopayAuthorizations.id,
    authorizationStatus: autopayAuthorizations.status,
    stopRequestedAt: autopayAuthorizations.stopRequestedAt,
    invoiceId: autopayAuthorizations.squareInvoiceId,
    customerEmail: autopayAuthorizations.cardholderEmail,
    customerName: autopayAuthorizations.cardholderName,
  })
    .from(autopayAuthorizations)
    .where(eq(autopayAuthorizations.bookingRequestId, inquiryId))
    .orderBy(desc(autopayAuthorizations.createdAt))
    .limit(1);

  if (!record) return Response.json({ error: "No automatic-payment authorization was found." }, { status: 409 });
  if (record.authorizationStatus === "stopped" || record.authorizationStatus === "cancelled") {
    return Response.json({ status: record.authorizationStatus, alreadyStopped: true });
  }
  if (record.authorizationStatus !== "active") {
    return Response.json({ error: "Automatic payments are not currently active for this inquiry." }, { status: 409 });
  }

  const requestedAt = new Date().toISOString();
  const staleBefore = new Date(Date.now() - STOP_CLAIM_STALE_MS).toISOString();
  const [claimed] = await db.update(autopayAuthorizations).set({
    stopRequestedAt: requestedAt,
    stopSource,
  }).where(and(
    eq(autopayAuthorizations.id, record.authorizationId),
    eq(autopayAuthorizations.status, "active"),
    or(
      isNull(autopayAuthorizations.stopRequestedAt),
      lt(autopayAuthorizations.stopRequestedAt, staleBefore),
    ),
  )).returning({ id: autopayAuthorizations.id });
  if (!claimed) {
    return Response.json({ error: "This stop request is already being processed. Try again after 10 minutes if it does not finish." }, { status: 409 });
  }

  try {
    const invoice = await getSquareInvoiceVersion(record.invoiceId);
    const squareResult = await setInvoiceAutopay({
      invoiceId: record.invoiceId,
      version: invoice.version,
      requestUids: invoice.paymentRequestUids,
      cardId: null,
      idempotencyKey: `cpt-ap-stop-${record.authorizationId}-${invoice.version}`,
    });
    const stoppedAt = new Date().toISOString();
    const finalStatus = stopSource === "booking_cancelled" ? "cancelled" : "stopped";

    await db.update(autopayAuthorizations).set({
      status: finalStatus,
      stoppedAt,
      squareInvoiceVersionAfterEnable: squareResult.version,
    }).where(eq(autopayAuthorizations.id, record.authorizationId));
    await db.update(bookingRequests).set({
      installmentAutopayAuthorized: false,
      installmentAutopayStatus: finalStatus,
      installmentAutopayError: null,
      installmentAutopayClaimedAt: null,
      squareDepositInvoiceVersion: squareResult.version,
      squareDepositInvoiceStatus: squareResult.status,
    }).where(eq(bookingRequests.id, inquiryId));
    await db.insert(autopayEvents).values({
      authorizationId: record.authorizationId,
      eventType: finalStatus === "cancelled" ? "cancelled" : "stopped",
      detail: JSON.stringify({ stopSource, stoppedAt, stoppedBy: owner.email }),
    });

    let emailSent = true;
    try {
      await sendAutopayStoppedEmail({
        toEmail: record.customerEmail,
        toName: record.customerName,
      });
      await db.insert(autopayEvents).values({
        authorizationId: record.authorizationId,
        eventType: "stop_email_sent",
        detail: JSON.stringify({ sentAt: new Date().toISOString() }),
      });
    } catch {
      emailSent = false;
      console.error("Automatic-payment stop email could not be sent", { inquiryId, authorizationId: record.authorizationId });
      await db.insert(autopayEvents).values({
        authorizationId: record.authorizationId,
        eventType: "stop_email_failed",
        detail: JSON.stringify({ code: "delivery_failed" }),
      });
    }

    return Response.json({ status: finalStatus, stoppedAt, emailSent });
  } catch {
    await db.update(autopayAuthorizations).set({
      stopRequestedAt: null,
      stopSource: null,
    }).where(and(
      eq(autopayAuthorizations.id, record.authorizationId),
      eq(autopayAuthorizations.status, "active"),
      eq(autopayAuthorizations.stopRequestedAt, requestedAt),
    ));
    console.error("Automatic-payment stop failed", { inquiryId, authorizationId: record.authorizationId });
    return Response.json({ error: "Automatic payments could not be turned off in Square. Please try again." }, { status: 502 });
  }
}
