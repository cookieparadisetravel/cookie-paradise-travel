import { env } from "cloudflare:workers";
import { and, eq, isNull } from "drizzle-orm";
import {
  autopayAuthorizationInvitations,
  autopayAuthorizations,
  autopayEvents,
  bookingRequests,
} from "@/db/schema";
import { getDb } from "@/db";
import { getAgreementReadiness } from "@/lib/agreement-readiness";
import {
  AUTOPAY_AUTHORIZATION_VERSION,
  autopayAvailable,
  buildAutopayAuthorizationText,
} from "@/lib/autopay-authorization";
import { getAutopayAuthorizationInvitation } from "@/lib/autopay-authorization-invitation";
import { activateRecordedAutopayAuthorization } from "@/lib/autopay-authorization-service";
import { hasValidOrigin } from "@/lib/same-origin";
import { autopayScheduleFingerprint, findAutopayCardAndSchedule } from "@/lib/square";
import { currentTravelerAgreement } from "@/lib/traveler-agreement";
import { getSquareBookingEnvironmentError } from "@/lib/square-config";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!hasValidOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const { token } = await context.params;
  let invitation: Awaited<ReturnType<typeof getAutopayAuthorizationInvitation>>;
  try {
    invitation = await getAutopayAuthorizationInvitation(token);
  } catch {
    console.error("Automatic-installment authorization schedule lookup failed");
    return Response.json({ error: "The Square schedule is temporarily unavailable. Please try again in a few minutes." }, { status: 502 });
  }
  if (invitation.status === "environment_mismatch") return Response.json({ error: invitation.message }, { status: 409 });
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
  const action = "action" in body && body.action === "decline" ? "decline" : "authorize";
  const authorized = "authorized" in body && body.authorized === true;
  const payerName = "payerName" in body && typeof body.payerName === "string" ? body.payerName.trim() : "";
  const submittedFingerprint = "scheduleFingerprint" in body && typeof body.scheduleFingerprint === "string"
    ? body.scheduleFingerprint.trim().toLowerCase()
    : "";

  if (action === "decline") return recordManualChoice(readyInvitation);
  if (!authorized) return Response.json({ error: "Review the schedule and check the authorization box before continuing." }, { status: 400 });
  if (payerName.length < 2 || payerName.length > 120) return Response.json({ error: "Enter the cardholder's full legal name." }, { status: 400 });
  if (!/^[a-f0-9]{64}$/u.test(submittedFingerprint)) return Response.json({ error: "The payment schedule could not be verified. Please reload the page." }, { status: 400 });

  const runtime = env as unknown as Record<string, string | undefined>;
  const ipHashKey = runtime.ACCEPTANCE_IP_HASH_KEY?.trim();
  if (!ipHashKey) {
    return Response.json({ error: "Electronic authorization verification is temporarily unavailable." }, { status: 503 });
  }

  const db = getDb();
  const [bookingSnapshot] = await db.select({
    id: bookingRequests.id,
    squareEnvironment: bookingRequests.squareEnvironment,
    partySize: bookingRequests.partySize,
    paymentPreference: bookingRequests.paymentPreference,
    squareCustomerId: bookingRequests.squareCustomerId,
    squareOrderId: bookingRequests.squareDepositOrderId,
    squareInvoiceId: bookingRequests.squareDepositInvoiceId,
  }).from(bookingRequests).where(eq(bookingRequests.id, readyInvitation.bookingRequestId)).limit(1);
  if (!bookingSnapshot || bookingSnapshot.paymentPreference !== "payment_plan") {
    return Response.json({ error: "This booking is not eligible for automatic installments." }, { status: 409 });
  }
  const environmentError = getSquareBookingEnvironmentError(bookingSnapshot.squareEnvironment, runtime);
  if (environmentError) return Response.json({ error: environmentError }, { status: 409 });

  const agreementReadiness = await getAgreementReadiness(bookingSnapshot.id, bookingSnapshot.partySize);
  if (!autopayAvailable(agreementReadiness)) {
    return Response.json({ error: "Every traveler must accept the current agreement before automatic installments can be authorized." }, { status: 409 });
  }
  if (!bookingSnapshot.squareCustomerId || !bookingSnapshot.squareOrderId || !bookingSnapshot.squareInvoiceId) {
    return Response.json({ error: "The Square invoice information is incomplete. Please contact Cookie Paradise Travel Company." }, { status: 409 });
  }

  const consentedAt = new Date().toISOString();
  const [claimed] = await db.update(autopayAuthorizationInvitations).set({ completedAt: consentedAt }).where(and(
    eq(autopayAuthorizationInvitations.id, readyInvitation.invitationId),
    isNull(autopayAuthorizationInvitations.completedAt),
    isNull(autopayAuthorizationInvitations.revokedAt),
  )).returning({ id: autopayAuthorizationInvitations.id });
  if (!claimed) return Response.json({ error: "This automatic-payment authorization has already been submitted." }, { status: 409 });

  async function releaseClaim() {
    await db.update(autopayAuthorizationInvitations).set({ completedAt: null }).where(and(
      eq(autopayAuthorizationInvitations.id, readyInvitation.invitationId),
      eq(autopayAuthorizationInvitations.completedAt, consentedAt),
      isNull(autopayAuthorizationInvitations.revokedAt),
    ));
  }

  await db.update(bookingRequests).set({
    installmentAutopayAuthorized: false,
    installmentAutopayAuthorizedAt: null,
    installmentAutopayPayerName: payerName,
    installmentAutopayStatus: "activating",
    installmentAutopayError: null,
    installmentAutopayClaimedAt: consentedAt,
  }).where(eq(bookingRequests.id, bookingSnapshot.id));

  let readiness;
  try {
    readiness = await findAutopayCardAndSchedule({
      customerId: bookingSnapshot.squareCustomerId,
      orderId: bookingSnapshot.squareOrderId,
      invoiceId: bookingSnapshot.squareInvoiceId,
    });
  } catch {
    await releaseClaim();
    await resetForRetry(bookingSnapshot.id, "The Square schedule is temporarily unavailable.");
    return Response.json({ error: "The Square schedule is temporarily unavailable. Please try again in a few minutes." }, { status: 502 });
  }
  if (readiness.status !== "ready" || !readiness.cardBrand || !readiness.cardLast4) {
    await releaseClaim();
    const message = readiness.status === "ready"
      ? "No saved card was found, so your installments stay manual."
      : readiness.message;
    await db.update(bookingRequests).set({
      installmentAutopayStatus: readiness.status === "ready" ? "card_not_saved" : readiness.status,
      installmentAutopayError: message,
      installmentAutopayClaimedAt: null,
    }).where(eq(bookingRequests.id, bookingSnapshot.id));
    return Response.json({ error: message }, { status: 409 });
  }

  const currentFingerprint = await autopayScheduleFingerprint(readiness.cardId, readiness.requests);
  if (currentFingerprint !== submittedFingerprint) {
    await releaseClaim();
    await resetForRetry(bookingSnapshot.id, null);
    return Response.json({ error: "Your payment schedule changed. Please reload the page." }, { status: 409 });
  }

  const totalCents = readiness.requests.reduce((sum, payment) => sum + payment.amountCents, 0);
  const finalDueDate = readiness.requests.reduce(
    (latest, payment) => payment.dueDate > latest ? payment.dueDate : latest,
    "",
  );
  const authorizationText = buildAutopayAuthorizationText({
    cardholderName: payerName,
    cardBrand: readiness.cardBrand,
    last4: readiness.cardLast4,
    paymentCount: readiness.requests.length,
    totalCents,
    finalDueDate,
  });
  const ipAddress = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unavailable";
  const ipHash = await hashIpAddress(ipAddress, ipHashKey);
  const userAgent = (request.headers.get("user-agent") || "unavailable").slice(0, 512);

  let authorizationId: number | null = null;
  try {
    const [authorization] = await db.insert(autopayAuthorizations).values({
      bookingRequestId: bookingSnapshot.id,
      invitationId: readyInvitation.invitationId,
      status: "saving",
      cardholderName: payerName,
      cardholderEmail: readyInvitation.recipientEmail.trim().toLowerCase(),
      consentedAt,
      consentedAtLocal: formatIndianaTimestamp(consentedAt),
      ipHash,
      userAgent,
      agreementVersion: currentTravelerAgreement.version,
      authorizationVersion: AUTOPAY_AUTHORIZATION_VERSION,
      authorizationText,
      squareCustomerId: bookingSnapshot.squareCustomerId,
      squareCardId: readiness.cardId,
      cardBrand: readiness.cardBrand,
      cardLast4: readiness.cardLast4,
      squareInvoiceId: bookingSnapshot.squareInvoiceId,
      scheduleSnapshot: JSON.stringify(readiness.requests),
      totalCents,
      finalDueDate,
    }).returning({ id: autopayAuthorizations.id });
    if (!authorization) throw new Error("Authorization record was not returned.");
    authorizationId = authorization.id;
    await db.insert(autopayEvents).values({
      authorizationId,
      eventType: "enable_requested",
      detail: JSON.stringify({ paymentCount: readiness.requests.length, totalCents }),
    });
  } catch {
    console.error("Automatic-installment evidence record could not be completed", { inquiryId: bookingSnapshot.id });
    if (!authorizationId) {
      await releaseClaim();
      await resetForRetry(bookingSnapshot.id, "The authorization record could not be saved.");
    }
    return Response.json({ error: "We couldn't save your authorization right now. Please try again in a few minutes." }, { status: 500 });
  }

  const result = await activateRecordedAutopayAuthorization(authorizationId);
  return result.ok
    ? Response.json(result, { status: 201 })
    : Response.json({ error: result.error, completedAt: result.completedAt, status: result.status }, { status: 502 });
}

