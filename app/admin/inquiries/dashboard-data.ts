import { env } from "cloudflare:workers";
import { desc } from "drizzle-orm";
import {
  agreementInvitations,
  bookingRequests,
  paymentPreferenceInvitations,
  travelerListInvitations,
  travelers,
} from "@/db/schema";
import { getDb } from "@/db";
import { getAgreementReadiness } from "@/lib/agreement-readiness";
import { todayInIndiana } from "@/lib/payment-schedule";
import { currentTravelerAgreement } from "@/lib/traveler-agreement";
import type {
  AgreementInvitationDelivery,
  DashboardInquiry,
  DashboardTraveler,
  SquareMode,
} from "./dashboard-types";

export async function loadInquiryDashboardData() {
  const db = getDb();
  const [inquiryRows, travelerRows, agreementInvitationRows, travelerListRows, paymentChoiceRows] = await Promise.all([
    db.select().from(bookingRequests).orderBy(desc(bookingRequests.createdAt)),
    db.select().from(travelers).orderBy(travelers.createdAt),
    db.select().from(agreementInvitations).orderBy(desc(agreementInvitations.createdAt)),
    db.select().from(travelerListInvitations).orderBy(desc(travelerListInvitations.createdAt)),
    db.select().from(paymentPreferenceInvitations).orderBy(desc(paymentPreferenceInvitations.createdAt)),
  ]);

  const travelersByInquiry = new Map<number, DashboardTraveler[]>();
  for (const traveler of travelerRows) {
    const existing = travelersByInquiry.get(traveler.bookingRequestId) ?? [];
    existing.push(traveler);
    travelersByInquiry.set(traveler.bookingRequestId, existing);
  }

  const latestAgreementInvitationByTraveler = new Map<number, AgreementInvitationDelivery>();
  for (const invitation of agreementInvitationRows) {
    if (latestAgreementInvitationByTraveler.has(invitation.travelerId)) continue;
    if (invitation.agreementVersion !== currentTravelerAgreement.version || !invitation.agreementDocumentJson) continue;
    if (!invitation.invitationEmailSentAt || !invitation.recipientEmail) continue;
    latestAgreementInvitationByTraveler.set(invitation.travelerId, {
      email: invitation.recipientEmail,
      sentAt: invitation.invitationEmailSentAt,
      expiresAt: invitation.expiresAt,
      revokedAt: invitation.revokedAt,
      acceptedAt: invitation.acceptedAt,
    });
  }

  const latestTravelerListByInquiry = new Map<number, (typeof travelerListRows)[number]>();
  for (const invitation of travelerListRows) {
    if (!latestTravelerListByInquiry.has(invitation.bookingRequestId)) {
      latestTravelerListByInquiry.set(invitation.bookingRequestId, invitation);
    }
  }

  const latestPaymentChoiceByInquiry = new Map<number, (typeof paymentChoiceRows)[number]>();
  for (const invitation of paymentChoiceRows) {
    if (!latestPaymentChoiceByInquiry.has(invitation.bookingRequestId)) {
      latestPaymentChoiceByInquiry.set(invitation.bookingRequestId, invitation);
    }
  }

  const agreementReadinessEntries = await Promise.all(inquiryRows.map(async (inquiry) => [
    inquiry.id,
    await getAgreementReadiness(inquiry.id, inquiry.partySize),
  ] as const));
  const agreementReadinessByInquiry = new Map(agreementReadinessEntries);
  // This forced-dynamic server request snapshots the recovery cutoff once.
  const requestTime = Date.now();
  const staleSquareClaimBefore = requestTime - 5 * 60_000;
  const staleAutopayClaimBefore = requestTime - 10 * 60_000;

  const inquiries: DashboardInquiry[] = inquiryRows.map((inquiry) => {
    const inquiryTravelers = travelersByInquiry.get(inquiry.id) ?? [];
    const agreementReadiness = agreementReadinessByInquiry.get(inquiry.id);
    if (!agreementReadiness) throw new Error(`Agreement readiness is unavailable for inquiry ${inquiry.id}.`);
    const agreementInvitationDeliveries: Record<number, AgreementInvitationDelivery> = {};
    for (const traveler of inquiryTravelers) {
      const delivery = latestAgreementInvitationByTraveler.get(traveler.id);
      if (delivery) agreementInvitationDeliveries[traveler.id] = delivery;
    }
    const travelerListInvitation = latestTravelerListByInquiry.get(inquiry.id);
    const paymentChoiceInvitation = latestPaymentChoiceByInquiry.get(inquiry.id);
    const claimedAtTime = inquiry.squareDepositClaimedAt ? Date.parse(inquiry.squareDepositClaimedAt) : NaN;
    const autopayClaimedAtTime = inquiry.installmentAutopayClaimedAt
      ? Date.parse(inquiry.installmentAutopayClaimedAt)
      : NaN;

    return {
      ...inquiry,
      companyAcceptanceDate: inquiry.companyAcceptedAt
        ? todayInIndiana(new Date(inquiry.companyAcceptedAt))
        : todayInIndiana(),
      travelers: inquiryTravelers,
      agreementActive: agreementReadiness.agreementActive,
      agreementReady: agreementReadiness.readyForInvoice,
      agreementReadinessMessage: agreementReadiness.message,
      acceptedTravelerIds: agreementReadiness.acceptedTravelerIds,
      agreementInvitationDeliveries,
      latestTravelerListLinkCreatedAt: travelerListInvitation?.createdAt ?? null,
      latestTravelerListCompletedAt: travelerListInvitation?.completedAt ?? null,
      latestPaymentChoiceLinkCreatedAt: paymentChoiceInvitation?.createdAt ?? null,
      latestPaymentChoiceCompletedAt: paymentChoiceInvitation?.completedAt ?? null,
      latestPaymentChoiceInvitation: paymentChoiceInvitation ? {
        id: paymentChoiceInvitation.id,
        createdAt: paymentChoiceInvitation.createdAt,
        expiresAt: paymentChoiceInvitation.expiresAt,
        completedAt: paymentChoiceInvitation.completedAt,
        revokedAt: paymentChoiceInvitation.revokedAt,
        usable: !paymentChoiceInvitation.completedAt
          && !paymentChoiceInvitation.revokedAt
          && Date.parse(paymentChoiceInvitation.expiresAt) > requestTime,
      } : null,
      squareDepositClaimIsStale: inquiry.squareDepositInvoiceStatus === "creating"
        && (!Number.isFinite(claimedAtTime) || claimedAtTime <= staleSquareClaimBefore),
      installmentAutopayClaimIsStale:
        (inquiry.installmentAutopayStatus === "authorization_sending"
          || inquiry.installmentAutopayStatus === "activating"
          || (inquiry.installmentAutopayStatus === "error"
            && inquiry.installmentAutopayError === "The optional automatic-installment authorization email could not be sent."))
        && (!Number.isFinite(autopayClaimedAtTime) || autopayClaimedAtTime <= staleAutopayClaimBefore),
    };
  });

  const runtime = env as unknown as { SQUARE_ENV?: string };
  const squareMode: SquareMode = runtime.SQUARE_ENV === "production" ? "production" : "sandbox";

  return {
    acceptanceDate: todayInIndiana(),
    inquiries,
    squareMode,
  };
}
