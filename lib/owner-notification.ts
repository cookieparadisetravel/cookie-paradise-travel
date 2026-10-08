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
  bookingIntent: "ready_to_book" | "needs_information";
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

type AutopayAuthorizationNotification = {
  inquiryId: number;
  primaryContactName: string;
  departure: string;
  paymentCount: number;
  totalCents: number;
  outcome: "active" | "square_failed";
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

export async function sendOwnerAutopayAuthorizationNotification(input: AutopayAuthorizationNotification): Promise<OwnerNotificationStatus> {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const webhookUrl = runtimeEnv.OWNER_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return "not_configured";

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: input.outcome === "active" ? "autopay_authorization.activated" : "autopay_authorization.failed",
        submittedAt: new Date().toISOString(),
        autopayAuthorization: input,
      }),
    });
    return response.ok ? "sent" : "error";
  } catch (error) {
    console.error("Owner automatic-installment notification failed", error);
    return "error";
  }
}