async function recordManualChoice(
  invitation: Extract<Awaited<ReturnType<typeof getAutopayAuthorizationInvitation>>, { status: "ready" }>,
) {
  const completedAt = new Date().toISOString();
  const [claimed] = await getDb().update(autopayAuthorizationInvitations).set({ completedAt }).where(and(
    eq(autopayAuthorizationInvitations.id, invitation.invitationId),
    isNull(autopayAuthorizationInvitations.completedAt),
    isNull(autopayAuthorizationInvitations.revokedAt),
  )).returning({ id: autopayAuthorizationInvitations.id });
  if (!claimed) return Response.json({ error: "This automatic-payment authorization has already been submitted." }, { status: 409 });
  await getDb().update(bookingRequests).set({
    installmentAutopayAuthorized: false,
    installmentAutopayAuthorizedAt: null,
    installmentAutopayPayerName: null,
    installmentAutopayStatus: "manual_selected",
    installmentAutopayCardBrand: null,
    installmentAutopayCardLast4: null,
    installmentAutopayError: null,
    installmentAutopayClaimedAt: null,
  }).where(eq(bookingRequests.id, invitation.bookingRequestId));
  return Response.json({ completedAt, status: "manual" }, { status: 201 });
}

async function resetForRetry(bookingRequestId: number, message: string | null) {
  await getDb().update(bookingRequests).set({
    installmentAutopayStatus: "authorization_sent",
    installmentAutopayError: message,
    installmentAutopayClaimedAt: null,
  }).where(eq(bookingRequests.id, bookingRequestId));
}

async function hashIpAddress(ipAddress: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ipAddress));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatIndianaTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "long",
    timeZone: "America/Indiana/Indianapolis",
  }).format(new Date(value));
}
