import { env } from "cloudflare:workers";

type SubscriberInput = { firstName: string; lastName: string; email: string };

export type MailerLiteStatus = "synced" | "not_configured" | "error";

export async function addConsentedSubscriber(input: SubscriberInput): Promise<MailerLiteStatus> {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const token = runtimeEnv.MAILERLITE_API_TOKEN;
  const groupId = runtimeEnv.MAILERLITE_GROUP_ID;
  if (!token || !groupId) return "not_configured";

  try {
    const response = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        fields: { name: input.firstName, last_name: input.lastName },
        groups: [groupId],
        opted_in_at: new Date().toISOString().replace("T", " ").slice(0, 19),
      }),
    });
    return response.ok ? "synced" : "error";
  } catch (error) {
    console.error("MailerLite subscriber sync failed", error);
    return "error";
  }
}
