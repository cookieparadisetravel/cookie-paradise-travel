import { count, eq } from "drizzle-orm";
import { bookingRequests, travelerListInvitations, travelers } from "@/db/schema";
import { getDb } from "@/db";
import { hashInvitationToken, isValidInvitationToken } from "@/lib/traveler-agreement";

export type TravelerListInvitationResult =
  | { status: "invalid" | "expired" | "revoked" }
  | { status: "completed"; completedAt: string | null }
  | {
      status: "ready";
      invitationId: number;
      bookingRequestId: number;
      primaryContactName: string;
      departure: string;
      partySize: number;
      existingTravelerCount: number;
      remainingTravelerCount: number;
      expiresAt: string;
    };

export async function getTravelerListInvitation(token: string): Promise<TravelerListInvitationResult> {
  if (!isValidInvitationToken(token)) return { status: "invalid" };

  const tokenHash = await hashInvitationToken(token);
  const db = getDb();
  const [record] = await db.select({
    invitationId: travelerListInvitations.id,
    bookingRequestId: bookingRequests.id,
    primaryContactName: bookingRequests.fullName,
    departure: bookingRequests.departure,
    partySize: bookingRequests.partySize,
    expiresAt: travelerListInvitations.expiresAt,
    completedAt: travelerListInvitations.completedAt,
    revokedAt: travelerListInvitations.revokedAt,
  })
    .from(travelerListInvitations)
    .innerJoin(bookingRequests, eq(travelerListInvitations.bookingRequestId, bookingRequests.id))
    .where(eq(travelerListInvitations.tokenHash, tokenHash))
    .limit(1);

  if (!record) return { status: "invalid" };
  if (record.revokedAt) return { status: "revoked" };

  const [travelerCount] = await db.select({ value: count() })
    .from(travelers)
    .where(eq(travelers.bookingRequestId, record.bookingRequestId));
  const existingTravelerCount = travelerCount?.value ?? 0;

  if (record.completedAt || existingTravelerCount >= record.partySize) {
    return { status: "completed", completedAt: record.completedAt };
  }

  const expiresAt = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return { status: "expired" };

  return {
    status: "ready",
    invitationId: record.invitationId,
    bookingRequestId: record.bookingRequestId,
    primaryContactName: record.primaryContactName,
    departure: record.departure,
    partySize: record.partySize,
    existingTravelerCount,
    remainingTravelerCount: record.partySize - existingTravelerCount,
    expiresAt: record.expiresAt,
  };
}
