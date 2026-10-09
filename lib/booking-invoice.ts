import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { bookingRequests, travelers } from "@/db/schema";
import { getDb } from "@/db";
import { getAgreementReadiness } from "@/lib/agreement-readiness";
import { isPaymentPreference } from "@/lib/payment-preference-invitation";
import {
  applyPaymentPreference,
  combineTravelerPaymentPlans,
  createPaymentPlan,
  todayInIndiana,
} from "@/lib/payment-schedule";
import {
  createSquareCustomer,
  createSquareDepositInvoice,
  createSquareDepositOrder,
  getSquareInvoiceVersion,
  getSquareOrderAmountCents,
  publishSquareInvoice,
} from "@/lib/square";

type InvoiceCreationSuccess = {
  ok: true;
  bookingTotalCents: number;
  amountDueNowCents: number;
  paymentType: "deposit" | "full";
  installments: Array<{ dueDate: string; amountCents: number }>;
  finalPaymentDeadline: string;
  publicUrl: string | null;
  status: string;
};

type InvoiceCreationFailure = {
  ok: false;
  status: number;
  error: string;
};

export type BookingInvoiceResult = InvoiceCreationSuccess | InvoiceCreationFailure;

export async function createBookingInvoice(input: { inquiryId: number; acceptedBy: string }): Promise<BookingInvoiceResult> {
  const db = getDb();
  const [inquiry] = await db.select().from(bookingRequests).where(eq(bookingRequests.id, input.inquiryId)).limit(1);
  if (!inquiry) return failure(404, "Inquiry not found");

  const agreementReadiness = await getAgreementReadiness(input.inquiryId, inquiry.partySize);
  if (!agreementReadiness.readyForInvoice) {
    return failure(409, `Payment invoice is locked. ${agreementReadiness.message}`);
  }
  if (!inquiry.confirmedBookingTotalCents || inquiry.confirmedBookingTotalCents < 1) {
    return failure(409, "Create the secure payment-choice link with the confirmed booking total before invoicing.");
  }
  if (inquiry.departure === "flexible") {
    return failure(400, "Assign a specific departure before creating a payment invoice.");
  }
  if (!isPaymentPreference(inquiry.paymentPreference)) {
    return failure(409, "The primary contact must submit a payment preference before invoicing.");
  }

  const paymentPreference = inquiry.paymentPreference;
  const bookingTotalCents = inquiry.confirmedBookingTotalCents;
  const acceptanceDate = todayInIndiana();
  let paymentPlan;
  try {
    const travelerPrices = await db.select({
      tripPriceCents: travelers.confirmedTripPriceCents,
    }).from(travelers).where(eq(travelers.bookingRequestId, input.inquiryId));
    if (
      travelerPrices.length !== inquiry.partySize
      || travelerPrices.some((traveler) => !traveler.tripPriceCents || traveler.tripPriceCents < 1)
    ) {
      return failure(409, "Every traveler must have a confirmed Trip Price before the Square draft is prepared.");
    }
    const allocatedTotal = travelerPrices.reduce((sum, traveler) => sum + (traveler.tripPriceCents ?? 0), 0);
    if (allocatedTotal !== bookingTotalCents) {
      return failure(409, "The individual traveler prices do not equal the confirmed booking total.");
    }
    const individualPlans = travelerPrices.map((traveler) => {
      const tripPriceCents = traveler.tripPriceCents!;
      const standard = createPaymentPlan({
        bookingTotalCents: tripPriceCents,
        partySize: 1,
        departure: inquiry.departure,
        acceptanceDate,
      });
      return applyPaymentPreference(standard, tripPriceCents, paymentPreference);
    });
    paymentPlan = combineTravelerPaymentPlans(individualPlans, bookingTotalCents);
    if (!paymentPlan) {
      return failure(409, "The traveler payment schedules could not be combined. Check that every Trip Price is more than the $500 deposit.");
    }
  } catch (error) {
    return failure(400, error instanceof Error ? error.message : "The payment schedule could not be calculated.");
  }

  const claimTimestamp = new Date().toISOString();
  const staleClaimBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const claimableStatus = ["not_created", "error", "draft"].includes(inquiry.squareDepositInvoiceStatus);
  const claimedAtTime = inquiry.squareDepositClaimedAt ? Date.parse(inquiry.squareDepositClaimedAt) : NaN;
  const staleCreatingClaim = inquiry.squareDepositInvoiceStatus === "creating"
    && (!Number.isFinite(claimedAtTime) || claimedAtTime <= Date.parse(staleClaimBefore));

  if (!claimableStatus && !staleCreatingClaim) {
    return inquiry.squareDepositInvoiceStatus === "creating"
      ? failure(409, "Invoice creation is already in progress. Try again after five minutes.")
      : failure(409, "A payment invoice already exists for this inquiry.");
  }

  const [claimed] = await db.update(bookingRequests).set({
    squareDepositInvoiceStatus: "creating",
    squareDepositClaimedAt: claimTimestamp,
  }).where(and(
    eq(bookingRequests.id, input.inquiryId),
    or(
      inArray(bookingRequests.squareDepositInvoiceStatus, ["not_created", "error", "draft"]),
      and(
        eq(bookingRequests.squareDepositInvoiceStatus, "creating"),
        or(
          isNull(bookingRequests.squareDepositClaimedAt),
          lt(bookingRequests.squareDepositClaimedAt, staleClaimBefore),
        ),
      ),
    ),
  )).returning({ id: bookingRequests.id });
  if (!claimed) return failure(409, "Invoice creation is already in progress. Try again after five minutes.");

  try {
    let customerId = inquiry.squareCustomerId;
    if (!customerId) {
      customerId = await createSquareCustomer({
        inquiryId: input.inquiryId,
        fullName: inquiry.fullName,
        email: inquiry.email,
        phone: inquiry.phone,
      });
      await db.update(bookingRequests).set({ squareCustomerId: customerId }).where(eq(bookingRequests.id, input.inquiryId));
    }

    let orderId = inquiry.squareDepositOrderId;
    let squareOrderAmountCents: number;
    if (orderId) {
      squareOrderAmountCents = await getSquareOrderAmountCents(orderId);
    } else {
      const order = await createSquareDepositOrder({
        inquiryId: input.inquiryId,
        customerId,
        bookingTotalCents,
        paymentType: paymentPlan.paymentType,
      });
      orderId = order.id;
      squareOrderAmountCents = order.amountCents;
      await db.update(bookingRequests).set({
        squareDepositOrderId: orderId,
        squareDepositAmountCents: squareOrderAmountCents,
      }).where(eq(bookingRequests.id, input.inquiryId));
    }

    if (squareOrderAmountCents !== bookingTotalCents) {
      await db.update(bookingRequests).set({
        squareDepositInvoiceStatus: "error",
        squareDepositAmountCents: squareOrderAmountCents,
        squareDepositClaimedAt: null,
      }).where(eq(bookingRequests.id, input.inquiryId));
      return failure(409, `Square already has an order for a $${(squareOrderAmountCents / 100).toFixed(2)} total booking price. The confirmed total is $${(bookingTotalCents / 100).toFixed(2)}. Resolve the existing Square order before retrying.`);
    }

    let invoiceId = inquiry.squareDepositInvoiceId;
    let invoiceVersion: number | undefined;
    if (!invoiceId) {
      const draft = await createSquareDepositInvoice({
        inquiryId: input.inquiryId,
        customerId,
        orderId,
        partySize: inquiry.partySize,
        departure: inquiry.departure,
        acceptanceDate,
        bookingTotalCents: squareOrderAmountCents,
        initialAmountCents: paymentPlan.initialAmountCents,
        paymentType: paymentPlan.paymentType,
        installments: paymentPlan.installments,
        finalPaymentDeadline: paymentPlan.finalPaymentDeadline,
        allowStoredPaymentMethod: paymentPlan.paymentType === "deposit",
      });
      invoiceId = draft.id;
      invoiceVersion = draft.version;
      await db.update(bookingRequests).set({
        squareDepositInvoiceId: invoiceId,
        squareDepositInvoiceStatus: "draft",
        squareDepositInvoiceVersion: invoiceVersion,
      }).where(eq(bookingRequests.id, input.inquiryId));
    }

    let published: { status: string; publicUrl: string | null; version: number };
    if (invoiceVersion === undefined) {
      const existingInvoice = await getSquareInvoiceVersion(invoiceId);
      if (existingInvoice.paymentType !== paymentPlan.paymentType) {
        await db.update(bookingRequests).set({
          squareDepositInvoiceStatus: "error",
          squareDepositClaimedAt: null,
        }).where(eq(bookingRequests.id, input.inquiryId));
        return failure(409, "Square already has an unpublished draft for this inquiry that no longer matches today's payment schedule. Cancel that draft in the Square Dashboard (Invoices → Drafts), then try again.");
      }
      if (
        existingInvoice.status === "draft"
        && existingInvoice.earliestDueDate
        && existingInvoice.earliestDueDate < acceptanceDate
      ) {
        await db.update(bookingRequests).set({
          squareDepositInvoiceStatus: "error",
          squareDepositClaimedAt: null,
        }).where(eq(bookingRequests.id, input.inquiryId));
        return failure(409, "Square already has an unpublished draft for this inquiry that no longer matches today's payment schedule. Cancel that draft in the Square Dashboard (Invoices → Drafts), then try again.");
      }
      invoiceVersion = existingInvoice.version;
      published = existingInvoice.status === "draft"
        ? await publishSquareInvoice({ inquiryId: input.inquiryId, invoiceId, version: invoiceVersion })
        : { status: existingInvoice.status, publicUrl: existingInvoice.publicUrl, version: existingInvoice.version };
    } else {
      published = await publishSquareInvoice({ inquiryId: input.inquiryId, invoiceId, version: invoiceVersion });
    }

    const companyAcceptedAt = inquiry.companyAcceptedAt ?? new Date().toISOString();
    await db.update(bookingRequests).set({
      squareDepositInvoiceStatus: published.status,
      squareDepositInvoiceVersion: published.version,
      squareDepositAmountCents: squareOrderAmountCents,
      squareDepositInvoiceUrl: published.publicUrl,
      squareDepositCreatedAt: new Date().toISOString(),
      squareDepositClaimedAt: null,
      companyAcceptedAt,
      companyAcceptedBy: inquiry.companyAcceptedBy ?? input.acceptedBy,
    }).where(eq(bookingRequests.id, input.inquiryId));

    return {
      ok: true,
      bookingTotalCents: squareOrderAmountCents,
      amountDueNowCents: paymentPlan.initialAmountCents,
      paymentType: paymentPlan.paymentType,
      installments: paymentPlan.installments,
      finalPaymentDeadline: paymentPlan.finalPaymentDeadline,
      publicUrl: published.publicUrl,
      status: published.status,
    };
  } catch (error) {
    console.error("Square payment invoice failed", error);
    await db.update(bookingRequests).set({
      squareDepositInvoiceStatus: "error",
      squareDepositClaimedAt: null,
    }).where(eq(bookingRequests.id, input.inquiryId));
    const errorMessage = error instanceof Error ? error.message : "";
    const message = errorMessage === "Square is not fully configured."
      ? "Square is not fully configured yet. Add the Sandbox access token and try again."
      : /subscription|INSTALLMENT/iu.test(errorMessage)
        ? `Square rejected the installment invoice.${errorMessage ? ` Square said: ${errorMessage}` : ""}`
        : `Square could not create the invoice. No second invoice will be created on retry.${errorMessage ? ` ${errorMessage}` : ""}`;
    return failure(502, message);
  }
}

function failure(status: number, error: string): InvoiceCreationFailure {
  return { ok: false, status, error };
}
