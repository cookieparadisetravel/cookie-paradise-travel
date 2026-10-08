import { eq } from "drizzle-orm";
import { autopayAuthorizationInvitations, bookingRequests } from "@/db/schema";
import { getDb } from "@/db";
import { getSquareAutopaySchedule, type SquareAutopayInstallment } from "@/lib/square";
import { hashInvitationToken, isValidInvitationToken } from "@/lib/traveler-agreement";

export type AutopayAuthorizationInvitationResult =
  | { status: "invalid" | "expired" | "revoked" }
  | { status: "completed"; completedAt: string | null }
  | {
      status: "ready";
      invitationId: number;
      bookingRequestId: number;
      primaryContactName: string;
      recipientEmail: string;
      departure: string;
      expiresAt: string;
      installments: SquareAutopayInstallment[];
    };

export async function getAutopayAuthorizationInvitation(token: string): Promise<AutopayAuthorizationInvitationResult> {
  if (!isValidInvitationToken(token)) return { status: "invalid" };

  const tokenHash = await hashInvitationToken(token);
  const [record] = await getDb().select({
    invitationId: autopayAuthorizationInvitations.id,
    bookingRequestId: bookingRequests.id,
    primaryContactName: bookingRequests.fullName,
    recipientEmail: autopayAuthorizationInvitations.recipientEmail,
    departure: bookingRequests.departure,
    paymentPreference: bookingRequests.paymentPreference,
    invoiceId: bookingRequests.squareDepositInvoiceId,
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
  if (record.completedAt) return { status: "completed", completedAt: record.completedAt };
  const expirationTime = Date.parse(record.expiresAt);
  if (!Number.isFinite(expirationTime) || expirationTime <= Date.now()) return { status: "expired" };
  if (record.paymentPreference !== "payment_plan" || !record.invoiceId) return { status: "invalid" };

  const installments = await getSquareAutopaySchedule(record.invoiceId);
  if (installments.length === 0) return { status: "invalid" };
  return {
    status: "ready",
    invitationId: record.invitationId,
    bookingRequestId: record.bookingRequestId,
    primaryContactName: record.primaryContactName,
    recipientEmail: record.recipientEmail,
    departure: record.departure,
    expiresAt: record.expiresAt,
    installments,
  };
}

export function createAutopayAuthorizationToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
