import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { travelerListInvitations, travelers } from "@/db/schema";
import { getDb } from "@/db";
import { sendOwnerTravelerListNotification } from "@/lib/owner-notification";
import { getTravelerListInvitation } from "@/lib/traveler-list-invitation";
import { isValidPastDate } from "@/lib/agreement-acceptance-record";

const travelerSchema = z.object({
  firstName: z.string().trim().min(1, "Enter each traveler's legal first name.").max(80),
  lastName: z.string().trim().min(1, "Enter each traveler's legal last name.").max(80),
  email: z.string().trim().email("Enter a valid traveler or guardian email address.").max(254),
  travelerType: z.enum(["adult", "minor"]),
  dateOfBirth: z.string().trim().max(10).optional().default(""),
  guardianLegalName: z.string().trim().max(160).optional().default(""),
  guardianRelationship: z.string().trim().max(80).optional().default(""),
}).superRefine((value, context) => {
  if (value.travelerType !== "minor") return;
  if (!value.guardianLegalName) context.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianLegalName"], message: "Enter the parent or guardian's legal name." });
  if (!value.guardianRelationship) context.addIssue({ code: z.ZodIssueCode.custom, path: ["guardianRelationship"], message: "Enter the parent or guardian's relationship to the minor." });
  if (!isValidPastDate(value.dateOfBirth)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["dateOfBirth"], message: "Enter the minor traveler's valid date of birth." });
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
  const { bookingRequestId, invitationId, partySize, remainingTravelerCount } = invitation;

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
  if (parsed.data.travelers.length !== remainingTravelerCount) {
    return Response.json({ error: `Enter exactly ${remainingTravelerCount} remaining traveler${remainingTravelerCount === 1 ? "" : "s"}.` }, { status: 400 });
  }

  const normalizedTravelers = parsed.data.travelers.map((traveler) => ({
    firstName: traveler.firstName,
    lastName: traveler.lastName,
    email: traveler.email.toLowerCase(),
    travelerType: traveler.travelerType,
    dateOfBirth: traveler.travelerType === "minor" ? traveler.dateOfBirth : null,
    guardianLegalName: traveler.travelerType === "minor" ? traveler.guardianLegalName : null,
    guardianRelationship: traveler.travelerType === "minor" ? traveler.guardianRelationship : null,
  }));
  const submittedKeys = normalizedTravelers.map((traveler) => `${traveler.firstName.toLowerCase()}\u0000${traveler.lastName.toLowerCase()}\u0000${traveler.email}`);
  if (new Set(submittedKeys).size !== submittedKeys.length) {
    return Response.json({ error: "The same traveler is listed more than once." }, { status: 409 });
  }

  const db = getDb();
  const completedAt = new Date().toISOString();
  const claimedInvitations = await db.update(travelerListInvitations).set({ completedAt }).where(and(
    eq(travelerListInvitations.id, invitationId),
    isNull(travelerListInvitations.completedAt),
    isNull(travelerListInvitations.revokedAt),
  )).returning({ id: travelerListInvitations.id });

  if (claimedInvitations.length === 0) {
    return Response.json({ error: "This traveler list has already been submitted." }, { status: 409 });
  }

  async function releaseClaim() {
    await db.update(travelerListInvitations).set({ completedAt: null }).where(and(
      eq(travelerListInvitations.id, invitationId),
      eq(travelerListInvitations.completedAt, completedAt),
      isNull(travelerListInvitations.revokedAt),
    ));
  }

  try {
    const existingTravelers = await db.select({ firstName: travelers.firstName, lastName: travelers.lastName, email: travelers.email })
      .from(travelers)
      .where(eq(travelers.bookingRequestId, bookingRequestId));

    if (existingTravelers.length + normalizedTravelers.length > partySize) {
      await releaseClaim();
      return Response.json({ error: "These travelers would exceed the party size for this booking." }, { status: 409 });
    }

    const existingKeys = new Set(existingTravelers.map((traveler) => `${traveler.firstName.toLowerCase()}\u0000${traveler.lastName.toLowerCase()}\u0000${traveler.email.toLowerCase()}`));
    if (submittedKeys.some((key) => existingKeys.has(key))) {
      await releaseClaim();
      return Response.json({ error: "A submitted traveler is already listed for this booking." }, { status: 409 });
    }

    await db.insert(travelers).values(normalizedTravelers.map((traveler) => ({
      bookingRequestId,
      ...traveler,
    })));
  } catch {
    try {
      await releaseClaim();
    } catch {
      return Response.json({ error: "Traveler information could not be saved, and the secure link could not be restored. Please contact Cookie Paradise Travel Company for a new link." }, { status: 500 });
    }
    return Response.json({ error: "Traveler information could not be saved. Please try again." }, { status: 500 });
  }

  const ownerNotificationStatus = await sendOwnerTravelerListNotification({
    inquiryId: bookingRequestId,
    primaryContactName: invitation.primaryContactName,
    departure: invitation.departure,
    travelerCount: normalizedTravelers.length,
  });
  if (ownerNotificationStatus === "error") {
    console.error("Traveler list was saved, but the owner notification could not be delivered", {
      bookingRequestId,
      invitationId,
    });
  }

  return Response.json({ completedAt }, { status: 201 });
}
