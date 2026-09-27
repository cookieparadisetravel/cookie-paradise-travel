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

export type OwnerNotificationStatus = "sent" | "not_configured" | "error";

export async function sendOwnerInquiryNotification(input: InquiryNotification): Promise<OwnerNotificationStatus> {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const webhookUrl = runtimeEnv.OWNER_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return "not_configured";

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
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
