import { env } from "cloudflare:workers";
import { and, asc, eq, gt, inArray, isNotNull, isNull, notExists, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { agreementAcceptances, agreementInvitations, agreementReminders, bookingRequests, travelers } from "@/db/schema";
import { sendAgreementReminderEmail } from "@/lib/mailersend-transactional";
import { currentTravelerAgreement, hashInvitationToken } from "@/lib/traveler-agreement";
import { ensureAgreementReminderStorage } from "@/lib/agreement-reminder-storage";

const WEEK_MS = 7 * 86_400_000;
const BOOKING_ORIGIN = "https://cookieparadisetravel.com";

/** Runs hourly; no customer can be reminded before seven full days have elapsed. */
export async function sendDueAgreementReminders(now = new Date()) {
  // Scheduled email is explicitly disabled in local and Sandbox environments.
  if (env.AGREEMENT_REMINDERS_ENABLED !== "true" || env.SQUARE_ENV !== "production") return { sent: 0, failed: 0 };
  if (!env.MAILERSEND_API_TOKEN?.trim() || !env.MAILERSEND_FROM_EMAIL?.trim()) {
    throw new Error("Agreement reminders require transactional email configuration.");
  }
  await ensureAgreementReminderStorage();
  const db = getDb();
  const timestamp = now.toISOString();
  const cutoff = new Date(now.getTime() - WEEK_MS).toISOString();
  const firstEmailSentAt = sql<string>`(select min(first_email.invitation_email_sent_at) from agreement_invitations first_email where first_email.traveler_id = ${travelers.id})`;
  const unsigned = notExists(db.select({ id: agreementAcceptances.id }).from(agreementAcceptances).where(eq(agreementAcceptances.travelerId, travelers.id)));
  const eligible = and(
    eq(bookingRequests.squareEnvironment, "production"),
    inArray(bookingRequests.status, ["new", "considering", "booking_in_progress", "reserved", "contacted", "qualified"]),
    or(eq(bookingRequests.departure, "flexible"), gt(bookingRequests.departure, timestamp.slice(0, 10))),
    eq(bookingRequests.sellerOfTravelStateResident, false),
    isNotNull(bookingRequests.companyAcceptedAt),
    isNotNull(bookingRequests.companyAcceptedBy),
    isNull(agreementInvitations.acceptedAt),
    isNull(agreementInvitations.revokedAt),
    isNotNull(agreementInvitations.invitationEmailSentAt),
    isNotNull(agreementInvitations.agreementDocumentJson),
    eq(agreementInvitations.agreementVersion, currentTravelerAgreement.version),
    gt(agreementInvitations.expiresAt, timestamp),
    sql`${firstEmailSentAt} <= ${cutoff}`,
    unsigned,
  );
  const query = () => db.select({
    travelerId: travelers.id,
    invitationId: agreementInvitations.id,
    recipientEmail: agreementInvitations.recipientEmail,
    travelerEmail: travelers.email,
    firstName: travelers.firstName,
    lastName: travelers.lastName,
    travelerType: travelers.travelerType,
    guardianLegalName: travelers.guardianLegalName,
    firstEmailSentAt,
    expiresAt: agreementInvitations.expiresAt,
  }).from(agreementInvitations)
    .innerJoin(travelers, eq(agreementInvitations.travelerId, travelers.id))
    .innerJoin(bookingRequests, eq(travelers.bookingRequestId, bookingRequests.id));

  const candidates = await query().where(and(eligible,
    notExists(db.select({ id: agreementReminders.travelerId }).from(agreementReminders).where(eq(agreementReminders.travelerId, travelers.id))),
  )).orderBy(asc(agreementInvitations.invitationEmailSentAt)).limit(50);
  const result = { sent: 0, failed: 0 };
  for (const candidate of candidates) {
    const token = createToken();
    const tokenHash = await hashInvitationToken(token);
    const [claim] = await db.insert(agreementReminders).values({
      travelerId: candidate.travelerId,
      invitationId: candidate.invitationId,
      tokenHash,
      firstEmailSentAt: candidate.firstEmailSentAt,
      claimedAt: timestamp,
      status: "sending",
    }).onConflictDoNothing().returning({ travelerId: agreementReminders.travelerId });
    if (!claim) continue;

    // Recheck after the atomic claim: signing or replacing a link can happen mid-run.
    const [current] = await query().where(and(eligible, eq(agreementInvitations.id, candidate.invitationId))).limit(1);
    if (!current) {
      await db.update(agreementReminders).set({ status: "skipped" }).where(eq(agreementReminders.travelerId, candidate.travelerId));
      continue;
    }
    const travelerName = `${current.firstName} ${current.lastName}`;
    try {
      const delivery = await sendAgreementReminderEmail({
        toEmail: current.recipientEmail || current.travelerEmail,
        toName: current.travelerType === "minor" ? current.guardianLegalName || travelerName : travelerName,
        travelerName,
        invitationUrl: `${BOOKING_ORIGIN}/traveler-agreement/${token}`,
        expiresAt: current.expiresAt,
      });
      await db.update(agreementReminders).set({ status: "sent", sentAt: delivery.sentAt, messageId: delivery.messageId })
        .where(eq(agreementReminders.travelerId, current.travelerId));
      result.sent++;
    } catch {
      // A timeout may follow provider acceptance. Do not automatically resend and risk duplicates.
      await db.update(agreementReminders).set({ status: "failed", error: "Delivery not confirmed; review MailerSend before manually retrying." })
        .where(eq(agreementReminders.travelerId, current.travelerId));
      console.error("Agreement reminder delivery not confirmed", { travelerId: current.travelerId, invitationId: current.invitationId });
      result.failed++;
    }
  }
  return result;
}

function createToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
