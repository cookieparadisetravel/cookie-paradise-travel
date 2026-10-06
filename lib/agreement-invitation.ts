import { and, eq, isNull } from "drizzle-orm";
import { agreementAcceptances, agreementInvitations, bookingRequests, travelers } from "@/db/schema";
import { getDb } from "@/db";
import {
  currentTravelerAgreement,
  hashAgreementDocument,
  hashInvitationToken,
  isValidInvitationToken,
  parseAgreementDocument,
  type AgreementDocument,
} from "@/lib/traveler-agreement";

export type AgreementInvitationView = {
  invitationId: number;
  travelerId: number;
  bookingRequestId: number;
  departure: string;
  firstName: string;
  lastName: string;
  email: string;
  travelerType: string;
  dateOfBirth: string | null;
  guardianLegalName: string | null;
  guardianRelationship: string | null;
  recipientEmail: string;
  companyAcceptedAt: string;
  companyAcceptedBy: string;
  verificationCodeSentAt: string | null;
  verificationCodeExpiresAt: string | null;
  verificationAttempts: number;
  emailVerifiedAt: string | null;
  expiresAt: string;
};

export type AgreementInvitationResult =
  | { status: "disabled" }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "revoked" }
  | { status: "accepted"; acceptedAt: string | null }
  | {
      status: "ready";
      invitation: AgreementInvitationView;
      agreementHash: string;
      agreement: AgreementDocument;
    };

export async function getAgreementInvitation(token: string): Promise<AgreementInvitationResult> {
  const agreement = currentTravelerAgreement;
  if (!agreement) return { status: "disabled" };
  if (!isValidInvitationToken(token)) return { status: "invalid" };

  const tokenHash = await hashInvitationToken(token);
  const db = getDb();
  const [record] = await db
    .select({
      invitationId: agreementInvitations.id,
      travelerId: travelers.id,
      bookingRequestId: travelers.bookingRequestId,
      departure: bookingRequests.departure,
      firstName: travelers.firstName,
      lastName: travelers.lastName,
      email: travelers.email,
      travelerType: travelers.travelerType,
      dateOfBirth: travelers.dateOfBirth,
      guardianLegalName: travelers.guardianLegalName,
      guardianRelationship: travelers.guardianRelationship,
      recipientEmail: agreementInvitations.recipientEmail,
      companyAcceptedAt: bookingRequests.companyAcceptedAt,
      companyAcceptedBy: bookingRequests.companyAcceptedBy,
      verificationCodeSentAt: agreementInvitations.verificationCodeSentAt,
      verificationCodeExpiresAt: agreementInvitations.verificationCodeExpiresAt,
      verificationAttempts: agreementInvitations.verificationAttempts,
      emailVerifiedAt: agreementInvitations.emailVerifiedAt,
      agreementVersion: agreementInvitations.agreementVersion,
      agreementDocumentHash: agreementInvitations.agreementDocumentHash,
      agreementDocumentJson: agreementInvitations.agreementDocumentJson,
      expiresAt: agreementInvitations.expiresAt,
      acceptedAt: agreementInvitations.acceptedAt,
      revokedAt: agreementInvitations.revokedAt,
    })
    .from(agreementInvitations)
    .innerJoin(travelers, eq(agreementInvitations.travelerId, travelers.id))
    .innerJoin(bookingRequests, eq(travelers.bookingRequestId, bookingRequests.id))
    .where(eq(agreementInvitations.tokenHash, tokenHash))
    .limit(1);

  if (!record) return { status: "invalid" };
  if (record.revokedAt) return { status: "revoked" };

  const [existingAcceptance] = await db
    .select({ acceptedAt: agreementAcceptances.acceptedAt })
    .from(agreementAcceptances)
    .where(eq(agreementAcceptances.invitationId, record.invitationId))
    .limit(1);
  if (existingAcceptance || record.acceptedAt) {
    return { status: "accepted", acceptedAt: existingAcceptance?.acceptedAt ?? record.acceptedAt };
  }

  const expiresAt = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return { status: "expired" };

  const personalizedAgreement = record.agreementDocumentJson
    ? parseAgreementDocument(record.agreementDocumentJson)
    : null;
  if (!personalizedAgreement || record.agreementVersion !== agreement.version || personalizedAgreement.version !== agreement.version) {
    return { status: "invalid" };
  }
  if (!record.companyAcceptedAt || !record.companyAcceptedBy) return { status: "invalid" };
  if (await hashAgreementDocument(personalizedAgreement) !== record.agreementDocumentHash) {
    return { status: "invalid" };
  }

  return {
    status: "ready",
    invitation: {
      invitationId: record.invitationId,
      travelerId: record.travelerId,
      bookingRequestId: record.bookingRequestId,
      departure: record.departure,
      firstName: record.firstName,
      lastName: record.lastName,
      email: record.email,
      travelerType: record.travelerType,
      dateOfBirth: record.dateOfBirth,
      guardianLegalName: record.guardianLegalName,
      guardianRelationship: record.guardianRelationship,
      recipientEmail: record.recipientEmail ?? record.email,
      companyAcceptedAt: record.companyAcceptedAt,
      companyAcceptedBy: record.companyAcceptedBy,
      verificationCodeSentAt: record.verificationCodeSentAt,
      verificationCodeExpiresAt: record.verificationCodeExpiresAt,
      verificationAttempts: record.verificationAttempts,
      emailVerifiedAt: record.emailVerifiedAt,
      expiresAt: record.expiresAt,
    },
    agreementHash: record.agreementDocumentHash,
    agreement: personalizedAgreement,
  };
}

export async function invitationIsStillAcceptable(invitationId: number) {
  const db = getDb();
  const [record] = await db
    .select({ id: agreementInvitations.id })
    .from(agreementInvitations)
    .where(and(
      eq(agreementInvitations.id, invitationId),
      isNull(agreementInvitations.acceptedAt),
      isNull(agreementInvitations.revokedAt),
    ))
    .limit(1);
  return Boolean(record);
}
