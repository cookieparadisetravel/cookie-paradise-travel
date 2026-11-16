import { and, eq, inArray, isNotNull, or } from "drizzle-orm";
import { agreementAcceptances, agreementInvitations, bookingRequests, travelers } from "@/db/schema";
import { getDb } from "@/db";
import { currentTravelerAgreement } from "@/lib/traveler-agreement";

export type AgreementReadiness = {
  agreementActive: boolean;
  expectedPartySize: number;
  travelerCount: number;
  acceptedCount: number;
  acceptedTravelerIds: number[];
  readyForInvoice: boolean;
  message: string;
};

export async function getAgreementReadiness(bookingRequestId: number, expectedPartySize: number, options: { requireCurrentAgreement?: boolean } = {}): Promise<AgreementReadiness> {
  const db = getDb();
  const travelerRecords = await db
    .select({ id: travelers.id })
    .from(travelers)
    .where(eq(travelers.bookingRequestId, bookingRequestId));

  if (!currentTravelerAgreement) {
    return {
      agreementActive: false,
      expectedPartySize,
      travelerCount: travelerRecords.length,
      acceptedCount: 0,
      acceptedTravelerIds: [],
      readyForInvoice: false,
      message: "The traveler agreement has not been activated after legal approval.",
    };
  }

  // Old signed terms remain valid for existing invoices and their autopay.
  // New invoices require the revised payment agreement.
  const versionCondition = options.requireCurrentAgreement
    ? eq(agreementAcceptances.agreementVersion, currentTravelerAgreement.version)
    : or(
      eq(agreementAcceptances.agreementVersion, currentTravelerAgreement.version),
      and(inArray(agreementAcceptances.agreementVersion, ["1.0", "1.1"]), isNotNull(bookingRequests.squareDepositInvoiceId)),
    );

  const acceptedRecords = await db
    .select({ travelerId: agreementAcceptances.travelerId })
    .from(agreementAcceptances)
    .innerJoin(agreementInvitations, eq(agreementAcceptances.invitationId, agreementInvitations.id))
    .innerJoin(travelers, eq(agreementAcceptances.travelerId, travelers.id))
    .innerJoin(bookingRequests, eq(travelers.bookingRequestId, bookingRequests.id))
    .where(and(
      eq(travelers.bookingRequestId, bookingRequestId),
      versionCondition,
      eq(agreementAcceptances.agreementDocumentHash, agreementInvitations.agreementDocumentHash),
    ));

  const travelerIds = new Set(travelerRecords.map((traveler) => traveler.id));
  const acceptedTravelerIds = [...new Set(acceptedRecords.map((record) => record.travelerId))]
    .filter((travelerId) => travelerIds.has(travelerId));
  const travelerCount = travelerRecords.length;
  const acceptedCount = acceptedTravelerIds.length;
  const readyForInvoice = travelerCount === expectedPartySize && acceptedCount === expectedPartySize;

  let message = "Every traveler has accepted the current agreement.";
  if (travelerCount < expectedPartySize) {
    message = `Add ${expectedPartySize - travelerCount} more traveler record${expectedPartySize - travelerCount === 1 ? "" : "s"} before invoicing.`;
  } else if (travelerCount > expectedPartySize) {
    message = "The traveler count exceeds the inquiry party size. Resolve the traveler records before invoicing.";
  } else if (acceptedCount < expectedPartySize) {
    message = `${expectedPartySize - acceptedCount} traveler agreement${expectedPartySize - acceptedCount === 1 ? " is" : "s are"} still awaiting acceptance.`;
  }

  return {
    agreementActive: true,
    expectedPartySize,
    travelerCount,
    acceptedCount,
    acceptedTravelerIds,
    readyForInvoice,
    message,
  };
}
