import { and, count, eq, isNull } from "drizzle-orm";
import { bookingRequests, travelerListInvitations, travelers } from "@/db/schema";
import { getDb } from "@/db";
import { requireOwner } from "@/lib/owner-auth";
import { hasValidOrigin } from "@/lib/same-origin";
import { hashInvitationToken } from "@/lib/traveler-agreement";

const INVITATION_LIFETIME_DAYS = 7;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await requireOwner("/admin/inquiries"))) return Response.json({ error: "Not authorized" }, { status: 403 });

  const { id: rawId } = await context.params;
  const bookingRequestId = Number(rawId);
  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return Response.json({ error: "Invalid inquiry" }, { status: 400 });
  }

  const db = getDb();
  const [inquiry] = await db.select({
    id: bookingRequests.id,
    partySize: bookingRequests.partySize,
    fullName: bookingRequests.fullName,
    email: bookingRequests.email,
  })
    .from(bookingRequests)
    .where(eq(bookingRequests.id, bookingRequestId))
    .limit(1);
  if (!inquiry) return Response.json({ error: "Inquiry not found" }, { status: 404 });
  if (inquiry.partySize === 1) {
    return Response.json({ error: "A traveler-list link is not needed for a single-traveler inquiry." }, { status: 409 });
  }

  const [travelerCount] = await db.select({ value: count() }).from(travelers)
    .where(eq(travelers.bookingRequestId, bookingRequestId));
  if ((travelerCount?.value ?? 0) >= inquiry.partySize) {
    return Response.json({ error: "The traveler list is already complete." }, { status: 409 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_DAYS * 86_400_000).toISOString();
  const token = createInvitationToken();
  const tokenHash = await hashInvitationToken(token);

  await db.update(travelerListInvitations).set({ revokedAt: now.toISOString() }).where(and(
    eq(travelerListInvitations.bookingRequestId, bookingRequestId),
    isNull(travelerListInvitations.completedAt),
    isNull(travelerListInvitations.revokedAt),
  ));

  await db.insert(travelerListInvitations).values({ bookingRequestId, tokenHash, expiresAt });

  const invitationUrl = new URL(`/traveler-list/${encodeURIComponent(token)}`, request.url).toString();
  return Response.json({
    invitationUrl,
    expiresAt,
    primaryContactName: inquiry.fullName,
    primaryContactEmail: inquiry.email,
  }, { status: 201 });
}

function createInvitationToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
