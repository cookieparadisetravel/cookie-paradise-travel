import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getSquareBookingEnvironmentError } from "@/lib/square-config";
import { getDb } from "@/db";
import { autopayAuthorizations, autopayEvents, bookingRequests } from "@/db/schema";
import { formatCardBrand } from "@/lib/autopay-authorization";
import { sendAutopayAuthorizationConfirmationEmail } from "@/lib/mailersend-transactional";
import { sendOwnerAutopayAuthorizationNotification } from "@/lib/owner-notification";
import { autopayScheduleFingerprint, findAutopayCardAndSchedule, setInvoiceAutopay } from "@/lib/square";
import type { AutopayScheduleRequest } from "@/lib/square-autopay";

export type AutopayActivationResult =
  | { ok: true; completedAt: string; status: "active" }
  | { ok: false; completedAt: string; status: "square_failed" | "environment_mismatch"; error: string };

export async function activateRecordedAutopayAuthorization(
  authorizationId: number,
): Promise<AutopayActivationResult> {
  const db = getDb();
  const [record] = await db.select({
    authorizationId: autopayAuthorizations.id,
    authorizationStatus: autopayAuthorizations.status,
    bookingRequestId: autopayAuthorizations.bookingRequestId,
    squareEnvironment: bookingRequests.squareEnvironment,
    cardholderName: autopayAuthorizations.cardholderName,
    cardholderEmail: autopayAuthorizations.cardholderEmail,
    consentedAt: autopayAuthorizations.consentedAt,
    authorizationText: autopayAuthorizations.authorizationText,
    squareCardId: autopayAuthorizations.squareCardId,
    cardBrand: autopayAuthorizations.cardBrand,
    cardLast4: autopayAuthorizations.cardLast4,
    squareInvoiceId: autopayAuthorizations.squareInvoiceId,
    scheduleSnapshot: autopayAuthorizations.scheduleSnapshot,
    totalCents: autopayAuthorizations.totalCents,
    confirmationEmailSentAt: autopayAuthorizations.confirmationEmailSentAt,
    primaryContactName: bookingRequests.fullName,
    departure: bookingRequests.departure,
    squareCustomerId: bookingRequests.squareCustomerId,
    squareOrderId: bookingRequests.squareDepositOrderId,
  })
    .from(autopayAuthorizations)
    .innerJoin(bookingRequests, eq(autopayAuthorizations.bookingRequestId, bookingRequests.id))
    .where(eq(autopayAuthorizations.id, authorizationId))
    .limit(1);

  if (!record) throw new Error("The automatic-payment authorization record was not found.");
  const environmentError = getSquareBookingEnvironmentError(
    record.squareEnvironment,
    env as unknown as Record<string, string | undefined>,
  );
  if (environmentError) {
    return { ok: false, completedAt: record.consentedAt, status: "environment_mismatch", error: environmentError };
  }
  if (record.authorizationStatus === "active") {
    return { ok: true, completedAt: record.consentedAt, status: "active" };
  }
  if (record.authorizationStatus !== "saving" && record.authorizationStatus !== "square_failed") {
    throw new Error("This automatic-payment authorization cannot be activated from its current state.");
  }
  if (!record.squareCustomerId || !record.squareOrderId) {
    return markActivationFailed(record, [], "square_information_missing");
  }

  const schedule = parseSchedule(record.scheduleSnapshot);
  if (!schedule) return markActivationFailed(record, [], "stored_schedule_invalid");

  let readiness;
  try {
    readiness = await findAutopayCardAndSchedule({
      customerId: record.squareCustomerId,
      orderId: record.squareOrderId,
      invoiceId: record.squareInvoiceId,
    });
  } catch {
    return markActivationFailed(record, schedule, "square_lookup_failed");
  }
  if (readiness.status !== "ready") {
    return markActivationFailed(record, schedule, readiness.status);
  }

  const [storedFingerprint, currentFingerprint] = await Promise.all([
    autopayScheduleFingerprint(record.squareCardId, schedule),
    autopayScheduleFingerprint(readiness.cardId, readiness.requests),
  ]);
  if (storedFingerprint !== currentFingerprint) {
    return markActivationFailed(record, schedule, "schedule_changed");
  }

  let invoiceResult = {
    version: readiness.invoiceVersion,
    status: readiness.invoiceStatus,
  };
  if (!readiness.autopayAlreadyEnabled) {
    try {
      invoiceResult = await setInvoiceAutopay({
        invoiceId: record.squareInvoiceId,
        version: readiness.invoiceVersion,
        requestUids: readiness.requestUids,
        cardId: readiness.cardId,
        idempotencyKey: `cpt-ap-${record.authorizationId}-${readiness.invoiceVersion}-${storedFingerprint.slice(0, 12)}`,
      });
    } catch {
      return markActivationFailed(record, schedule, "square_update_failed");
    }
  }

  await db.update(autopayAuthorizations).set({
    status: "active",
    squareInvoiceVersionAfterEnable: invoiceResult.version,
  }).where(eq(autopayAuthorizations.id, record.authorizationId));
  await db.update(bookingRequests).set({
    installmentAutopayAuthorized: true,
    installmentAutopayAuthorizedAt: record.consentedAt,
    installmentAutopayPayerName: record.cardholderName,
    installmentAutopayStatus: "active",
    installmentAutopayCardBrand: record.cardBrand,
    installmentAutopayCardLast4: record.cardLast4,
    installmentAutopayError: null,
    installmentAutopayClaimedAt: null,
    squareDepositInvoiceVersion: invoiceResult.version,
    squareDepositInvoiceStatus: invoiceResult.status,
  }).where(eq(bookingRequests.id, record.bookingRequestId));
  await db.insert(autopayEvents).values({
    authorizationId: record.authorizationId,
    eventType: readiness.autopayAlreadyEnabled ? "enable_recovered" : "enable_succeeded",
    detail: JSON.stringify({ invoiceVersion: invoiceResult.version }),
  });

  if (!record.confirmationEmailSentAt) {
    try {
      const delivery = await sendAutopayAuthorizationConfirmationEmail({
        toEmail: record.cardholderEmail,
        toName: record.cardholderName,
        authorizationText: record.authorizationText,
        cardBrand: formatCardBrand(record.cardBrand),
        cardLast4: record.cardLast4,
        schedule,
        totalCents: record.totalCents,
      });
      await db.update(autopayAuthorizations).set({
        confirmationEmailSentAt: delivery.sentAt,
        confirmationEmailError: null,
      }).where(eq(autopayAuthorizations.id, record.authorizationId));
      await db.insert(autopayEvents).values({
        authorizationId: record.authorizationId,
        eventType: "confirmation_email_sent",
        detail: JSON.stringify({ sentAt: delivery.sentAt }),
      });
    } catch {
      await db.update(autopayAuthorizations).set({
        confirmationEmailError: "The confirmation email could not be sent.",
      }).where(eq(autopayAuthorizations.id, record.authorizationId));
      await db.insert(autopayEvents).values({
        authorizationId: record.authorizationId,
        eventType: "confirmation_email_failed",
        detail: JSON.stringify({ code: "delivery_failed" }),
      });
    }
  }

  await sendOwnerAutopayAuthorizationNotification({
    inquiryId: record.bookingRequestId,
    primaryContactName: record.primaryContactName,
    departure: record.departure,
    paymentCount: schedule.length,
    totalCents: record.totalCents,
    outcome: "active",
  });

  return { ok: true, completedAt: record.consentedAt, status: "active" };
}

