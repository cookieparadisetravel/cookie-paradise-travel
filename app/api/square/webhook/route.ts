import { env } from "cloudflare:workers";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { getDb } from "@/db";
import {
  autopayAuthorizationInvitations,
  autopayAuthorizations,
  autopayEvents,
  bookingRequests,
} from "@/db/schema";
import { createAutopayAuthorizationToken } from "@/lib/autopay-authorization-invitation";
import { sendAutopayAuthorizationInvitationEmail, sendTravelInsuranceReferralEmail } from "@/lib/mailersend-transactional";
import { findAutopayCardAndSchedule } from "@/lib/square";
import { getSquareWebhookValues } from "@/lib/square-config";
import { hashInvitationToken } from "@/lib/traveler-agreement";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hasValidSignature(
  signature: string,
  rawBody: string,
  notificationUrl: string,
  signatureKey: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(notificationUrl + rawBody),
    ),
  );
  const received = decodeBase64(signature);

  if (!received || received.length !== expected.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected[index] ^ received[index];
  }

  return mismatch === 0;
}

function getInvoice(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return null;
  }

  const object = payload.data.object;
  if (!isRecord(object) || !isRecord(object.invoice)) {
    return null;
  }

  return object.invoice;
}

export async function POST(request: Request) {
  const runtime = env as unknown as Record<string, string | undefined>;
  const webhook = getSquareWebhookValues(runtime, request.url);
  const signatureKey = webhook.signatureKey?.trim();
  const notificationUrl = webhook.notificationUrl?.trim();

  if (!signatureKey || !notificationUrl) {
    return Response.json(
      { error: "Square webhook configuration is unavailable." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("x-square-hmacsha256-signature");
  const rawBody = await request.text();

  if (
    !signature ||
    !(await hasValidSignature(signature, rawBody, notificationUrl, signatureKey))
  ) {
    return Response.json({ error: "Invalid Square webhook signature." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(payload) || typeof payload.type !== "string") {
    return Response.json({ error: "Invalid Square webhook payload." }, { status: 400 });
  }

  if (
    payload.type !== "invoice.payment_made"
    && payload.type !== "invoice.updated"
    && payload.type !== "invoice.scheduled_charge_failed"
  ) {
    return Response.json({ ok: true, ignored: true });
  }

  const invoice = getInvoice(payload);
  if (
    !invoice ||
    typeof invoice.id !== "string" ||
    typeof invoice.status !== "string" ||
    typeof invoice.version !== "number" ||
    !Number.isSafeInteger(invoice.version) ||
    invoice.version < 0
  ) {
    return Response.json({ error: "Square invoice data is incomplete." }, { status: 400 });
  }

  const changes: {
    squareDepositInvoiceStatus: string;
    squareDepositInvoiceVersion: number;
    squareDepositInvoiceUrl?: string;
  } = {
    squareDepositInvoiceStatus: invoice.status.toLowerCase(),
    squareDepositInvoiceVersion: invoice.version,
  };

  if (typeof invoice.public_url === "string" && invoice.public_url.length > 0) {
    changes.squareDepositInvoiceUrl = invoice.public_url;
  }

  const [updated] = await getDb()
    .update(bookingRequests)
    .set(changes)
    .where(and(
      eq(bookingRequests.squareDepositInvoiceId, invoice.id),
      or(
        isNull(bookingRequests.squareDepositInvoiceVersion),
        lt(bookingRequests.squareDepositInvoiceVersion, invoice.version),
      ),
    ))
    .returning({ id: bookingRequests.id });

  let insuranceReferralSent = false;
  let installmentAutopayStatus: string | null = null;
  if (updated && payload.type === "invoice.scheduled_charge_failed") {
    const stoppedAt = new Date().toISOString();
    const stoppedAuthorizations = await getDb().update(autopayAuthorizations).set({
      status: "stopped_by_square",
      stopSource: "square_charge_failed",
      stoppedAt,
    }).where(and(
      eq(autopayAuthorizations.squareInvoiceId, invoice.id),
      eq(autopayAuthorizations.status, "active"),
    )).returning({ id: autopayAuthorizations.id });
    for (const authorization of stoppedAuthorizations) {
      await getDb().insert(autopayEvents).values({
        authorizationId: authorization.id,
        eventType: "stopped_by_square",
        detail: JSON.stringify({ invoiceVersion: invoice.version, stoppedAt }),
      });
    }
    if (stoppedAuthorizations.length > 0) {
      await getDb().update(bookingRequests).set({
        installmentAutopayAuthorized: false,
        installmentAutopayStatus: "stopped_by_square",
        installmentAutopayError: "Square could not collect a scheduled installment automatically. Automatic payments are no longer active; the customer must pay from the invoice page or update the saved card.",
        installmentAutopayClaimedAt: null,
      }).where(eq(bookingRequests.squareDepositInvoiceId, invoice.id));
      installmentAutopayStatus = "stopped_by_square";
    }
  }

  if (updated && invoice.status.toUpperCase() === "PAID") {
    const completedAt = new Date().toISOString();
    const completedAuthorizations = await getDb().update(autopayAuthorizations).set({
      status: "completed",
    }).where(and(
      eq(autopayAuthorizations.squareInvoiceId, invoice.id),
      eq(autopayAuthorizations.status, "active"),
    )).returning({ id: autopayAuthorizations.id });
    for (const authorization of completedAuthorizations) {
      await getDb().insert(autopayEvents).values({
        authorizationId: authorization.id,
        eventType: "completed",
        detail: JSON.stringify({ invoiceVersion: invoice.version, completedAt }),
      });
    }
    if (completedAuthorizations.length > 0) {
      await getDb().update(bookingRequests).set({
        installmentAutopayAuthorized: false,
        installmentAutopayStatus: "completed",
        installmentAutopayError: null,
        installmentAutopayClaimedAt: null,
      }).where(eq(bookingRequests.squareDepositInvoiceId, invoice.id));
      installmentAutopayStatus = "completed";
    }
  }

  if (payload.type === "invoice.payment_made") {
    const autopayClaimedAt = new Date().toISOString();
    const [autopayClaim] = await getDb().update(bookingRequests).set({
      installmentAutopayStatus: "authorization_sending",
      installmentAutopayError: null,
      installmentAutopayClaimedAt: autopayClaimedAt,
    }).where(and(
      eq(bookingRequests.squareDepositInvoiceId, invoice.id),
      eq(bookingRequests.paymentPreference, "payment_plan"),
      eq(bookingRequests.installmentAutopayStatus, "awaiting_deposit"),
    )).returning({
      id: bookingRequests.id,
      fullName: bookingRequests.fullName,
      email: bookingRequests.email,
      squareCustomerId: bookingRequests.squareCustomerId,
      squareOrderId: bookingRequests.squareDepositOrderId,
      squareInvoiceId: bookingRequests.squareDepositInvoiceId,
    });

    if (autopayClaim) {
      let invitationId: number | null = null;
      let invitationEmailSent = false;
      try {
        if (!autopayClaim.squareCustomerId || !autopayClaim.squareOrderId || !autopayClaim.squareInvoiceId) {
          throw new Error("The Square invoice information is incomplete for automatic installments.");
        }
        const readiness = await findAutopayCardAndSchedule({
          customerId: autopayClaim.squareCustomerId,
          orderId: autopayClaim.squareOrderId,
          invoiceId: autopayClaim.squareInvoiceId,
        });
        if (readiness.status !== "ready") {
          await getDb().update(bookingRequests).set({
            installmentAutopayStatus: readiness.status,
            installmentAutopayError: readiness.message,
            installmentAutopayClaimedAt: null,
          }).where(and(
            eq(bookingRequests.id, autopayClaim.id),
            eq(bookingRequests.installmentAutopayStatus, "authorization_sending"),
          ));
          installmentAutopayStatus = readiness.status;
        } else {
          const token = createAutopayAuthorizationToken();
          const tokenHash = await hashInvitationToken(token);
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 14 * 86_400_000).toISOString();
          const [invitation] = await getDb().insert(autopayAuthorizationInvitations).values({
            bookingRequestId: autopayClaim.id,
            tokenHash,
            recipientEmail: autopayClaim.email.trim().toLowerCase(),
            expiresAt,
            createdAt: now.toISOString(),
          }).returning({ id: autopayAuthorizationInvitations.id });
          if (!invitation) throw new Error("The automatic-payment authorization invitation could not be saved.");
          invitationId = invitation.id;
          const authorizationUrl = new URL(`/autopay-authorization/${encodeURIComponent(token)}`, notificationUrl).toString();
          const delivery = await sendAutopayAuthorizationInvitationEmail({
            toEmail: autopayClaim.email,
            toName: autopayClaim.fullName,
            authorizationUrl,
            expiresAt,
          });
          invitationEmailSent = true;
          await getDb().update(autopayAuthorizationInvitations).set({
            invitationEmailSentAt: delivery.sentAt,
            invitationEmailMessageId: delivery.messageId,
          }).where(eq(autopayAuthorizationInvitations.id, invitation.id));
          await getDb().update(bookingRequests).set({
            installmentAutopayStatus: "authorization_sent",
            installmentAutopayClaimedAt: null,
          }).where(and(
            eq(bookingRequests.id, autopayClaim.id),
            eq(bookingRequests.installmentAutopayStatus, "authorization_sending"),
          ));
          installmentAutopayStatus = "authorization_sent";
        }
      } catch (error) {
        console.error("Automatic-installment authorization preparation failed", {
          inquiryId: autopayClaim.id,
          error: error instanceof Error ? error.message : String(error),
        });
        if (invitationId && !invitationEmailSent) {
          await getDb().delete(autopayAuthorizationInvitations).where(eq(autopayAuthorizationInvitations.id, invitationId));
        }
        await getDb().update(bookingRequests).set({
          installmentAutopayStatus: "authorization_sending",
          installmentAutopayError: "The optional automatic-installment authorization email could not be sent.",
          installmentAutopayClaimedAt: autopayClaimedAt,
        }).where(and(
          eq(bookingRequests.id, autopayClaim.id),
          eq(bookingRequests.installmentAutopayStatus, "authorization_sending"),
        ));
        installmentAutopayStatus = "authorization_sending";
      }
    }

    const claimTimestamp = new Date().toISOString();
    const staleClaimCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const [claimed] = await getDb()
      .update(bookingRequests)
      .set({ travelInsuranceReferralClaimedAt: claimTimestamp })
      .where(and(
        eq(bookingRequests.squareDepositInvoiceId, invoice.id),
        isNull(bookingRequests.travelInsuranceReferralSentAt),
        or(
          isNull(bookingRequests.travelInsuranceReferralClaimedAt),
          lt(bookingRequests.travelInsuranceReferralClaimedAt, staleClaimCutoff),
        ),
      ))
      .returning({
        id: bookingRequests.id,
        email: bookingRequests.email,
        fullName: bookingRequests.fullName,
        paymentPreference: bookingRequests.paymentPreference,
      });

    if (claimed) {
      try {
        const result = await sendTravelInsuranceReferralEmail({
          toEmail: claimed.email,
          toName: claimed.fullName,
          paymentPreference: claimed.paymentPreference === "payment_plan" || claimed.paymentPreference === "full"
            ? claimed.paymentPreference
            : null,
        });
        await getDb()
          .update(bookingRequests)
          .set({
            travelInsuranceReferralSentAt: result.sentAt,
            travelInsuranceReferralMessageId: result.messageId,
          })
          .where(and(
            eq(bookingRequests.id, claimed.id),
            eq(bookingRequests.travelInsuranceReferralClaimedAt, claimTimestamp),
            isNull(bookingRequests.travelInsuranceReferralSentAt),
          ));
        insuranceReferralSent = true;
      } catch (error) {
        console.error("Travel insurance referral email failed", error);
        await getDb()
          .update(bookingRequests)
          .set({ travelInsuranceReferralClaimedAt: null })
          .where(and(
            eq(bookingRequests.id, claimed.id),
            eq(bookingRequests.travelInsuranceReferralClaimedAt, claimTimestamp),
            isNull(bookingRequests.travelInsuranceReferralSentAt),
          ));
        return Response.json(
          { error: "The payment was recorded, but the follow-up email could not be sent." },
          { status: 500 },
        );
      }
    }
  }

  return Response.json({
    ok: true,
    updated: Boolean(updated),
    insuranceReferralSent,
    installmentAutopayStatus,
  });
}
