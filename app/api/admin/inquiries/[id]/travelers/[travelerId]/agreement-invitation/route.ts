import { and, eq, isNull } from "drizzle-orm";
import { agreementAcceptances, agreementInvitations, travelers } from "@/db/schema";
import { getDb } from "@/db";
import { requireOwner } from "@/lib/owner-auth";
import { hasValidOrigin } from "@/lib/same-origin";
import { sendAgreementInvitationEmail } from "@/lib/mailersend-transactional";
import {
  currentTravelerAgreement,
  hashAgreementDocument,
  hashInvitationToken,
} from "@/lib/traveler-agreement";

const INVITATION_LIFETIME_DAYS = 14;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; travelerId: string }> },
) {
  if (!hasValidOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }
  if (!(await requireOwner("/admin/inquiries"))) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }
  if (!currentTravelerAgreement) {
    return Response.json({
      error: "Agreement invitations remain disabled until the legally approved agreement is activated.",
    }, { status: 409 });
  }

  const { id: rawInquiryId, travelerId: rawTravelerId } = await context.params;
  const inquiryId = Number(rawInquiryId);
  const travelerId = Number(rawTravelerId);
  if (!Number.isInteger(inquiryId) || inquiryId < 1 || !Number.isInteger(travelerId) || travelerId < 1) {
    return Response.json({ error: "Invalid traveler" }, { status: 400 });
  }

  const db = getDb();
  const [traveler] = await db.select({
    id: travelers.id,
    firstName: travelers.firstName,
    lastName: travelers.lastName,
    email: travelers.email,
    travelerType: travelers.travelerType,
    guardianLegalName: travelers.guardianLegalName,
  })
    .from(travelers)
    .where(and(
      eq(travelers.id, travelerId),
      eq(travelers.bookingRequestId, inquiryId),
    ))
    .limit(1);
  if (!traveler) return Response.json({ error: "Traveler not found" }, { status: 404 });

  const agreementHash = await hashAgreementDocument(currentTravelerAgreement);
  const [existingAcceptance] = await db.select({ id: agreementAcceptances.id })
    .from(agreementAcceptances)
    .where(and(
      eq(agreementAcceptances.travelerId, travelerId),
      eq(agreementAcceptances.agreementVersion, currentTravelerAgreement.version),
      eq(agreementAcceptances.agreementDocumentHash, agreementHash),
    ))
    .limit(1);
  if (existingAcceptance) {
    return Response.json({ error: "This traveler has already accepted the current agreement." }, { status: 409 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_DAYS * 86_400_000).toISOString();
  const token = createInvitationToken();
  const tokenHash = await hashInvitationToken(token);

  await db.update(agreementInvitations)
    .set({ revokedAt: now.toISOString() })
    .where(and(
      eq(agreementInvitations.travelerId, travelerId),
      isNull(agreementInvitations.acceptedAt),
      isNull(agreementInvitations.revokedAt),
    ));

  const [invitation] = await db.insert(agreementInvitations).values({
    travelerId,
    tokenHash,
    agreementVersion: currentTravelerAgreement.version,
    agreementDocumentHash: agreementHash,
    recipientEmail: traveler.email.trim().toLowerCase(),
    expiresAt,
  }).returning({ id: agreementInvitations.id });

  const invitationUrl = new URL(
    `/traveler-agreement/${encodeURIComponent(token)}`,
    request.url,
  ).toString();

  try {
    const delivery = await sendAgreementInvitationEmail({
      toEmail: traveler.email,
      toName: traveler.travelerType === "minor"
        ? traveler.guardianLegalName || `${traveler.firstName} ${traveler.lastName}`
        : `${traveler.firstName} ${traveler.lastName}`,
      travelerName: `${traveler.firstName} ${traveler.lastName}`,
      invitationUrl,
      expiresAt,
    });
    await db.update(agreementInvitations)
      .set({
        invitationEmailSentAt: delivery.sentAt,
        invitationEmailMessageId: delivery.messageId,
      })
      .where(eq(agreementInvitations.id, invitation.id));

    return Response.json({
      sentTo: traveler.email,
      sentAt: delivery.sentAt,
      expiresAt,
    }, { status: 201 });
  } catch (cause) {
    await db.update(agreementInvitations)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(agreementInvitations.id, invitation.id));
    return Response.json({
      error: cause instanceof Error ? cause.message : "The agreement email could not be sent.",
    }, { status: 502 });
  }
}

function createInvitationToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