async function markActivationFailed(
  record: {
    authorizationId: number;
    bookingRequestId: number;
    consentedAt: string;
    primaryContactName: string;
    departure: string;
    totalCents: number;
  },
  schedule: AutopayScheduleRequest[],
  code: string,
): Promise<AutopayActivationResult> {
  const db = getDb();
  const publicError = "We couldn't turn on automatic payments. Nothing will be charged automatically; your invoice stays manual.";
  await db.update(autopayAuthorizations).set({ status: "square_failed" })
    .where(eq(autopayAuthorizations.id, record.authorizationId));
  await db.update(bookingRequests).set({
    installmentAutopayAuthorized: false,
    installmentAutopayAuthorizedAt: null,
    installmentAutopayStatus: "square_failed",
    installmentAutopayError: publicError,
    installmentAutopayClaimedAt: null,
  }).where(eq(bookingRequests.id, record.bookingRequestId));
  await db.insert(autopayEvents).values({
    authorizationId: record.authorizationId,
    eventType: "enable_failed",
    detail: JSON.stringify({ code }),
  });
  await sendOwnerAutopayAuthorizationNotification({
    inquiryId: record.bookingRequestId,
    primaryContactName: record.primaryContactName,
    departure: record.departure,
    paymentCount: schedule.length,
    totalCents: record.totalCents,
    outcome: "square_failed",
  });
  return { ok: false, completedAt: record.consentedAt, status: "square_failed", error: publicError };
}

function parseSchedule(value: string): AutopayScheduleRequest[] | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const schedule: AutopayScheduleRequest[] = [];
    for (const item of parsed) {
      if (
        !item
        || typeof item !== "object"
        || !("uid" in item) || typeof item.uid !== "string"
        || !("dueDate" in item) || typeof item.dueDate !== "string"
        || !("amountCents" in item) || !Number.isSafeInteger(item.amountCents) || Number(item.amountCents) <= 0
      ) return null;
      schedule.push({ uid: item.uid, dueDate: item.dueDate, amountCents: Number(item.amountCents) });
    }
    return schedule;
  } catch {
    return null;
  }
}
