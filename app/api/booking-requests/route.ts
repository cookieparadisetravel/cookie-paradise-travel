import { bookingRequests, travelers } from "@/db/schema";
import { getDb } from "@/db";
import { eq } from "drizzle-orm";
import { addConsentedSubscriber } from "@/lib/mailerlite";
import { sendOwnerInquiryNotification } from "@/lib/owner-notification";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { startAutomatedReadyToBookFlow } from "@/lib/booking-automation";
import { getSafeDatabaseErrorDetails } from "@/lib/safe-error";
import { getSquareEnvironment } from "@/lib/square-config";

import { connectNewBookingToSales } from "@/lib/inquiry-sales";
import { getSalesBookingInvitation, completeSalesBookingInvitation } from "@/lib/inquiry-booking-invitations";
import { sameOrigin } from "@/lib/lead-request";
import { referralFromCookie } from "@/lib/salon-referrals";

const validDepartures = new Set(["2027-06-01"]);
const validRooms = new Set(["shared", "private"]);
const validSellerOfTravelStates = new Set(["CA", "FL", "HI", "MD", "WA"]);
const validBookingIntents = new Set(["ready_to_book", "needs_information"]);
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

    const firstName = String(payload.firstName ?? "").trim();
    const lastName = String(payload.lastName ?? "").trim();
    const fullName = `${firstName} ${lastName}`;
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
    const bookingIntent = String(payload.bookingIntent ?? "");

    if (!firstName || firstName.length > 60 || !lastName || lastName.length > 60 || fullName.length > 121 || !emailSchema.safeParse(email).success) {
      return Response.json({ error: "Valid first name, last name and email are required." }, { status: 400 });
    }
    if (!validDepartures.has(departure) || !validRooms.has(room) || !Number.isInteger(partySize) || partySize < 1 || partySize > 6) {
      return Response.json({ error: "Please review the trip selections." }, { status: 400 });
    }
    if (!phone || phone.length > 40) {
      return Response.json({ error: "A phone number is required and must be 40 characters or fewer." }, { status: 400 });
    }
    if (notes.length > 1000) {
      return Response.json({ error: "Questions or notes must be 1,000 characters or fewer." }, { status: 400 });
    }
    if (!contactConsent) {
      return Response.json({ error: "Contact consent is required to send an inquiry." }, { status: 400 });
    }
    if (sellerOfTravelStateResident && !validSellerOfTravelStates.has(residenceState)) {
      return Response.json({ error: "Please select your state of residence." }, { status: 400 });
    }
    if (!validBookingIntents.has(bookingIntent)) {
      return Response.json({ error: "Please tell us whether you are ready to book or would like more information." }, { status: 400 });
    }
    const automatedBookingEnabled = env.AUTOMATED_BOOKING_ENABLED?.trim().toLowerCase() === "true";
    const bookingPaused = bookingIntent === "ready_to_book" && !automatedBookingEnabled;
    const now = new Date().toISOString();

    const invitationToken=String(payload.bookingInvitationToken ?? "").trim();
    if (invitationToken && (!sameOrigin(request) || !/^[a-f0-9]{64}$/.test(invitationToken) || bookingIntent!=="ready_to_book")) {
      return Response.json({error:"Please use your secure booking link to continue."},{status:400});
    }
    const invitation=invitationToken ? await getSalesBookingInvitation(invitationToken) : null;
    if (invitationToken && !invitation) return Response.json({error:"This booking link has expired or is no longer available. Please contact Trung."},{status:410});
    if (invitation && invitation.sale.email!==email) return Response.json({error:"Use the email address this booking link was sent to."},{status:400});
    let referralCode=invitation ? invitation.sale.referralCode : referralFromCookie(request.headers.get("cookie"))?.code ?? null;
    const db = getDb();
    let saved:{id:number};
    if (invitation) {
      let completed:{bookingId:number;started:boolean};
      try {
        completed=await completeSalesBookingInvitation(invitation,{firstName,lastName,fullName,email,phone,departure,room,partySize,notes,marketingConsent,sellerOfTravelStateResident,residenceState,bookingPaused});
      } catch(error) {
        console.error("Booking handoff could not be completed",getSafeDatabaseErrorDetails(error));
        return Response.json({error:"This request could not be started. Refresh your booking link or contact Trung. No payment was collected."},{status:409});
      }
      saved={id:completed.bookingId};
      if (!completed.started) {
        const [existing]=await db.select({automationStatus:bookingRequests.automatedBookingStatus}).from(bookingRequests).where(eq(bookingRequests.id,saved.id)).limit(1);
        return Response.json({ok:true,bookingIntent:"ready_to_book",automationStatus:existing?.automationStatus ?? "not_requested",bookingPaused},{status:200});
      }
    } else {
      [saved] = await db.insert(bookingRequests).values({
        squareEnvironment: getSquareEnvironment(env as unknown as Record<string, string | undefined>),
        tripSlug: "vietnam-southern-charms-central-heritage",
        referralCode,
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
        bookingIntent,
        automatedBookingStatus: bookingPaused ? "paused" : "not_requested",
        automatedBookingUpdatedAt: bookingPaused ? now : null,
        status: bookingIntent === "ready_to_book" && automatedBookingEnabled ? "booking_in_progress" : "new",
      }).returning({ id: bookingRequests.id });

      try { referralCode=await connectNewBookingToSales(saved.id) ?? referralCode; }
      catch { console.error("Booking saved; sales history needs synchronization."); }
    }

    if (partySize === 1 && !invitation) {
      try {
        await db.insert(travelers).values({
          bookingRequestId: saved.id,
          firstName,
          lastName,
          email,
          travelerType: "adult",
        });
      } catch (error) {
        console.error("Single-traveler inquiry saved, but its traveler record could not be created", {
          inquiryId: saved.id,
          ...getSafeDatabaseErrorDetails(error),
        });
      }
    }

    let mailerLiteStatus = marketingConsent ? "pending" : "not_requested";
    if (marketingConsent) {
      mailerLiteStatus = await addConsentedSubscriber({ firstName, lastName, email });
    }

    const screening = invitation ? (await db.select({
      sellerOfTravelStateResident:bookingRequests.sellerOfTravelStateResident,
      residenceState:bookingRequests.residenceState,
    }).from(bookingRequests).where(eq(bookingRequests.id,saved.id)).limit(1))[0] : null;
    const ownerNotificationStatus = await sendOwnerInquiryNotification({
      id: saved.id, fullName, email, phone, departure, room, partySize, notes,
      contactConsent: true, sellerOfTravelStateResident:screening?.sellerOfTravelStateResident ?? sellerOfTravelStateResident,
      residenceState: screening ? screening.residenceState : sellerOfTravelStateResident ? residenceState : null,
      bookingIntent: bookingIntent as "ready_to_book" | "needs_information",
      referralCode,
    });

    try {
      await db.update(bookingRequests).set({
        mailerLiteStatus,
        ownerNotificationStatus,
      }).where(eq(bookingRequests.id, saved.id));
    } catch (error) {
      console.error("Inquiry saved, but follow-up statuses could not be updated", {
        inquiryId: saved.id,
        ...getSafeDatabaseErrorDetails(error),
      });
    }
    const automationStatus = bookingIntent === "ready_to_book" && automatedBookingEnabled
      ? await startAutomatedReadyToBookFlow({ inquiryId: saved.id, requestUrl: request.url })
      : bookingPaused ? "paused" : "not_requested";

    return Response.json({ ok: true, bookingIntent, automationStatus, bookingPaused }, { status: 201 });
  } catch (error) {
    console.error("Booking request failed", getSafeDatabaseErrorDetails(error));
    return Response.json({ error: "Booking requests are temporarily unavailable." }, { status: 500 });
  }
}
