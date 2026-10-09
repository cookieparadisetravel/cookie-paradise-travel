import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getSquareBookingEnvironmentError } from "@/lib/square-config";
import { bookingRequests, paymentPreferenceInvitations } from "@/db/schema";
import { getDb } from "@/db";
import { createPaymentPlan, todayInIndiana, type PaymentPreference } from "@/lib/payment-schedule";
import { hashInvitationToken, isValidInvitationToken } from "@/lib/traveler-agreement";

export type PaymentPreferenceInvitationResult =
  | { status: "invalid" | "expired" | "revoked" }
  | { status: "environment_mismatch"; message: string }
  | {
      status: "completed";
      completedAt: string | null;
      paymentPreference: PaymentPreference | null;
      invoiceUrl: string | null;
      invoiceStatus: string;
    }
  | {
      status: "ready";
      invitationId: number;
      bookingRequestId: number;
      primaryContactName: string;
      departure: string;
      partySize: number;
      bookingTotalCents: number;
      depositAmountCents: number;
      remainingBalanceCents: number;
      installmentCount: number;
      finalPaymentDeadline: string;
      fullPaymentRequired: boolean;
      createdBy: string | null;
      expiresAt: string;
    };

export async function getPaymentPreferenceInvitation(token: string): Promise<PaymentPreferenceInvitationResult> {
  if (!isValidInvitationToken(token)) return { status: "invalid" };

  const tokenHash = await hashInvitationToken(token);
  const db = getDb();
  const [record] = await db.select({
    invitationId: paymentPreferenceInvitations.id,
    bookingRequestId: bookingRequests.id,
    squareEnvironment: bookingRequests.squareEnvironment,
    primaryContactName: bookingRequests.fullName,
    departure: bookingRequests.departure,
    partySize: bookingRequests.partySize,
    bookingTotalCents: bookingRequests.confirmedBookingTotalCents,
    paymentPreference: bookingRequests.paymentPreference,
    invoiceUrl: bookingRequests.squareDepositInvoiceUrl,
    invoiceStatus: bookingRequests.squareDepositInvoiceStatus,
    createdBy: paymentPreferenceInvitations.createdBy,
    expiresAt: paymentPreferenceInvitations.expiresAt,
    completedAt: paymentPreferenceInvitations.completedAt,
    revokedAt: paymentPreferenceInvitations.revokedAt,
  })
    .from(paymentPreferenceInvitations)
    .innerJoin(bookingRequests, eq(paymentPreferenceInvitations.bookingRequestId, bookingRequests.id))
    .where(eq(paymentPreferenceInvitations.tokenHash, tokenHash))
    .limit(1);

  if (!record) return { status: "invalid" };
  if (record.revokedAt) return { status: "revoked" };
  const environmentError = getSquareBookingEnvironmentError(
    record.squareEnvironment,
    env as unknown as Record<string, string | undefined>,
  );
  if (environmentError) return { status: "environment_mismatch", message: environmentError };
  if (record.completedAt) {
    return {
      status: "completed",
      completedAt: record.completedAt,
      paymentPreference: isPaymentPreference(record.paymentPreference) ? record.paymentPreference : null,
      invoiceUrl: record.invoiceUrl,
      invoiceStatus: record.invoiceStatus,
    };
  }

  const expiresAt = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return { status: "expired" };
  if (!record.bookingTotalCents || record.bookingTotalCents < 1 || record.departure === "flexible") {
    return { status: "invalid" };
  }

  try {
    const standardPlan = createPaymentPlan({
      bookingTotalCents: record.bookingTotalCents,
      partySize: record.partySize,
      departure: record.departure,
      acceptanceDate: todayInIndiana(),
    });
    return {
      status: "ready",
      invitationId: record.invitationId,
      bookingRequestId: record.bookingRequestId,
      primaryContactName: record.primaryContactName,
      departure: record.departure,
      partySize: record.partySize,
      bookingTotalCents: record.bookingTotalCents,
      depositAmountCents: standardPlan.depositAmountCents,
      remainingBalanceCents: standardPlan.remainingBalanceCents,
      installmentCount: standardPlan.installments.length,
      finalPaymentDeadline: standardPlan.finalPaymentDeadline,
      fullPaymentRequired: standardPlan.paymentType === "full" || standardPlan.remainingBalanceCents === 0,
      createdBy: record.createdBy,
      expiresAt: record.expiresAt,
    };
  } catch {
    return { status: "invalid" };
  }
}

export function isPaymentPreference(value: unknown): value is PaymentPreference {
  return value === "payment_plan" || value === "full";
}
