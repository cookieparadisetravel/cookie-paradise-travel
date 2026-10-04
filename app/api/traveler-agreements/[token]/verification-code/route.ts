import { and, eq, isNull, lte, or } from "drizzle-orm";
import { agreementInvitations } from "@/db/schema";
import { getDb } from "@/db";
import { getAgreementInvitation } from "@/lib/agreement-invitation";
import {
  createVerificationCode,
  hashVerificationCode,
  maskEmail,
  VERIFICATION_CODE_LIFETIME_MINUTES,
  VERIFICATION_CODE_RESEND_SECONDS,
} from "@/lib/agreement-verification";
import { sendAgreementVerificationCodeEmail } from "@/lib/mailersend-transactional";

export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const result = await getAgreementInvitation(token);
  if (result.status !== "ready") {
    const status = result.status === "expired" ? 410 : result.status === "accepted" ? 409 : 404;
    return Response.json({ error: "This agreement link is invalid or unavailable." }, { status });
  }

  const invitation = result.invitation;
  if (invitation.emailVerifiedAt) {
    return Response.json({ verified: true, maskedEmail: maskEmail(invitation.recipientEmail) });
  }

  const db = getDb();
  const now = new Date();
  const resendBefore = new Date(now.getTime() - VERIFICATION_CODE_RESEND_SECONDS * 1_000).toISOString();
  const [claimed] = await db.update(agreementInvitations)
    .set({
      verificationCodeSentAt: now.toISOString(),
      verificationCodeHash: null,
      verificationCodeExpiresAt: null,
      verificationAttempts: 0,
    })
    .where(and(
      eq(agreementInvitations.id, invitation.invitationId),
      isNull(agreementInvitations.acceptedAt),
      isNull(agreementInvitations.revokedAt),
      isNull(agreementInvitations.emailVerifiedAt),
      or(
        isNull(agreementInvitations.verificationCodeSentAt),
        lte(agreementInvitations.verificationCodeSentAt, resendBefore),
      ),
    ))
    .returning({ id: agreementInvitations.id });

  if (!claimed) {
    return Response.json({ error: "Please wait one minute before requesting another code." }, { status: 429 });
  }

  const code = createVerificationCode();
  const codeHash = await hashVerificationCode(invitation.invitationId, code);
  const expiresAt = new Date(now.getTime() + VERIFICATION_CODE_LIFETIME_MINUTES * 60_000).toISOString();

  try {
    await sendAgreementVerificationCodeEmail({
      toEmail: invitation.recipientEmail,
      toName: invitation.travelerType === "minor"
        ? invitation.guardianLegalName || `${invitation.firstName} ${invitation.lastName}`
        : `${invitation.firstName} ${invitation.lastName}`,
      code,
      expiresInMinutes: VERIFICATION_CODE_LIFETIME_MINUTES,
    });
    await db.update(agreementInvitations)
      .set({
        verificationCodeHash: codeHash,
        verificationCodeExpiresAt: expiresAt,
      })
      .where(eq(agreementInvitations.id, invitation.invitationId));
  } catch (cause) {
    console.error("Agreement verification code email failed", {
      invitationId: invitation.invitationId,
      error: cause instanceof Error ? cause.message : String(cause),
    });
    await db.update(agreementInvitations)
      .set({
        verificationCodeSentAt: null,
        verificationCodeHash: null,
        verificationCodeExpiresAt: null,
        verificationAttempts: 0,
      })
      .where(eq(agreementInvitations.id, invitation.invitationId));
    return Response.json({
      error: "We couldn't send the code right now. Please try again in a few minutes.",
    }, { status: 502 });
  }

  return Response.json({
    sent: true,
    maskedEmail: maskEmail(invitation.recipientEmail),
    expiresAt,
  });
}
