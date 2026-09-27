import { and, eq, inArray } from "drizzle-orm";
import { bookingRequests } from "@/db/schema";
import { getDb } from "@/db";
import { isOwnerRequest } from "@/lib/owner-auth";
import {
  createSquareCustomer,
  createSquareDepositInvoice,
  createSquareDepositOrder,
  getSquareInvoiceVersion,
  publishSquareInvoice,
} from "@/lib/square";

function daysUntilDeparture(departure: string) {
  const departureTime = Date.parse(`${departure}T12:00:00Z`);
  if (!Number.isFinite(departureTime)) return null;
  return Math.ceil((departureTime - Date.now()) / 86_400_000);
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isOwnerRequest())) return Response.json({ error: "Not authorized" }, { status: 403 });

  const { id: rawId } = await context.params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Invalid inquiry" }, { status: 400 });

  const db = getDb();
  const [inquiry] = await db.select().from(bookingRequests).where(eq(bookingRequests.id, id)).limit(1);
  if (!inquiry) return Response.json({ error: "Inquiry not found" }, { status: 404 });

  const body = await request.json().catch(() => null) as { bookingTotalDollars?: unknown } | null;
  const bookingTotalDollars = typeof body?.bookingTotalDollars === "number" ? body.bookingTotalDollars : NaN;
  if (!Number.isFinite(bookingTotalDollars) || bookingTotalDollars <= 0 || bookingTotalDollars > 100_000) {
    return Response.json({ error: "Enter the confirmed total booking price before creating the invoice." }, { status: 400 });
  }
  if (inquiry.departure === "flexible") {
    return Response.json({ error: "Assign a specific departure before creating a payment invoice." }, { status: 400 });
  }
  const daysRemaining = daysUntilDeparture(inquiry.departure);
  if (daysRemaining === null) return Response.json({ error: "The departure date is invalid." }, { status: 400 });
  const paymentPercent: 50 | 100 = daysRemaining <= 90 ? 100 : 50;
  const bookingTotalCents = Math.round(bookingTotalDollars * 100);
  const amountCents = paymentPercent === 50 ? Math.round(bookingTotalCents / 2) : bookingTotalCents;

  if (inquiry.squareDepositInvoiceId && !["error", "creating"].includes(inquiry.squareDepositInvoiceStatus)) {
    return Response.json({ error: "A deposit invoice already exists for this inquiry." }, { status: 409 });
  }

  const [claimed] = await db.update(bookingRequests).set({ squareDepositInvoiceStatus: "creating" })
    .where(and(
      eq(bookingRequests.id, id),
      inArray(bookingRequests.squareDepositInvoiceStatus, ["not_created", "error"]),
    ))
    .returning({ id: bookingRequests.id });
  if (!claimed) return Response.json({ error: "Invoice creation is already in progress." }, { status: 409 });

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
    if (!orderId) {
      orderId = await createSquareDepositOrder({ inquiryId: id, customerId, amountCents, paymentPercent });
      await db.update(bookingRequests).set({ squareDepositOrderId: orderId }).where(eq(bookingRequests.id, id));
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
        amountCents,
        paymentPercent,
      });
      invoiceId = draft.id;
      invoiceVersion = draft.version;
      await db.update(bookingRequests).set({
        squareDepositInvoiceId: invoiceId,
        squareDepositInvoiceStatus: "draft",
      }).where(eq(bookingRequests.id, id));
    }

    if (invoiceVersion === undefined) invoiceVersion = await getSquareInvoiceVersion(invoiceId);

    const published = await publishSquareInvoice({ inquiryId: id, invoiceId, version: invoiceVersion });
    await db.update(bookingRequests).set({
      squareDepositInvoiceStatus: published.status,
      squareDepositAmountCents: amountCents,
      squareDepositInvoiceUrl: published.publicUrl,
      squareDepositCreatedAt: new Date().toISOString(),
    }).where(eq(bookingRequests.id, id));

    return Response.json({
      ok: true,
      amountCents,
      paymentPercent,
      publicUrl: published.publicUrl,
      status: published.status,
    });
  } catch (error) {
    console.error("Square deposit invoice failed", error);
    await db.update(bookingRequests).set({ squareDepositInvoiceStatus: "error" }).where(eq(bookingRequests.id, id));
    const message = error instanceof Error && error.message === "Square is not fully configured."
      ? "Square is not fully configured yet. Add the Sandbox access token and try again."
      : "Square could not create the invoice. No second invoice will be created on retry.";
    return Response.json({ error: message }, { status: 502 });
  }
}
