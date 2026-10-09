import { and, eq, isNull } from "drizzle-orm";
import {
  agreementAcceptances,
  agreementInvitations,
  bookingRequests,
  paymentPreferenceInvitations,
  travelerListInvitations,
  travelers,
} from "@/db/schema";
import { getDb } from "@/db";
import { getAgreementReadiness } from "@/lib/agreement-readiness";
import {
  sendAgreementInvitationEmail,
  sendPaymentChoiceInvitationEmail,
  sendTravelerListInvitationEmail,
} from "@/lib/mailersend-transactional";
import { createPaymentPlan, todayInIndiana } from "@/lib/payment-schedule";
import { automaticTravelerPriceCents } from "@/lib/trip-pricing";
import {
  formatSafeDatabaseErrorDetails,
  getSafeDatabaseErrorDetails,
} from "@/lib/safe-error";
import {
  buildPersonalizedTravelerAgreement,
  canonicalizeAgreement,
  currentTravelerAgreement,
  hashAgreementDocument,
  hashInvitationToken,
} from "@/lib/traveler-agreement";

const COMPANY_AUTOMATION_IDENTITY = "Cookie Paradise Travel Company automated booking flow";
const TRAVELER_LIST_LIFETIME_DAYS = 7;
const AGREEMENT_LIFETIME_DAYS = 14;
const PAYMENT_CHOICE_LIFETIME_DAYS = 7;

export type AutomatedBookingStatus =
  | "not_requested"
  | "traveler_list_sent"
  | "agreements_sent"
  | "payment_choice_sending"
  | "payment_choice_sent"
  | "invoice_created"
  | "blocked"
  | "error";

export async function startAutomatedReadyToBookFlow(input: {
  inquiryId: number;
  requestUrl: string;
}) {
  const db = getDb();
  const [inquiry] = await db.select().from(bookingRequests)
    .where(eq(bookingRequests.id, input.inquiryId))
    .limit(1);
  if (!inquiry || inquiry.bookingIntent !== "ready_to_book") return "not_requested" as const;

  try {
    if (inquiry.sellerOfTravelStateResident) {
      await setAutomationState(input.inquiryId, "blocked", "Seller-of-travel residency screening requires owner review before agreements or payment steps are sent.");
      return "blocked" as const;
    }

    if (inquiry.partySize > 1) {
      await createAndSendTravelerListInvitation({ inquiryId: inquiry.id, requestUrl: input.requestUrl });
      return "traveler_list_sent" as const;
    }

    await assignAutomaticTravelerPricing(inquiry.id, inquiry.roomPreference);
    await createAndSendAgreementInvitations({ inquiryId: inquiry.id, requestUrl: input.requestUrl });
    return "agreements_sent" as const;
  } catch (error) {
    await recordAutomationFailure(inquiry.id, error);
    return "error" as const;
  }
}

export async function continueAutomatedBookingAfterTravelerList(input: {
  inquiryId: number;
  requestUrl: string;
}) {
  const db = getDb();
  const [inquiry] = await db.select().from(bookingRequests)
    .where(eq(bookingRequests.id, input.inquiryId))
    .limit(1);
  if (!inquiry || inquiry.bookingIntent !== "ready_to_book" || inquiry.sellerOfTravelStateResident) return;

  try {
    await assignAutomaticTravelerPricing(inquiry.id, inquiry.roomPreference);
    await createAndSendAgreementInvitations({ inquiryId: inquiry.id, requestUrl: input.requestUrl });
  } catch (error) {
    await recordAutomationFailure(inquiry.id, error);
  }
}

export async function continueAutomatedBookingAfterAgreement(input: {
  inquiryId: number;
  requestUrl: string;
}) {
  const db = getDb();
  const [inquiry] = await db.select().from(bookingRequests)
    .where(eq(bookingRequests.id, input.inquiryId))
    .limit(1);
  if (!inquiry || inquiry.bookingIntent !== "ready_to_book" || inquiry.sellerOfTravelStateResident) return;

  const readiness = await getAgreementReadiness(inquiry.id, inquiry.partySize);
  if (!readiness.readyForInvoice) return;

  const claimed = await db.update(bookingRequests).set({
    automatedBookingStatus: "payment_choice_sending",
    automatedBookingError: null,
    automatedBookingUpdatedAt: new Date().toISOString(),
  }).where(and(
    eq(bookingRequests.id, inquiry.id),
    eq(bookingRequests.bookingIntent, "ready_to_book"),
    eq(bookingRequests.automatedBookingStatus, "agreements_sent"),
  )).returning({ id: bookingRequests.id });
  if (claimed.length === 0) return;

  try {
    await createAndSendPaymentChoiceInvitation({ inquiryId: inquiry.id, requestUrl: input.requestUrl });
  } catch (error) {
    await recordAutomationFailure(inquiry.id, error);
  }
}

export async function markAutomatedInvoiceCreated(inquiryId: number) {
  const db = getDb();
  await db.update(bookingRequests).set({
    automatedBookingStatus: "invoice_created",
    automatedBookingError: null,
    automatedBookingUpdatedAt: new Date().toISOString(),
  }).where(and(
    eq(bookingRequests.id, inquiryId),
    eq(bookingRequests.bookingIntent, "ready_to_book"),
  ));
}

