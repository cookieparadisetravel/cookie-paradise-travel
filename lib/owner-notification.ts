import { env } from "cloudflare:workers";

type InquiryNotification = {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  departure: string;
  room: string;
  partySize: number;
  notes: string;
  contactConsent: boolean;
  sellerOfTravelStateResident: boolean;
  residenceState: string | null;
};

type TravelerListNotification = {
  inquiryId: number;
  primaryContactName: string;
  departure: string;
  travelerCount: number;
};

type PaymentPreferenceNotification = {
  inquiryId: number;
  primaryContactName: string;
  departure: string;
  bookingTotalCents: number;
  paymentPreference: "payment_plan" | "full";
};

export type OwnerNotificationStatus = "sent" | "not_configured" | "error";

export async function sendOwnerInquiryNotification(input: InquiryNotification): Promise<OwnerNotificationStatus> {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const webhookUrl = runtimeEnv.OWNER_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return "not_configured";

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "travel_inquiry.created",
        submittedAt: new Date().toISOString(),
        inquiry: input,
      }),
    });
    return response.ok ? "sent" : "error";
  } catch (error) {
    console.error("Owner inquiry notification failed", error);
    return "error";
  }
}

export async function sendOwnerTravelerListNotification(input: TravelerListNotification): Promise<OwnerNotificationStatus> {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const webhookUrl = runtimeEnv.OWNER_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return "not_configured";

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "traveler_list.submitted",
        submittedAt: new Date().toISOString(),
        travelerList: input,
      }),
    });
    return response.ok ? "sent" : "error";
  } catch (error) {
    console.error("Owner traveler-list notification failed", error);
    return "error";
  }
}

export async function sendOwnerPaymentPreferenceNotification(input: PaymentPreferenceNotification): Promise<OwnerNotificationStatus> {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const webhookUrl = runtimeEnv.OWNER_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return "not_configured";

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "payment_preference.submitted",
        submittedAt: new Date().toISOString(),
        paymentPreference: input,
      }),
    });
    return response.ok ? "sent" : "error";
  } catch (error) {
    console.error("Owner payment-preference notification failed", error);
    return "error";
  }
}
