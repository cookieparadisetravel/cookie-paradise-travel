import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { agreementInvitations } from "@/db/schema";
import { getDb } from "@/db";
import { getAgreementInvitation } from "@/lib/agreement-invitation";
import {
  constantTimeEqual,
  hashVerificationCode,
  VERIFICATION_CODE_MAX_ATTEMPTS,
} from "@/lib/agreement-verification";

const verificationSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/u, "Enter the six-digit verification code."),
});

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const result = await getAgreementInvitation(token);
  if (result.status !== "ready") {
    const status = result.status === "expired" ? 410 : result.status === "accepted" ? 409 : 404;
    return Response.json({ error: "This agreement link is invalid or unavailable." }, { status });
  }
  if (result.invitation.emailVerifiedAt) {
    return Response.json({ verified: true, verifiedAt: result.invitation.emailVerifiedAt });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = verificationSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter a valid verification code." }, { status: 400 });
  }

  const invitation = result.invitation;
  if (!invitation.verificationCodeSentAt || !invitation.verificationCodeExpiresAt) {
    return Response.json({ error: "Request a verification code first." }, { status: 409 });
  }
  if (Date.parse(invitation.verificationCodeExpiresAt) <= Date.now()) {
    return Response.json({ error: "This verification code has expired. Request a new code." }, { status: 410 });
  }
  if (invitation.verificationAttempts >= VERIFICATION_CODE_MAX_ATTEMPTS) {
    return Response.json({ error: "Too many incorrect attempts. Request a new code." }, { status: 429 });
  }

  const db = getDb();
  const [claimedAttempt] = await db.update(agreementInvitations)
    .set({ verificationAttempts: sql`${agreementInvitations.verificationAttempts} + 1` })
    .where(and(
      eq(agreementInvitations.id, invitation.invitationId),
      lt(agreementInvitations.verificationAttempts, VERIFICATION_CODE_MAX_ATTEMPTS),
      isNull(agreementInvitations.emailVerifiedAt),
    ))
    .returning({ hash: agreementInvitations.verificationCodeHash });
  if (!claimedAttempt) {
    return Response.json({ error: "Too many incorrect attempts. Request a new code." }, { status: 429 });
  }
  if (!claimedAttempt.hash) {
    return Response.json({ error: "The verification code is not ready. Request another code." }, { status: 409 });
  }

  const submittedHash = await hashVerificationCode(invitation.invitationId, parsed.data.code);
  if (!constantTimeEqual(claimedAttempt.hash, submittedHash)) {
    return Response.json({ error: "That verification code is incorrect." }, { status: 400 });
  }

  const verifiedAt = new Date().toISOString();
  await db.update(agreementInvitations)
    .set({ emailVerifiedAt: verifiedAt })
    .where(eq(agreementInvitations.id, invitation.invitationId));

  return Response.json({ verified: true, verifiedAt });
}
