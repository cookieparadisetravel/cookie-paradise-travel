import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { bookingRequests, travelers } from "@/db/schema";
import { getDb } from "@/db";
import { isOwnerRequest } from "@/lib/owner-auth";
import { hasValidOrigin } from "@/lib/same-origin";
import { isValidPastDate } from "@/lib/agreement-acceptance-record";

const travelerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254),
  travelerType: z.enum(["adult", "minor"]),
  dateOfBirth: z.string().trim().max(10).optional().default(""),
  guardianLegalName: z.string().trim().max(160).optional().default(""),
  guardianRelationship: z.string().trim().max(80).optional().default(""),
}).superRefine((value, context) => {
  if (value.travelerType !== "minor") return;
  if (!value.guardianLegalName) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianLegalName"], message: "Enter the parent or guardian's legal name." });
  }
  if (!value.guardianRelationship) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianRelationship"], message: "Enter the parent or guardian's relationship to the minor." });
  }
  if (!isValidPastDate(value.dateOfBirth)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["dateOfBirth"], message: "Enter the minor traveler's valid date of birth." });
  }
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!hasValidOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await isOwnerRequest())) return Response.json({ error: "Not authorized" }, { status: 403 });

  const { id: rawId } = await context.params;
  const bookingRequestId = Number(rawId);
  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return Response.json({ error: "Invalid inquiry" }, { status: 400 });
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = travelerSchema.safeParse(parsedPayload);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter valid traveler information." }, { status: 400 });
  }

  const db = getDb();
  const [inquiry] = await db.select({ id: bookingRequests.id, partySize: bookingRequests.partySize })
    .from(bookingRequests)
    .where(eq(bookingRequests.id, bookingRequestId))
    .limit(1);
  if (!inquiry) return Response.json({ error: "Inquiry not found" }, { status: 404 });

  const [travelerCount] = await db.select({ value: count() })
    .from(travelers)
    .where(eq(travelers.bookingRequestId, bookingRequestId));
  if ((travelerCount?.value ?? 0) >= inquiry.partySize) {
    return Response.json({ error: `This inquiry already has all ${inquiry.partySize} traveler records.` }, { status: 409 });
  }

  const value = parsed.data;
  const normalizedEmail = value.email.toLowerCase();
  const [duplicate] = await db.select({ id: travelers.id })
    .from(travelers)
    .where(and(
      eq(travelers.bookingRequestId, bookingRequestId),
      eq(travelers.firstName, value.firstName),
      eq(travelers.lastName, value.lastName),
      eq(travelers.email, normalizedEmail),
    ))
    .limit(1);
  if (duplicate) {
    return Response.json({ error: "This traveler is already listed for the inquiry." }, { status: 409 });
  }

  const [created] = await db.insert(travelers).values({
    bookingRequestId,
    firstName: value.firstName,
    lastName: value.lastName,
    email: normalizedEmail,
    travelerType: value.travelerType,
    dateOfBirth: value.travelerType === "minor" ? value.dateOfBirth : null,
    guardianLegalName: value.travelerType === "minor" ? value.guardianLegalName : null,
    guardianRelationship: value.travelerType === "minor" ? value.guardianRelationship : null,
  }).returning();

  return Response.json({ traveler: created }, { status: 201 });
}
