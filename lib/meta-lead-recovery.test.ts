import assert from "node:assert/strict";
import test from "node:test";
import { recoverMetaLeads } from "./meta-lead-recovery.ts";
import { databaseFixture, loadModule } from "../test-support/lead-fixture.ts";
import * as requestHelpers from "./lead-request.ts";

const config = { token: "private-token", version: "v99.0", formIds: ["222"], consentField: "trip_contact_permission" };
function lead(id: string, consent = "yes") {
  return { id, form_id: "222", created_time: "2026-11-01T12:00:00Z", field_data: [
    { name: "full_name", values: ["Test Traveler"] }, { name: "email", values: [`person${id}@example.test`] },
    { name: "trip_contact_permission", values: [consent] }, { name: "travel_interest", values: ["a_future_departure"] },
  ] };
}
test("recovery paginates on the fixed Graph origin, captures No, and safely replays", async () => {
  const saved = new Map<string, ReturnType<typeof import("./meta-leads.ts").mapMetaLead>>();
  let requests = 0;
  const fetcher: typeof fetch = async (input, init) => {
    requests++;
    const url = new URL(String(input));
    assert.equal(url.origin, "https://graph.facebook.com");
    assert.equal(url.pathname, "/v99.0/222/leads");
    assert.equal(url.searchParams.has("access_token"), false);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer private-token");
    return Response.json(url.searchParams.has("after") ? { data: [lead("112", "no")] }
      : { data: [lead("111")], paging: { next: "https://untrusted.example/?access_token=private-token", cursors: { after: "next-page" } } });
  };
  const save = async (input: ReturnType<typeof import("./meta-leads.ts").mapMetaLead>) => {
    const created = !saved.has(input.submissionId); saved.set(input.submissionId, input); return { created };
  };
  assert.deepEqual(await recoverMetaLeads(config, save, fetcher), { checked: 2, added: 2, existing: 0, failed: 0, errors: [] });
  assert.equal(saved.get("meta:112")?.contactConsent, false);
  assert.equal(saved.get("meta:111")?.marketingConsent, false);
  assert.equal(saved.get("meta:112")?.timing, "future");
  assert.equal((await recoverMetaLeads(config, save, fetcher)).existing, 2);
  assert.equal(saved.size, 2); assert.equal(requests, 4);
});
test("bad lead does not hide later leads; storage errors remain distinct from form errors", async () => {
  const result = await recoverMetaLeads(config, async input => {
    if (input.submissionId === "meta:112") throw new Error("private DB error");
    return { created: true };
  }, async () => Response.json({ data: [{ ...lead("110"), form_id: "999" }, lead("111", "unknown"), lead("112"), lead("113")] }));
  assert.equal(result.checked, 4); assert.equal(result.added, 1); assert.equal(result.failed, 3);
  assert.equal(result.errors.length, 2); assert.ok(!JSON.stringify(result).includes("private DB error"));
});
test("Graph failures are actionable without leaking raw error messages or tokens", async () => {
  for (const code of [190, 200, 10, 100]) {
    const result = await recoverMetaLeads(config, async () => { throw new Error("must not save"); }, async () => Response.json({ error: { code, message: "private-token" } }, { status: 400 }));
    assert.equal(result.errors.length, 1); assert.equal(result.checked, 0);
    assert.ok(!JSON.stringify(result).includes("private-token"));
    if (code === 190) assert.match(result.errors[0], /expired/);
  }
  const malformed = await recoverMetaLeads(config, async () => ({ created: true }), async () => new Response("not-json"));
  assert.equal(malformed.errors.length, 1);
});
test("pagination loops and missing cursors report incomplete recovery", async () => {
  for (const cursors of [undefined, { after: "repeat" }]) {
    let calls = 0;
    const result = await recoverMetaLeads(config, async () => ({ created: false }), async () => {
      calls++; return Response.json({ data: [], paging: { next: "next", cursors } });
    });
    assert.ok(calls <= 2); assert.equal(result.errors.length, 1);
  }
});
test("sync persists health, honors the lease, and preserves last success on later failures", async () => {
  const f = databaseFixture();
  const env: Record<string, unknown> = { DB: f.db, SQUARE_ENV: "production", META_PAGE_ID: "333", META_FORM_IDS: "222", META_PAGE_ACCESS_TOKEN: config.token, META_GRAPH_API_VERSION: config.version, META_CONTACT_CONSENT_FIELD: config.consentField };
  let calls = 0, fail = false;
  const service = await loadModule<typeof import("./meta-sync.ts")>("lib/meta-sync.ts", {
    "cloudflare:workers": { env },
    "./meta-lead-recovery": { recoverMetaLeads: async () => { calls++; return { checked: 1, added: 1, existing: 0, failed: 0, errors: fail ? ["Access denied"] : [] }; } },
    "./trip-guide-service": { saveMetaDashboardLead: async () => ({ created: true }) },
  });
  assert.equal((await service.metaSyncStatus()).checkedAt, null);
  const ok = await service.synchronizeMetaLeads(); assert.equal(calls, 1); assert.ok(ok.lastSuccessAt); assert.equal(ok.running, false);
  f.sqlite.prepare("UPDATE meta_lead_sync SET lease_id='another',lease_until=?").run(new Date(Date.now()+60000).toISOString());
  assert.equal((await service.synchronizeMetaLeads()).running, true); assert.equal(calls, 1);
  f.sqlite.exec("UPDATE meta_lead_sync SET lease_until=NULL"); fail = true;
  const failure = await service.synchronizeMetaLeads(); assert.equal(calls, 2); assert.equal(failure.lastSuccessAt, ok.lastSuccessAt); assert.equal(failure.message, "Access denied");
  env.SQUARE_ENV = "sandbox";
  assert.equal((await service.synchronizeMetaLeads()).configured, false); assert.equal(calls, 2);
  env.SQUARE_ENV = "production"; env.META_FORM_IDS = "222,invalid";
  assert.equal((await service.synchronizeMetaLeads()).configured, false); assert.equal(calls, 2);
});
test("manual sync requires owner auth and same-origin POST, status is private", async () => {
  let owner = false, calls = 0;
  const route = await loadModule<typeof import("../app/api/admin/meta-sync/route.ts")>("app/api/admin/meta-sync/route.ts", {
    "@/lib/owner-auth": { requireOwner: async () => owner ? { email: "owner@example.test" } : null },
    "@/lib/lead-request": requestHelpers,
    "@/lib/meta-sync": { metaSyncStatus: async () => ({}), synchronizeMetaLeads: async () => { calls++; return {}; } },
  });
  const req = (origin: string) => new Request("https://example.test/api/admin/meta-sync", { method: "POST", headers: { origin } });
  assert.equal((await route.GET()).status, 403);
  assert.equal((await route.POST(req("https://example.test"))).status, 403);
  owner = true;
  assert.equal((await route.POST(req("https://other.example"))).status, 403); assert.equal(calls, 0);
  const result = await route.POST(req("https://example.test")); assert.equal(result.status, 200); assert.equal(calls, 1);
  assert.equal(result.headers.get("cache-control"), "private, no-store");
});
