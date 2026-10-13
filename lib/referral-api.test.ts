import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Bundle the real route with isolated infrastructure: no credentials, database, email or Square calls.
test("referral API persists each partner and blocks preview/inactive requests before side effects", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "referral-route-"));
  const state = { rows: [] as Record<string, unknown>[], notifications: [] as Record<string, unknown>[], automations: 0, fetches: 0 };
  const runtime = { REFERRAL_ACTIVE_PARTNERS: "gossip-nails,nail-station-spa", TURNSTILE_SECRET_KEY: "test", AUTOMATED_BOOKING_ENABLED: "true" };
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.__referralTest = { state, runtime };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { state.fetches++; return Response.json({ success: true, action: "booking_inquiry" }); };
  try {
    await build({ entryPoints: ["app/api/booking-requests/route.ts"], outfile: path.join(dir, "route.mjs"), bundle: true, platform: "node", format: "esm", plugins: [{ name: "isolated-infrastructure", setup(builder) {
      builder.onResolve({ filter: /^(cloudflare:workers|@\/db.*|drizzle-orm|@\/lib\/.*)$/ }, (args) => args.path === "@/lib/referral-partners" ? undefined : ({ path: args.path, namespace: "test-mock" }));
      builder.onLoad({ filter: /.*/, namespace: "test-mock" }, ({ path: modulePath }) => {
        const prefix = "const { state, runtime } = globalThis.__referralTest;";
        const modules: Record<string, string> = {
          "cloudflare:workers": "export const env = runtime;",
          "@/db/schema": "export const bookingRequests = {id: 'id'}; export const travelers = {};",
          "@/db": "export function getDb() { return { insert: () => ({values: (row) => ({returning: async () => {state.rows.push(row); return [{id: state.rows.length}];}})}), update: () => ({set: () => ({where: async () => {}})}) }; }",
          "drizzle-orm": "export const eq = () => null;",
          "@/lib/mailerlite": "export const addConsentedSubscriber = async () => { throw Error('Unexpected marketing call'); };",
          "@/lib/owner-notification": "export const sendOwnerInquiryNotification = async (input) => {state.notifications.push(input); return 'sent';};",
          "@/lib/booking-automation": "export const startAutomatedReadyToBookFlow = async () => { state.automations++; return 'started'; };",
          "@/lib/safe-error": "export const getSafeDatabaseErrorDetails = () => ({});",
          "@/lib/square-config": "export const getSquareEnvironment = () => 'sandbox';",
        };
        if (!modules[modulePath]) throw Error(`Missing mock ${modulePath}`);
        return { contents: prefix + modules[modulePath], loader: "js" };
      });
    }}] });
    const { POST } = await import(path.join(dir, "route.mjs"));
    const payload = { firstName: "Test", lastName: "Only", email: "test@example.invalid", phone: "5550100", departure: "2027-06-01", room: "shared", partySize: 2, contactConsent: true, bookingIntent: "needs_information", turnstileToken: "test" };
    const post = (extra: Record<string, unknown>) => POST(new Request("https://example.invalid/api/booking-requests", {method: "POST", body: JSON.stringify({...payload, ...extra})}));
    for (const partner of ["gossip-nails", "nail-station-spa"]) {
      const response = await post({referralPartner: partner});
      assert.equal(response.status, 201);
      assert.equal(state.rows.at(-1)?.referralPartner, partner);
      assert.equal(state.notifications.at(-1)?.referralPartner, partner);
    }
    assert.equal((await post({})).status, 201);
    assert.equal(state.rows.at(-1)?.referralPartner, null);
    assert.equal((await post({ referralPartner: "gossip-nails", bookingIntent: "ready_to_book" })).status, 201);
    assert.equal(state.automations, 1);
    const before = JSON.stringify(state);
    assert.equal((await post({ referralPartner: "gossip-nails", referralPreview: true })).status, 400);
    assert.equal((await post({ referralPartner: "unrecognized" })).status, 400);
    runtime.REFERRAL_ACTIVE_PARTNERS = "";
    assert.equal((await post({ referralPartner: "gossip-nails" })).status, 400);
    assert.equal((await post({ referralPartner: "nail-station-spa" })).status, 400);
    assert.equal(JSON.stringify(state), before);
  } finally {
    globalThis.fetch = originalFetch;
    delete globals.__referralTest;
    await rm(dir, { recursive: true, force: true });
  }
});
