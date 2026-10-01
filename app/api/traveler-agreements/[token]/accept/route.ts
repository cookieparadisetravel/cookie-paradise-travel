import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { agreementAcceptances, agreementInvitations } from "@/db/schema";
import { getDb } from "@/db";
import { getAgreementInvitation, invitationIsStillAcceptable } from "@/lib/agreement-invitation";
import { currentTravelerAgreement } from "@/lib/traveler-agreement";

const acceptanceSchema = z.object({
  signerLegalName: z.string().trim().min(2, "Enter the signer's full legal name.").max(160),
  travelerInitials: z.string().trim().min(1, "Enter the traveler's initials.").max(12)
    .regex(/^[\p{L}\p{M} .'-]+$/u, "Enter valid traveler initials."),
  guardianRelationship: z.string().trim().max(80).optional().default(""),
  electronicSignatureConsent: z.literal(true, { errorMap: () => ({ message: "Electronic-signature consent is required." }) }),
  agreementConsent: z.literal(true, { errorMap: () => ({ message: "Agreement acceptance is required." }) }),
  depositAcknowledged: z.literal(true, { errorMap: () => ({ message: "Deposit acknowledgement is required." }) }),
  cancellationAcknowledged: z.literal(true, { errorMap: () => ({ message: "Cancellation acknowledgement is required." }) }),
  insuranceSelection: z.enum(["purchased", "will_purchase", "declined"], { errorMap: () => ({ message: "Choose a travel-insurance decision." }) }),
  insuranceProvider: z.string().trim().max(120).optional().default(""),
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
  const db = getDb();

  try {
    await db.insert(agreementAcceptances).values({
      invitationId: invitationResult.invitation.invitationId,
      travelerId: invitationResult.invitation.travelerId,
      agreementVersion: currentTravelerAgreement.version,
      agreementDocumentHash: invitationResult.agreementHash,
      signerType: isMinor ? "guardian" : "traveler",
      signerLegalName: data.signerLegalName,
      travelerInitials: data.travelerInitials.toUpperCase(),
      guardianRelationship: isMinor ? data.guardianRelationship : null,
      electronicSignatureConsent: data.electronicSignatureConsent,
      agreementConsent: data.agreementConsent,
      depositAcknowledged: data.depositAcknowledged,
      cancellationAcknowledged: data.cancellationAcknowledged,
      insuranceSelection: data.insuranceSelection,
      insuranceProvider: data.insuranceProvider || null,
      photoMediaOptIn: data.photoMediaOptIn,
      ipHash,
      userAgent,
      acceptedAt,
    });
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

  return Response.json({ acceptedAt }, { status: 201 });
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
