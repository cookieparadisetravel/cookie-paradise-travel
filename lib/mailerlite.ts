import { env } from "cloudflare:workers";

type SubscriberInput = { firstName: string; lastName: string; email: string };
type SubscriberOptions = { groupName?: string };

export type MailerLiteStatus = "synced" | "not_configured" | "error";

async function findNamedGroup(token: string, name: string) {
  const url = new URL("https://connect.mailerlite.com/api/groups");
  url.searchParams.set("filter[name]", name);
  url.searchParams.set("limit", "1000");
  const response = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("MailerLite group lookup failed.");
  const body = await response.json() as { data?: { id?: string; name?: string }[] };
  if (!Array.isArray(body.data)) throw new Error("MailerLite returned an invalid group list.");
  const matches = body.data.filter(group => group.name === name && typeof group.id === "string" && /^\d+$/.test(group.id));
  // MailerLite's name filter returns partial matches. Never send leads to a similarly named group.
  return matches.length === 1 ? matches[0].id! : null;
}

export async function addConsentedSubscriber(input: SubscriberInput, options: SubscriberOptions = {}): Promise<MailerLiteStatus> {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const token = runtimeEnv.MAILERLITE_API_TOKEN?.trim();
  if (!token?.trim()) return "not_configured";

  try {
    const groupId = options.groupName ? await findNamedGroup(token, options.groupName) : runtimeEnv.MAILERLITE_GROUP_ID;
    if (!groupId) return "not_configured";
    const response = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        fields: { name: input.firstName, last_name: input.lastName },
        groups: [groupId],
        resubscribe: false,
        opted_in_at: new Date().toISOString().replace("T", " ").slice(0, 19),
      }),
    });
    return response.ok ? "synced" : "error";
  } catch {
    console.error("MailerLite subscriber sync failed; review the saved lead status and integration settings.");
    return "error";
  }
}
