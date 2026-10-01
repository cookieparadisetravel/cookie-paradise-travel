import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { travelerListInvitations, travelers } from "@/db/schema";
import { getDb } from "@/db";
import { getTravelerListInvitation } from "@/lib/traveler-list-invitation";

const travelerSchema = z.object({
  firstName: z.string().trim().min(1, "Enter each traveler's legal first name.").max(80),
  lastName: z.string().trim().min(1, "Enter each traveler's legal last name.").max(80),
  email: z.string().trim().email("Enter a valid traveler or guardian email address.").max(254),
  travelerType: z.enum(["adult", "minor"]),
  guardianLegalName: z.string().trim().max(160).optional().default(""),
  guardianRelationship: z.string().trim().max(80).optional().default(""),
}).superRefine((value, context) => {
  if (value.travelerType !== "minor") return;
  if (!value.guardianLegalName) context.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianLegalName"], message: "Enter the parent or guardian's legal name." });
  if (!value.guardianRelationship) context.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianRelationship"], message: "Enter the parent or guardian's relationship to the minor." });
});

const submissionSchema = z.object({
  travelers: z.array(travelerSchema).min(1).max(15),
});

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const invitation = await getTravelerListInvitation(token);
  if (invitation.status === "completed") return Response.json({ error: "This traveler list has already been submitted." }, { status: 409 });
  if (invitation.status !== "ready") {
    return Response.json({ error: "This traveler-list link is invalid, expired or unavailable." }, { status: invitation.status === "expired" ? 410 : 404 });
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

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Enter valid traveler information." }, { status: 400 });
  }
  if (parsed.data.travelers.length !== invitation.remainingTravelerCount) {
    return Response.json({ error: `Enter exactly ${invitation.remainingTravelerCount} remaining traveler${invitation.remainingTravelerCount === 1 ? "" : "s"}.` }, { status: 400 });
  }

  const normalizedTravelers = parsed.data.travelers.map((traveler) => ({
    firstName: traveler.firstName,
    lastName: traveler.lastName,
    email: traveler.email.toLowerCase(),
    travelerType: traveler.travelerType,
    guardianLegalName: traveler.travelerType === "minor" ? traveler.guardianLegalName : null,
    guardianRelationship: traveler.travelerType === "minor" ? traveler.guardianRelationship : null,
  }));
  const submittedKeys = normalizedTravelers.map((traveler) => `${traveler.firstName.toLowerCase()}\u0000${traveler.lastName.toLowerCase()}\u0000${traveler.email}`);
  if (new Set(submittedKeys).size !== submittedKeys.length) {
    return Response.json({ error: "The same traveler is listed more than once." }, { status: 409 });
  }

  const db = getDb();
  const existingTravelers = await db.select({ firstName: travelers.firstName, lastName: travelers.lastName, email: travelers.email })
    .from(travelers)
    .where(eq(travelers.bookingRequestId, invitation.bookingRequestId));
  const existingKeys = new Set(existingTravelers.map((traveler) => `${traveler.firstName.toLowerCase()}\u0000${traveler.lastName.toLowerCase()}\u0000${traveler.email.toLowerCase()}`));
  if (submittedKeys.some((key) => existingKeys.has(key))) {
    return Response.json({ error: "A submitted traveler is already listed for this booking." }, { status: 409 });
  }

  const completedAt = new Date().toISOString();
  await db.insert(travelers).values(normalizedTravelers.map((traveler) => ({
    bookingRequestId: invitation.bookingRequestId,
    ...traveler,
  })));
  await db.update(travelerListInvitations).set({ completedAt }).where(and(
    eq(travelerListInvitations.id, invitation.invitationId),
    isNull(travelerListInvitations.completedAt),
    isNull(travelerListInvitations.revokedAt),
  ));

  return Response.json({ completedAt }, { status: 201 });
}
