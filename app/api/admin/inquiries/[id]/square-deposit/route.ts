import { createBookingInvoice } from "@/lib/booking-invoice";
import { requireOwner } from "@/lib/owner-auth";
import { hasValidOrigin } from "@/lib/same-origin";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const owner = await requireOwner("/admin/inquiries");
  if (!owner) return Response.json({ error: "Not authorized" }, { status: 403 });

  const { id: rawId } = await context.params;
  const inquiryId = Number(rawId);
  if (!Number.isInteger(inquiryId) || inquiryId < 1) {
    return Response.json({ error: "Invalid inquiry" }, { status: 400 });
  }

  const result = await createBookingInvoice({ inquiryId, acceptedBy: owner.email });
  return result.ok
    ? Response.json(result)
    : Response.json({ error: result.error }, { status: result.status });
}
