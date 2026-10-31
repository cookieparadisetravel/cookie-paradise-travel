import assert from "node:assert/strict";
import test from "node:test";
import * as meta from "./meta-leads.ts";
import * as requests from "./lead-request.ts";
import { loadModule } from "../test-support/lead-fixture.ts";

const secret = "test-app-secret";
async function signature(raw: string, key = secret) {
  const imported = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", imported, new TextEncoder().encode(raw));
  return `sha256=${Array.from(new Uint8Array(signed), byte => byte.toString(16).padStart(2,"0")).join("")}`;
}
const lead = () => ({ id: "111", form_id: "222", created_time: "2026-10-30T17:00:00+0000", ad_id: "444", field_data: [
  { name: "first_name", values: ["Traveler"] }, { name: "email", values: ["TRAVELER@example.test"] }, { name: "city", values: ["Bloomington"] },
  { name: "trip_contact_permission", values: ["Yes"] }, { name: "travel_interest", values: ["June 1-8, 2027"] },
] });
const expected = { id: "111", formId: "222", consentField: "trip_contact_permission" };
test("Meta signature verifies exactly the raw bytes and rejects wrong, missing or malformed signatures", async () => {
  const raw = '{"object":"page"}'; const signed = await signature(raw);
  assert.equal(await meta.verifyMetaSignature(raw,signed,secret), true);
  assert.equal(await meta.verifyMetaSignature(`${raw} `,signed,secret), false);
  for (const value of [null,"","sha1=abc","sha256=xx","sha256=00",await signature(raw,"wrong")]) assert.equal(await meta.verifyMetaSignature(raw,value,secret), false);
});
test("Meta mapping requires exact ID/form/contact permission and never assumes newsletter consent", () => {
  const result = meta.mapMetaLead(lead(),expected);
  assert.ok(result);
  assert.equal(result.email,"traveler@example.test"); assert.equal(result.marketingConsent,false); assert.equal(result.source,"meta");
  assert.equal(result.attribution.adId,"444"); assert.equal(result.city,"Bloomington"); assert.equal(result.timing,"june_2027");
  assert.equal(result.submittedAt,"2026-10-30T17:00:00.000Z");
  for (const value of [{ ...lead(), id: "555" },{ ...lead(), form_id: "555" },{ ...lead(), created_time: "invalid" },{ ...lead(), created_time: "2099-01-01" },{ ...lead(), field_data: lead().field_data.filter(field => field.name !== expected.consentField) }]) assert.throws(() => meta.mapMetaLead(value,expected));
  assert.equal(meta.mapMetaLead({ ...lead(), field_data: lead().field_data.map(field => field.name === expected.consentField ? { ...field, values: ["No"] } : field) }, expected),null);
});
async function fixture() {
  const cfg: Record<string,string> = { SQUARE_ENV: "production", META_APP_SECRET: secret, META_PAGE_ACCESS_TOKEN: "test-page-token", META_PAGE_ID: "333", META_FORM_IDS: "222", META_GRAPH_API_VERSION: "v99.0", META_WEBHOOK_VERIFY_TOKEN: "test-verify", META_CONTACT_CONSENT_FIELD: "trip_contact_permission" };
  const saved: unknown[] = [];
  const route = await loadModule<{ GET(request: Request): Promise<Response>; POST(request: Request): Promise<Response> }>("app/api/meta/leads/route.ts", {
    "cloudflare:workers": { env: cfg }, "@/lib/lead-request": requests, "@/lib/meta-leads": meta,
    "@/lib/trip-guide-service": { saveTripGuideLead: async (input: unknown) => { saved.push(input); return { created: true, emailStatus: "sent" }; } },
  });
  const payload = { object: "page", entry: [{ id: "333", changes: [{ field: "leadgen", value: { leadgen_id: "111", page_id: "333", form_id: "222", ad_id: "444" } }] }] };
  async function send(value: unknown = payload, signed = true) {
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    return route.POST(new Request("https://example.test/api/meta/leads", { method: "POST", headers: signed ? { "X-Hub-Signature-256": await signature(raw) } : {}, body: raw }));
  }
  return { cfg, saved, route, send, payload };
}
test("Meta challenge requires the configured verification token", async () => {
  const f = await fixture();
  const request = (token: string) => new Request(`https://example.test/api/meta/leads?hub.mode=subscribe&hub.challenge=12345&hub.verify_token=${token}`);
  assert.equal((await f.route.GET(request("wrong"))).status,403);
  assert.equal(await (await f.route.GET(request("test-verify"))).text(),"12345");
  delete f.cfg.META_WEBHOOK_VERIFY_TOKEN; assert.equal((await f.route.GET(request("test-verify"))).status,503);
});
test("Meta delivery rejects unsigned, oversized, unconfigured and unapproved form traffic before fetching", async () => {
  const f = await fixture(); let fetched = 0;
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { fetched++; return Response.json(lead()); };
    assert.equal((await f.send(undefined,false)).status,403);
    assert.equal((await f.send("x".repeat(66000))).status,400);
    f.payload.entry[0].changes[0].value.form_id = "555"; assert.equal((await f.send()).status,200);
    assert.equal(fetched,0); assert.equal(f.saved.length,0);
    delete f.cfg.META_APP_SECRET; assert.equal((await f.send()).status,503);
  } finally { globalThis.fetch = original; }
});
test("Meta retrieves only the signed lead with a bearer header and retries retrieval or identity failures", async () => {
  const f = await fixture(); const original = globalThis.fetch;
  try {
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input)); assert.equal(url.hostname,"graph.facebook.com"); assert.equal(url.pathname,"/v99.0/111");
      assert.equal(url.searchParams.get("access_token"),null); assert.equal((init!.headers as Record<string,string>).Authorization,"Bearer test-page-token");
      return Response.json(lead());
    };
    assert.equal((await f.send()).status,200); assert.equal(f.saved.length,1);
    globalThis.fetch = async () => new Response("Forbidden",{ status:403 }); assert.equal((await f.send()).status,503);
    globalThis.fetch = async () => Response.json({ ...lead(), form_id: "999" }); assert.equal((await f.send()).status,503);
    assert.equal(f.saved.length,1);
  } finally { globalThis.fetch = original; }
});