async function createAndSendTravelerListInvitation(input: { inquiryId: number; requestUrl: string }) {
  const db = getDb();
  const [inquiry] = await db.select().from(bookingRequests)
    .where(eq(bookingRequests.id, input.inquiryId))
    .limit(1);
  if (!inquiry) throw new Error("Inquiry not found.");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRAVELER_LIST_LIFETIME_DAYS * 86_400_000).toISOString();
  const token = createInvitationToken();
  const tokenHash = await hashInvitationToken(token);

  await db.update(travelerListInvitations).set({ revokedAt: now.toISOString() }).where(and(
    eq(travelerListInvitations.bookingRequestId, inquiry.id),
    isNull(travelerListInvitations.completedAt),
    isNull(travelerListInvitations.revokedAt),
  ));
  const [created] = await db.insert(travelerListInvitations).values({
    bookingRequestId: inquiry.id,
    tokenHash,
    expiresAt,
  }).returning({ id: travelerListInvitations.id });

  const invitationUrl = new URL(`/traveler-list/${encodeURIComponent(token)}`, input.requestUrl).toString();
  try {
    await sendTravelerListInvitationEmail({
      toEmail: inquiry.email,
      toName: inquiry.fullName,
      invitationUrl,
      partySize: inquiry.partySize,
      expiresAt,
    });
  } catch (error) {
    await db.update(travelerListInvitations).set({ revokedAt: new Date().toISOString() })
      .where(eq(travelerListInvitations.id, created.id));
    await recordAutomationFailure(inquiry.id, error);
    throw error;
  }

  await setAutomationState(inquiry.id, "traveler_list_sent", null);
}

async function assignAutomaticTravelerPricing(inquiryId: number, roomPreference: string) {
  const db = getDb();
  const occupancy = roomPreference === "private" ? "private" : "shared";
  const tripPriceCents = automaticTravelerPriceCents(occupancy);
  await db.update(travelers).set({
    confirmedTripPriceCents: tripPriceCents,
    confirmedOccupancy: occupancy,
  }).where(eq(travelers.bookingRequestId, inquiryId));
}

async function createAndSendAgreementInvitations(input: { inquiryId: number; requestUrl: string }) {
  if (!currentTravelerAgreement) throw new Error("The Traveler Agreement is not active.");
  const db = getDb();
  const [inquiry] = await db.select().from(bookingRequests)
    .where(eq(bookingRequests.id, input.inquiryId))
    .limit(1);
  if (!inquiry) throw new Error("Inquiry not found.");

  const bookingTravelers = await db.select().from(travelers)
    .where(eq(travelers.bookingRequestId, inquiry.id));
  if (bookingTravelers.length !== inquiry.partySize) {
    throw new Error("The traveler count must exactly match the party size before agreements are sent.");
  }
  if (bookingTravelers.some((traveler) => !traveler.confirmedTripPriceCents || (traveler.confirmedOccupancy !== "shared" && traveler.confirmedOccupancy !== "private"))) {
    throw new Error("Every traveler needs a confirmed Trip Price and occupancy before agreements are sent.");
  }

  const now = new Date();
  const companyAcceptedAt = inquiry.companyAcceptedAt ?? now.toISOString();
  await db.update(bookingRequests).set({
    companyAcceptedAt,
    companyAcceptedBy: inquiry.companyAcceptedBy ?? COMPANY_AUTOMATION_IDENTITY,
  }).where(eq(bookingRequests.id, inquiry.id));

  for (const traveler of bookingTravelers) {
    const personalizedAgreement = buildPersonalizedTravelerAgreement({
      travelerName: `${traveler.firstName} ${traveler.lastName}`,
      departure: inquiry.departure,
      occupancy: traveler.confirmedOccupancy === "private" ? "Private room supplement" : "Shared double/twin room",
      tripPriceCents: traveler.confirmedTripPriceCents!,
    });
    const agreementHash = await hashAgreementDocument(personalizedAgreement);
    const [accepted] = await db.select({ id: agreementAcceptances.id })
      .from(agreementAcceptances)
      .where(and(
        eq(agreementAcceptances.travelerId, traveler.id),
        eq(agreementAcceptances.agreementVersion, currentTravelerAgreement.version),
        eq(agreementAcceptances.agreementDocumentHash, agreementHash),
      ))
      .limit(1);
    if (accepted) continue;

    const existingInvitations = await db.select().from(agreementInvitations)
      .where(and(
        eq(agreementInvitations.travelerId, traveler.id),
        isNull(agreementInvitations.acceptedAt),
        isNull(agreementInvitations.revokedAt),
      ));
    const reusable = existingInvitations.find((invitation) =>
      invitation.agreementVersion === currentTravelerAgreement.version
      && invitation.agreementDocumentHash === agreementHash
      && Boolean(invitation.invitationEmailSentAt)
      && Date.parse(invitation.expiresAt) > Date.now());
    if (reusable) continue;

    await db.update(agreementInvitations).set({ revokedAt: now.toISOString() }).where(and(
      eq(agreementInvitations.travelerId, traveler.id),
      isNull(agreementInvitations.acceptedAt),
      isNull(agreementInvitations.revokedAt),
    ));

    const token = createInvitationToken();
    const tokenHash = await hashInvitationToken(token);
    const expiresAt = new Date(now.getTime() + AGREEMENT_LIFETIME_DAYS * 86_400_000).toISOString();
    const [created] = await db.insert(agreementInvitations).values({
      travelerId: traveler.id,
      tokenHash,
      agreementVersion: currentTravelerAgreement.version,
      agreementDocumentHash: agreementHash,
      agreementDocumentJson: canonicalizeAgreement(personalizedAgreement),
      recipientEmail: traveler.email.trim().toLowerCase(),
      expiresAt,
    }).returning({ id: agreementInvitations.id });
    const invitationUrl = new URL(`/traveler-agreement/${encodeURIComponent(token)}`, input.requestUrl).toString();

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
      await db.update(agreementInvitations).set({
        invitationEmailSentAt: delivery.sentAt,
        invitationEmailMessageId: delivery.messageId,
      }).where(eq(agreementInvitations.id, created.id));
    } catch (error) {
      await db.update(agreementInvitations).set({ revokedAt: new Date().toISOString() })
        .where(eq(agreementInvitations.id, created.id));
      throw error;
    }
  }

  await setAutomationState(inquiry.id, "agreements_sent", null);
}

