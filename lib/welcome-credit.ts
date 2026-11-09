import { z } from "zod";
export const welcomeGroupId = "203686368046483338";
export const welcomeConsent = "Send me Vietnam travel inspiration and trip updates from Cookie Paradise Travel Company. I can unsubscribe anytime.";
export const welcomeTerms = "One $50 USD credit per subscriber, applied once to one hosted group or private/FIT Vietnam booking, not per traveler. Request your credit before confirming your booking using your subscribed email. Applied manually by Trung; no code or automatic checkout discount. No cash value.";
export const signupSchema = z.object({
  name: z.string().trim().min(1).max(100), email: z.string().trim().toLowerCase().email().max(180),
  consent: z.literal(true), source: z.literal("/fit"),
  turnstileToken: z.string().min(1).max(2048), website: z.string().max(200).optional(),
});
export const redeemSchema = z.object({ id: z.string().uuid(), bookingReference: z.string().trim().min(3).max(150), applied: z.literal(true) });
export type WelcomeCredit = { id: string; email: string; name: string; source: string; created_at: string; sync_status: string; redeemed_at: string | null; booking_reference: string | null; redeemed_by: string | null };
