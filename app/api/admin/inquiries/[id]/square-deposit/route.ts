import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { bookingRequests } from "@/db/schema";
import { getDb } from "@/db";
import { requireOwner } from "@/lib/owner-auth";
import { hasValidOrigin } from "@/lib/same-origin";
import { getAgreementReadiness } from "@/lib/agreement-readiness";
import { createPaymentPlan, todayInIndiana } from "@/lib/payment-schedule";
import {
  createSquareCustomer,
  createSquareDepositInvoice,
  createSquareDepositOrder,
  getSquareInvoiceVersion,
  getSquareOrderAmountCents,
  publishSquareInvoice,
} from "@/lib/square";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const owner = await requireOwner("/admin/inquiries");
  if (!owner) return Response.json({ error: "Not authorized" }, { status: 403 });

  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Invalid inquiry" }, { status: 400 });

  const db = getDb();
  const [inquiry] = await db.select().from(bookingRequests).where(eq(bookingRequests.id, id)).limit(1);
  if (!inquiry) return Response.json({ error: "Inquiry not found" }, { status: 404 });

  const agreementReadiness = await getAgreementReadiness(id, inquiry.partySize);
  if (!agreementReadiness.readyForInvoice) {
    return Response.json({
      error: `Payment invoice is locked. ${agreementReadiness.message}`,
      agreementReadiness,
    }, { status: 409 });
  }

  const body = await request.json().catch(() => null) as { bookingTotalDollars?: unknown } | null;
  const bookingTotalDollars = typeof body?.bookingTotalDollars === "number" ? body.bookingTotalDollars : NaN;
  if (!Number.isFinite(bookingTotalDollars) || bookingTotalDollars <= 0 || bookingTotalDollars > 100_000) {
    return Response.json({ error: "Enter the confirmed total booking price before creating the invoice." }, { status: 400 });
  }
  if (inquiry.departure === "flexible") {
    return Response.json({ error: "Assign a specific departure before creating a payment invoice." }, { status: 400 });
  }
  const bookingTotalCents = Math.round(bookingTotalDollars * 100);
  const acceptanceDate = todayInIndiana();
  let paymentPlan;
  try {
    paymentPlan = createPaymentPlan({
      bookingTotalCents,
      partySize: inquiry.partySize,
      departure: inquiry.departure,
      acceptanceDate,
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "The payment schedule could not be calculated.",
    }, { status: 400 });
  }
  const claimTimestamp = new Date().toISOString();
  const staleClaimBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const claimableStatus = ["not_created", "error", "draft"].includes(inquiry.squareDepositInvoiceStatus);
  const claimedAtTime = inquiry.squareDepositClaimedAt ? Date.parse(inquiry.squareDepositClaimedAt) : NaN;
  const staleCreatingClaim = inquiry.squareDepositInvoiceStatus === "creating"
    && (!Number.isFinite(claimedAtTime) || claimedAtTime <= Date.parse(staleClaimBefore));

  if (!claimableStatus && !staleCreatingClaim) {
    if (inquiry.squareDepositInvoiceStatus === "creating") {
      return Response.json({ error: "Invoice creation is already in progress. Try again after five minutes." }, { status: 409 });
    }
    return Response.json({ error: "A payment invoice already exists for this inquiry." }, { status: 409 });
  }

  const [claimed] = await db.update(bookingRequests).set({
    squareDepositInvoiceStatus: "creating",
    squareDepositClaimedAt: claimTimestamp,
  })
    .where(and(
      eq(bookingRequests.id, id),
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
    ))
    .returning({ id: bookingRequests.id });
  if (!claimed) {
    return Response.json({ error: "Invoice creation is already in progress. Try again after five minutes." }, { status: 409 });
  }

  try {
    let customerId = inquiry.squareCustomerId;
    if (!customerId) {
      customerId = await createSquareCustomer({
        inquiryId: id,
        fullName: inquiry.fullName,
        email: inquiry.email,
        phone: inquiry.phone,
      });
      await db.update(bookingRequests).set({ squareCustomerId: customerId }).where(eq(bookingRequests.id, id));
    }

    let orderId = inquiry.squareDepositOrderId;
    let squareOrderAmountCents: number;
    if (orderId) {
      squareOrderAmountCents = await getSquareOrderAmountCents(orderId);
    } else {
      const order = await createSquareDepositOrder({
        inquiryId: id,
        customerId,
        bookingTotalCents,
        paymentType: paymentPlan.paymentType,
      });
      orderId = order.id;
      squareOrderAmountCents = order.amountCents;
      await db.update(bookingRequests).set({
        squareDepositOrderId: orderId,
        squareDepositAmountCents: squareOrderAmountCents,
      }).where(eq(bookingRequests.id, id));
    }

    if (squareOrderAmountCents !== bookingTotalCents) {
      await db.update(bookingRequests).set({
        squareDepositInvoiceStatus: "error",
        squareDepositAmountCents: squareOrderAmountCents,
        squareDepositClaimedAt: null,
      }).where(eq(bookingRequests.id, id));
      return Response.json({
        error: `Square already has an order for a $${(squareOrderAmountCents / 100).toFixed(2)} total booking price. The entered total is $${(bookingTotalCents / 100).toFixed(2)}. Use the original confirmed booking total or resolve the existing Square order before retrying.`,
      }, { status: 409 });
    }

    let invoiceId = inquiry.squareDepositInvoiceId;
    let invoiceVersion: number | undefined;
    if (!invoiceId) {
      const draft = await createSquareDepositInvoice({
        inquiryId: id,
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
      });
      invoiceId = draft.id;
      invoiceVersion = draft.version;
      await db.update(bookingRequests).set({
        squareDepositInvoiceId: invoiceId,
        squareDepositInvoiceStatus: "draft",
        squareDepositInvoiceVersion: invoiceVersion,
      }).where(eq(bookingRequests.id, id));
    }

    let published: { status: string; publicUrl: string | null; version: number };
    if (invoiceVersion === undefined) {
      const existingInvoice = await getSquareInvoiceVersion(invoiceId);
      invoiceVersion = existingInvoice.version;
      published = existingInvoice.status === "draft"
        ? await publishSquareInvoice({ inquiryId: id, invoiceId, version: invoiceVersion })
        : {
            status: existingInvoice.status,
            publicUrl: existingInvoice.publicUrl,
            version: existingInvoice.version,
          };
    } else {
      published = await publishSquareInvoice({ inquiryId: id, invoiceId, version: invoiceVersion });
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
      companyAcceptedBy: inquiry.companyAcceptedBy ?? owner.email,
    }).where(eq(bookingRequests.id, id));

    return Response.json({
      ok: true,
      bookingTotalCents: squareOrderAmountCents,
      amountDueNowCents: paymentPlan.initialAmountCents,
      paymentType: paymentPlan.paymentType,
      installments: paymentPlan.installments,
      finalPaymentDeadline: paymentPlan.finalPaymentDeadline,
      publicUrl: published.publicUrl,
      status: published.status,
    });
  } catch (error) {
    console.error("Square deposit invoice failed", error);
    await db.update(bookingRequests).set({
      squareDepositInvoiceStatus: "error",
      squareDepositClaimedAt: null,
    }).where(eq(bookingRequests.id, id));
    const errorMessage = error instanceof Error ? error.message : "";
    const message = errorMessage === "Square is not fully configured."
      ? "Square is not fully configured yet. Add the Sandbox access token and try again."
      : /subscription|INSTALLMENT/iu.test(errorMessage)
        ? `Square rejected the installment invoice.${errorMessage ? ` Square said: ${errorMessage}` : ""}`
        : `Square could not create the invoice. No second invoice will be created on retry.${errorMessage ? ` ${errorMessage}` : ""}`;
    return Response.json({ error: message }, { status: 502 });
  }
}
