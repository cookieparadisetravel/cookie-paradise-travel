import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getSquareBookingEnvironmentError } from "@/lib/square-config";
import { autopayAuthorizationInvitations, bookingRequests } from "@/db/schema";
import { getDb } from "@/db";
import { getAgreementReadiness } from "@/lib/agreement-readiness";
import { autopayAvailable } from "@/lib/autopay-authorization";
import { autopayScheduleFingerprint, findAutopayCardAndSchedule } from "@/lib/square";
import type { AutopayScheduleRequest } from "@/lib/square-autopay";
import { hashInvitationToken, isValidInvitationToken } from "@/lib/traveler-agreement";

export type AutopayAuthorizationInvitationResult =
  | { status: "invalid" | "expired" | "revoked" }
  | { status: "environment_mismatch"; message: string }
  | { status: "completed"; completedAt: string | null; autopayStatus: string }
  | { status: "manual"; message: string }
  | {
      status: "ready";
      invitationId: number;
      bookingRequestId: number;
      primaryContactName: string;
      recipientEmail: string;
      departure: string;
      expiresAt: string;
      cardBrand: string;
      cardLast4: string;
      requests: AutopayScheduleRequest[];
      scheduleFingerprint: string;
    };

export async function getAutopayAuthorizationInvitation(token: string): Promise<AutopayAuthorizationInvitationResult> {
  if (!isValidInvitationToken(token)) return { status: "invalid" };

  const tokenHash = await hashInvitationToken(token);
  const [record] = await getDb().select({
    invitationId: autopayAuthorizationInvitations.id,
    bookingRequestId: bookingRequests.id,
    squareEnvironment: bookingRequests.squareEnvironment,
    primaryContactName: bookingRequests.fullName,
    recipientEmail: autopayAuthorizationInvitations.recipientEmail,
    departure: bookingRequests.departure,
    partySize: bookingRequests.partySize,
    paymentPreference: bookingRequests.paymentPreference,
    customerId: bookingRequests.squareCustomerId,
    orderId: bookingRequests.squareDepositOrderId,
    invoiceId: bookingRequests.squareDepositInvoiceId,
    autopayStatus: bookingRequests.installmentAutopayStatus,
    expiresAt: autopayAuthorizationInvitations.expiresAt,
    completedAt: autopayAuthorizationInvitations.completedAt,
    revokedAt: autopayAuthorizationInvitations.revokedAt,
  })
    .from(autopayAuthorizationInvitations)
    .innerJoin(bookingRequests, eq(autopayAuthorizationInvitations.bookingRequestId, bookingRequests.id))
    .where(eq(autopayAuthorizationInvitations.tokenHash, tokenHash))
    .limit(1);

  if (!record) return { status: "invalid" };
  if (record.revokedAt) return { status: "revoked" };
  const environmentError = getSquareBookingEnvironmentError(
    record.squareEnvironment,
    env as unknown as Record<string, string | undefined>,
  );
  if (environmentError) return { status: "environment_mismatch", message: environmentError };
  if (record.completedAt) return { status: "completed", completedAt: record.completedAt, autopayStatus: record.autopayStatus };
  const expirationTime = Date.parse(record.expiresAt);
  if (!Number.isFinite(expirationTime) || expirationTime <= Date.now()) return { status: "expired" };
  if (
    record.paymentPreference !== "payment_plan"
    || !record.customerId
    || !record.orderId
    || !record.invoiceId
  ) return { status: "invalid" };

  const agreementReadiness = await getAgreementReadiness(record.bookingRequestId, record.partySize);
  if (!autopayAvailable(agreementReadiness)) return { status: "invalid" };

  const readiness = await findAutopayCardAndSchedule({
    customerId: record.customerId,
    orderId: record.orderId,
    invoiceId: record.invoiceId,
  });
  if (readiness.status !== "ready") {
    return {
      status: "manual",
      message: readiness.status === "card_not_saved"
        ? "No saved card was found, so your installments stay manual."
        : readiness.message,
    };
  }
  if (!readiness.cardBrand || !readiness.cardLast4) {
    return { status: "manual", message: "No saved card was found, so your installments stay manual." };
  }

  return {
    status: "ready",
    invitationId: record.invitationId,
    bookingRequestId: record.bookingRequestId,
    primaryContactName: record.primaryContactName,
    recipientEmail: record.recipientEmail,
    departure: record.departure,
    expiresAt: record.expiresAt,
    cardBrand: readiness.cardBrand,
    cardLast4: readiness.cardLast4,
    requests: readiness.requests,
    scheduleFingerprint: await autopayScheduleFingerprint(readiness.cardId, readiness.requests),
  };
}

export function createAutopayAuthorizationToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
