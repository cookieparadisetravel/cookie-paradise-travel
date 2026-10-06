import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { agreementAcceptances, agreementInvitations } from "@/db/schema";
import { getDb } from "@/db";
import { getAgreementInvitation, invitationIsStillAcceptable } from "@/lib/agreement-invitation";
import {
  canonicalizeAcceptanceSnapshot,
  isValidPastDate,
  retentionUntilForDeparture,
  sha256Hex,
  signAcceptanceSnapshot,
  type AgreementAcceptanceSnapshot,
} from "@/lib/agreement-acceptance-record";
import {
  agreementPdfFilename,
  generateAgreementPdf,
  pdfBytesToBase64,
} from "@/lib/agreement-pdf";
import { sendSignedAgreementEmail } from "@/lib/mailersend-transactional";
import { canonicalizeAgreement, currentTravelerAgreement } from "@/lib/traveler-agreement";

const acceptanceSchema = z.object({
  signerLegalName: z.string().trim().min(2, "Enter the signer's full legal name.").max(160),
  travelerInitials: z.string().trim().min(1, "Enter the traveler's initials.").max(12)
    .regex(/^[\p{L}\p{M} .'-]+$/u, "Enter valid traveler initials."),
  guardianRelationship: z.string().trim().max(80).optional().default(""),
  minorDateOfBirth: z.string().trim().max(10).optional().default(""),
  electronicSignatureConsent: z.literal(true, { errorMap: () => ({ message: "Electronic-signature consent is required." }) }),
  electronicRecordsDisclosureAccepted: z.literal(true, { errorMap: () => ({ message: "Electronic-records disclosure consent is required." }) }),
  agreementConsent: z.literal(true, { errorMap: () => ({ message: "Agreement acceptance is required." }) }),
  depositAcknowledged: z.literal(true, { errorMap: () => ({ message: "Deposit acknowledgement is required." }) }),
  cancellationAcknowledged: z.literal(true, { errorMap: () => ({ message: "Cancellation acknowledgement is required." }) }),
  healthFitnessAcknowledged: z.literal(true, { errorMap: () => ({ message: "Health and participation acknowledgement is required." }) }),
  insuranceSelection: z.enum(["will_purchase", "declined"], { errorMap: () => ({ message: "Choose a travel-insurance decision." }) }),
  insuranceAcknowledged: z.literal(true, { errorMap: () => ({ message: "Travel-insurance acknowledgement is required." }) }),
  releaseAcknowledged: z.literal(true, { errorMap: () => ({ message: "Responsibility and release acknowledgement is required." }) }),
  liabilityLimitAcknowledged: z.literal(true, { errorMap: () => ({ message: "Liability-limit acknowledgement is required." }) }),
  safetyBriefingAcknowledged: z.literal(true, { errorMap: () => ({ message: "Safety-briefing acknowledgement is required." }) }),
  agreementViewedToEnd: z.literal(true, { errorMap: () => ({ message: "Review the complete agreement before signing." }) }),
  photoMediaOptIn: z.boolean().optional().default(false),
});

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!currentTravelerAgreement) {
    return Response.json({ error: "Traveler agreement acceptance is not active." }, { status: 503 });
  }

  const { token } = await context.params;
  const invitationResult = await getAgreementInvitation(token);
  if (invitationResult.status === "accepted") {
    return Response.json({ error: "This agreement has already been accepted." }, { status: 409 });
  }
  if (invitationResult.status !== "ready") {
    const status = invitationResult.status === "expired" ? 410 : 404;
    return Response.json({ error: "This agreement link is invalid or unavailable." }, { status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const parsed = acceptanceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter valid acceptance information." }, { status: 400 });
  }

  const data = parsed.data;
  const isMinor = invitationResult.invitation.travelerType === "minor";
  if (isMinor && !data.guardianRelationship) {
    return Response.json({ error: "Enter the parent or guardian's relationship to the minor." }, { status: 400 });
  }
  if (isMinor && !isValidPastDate(data.minorDateOfBirth)) {
    return Response.json({ error: "Enter the minor traveler's valid date of birth." }, { status: 400 });
  }
  if (!invitationResult.invitation.emailVerifiedAt) {
    return Response.json({ error: "Verify the recorded email address before signing." }, { status: 403 });
  }

  const hashKey = env.ACCEPTANCE_IP_HASH_KEY?.trim();
  if (!hashKey) {
    return Response.json({ error: "Agreement acceptance is temporarily unavailable." }, { status: 503 });
  }

  if (!(await invitationIsStillAcceptable(invitationResult.invitation.invitationId))) {
    return Response.json({ error: "This agreement link has already been used or revoked." }, { status: 409 });
  }

  const acceptedAt = new Date().toISOString();
  const ipHash = await hashIpAddress(request.headers.get("cf-connecting-ip") ?? "unavailable", hashKey);
  const userAgent = (request.headers.get("user-agent") ?? "unavailable").slice(0, 512);
  const signerType = isMinor ? "guardian" : "traveler";
  const signerEmail = invitationResult.invitation.recipientEmail;
  const snapshot: AgreementAcceptanceSnapshot = {
    agreementVersion: invitationResult.agreement.version,
    agreementDocumentHash: invitationResult.agreementHash,
    agreementCanonicalJson: canonicalizeAgreement(invitationResult.agreement),
    invitationId: invitationResult.invitation.invitationId,
    travelerId: invitationResult.invitation.travelerId,
    bookingRequestId: invitationResult.invitation.bookingRequestId,
    travelerName: `${invitationResult.invitation.firstName} ${invitationResult.invitation.lastName}`,
    travelerType: invitationResult.invitation.travelerType,
    signerType,
    signerLegalName: data.signerLegalName,
    signerEmail,
    companyAcceptedAt: invitationResult.invitation.companyAcceptedAt,
    companyAcceptedBy: invitationResult.invitation.companyAcceptedBy,
    travelerInitials: data.travelerInitials.toUpperCase(),
    guardianRelationship: isMinor ? data.guardianRelationship : null,
    minorDateOfBirth: isMinor ? data.minorDateOfBirth : null,
    electronicSignatureConsent: true,
    electronicRecordsDisclosureAccepted: true,
    agreementConsent: true,
    depositAcknowledged: true,
    cancellationAcknowledged: true,
    healthFitnessAcknowledged: true,
    insuranceSelection: data.insuranceSelection,
    insuranceAcknowledged: true,
    releaseAcknowledged: true,
    liabilityLimitAcknowledged: true,
    safetyBriefingAcknowledged: true,
    agreementViewedToEnd: true,
    photoMediaOptIn: data.photoMediaOptIn,
    emailVerifiedAt: invitationResult.invitation.emailVerifiedAt,
    acceptedAt,
    ipHash,
    userAgent,
  };
  const agreementSnapshot = canonicalizeAcceptanceSnapshot(snapshot);
  const acceptanceRecordHash = await signAcceptanceSnapshot(agreementSnapshot);
  const retentionUntil = retentionUntilForDeparture(invitationResult.invitation.departure);
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateAgreementPdf({ agreement: invitationResult.agreement, snapshot });
  } catch (cause) {
    console.error("Signed agreement PDF generation failed", {
      invitationId: invitationResult.invitation.invitationId,
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return Response.json({
      error: "We couldn't prepare the signed agreement right now. Please try again in a few minutes.",
    }, { status: 503 });
  }
  const signedPdfBase64 = pdfBytesToBase64(pdfBytes);
  const signedPdfSha256 = await sha256Hex(pdfBytes);
  const signedPdfFilename = agreementPdfFilename(snapshot.travelerName, true);
  const db = getDb();

  let acceptanceId: number;
  try {
    const [createdAcceptance] = await db.insert(agreementAcceptances).values({
      invitationId: invitationResult.invitation.invitationId,
      travelerId: invitationResult.invitation.travelerId,
      agreementVersion: invitationResult.agreement.version,
      agreementDocumentHash: invitationResult.agreementHash,
      signerType,
      signerLegalName: data.signerLegalName,
      travelerInitials: data.travelerInitials.toUpperCase(),
      guardianRelationship: isMinor ? data.guardianRelationship : null,
      minorDateOfBirth: isMinor ? data.minorDateOfBirth : null,
      electronicSignatureConsent: data.electronicSignatureConsent,
      electronicRecordsDisclosureAccepted: data.electronicRecordsDisclosureAccepted,
      agreementConsent: data.agreementConsent,
      depositAcknowledged: data.depositAcknowledged,
      cancellationAcknowledged: data.cancellationAcknowledged,
      healthFitnessAcknowledged: data.healthFitnessAcknowledged,
      insuranceSelection: data.insuranceSelection,
      insuranceAcknowledged: data.insuranceAcknowledged,
      releaseAcknowledged: data.releaseAcknowledged,
      liabilityLimitAcknowledged: data.liabilityLimitAcknowledged,
      safetyBriefingAcknowledged: data.safetyBriefingAcknowledged,
      agreementViewedToEnd: data.agreementViewedToEnd,
      insuranceProvider: null,
      photoMediaOptIn: data.photoMediaOptIn,
      ipHash,
      userAgent,
      recipientEmail: signerEmail,
      agreementSnapshot,
      acceptanceRecordHash,
      signedPdfBase64,
      signedPdfSha256,
      retentionUntil,
      acceptedAt,
    }).returning({ id: agreementAcceptances.id });
    acceptanceId = createdAcceptance.id;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.toLowerCase() : "";
    if (message.includes("unique") || message.includes("constraint")) {
      return Response.json({ error: "This agreement has already been accepted." }, { status: 409 });
    }
    throw cause;
  }

  await db.update(agreementInvitations)
    .set({ acceptedAt })
    .where(eq(agreementInvitations.id, invitationResult.invitation.invitationId));

  let copyEmailStatus: "sent" | "error" = "sent";
  try {
    const delivery = await sendSignedAgreementEmail({
      toEmail: signerEmail,
      toName: data.signerLegalName,
      travelerName: snapshot.travelerName,
      acceptedAt,
      pdfBase64: signedPdfBase64,
      filename: signedPdfFilename,
    });
    await db.update(agreementAcceptances)
      .set({
        confirmationEmailSentAt: delivery.sentAt,
        confirmationEmailMessageId: delivery.messageId,
      })
      .where(eq(agreementAcceptances.id, acceptanceId));
  } catch (cause) {
    copyEmailStatus = "error";
    console.error("Agreement accepted but signed PDF email failed", {
      acceptanceId,
      error: cause instanceof Error ? cause.message : String(cause),
    });
  }

  return Response.json({
    acceptedAt,
    signedPdfBase64,
    signedPdfFilename,
    copyEmailStatus,
  }, { status: 201 });
}

async function hashIpAddress(ipAddress: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ipAddress));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