async function createAndSendPaymentChoiceInvitation(input: { inquiryId: number; requestUrl: string }) {
  const db = getDb();
  const [inquiry] = await db.select().from(bookingRequests)
    .where(eq(bookingRequests.id, input.inquiryId))
    .limit(1);
  if (!inquiry) throw new Error("Inquiry not found.");

  const bookingTravelers = await db.select({ tripPriceCents: travelers.confirmedTripPriceCents })
    .from(travelers)
    .where(eq(travelers.bookingRequestId, inquiry.id));
  if (bookingTravelers.length !== inquiry.partySize || bookingTravelers.some((traveler) => !traveler.tripPriceCents)) {
    throw new Error("Traveler pricing is incomplete.");
  }
  const bookingTotalCents = bookingTravelers.reduce((sum, traveler) => sum + (traveler.tripPriceCents ?? 0), 0);
  createPaymentPlan({
    bookingTotalCents,
    partySize: inquiry.partySize,
    departure: inquiry.departure,
    acceptanceDate: inquiry.companyAcceptedAt ? todayInIndiana(new Date(inquiry.companyAcceptedAt)) : todayInIndiana(),
  });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + PAYMENT_CHOICE_LIFETIME_DAYS * 86_400_000).toISOString();
  const token = createInvitationToken();
  const tokenHash = await hashInvitationToken(token);

  await db.update(paymentPreferenceInvitations).set({ revokedAt: now.toISOString() }).where(and(
    eq(paymentPreferenceInvitations.bookingRequestId, inquiry.id),
    isNull(paymentPreferenceInvitations.completedAt),
    isNull(paymentPreferenceInvitations.revokedAt),
  ));
  await db.update(bookingRequests).set({
    confirmedBookingTotalCents: bookingTotalCents,
    paymentPreference: null,
    paymentPreferenceSelectedAt: null,
  }).where(eq(bookingRequests.id, inquiry.id));
  const [created] = await db.insert(paymentPreferenceInvitations).values({
    bookingRequestId: inquiry.id,
    tokenHash,
    createdBy: COMPANY_AUTOMATION_IDENTITY,
    expiresAt,
    createdAt: now.toISOString(),
  }).returning({ id: paymentPreferenceInvitations.id });
  const invitationUrl = new URL(`/payment-preference/${encodeURIComponent(token)}`, input.requestUrl).toString();

  try {
    await sendPaymentChoiceInvitationEmail({
      toEmail: inquiry.email,
      toName: inquiry.fullName,
      invitationUrl,
      bookingTotalCents,
      expiresAt,
    });
  } catch (error) {
    await db.update(paymentPreferenceInvitations).set({ revokedAt: new Date().toISOString() })
      .where(eq(paymentPreferenceInvitations.id, created.id));
    throw error;
  }

  await setAutomationState(inquiry.id, "payment_choice_sent", null);
}

async function setAutomationState(inquiryId: number, status: AutomatedBookingStatus, error: string | null) {
  const db = getDb();
  await db.update(bookingRequests).set({
    automatedBookingStatus: status,
    automatedBookingError: error,
    automatedBookingUpdatedAt: new Date().toISOString(),
  }).where(eq(bookingRequests.id, inquiryId));
}

async function recordAutomationFailure(inquiryId: number, error: unknown) {
  const details = getSafeDatabaseErrorDetails(error);
  console.error("Automated booking flow failed", { inquiryId, ...details });
  await setAutomationState(inquiryId, "error", formatSafeDatabaseErrorDetails(error));
}

function createInvitationToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
