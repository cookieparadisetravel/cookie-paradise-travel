import { env } from "cloudflare:workers";
import { boundedBody } from "@/lib/lead-request";
import { mapMetaLead, metaNotificationSchema, metaPayloadSchema, verifyMetaSignature } from "@/lib/meta-leads";
import { saveTripGuideLead } from "@/lib/trip-guide-service";

function config() { return env as unknown as Record<string, string | undefined>; }
export async function GET(request: Request) {
  const token = config().META_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!token) return new Response("Meta connection is not configured.", { status: 503 });
  const query = new URL(request.url).searchParams;
  const challenge = query.get("hub.challenge") ?? "";
  if (query.get("hub.mode") !== "subscribe" || query.get("hub.verify_token") !== token || !/^\d{1,100}$/.test(challenge)) return new Response("Verification failed.", { status: 403 });
  return new Response(challenge, { headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const cfg = config();
  const formIds = new Set((cfg.META_FORM_IDS ?? "").split(",").map(value => value.trim()).filter(value => /^\d{1,32}$/.test(value)));
  if (env.SQUARE_ENV !== "production" || !cfg.META_APP_SECRET || !cfg.META_PAGE_ACCESS_TOKEN || !/^\d{1,32}$/.test(cfg.META_PAGE_ID ?? "") || !/^v\d+\.\d+$/.test(cfg.META_GRAPH_API_VERSION ?? "") || !cfg.META_CONTACT_CONSENT_FIELD || !formIds.size) {
    return new Response("Meta connection is not configured.", { status: 503 });
  }
  let raw: string;
  try { raw = await boundedBody(request, 65_536); } catch { return new Response("Invalid payload.", { status: 400 }); }
  if (!await verifyMetaSignature(raw, request.headers.get("X-Hub-Signature-256"), cfg.META_APP_SECRET)) return new Response("Invalid signature.", { status: 403 });
  try {
    const payload = metaPayloadSchema.parse(JSON.parse(raw));
    for (const entry of payload.entry) {
      if (entry.id !== cfg.META_PAGE_ID) continue;
      for (const change of entry.changes) {
        if (change.field !== "leadgen") continue;
        const notification = metaNotificationSchema.parse(change.value);
        if (notification.page_id !== cfg.META_PAGE_ID || !formIds.has(notification.form_id)) continue;
        const url = new URL(`https://graph.facebook.com/${cfg.META_GRAPH_API_VERSION}/${notification.leadgen_id}`);
        url.searchParams.set("fields", "id,created_time,ad_id,form_id,field_data");
        const response = await fetch(url, { headers: { Authorization: `Bearer ${cfg.META_PAGE_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(10_000) });
        if (!response.ok) throw new Error("Lead retrieval failed.");
        const input = mapMetaLead(await response.json(), { id: notification.leadgen_id, formId: notification.form_id, consentField: cfg.META_CONTACT_CONSENT_FIELD, timingField: cfg.META_TRAVEL_TIMING_FIELD });
        if (!input) continue;
        input.attribution.adId ||= notification.ad_id ?? "";
        await saveTripGuideLead(input);
      }
    }
    return new Response("EVENT_RECEIVED", { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Returning an error lets Meta retry. Stored submission IDs prevent duplicate guide emails.
    console.error("Meta lead intake needs attention; check Page access, form fields and lead inbox.");
    return new Response("Lead could not be processed.", { status: 503 });
  }
}
