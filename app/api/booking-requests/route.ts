import { bookingRequests } from "@/db/schema";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";
import { addConsentedSubscriber } from "@/lib/mailerlite";
import { sendOwnerInquiryNotification } from "@/lib/owner-notification";
import { env } from "cloudflare:workers";
import { z } from "zod";

const validDepartures = new Set(["2027-06-01", "2027-06-29", "2027-07-27", "flexible"]);
const validRooms = new Set(["shared", "private", "unsure"]);
const validSellerOfTravelStates = new Set(["CA", "FL", "HI", "WA"]);
const emailSchema = z.string().email().max(180);

type TurnstileVerification = {
  success: boolean;
  action?: string;
  "error-codes"?: string[];
};

async function verifyTurnstileToken(token: string, remoteIp: string | null) {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) throw new Error("TURNSTILE_SECRET_KEY is unavailable");

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) throw new Error(`Turnstile verification returned ${response.status}`);

  const result = await response.json() as TurnstileVerification;
  return result.success && result.action === "booking_inquiry";
}

export async function POST(request: Request) {
  try {
    let parsedPayload: unknown;
    try {
      parsedPayload = await request.json();
    } catch {
      return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    if (!parsedPayload || typeof parsedPayload !== "object" || Array.isArray(parsedPayload)) {
      return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }
    const payload = parsedPayload as Record<string, unknown>;
    const website = String(payload.website ?? "").trim();
    if (website) return Response.json({ ok: true }, { status: 201 });

    const turnstileToken = String(payload.turnstileToken ?? "").trim();
    if (!turnstileToken || turnstileToken.length > 2048) {
      return Response.json({ error: "Please complete the human verification." }, { status: 400 });
    }

    const turnstileValid = await verifyTurnstileToken(
      turnstileToken,
      request.headers.get("CF-Connecting-IP"),
    );
    if (!turnstileValid) {
      return Response.json({ error: "Human verification failed. Please refresh and try again." }, { status: 400 });
    }

    const fullName = String(payload.fullName ?? "").trim();
    const email = String(payload.email ?? "").trim().toLowerCase();
    const phone = String(payload.phone ?? "").trim();
    const departure = String(payload.departure ?? "");
    const room = String(payload.room ?? "");
    const notes = String(payload.notes ?? "").trim();
    const partySize = Number(payload.partySize ?? 1);
    const marketingConsent = payload.marketingConsent === true;
    const contactConsent = payload.contactConsent === true;
    const sellerOfTravelStateResident = payload.sellerOfTravelStateResident === true;
    const residenceState = String(payload.residenceState ?? "").trim().toUpperCase();

    if (!fullName || fullName.length > 120 || !emailSchema.safeParse(email).success) {
      return Response.json({ error: "Valid name and email are required." }, { status: 400 });
    }
    if (!validDepartures.has(departure) || !validRooms.has(room) || !Number.isInteger(partySize) || partySize < 1 || partySize > 6) {
      return Response.json({ error: "Please review the trip selections." }, { status: 400 });
    }
    if (phone.length > 40 || notes.length > 1000) {
      return Response.json({ error: "One or more fields are too long." }, { status: 400 });
    }
    if (!contactConsent) {
      return Response.json({ error: "Contact consent is required to send an inquiry." }, { status: 400 });
    }
    if (sellerOfTravelStateResident && !validSellerOfTravelStates.has(residenceState)) {
      return Response.json({ error: "Please select your state of residence." }, { status: 400 });
    }

    const db = getDb();
    const [saved] = await db.insert(bookingRequests).values({
      tripSlug: "vietnam-southern-charms-central-heritage",
      fullName, email, phone, departure,
      roomPreference: room, partySize, notes,
      contactConsent: true,
      contactConsentedAt: new Date().toISOString(),
      sellerOfTravelStateResident,
      residenceState: sellerOfTravelStateResident ? residenceState : null,
      marketingConsent,
      marketingConsentedAt: marketingConsent ? new Date().toISOString() : null,
      mailerLiteStatus: marketingConsent ? "pending" : "not_requested",
      ownerNotificationStatus: "pending",
    }).returning({ id: bookingRequests.id });

    let mailerLiteStatus = marketingConsent ? "pending" : "not_requested";
    if (marketingConsent) {
      mailerLiteStatus = await addConsentedSubscriber({ fullName, email });
    }

    const ownerNotificationStatus = await sendOwnerInquiryNotification({
      id: saved.id, fullName, email, phone, departure, room, partySize, notes,
      contactConsent: true, sellerOfTravelStateResident,
      residenceState: sellerOfTravelStateResident ? residenceState : null,
    });

    try {
      await db.update(bookingRequests).set({
        mailerLiteStatus,
        ownerNotificationStatus,
      }).where(eq(bookingRequests.id, saved.id));
    } catch (error) {
      console.error("Inquiry saved, but follow-up statuses could not be updated", error);
    }
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Booking request failed", error);
    return Response.json({ error: "Booking requests are temporarily unavailable." }, { status: 500 });
  }
}
