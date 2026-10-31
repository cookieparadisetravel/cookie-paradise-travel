import { z } from "zod";
import { boundedText, emptyAttribution, type LeadTiming } from "./trip-guide.ts";

export async function verifyMetaSignature(raw: string, signature: string | null, secret: string) {
  if (!/^sha256=[0-9a-f]{64}$/i.test(signature ?? "")) return false;
  const bytes = Uint8Array.from(signature!.slice(7).match(/../g)!, pair => parseInt(pair, 16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(raw));
}

const numericId = z.string().regex(/^\d{1,32}$/);
export const metaPayloadSchema = z.object({ object: z.literal("page"), entry: z.array(z.object({
  id: numericId, changes: z.array(z.object({ field: z.string(), value: z.unknown() })).max(50),
})).max(20) });
export const metaNotificationSchema = z.object({ leadgen_id: numericId, page_id: numericId, form_id: numericId, ad_id: numericId.optional() });
const metaLeadSchema = z.object({ id: numericId, form_id: numericId, created_time: z.string(), ad_id: numericId.optional(),
  field_data: z.array(z.object({ name: z.string().max(300), values: z.array(z.string().max(2000)).max(20) })).max(50),
});

export function mapMetaLead(raw: unknown, expected: { id: string; formId: string; consentField: string; timingField?: string }) {
  const lead = metaLeadSchema.parse(raw);
  if (lead.id !== expected.id || lead.form_id !== expected.formId || !Number.isFinite(Date.parse(lead.created_time)) || Date.parse(lead.created_time) > Date.now()+300_000) throw new Error("Lead identity does not match.");
  const fields = new Map(lead.field_data.map(field => [field.name, field.values[0] ?? ""]));
  // This must be a required custom question on every approved form. Facebook submission
  // is never treated as consent to the separate newsletter marketing list.
  const permission = fields.get(expected.consentField)?.trim().toLowerCase();
  if (permission === "no") return null;
  if (permission !== "yes") throw new Error("Trip contact permission is missing.");
  const firstName = boundedText(fields.get("first_name") || fields.get("full_name")?.split(/\s+/)[0], 60);
  const email = z.string().trim().toLowerCase().email().max(180).parse(fields.get("email"));
  if (!firstName) throw new Error("A first name is required.");
  const selected = fields.get(expected.timingField ?? "travel_interest")?.toLowerCase() ?? "";
  const timing: LeadTiming = selected.includes("future") ? "future" : selected.includes("june") ? "june_2027" : "not_sure";
  const city = boundedText(fields.get("city"), 80) || "Not provided";
  return { firstName, email, phone: boundedText(fields.get("phone_number"), 40), city, timing, marketingConsent: false,
    source: "meta" as const, submissionId: `meta:${lead.id}`, formId: lead.form_id, submittedAt: new Date(lead.created_time).toISOString(), referralCode: null,
    attribution: { ...emptyAttribution, utmSource: "facebook", utmMedium: "paid_social", adId: lead.ad_id ?? "" } };
}
