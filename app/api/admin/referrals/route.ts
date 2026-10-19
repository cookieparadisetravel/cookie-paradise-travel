import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingRequests, salonReferralCompletions, salonReferralPilots, travelers } from "@/db/schema";
import { requireOwner } from "@/lib/owner-auth";
import { hasValidOrigin } from "@/lib/same-origin";
import { dateInPilot, getSalonPartner, validReferralDate } from "@/lib/salon-referrals";
import { todayInIndiana } from "@/lib/payment-schedule";
import { getAgreementReadiness } from "@/lib/agreement-readiness";
import { getSafeDatabaseErrorDetails } from "@/lib/safe-error";

export async function PATCH(request: Request) {
  if (!hasValidOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const owner = await requireOwner("/admin/referrals");
  if (!owner) return Response.json({ error: "Not authorized." }, { status: 403 });
  let payload: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid body");
    payload = value as Record<string, unknown>;
  } catch { return Response.json({ error: "Request body must be a JSON object." }, { status: 400 }); }
  const db = getDb();
  const now = new Date().toISOString();
  const today = todayInIndiana();
  try {
    if (payload.action === "pilot") {
      const partner = getSalonPartner(payload.code);
      const startDate = payload.materialsReceivedOn;
      if (!partner || !validReferralDate(startDate) || startDate > today) {
        return Response.json({ error: "Select a valid materials-received date that is not in the future." }, { status: 400 });
      }
      const reviewed = await db.select({ id: travelers.id }).from(salonReferralCompletions)
        .innerJoin(travelers, eq(travelers.id, salonReferralCompletions.travelerId))
        .innerJoin(bookingRequests, eq(bookingRequests.id, travelers.bookingRequestId))
        .where(eq(bookingRequests.referralCode, partner.code)).limit(1);
      if (reviewed.length) return Response.json({ error: "This pilot date is locked because traveler commission reviews already exist." }, { status: 409 });
      await db.insert(salonReferralPilots).values({ code: partner.code, materialsReceivedOn: startDate, updatedAt: now, updatedBy: owner.email })
        .onConflictDoUpdate({ target: salonReferralPilots.code, set: { materialsReceivedOn: startDate, updatedAt: now, updatedBy: owner.email } });
      return Response.json({ ok: true });
    }
    if (payload.action !== "completion" || !Number.isSafeInteger(payload.travelerId) || Number(payload.travelerId) < 1 || typeof payload.successful !== "boolean") {
      return Response.json({ error: "Invalid referral review." }, { status: 400 });
    }
    const travelerId = Number(payload.travelerId);
    const [row] = await db.select({ traveler: travelers, inquiry: bookingRequests }).from(travelers)
      .innerJoin(bookingRequests, eq(bookingRequests.id, travelers.bookingRequestId)).where(eq(travelers.id, travelerId));
    if (!row || !getSalonPartner(row.inquiry.referralCode)) return Response.json({ error: "Attributed traveler not found." }, { status: 404 });
    if (!payload.successful) {
      await db.update(salonReferralCompletions).set({ successful: false, reviewedBy: owner.email, reviewedAt: now })
        .where(eq(salonReferralCompletions.travelerId, travelerId));
      return Response.json({ ok: true });
    }
    const qualifiedOn = payload.qualifiedOn;
    const [pilot] = await db.select().from(salonReferralPilots).where(eq(salonReferralPilots.code, row.inquiry.referralCode!));
    const inquiryDate = todayInIndiana(new Date(row.inquiry.createdAt.includes("T") ? row.inquiry.createdAt : row.inquiry.createdAt.replace(" ", "T") + "Z"));
    if (!validReferralDate(qualifiedOn) || qualifiedOn > today || qualifiedOn < inquiryDate
      || !dateInPilot(pilot?.materialsReceivedOn ?? null, qualifiedOn)
      || !dateInPilot(pilot?.materialsReceivedOn ?? null, inquiryDate)) {
      return Response.json({ error: "The inquiry, signed agreement and cleared deposit must qualify within this partner’s 90-day pilot. Enter the date the last requirement was met." }, { status: 400 });
    }
    const tripEnds = new Date(`${row.inquiry.departure}T00:00:00Z`);
    tripEnds.setUTCDate(tripEnds.getUTCDate() + 7);
    if (row.inquiry.squareEnvironment !== "production" || row.inquiry.squareDepositInvoiceStatus !== "paid"
      || !Number.isFinite(tripEnds.getTime()) || today <= tripEnds.toISOString().slice(0, 10)
      || payload.tripCompletedAndNotRefunded !== true) {
      return Response.json({ error: "Confirm the traveler completed the trip without cancellation or refund. The Production invoice must be fully paid, and the eight-day trip must have ended." }, { status: 409 });
    }
    const readiness = await getAgreementReadiness(row.inquiry.id, row.inquiry.partySize);
    if (!readiness.acceptedTravelerIds.includes(travelerId)) {
      return Response.json({ error: "This traveler’s signed agreement has not been recorded." }, { status: 409 });
    }
    await db.insert(salonReferralCompletions).values({ travelerId, qualifiedOn, successful: true, reviewedBy: owner.email, reviewedAt: now })
      .onConflictDoUpdate({ target: salonReferralCompletions.travelerId, set: { qualifiedOn, successful: true, reviewedBy: owner.email, reviewedAt: now } });
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Partner referral update failed", getSafeDatabaseErrorDetails(error));
    return Response.json({ error: "The referral update could not be saved. Please try again." }, { status: 500 });
  }
}
