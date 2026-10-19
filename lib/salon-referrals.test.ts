import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { z } from "zod";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as sqlBuilders from "drizzle-orm";
import * as schema from "../db/schema.ts";
import * as referrals from "./salon-referrals.ts";
import { getSafeDatabaseErrorDetails } from "./safe-error.ts";

type Stubs = Record<string, Record<string, unknown>>;
async function loadModule(file: string, stubs: Stubs): Promise<Record<string, (...args: never[]) => Promise<Response>>> {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  const key = `__referralTest_${crypto.randomUUID()}`;
  const globals = globalThis as unknown as Record<string, unknown>;
  globals[key] = stubs;
  let code = outputText;
  for (const statement of ts.createSourceFile(file, outputText, ts.ScriptTarget.ESNext, true).statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;
    assert.ok(bindings && ts.isNamedImports(bindings));
    const exports = bindings.elements.map((binding) => `export const ${(binding.propertyName ?? binding.name).text} = stub[${JSON.stringify((binding.propertyName ?? binding.name).text)}];`).join("\n");
    const stubCode = `const stub = globalThis[${JSON.stringify(key)}][${JSON.stringify(specifier)}];\n${exports}`;
    code = code.replace(JSON.stringify(specifier), JSON.stringify(`data:text/javascript;base64,${Buffer.from(stubCode).toString("base64")}`));
  }
  try { return await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`); }
  finally { delete globals[key]; }
}
async function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  const directory = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  const db = drizzle(async (query, params, method) => {
    const statement = sqlite.prepare(query);
    if (method === "run") { statement.run(...params); return { rows: [] }; }
    statement.setReturnArrays(true);
    return { rows: method === "get" ? statement.get(...params) as unknown as unknown[] : statement.all(...params) as unknown as unknown[][] };
  });
  await db.insert(schema.bookingRequests).values({ id: 1, tripSlug: "test", fullName: "Test Traveler", email: "test@example.com", departure: "2027-06-01", roomPreference: "shared", partySize: 1, referralCode: "gossip-nails", squareEnvironment: "production", squareDepositInvoiceStatus: "paid", createdAt: "2026-10-13T16:00:00Z" });
  await db.insert(schema.travelers).values({ id: 1, bookingRequestId: 1, firstName: "Test", lastName: "Traveler", email: "test@example.com" });
  await db.insert(schema.salonReferralPilots).values({ code: "gossip-nails", materialsReceivedOn: "2026-10-13", updatedAt: "2026-10-13T16:00:00Z", updatedBy: "owner@example.com" });
  const stubs: Stubs = {
    "drizzle-orm": sqlBuilders, "@/db": { getDb: () => db }, "@/db/schema": schema,
    "@/lib/owner-auth": { requireOwner: async () => ({ email: "owner@example.com" }) },
    "@/lib/same-origin": { hasValidOrigin: () => true }, "@/lib/salon-referrals": referrals,
    "@/lib/payment-schedule": { todayInIndiana: (date?: Date) => date ? date.toISOString().slice(0, 10) : "2027-06-09" },
    "@/lib/agreement-readiness": { getAgreementReadiness: async () => ({ acceptedTravelerIds: [1] }) },
    "@/lib/safe-error": { getSafeDatabaseErrorDetails },
  };
  return { sqlite, stubs };
}
const body = { action: "completion", travelerId: 1, successful: true, qualifiedOn: "2026-10-20", tripCompletedAndNotRefunded: true };
function request(payload: unknown) { return new Request("https://example.com/api/admin/referrals", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); }

test("referral cookies accept only the configured partners and do not trust arbitrary names", () => {
  assert.equal(referrals.referralFromCookie("other=x; cp_travel_referral=gossip-nails")?.name, "Gossip Nails");
  assert.equal(referrals.referralFromCookie("cp_travel_referral=nails-station")?.name, "Nails Station & Spa");
  assert.equal(referrals.referralFromCookie("cp_travel_referral=cisco-barbershop")?.name, "Cisco Barbershop");
  assert.equal(referrals.referralFromCookie("cp_travel_referral=columbus-uppercuts")?.name, "Columbus Uppercuts");
  for (const cookie of [null, "cp_travel_referral=<script>", "fake_cp_travel_referral=gossip-nails", "cp_travel_referral=missing"]) assert.equal(referrals.referralFromCookie(cookie), null);
});
test("ninety-day pilot includes its first and last day, including leap years", () => {
  assert.equal(referrals.pilotLastDay("2026-10-13"), "2027-01-10");
  assert.equal(referrals.pilotLastDay("2028-01-01"), "2028-03-30");
  for (const [date, allowed] of [["2026-10-12", false], ["2026-10-13", true], ["2027-01-10", true], ["2027-01-11", false]] as const) assert.equal(referrals.dateInPilot("2026-10-13", date), allowed);
  assert.equal(referrals.dateInPilot(null, "2026-10-13"), false);
  assert.equal(referrals.validReferralDate("2026-02-31"), false);
});
test("barbershop pilots save independently and use the same commission qualification", async () => {
  const { sqlite, stubs } = await fixture();
  try {
    const route = await loadModule("app/api/admin/referrals/route.ts", stubs);
    for (const code of ["cisco-barbershop", "columbus-uppercuts"]) {
      assert.equal((await route.PATCH(request({ action: "pilot", code, materialsReceivedOn: "2026-10-13" }) as never)).status, 200);
      sqlite.prepare("UPDATE booking_requests SET referral_code=? WHERE id=1").run(code);
      assert.equal((await route.PATCH(request(body) as never)).status, 200);
      sqlite.exec("DELETE FROM salon_referral_completions");
    }
    assert.deepEqual(sqlite.prepare("SELECT code, materials_received_on FROM salon_referral_pilots ORDER BY code").all().map((row) => [row.code, row.materials_received_on]), [
      ["cisco-barbershop", "2026-10-13"], ["columbus-uppercuts", "2026-10-13"], ["gossip-nails", "2026-10-13"],
    ]);
  } finally { sqlite.close(); }
});
test("bonuses accumulate independently without rounding incomplete groups or imposing a cap", () => {
  for (const [count, total] of [[0,0],[1,100],[4,400],[5,600],[6,700],[10,1200],[15,1800],[20,2400],[25,3000],[30,3600],[31,3700]]) assert.equal(referrals.referralEarnings(count).totalCents, total * 100);
  assert.throws(() => referrals.referralEarnings(-1));
  assert.throws(() => referrals.referralEarnings(1.5));
});
test("QR landing redirects to the booking site with a private, secure, ninety-day cookie", async () => {
  const route = await loadModule("app/r/[code]/route.ts", { "@/lib/salon-referrals": referrals });
  for (const partner of referrals.salonPartners) {
    const response = await route.GET(new Request(`https://example.com/r/${partner.code}`) as never, { params: Promise.resolve({ code: partner.code }) } as never);
    assert.equal(response.status, 303); assert.equal(response.headers.get("location"), "https://example.com/");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match(response.headers.get("set-cookie")!, /Path=\/; Max-Age=7776000; HttpOnly; SameSite=Lax; Secure$/);
    assert.ok(response.headers.get("set-cookie")!.startsWith(`cp_travel_referral=${partner.code};`));
  }
  const invalid = await route.GET(new Request("https://example.com/r/unknown") as never, { params: Promise.resolve({ code: "unknown" }) } as never);
  assert.equal(invalid.status,404); assert.equal(invalid.headers.get("set-cookie"),null);
});
test("successful traveler is counted once, can be removed, and can be restored", async () => {
  const { sqlite, stubs } = await fixture();
  try {
    const route = await loadModule("app/api/admin/referrals/route.ts", stubs);
    for (let i = 0; i < 2; i++) assert.equal((await route.PATCH(request(body) as never)).status, 200);
    assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM salon_referral_completions WHERE successful = 1").get()!.count, 1);
    assert.equal((await route.PATCH(request({ ...body, successful: false }) as never)).status, 200);
    assert.equal(sqlite.prepare("SELECT successful FROM salon_referral_completions").get()!.successful, 0);
    assert.equal((await route.PATCH(request(body) as never)).status, 200);
    const locked = await route.PATCH(request({ action: "pilot", code: "gossip-nails", materialsReceivedOn: "2026-10-14" }) as never);
    assert.equal(locked.status,409);
  } finally { sqlite.close(); }
});
test("Sandbox, unpaid, unfinished and unsigned travelers cannot earn commissions", async () => {
  for (const blocked of ["sandbox", "unpaid", "unfinished", "unsigned"]) {
    const { sqlite, stubs } = await fixture();
    try {
      if (blocked === "sandbox") sqlite.exec("UPDATE booking_requests SET square_environment='sandbox'");
      if (blocked === "unpaid") sqlite.exec("UPDATE booking_requests SET square_deposit_invoice_status='partially_paid'");
      if (blocked === "unfinished") stubs["@/lib/payment-schedule"].todayInIndiana = (date?: Date) => date ? date.toISOString().slice(0,10) : "2027-06-08";
      if (blocked === "unsigned") stubs["@/lib/agreement-readiness"].getAgreementReadiness = async () => ({ acceptedTravelerIds: [] });
      const route = await loadModule("app/api/admin/referrals/route.ts", stubs);
      assert.equal((await route.PATCH(request(body) as never)).status,409,blocked);
      assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM salon_referral_completions").get()!.count,0);
    } finally { sqlite.close(); }
  }
});
test("commission review rejects out-of-window dates and requires the owner's completion check", async () => {
  const { sqlite, stubs } = await fixture();
  try {
    const route = await loadModule("app/api/admin/referrals/route.ts", stubs);
    for (const date of ["2026-10-12", "2027-01-11", "2026-02-31"]) assert.equal((await route.PATCH(request({ ...body, qualifiedOn: date }) as never)).status,400);
    assert.equal((await route.PATCH(request({ ...body, tripCompletedAndNotRefunded: false }) as never)).status,409);
  } finally { sqlite.close(); }
});
test("owner authentication and origin checks run before any referral data changes", async () => {
  for (const check of ["owner", "origin"]) {
    const { sqlite, stubs } = await fixture();
    try {
      if (check === "owner") stubs["@/lib/owner-auth"].requireOwner = async () => null;
      else stubs["@/lib/same-origin"].hasValidOrigin = () => false;
      const route = await loadModule("app/api/admin/referrals/route.ts", stubs);
      assert.equal((await route.PATCH(request(body) as never)).status,403);
    } finally { sqlite.close(); }
  }
});

test("the public booking API persists the allowlisted cookie and ignores a forged payload referral", async () => {
  for (const [cookie, expected] of [...referrals.salonPartners.map(({ code }) => [`cp_travel_referral=${code}`, code] as const), ["cp_travel_referral=unknown", null], ["", null]] as const) {
    const { sqlite, stubs } = await fixture();
    const oldFetch = globalThis.fetch;
    let notifiedCode: string | null | undefined;
    try {
      globalThis.fetch = async () => Response.json({ success: true, action: "booking_inquiry" });
      stubs["zod"] = { z };
      stubs["cloudflare:workers"] = { env: { TURNSTILE_SECRET_KEY: "test-key", AUTOMATED_BOOKING_ENABLED: "false" } };
      stubs["@/lib/mailerlite"] = { addConsentedSubscriber: async () => { throw new Error("No marketing consent"); } };
      stubs["@/lib/owner-notification"] = { sendOwnerInquiryNotification: async (input: { referralCode: string | null }) => { notifiedCode = input.referralCode; return "sent"; } };
      stubs["@/lib/booking-automation"] = { startAutomatedReadyToBookFlow: async () => { throw new Error("No automation requested"); } };
      stubs["@/lib/square-config"] = { getSquareEnvironment: () => "production" };
      const route = await loadModule("app/api/booking-requests/route.ts", stubs);
      const payload = { firstName: "New", lastName: "Traveler", email: "new@example.com", phone: "555-1234", departure: "2027-06-01", room: "shared", partySize: 1, bookingIntent: "needs_information", contactConsent: true, turnstileToken: "test-token", referralCode: "nails-station" };
      const response = await route.POST(new Request("https://example.com/api/booking-requests", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(payload) }) as never);
      assert.equal(response.status,201);
      assert.equal(sqlite.prepare("SELECT referral_code FROM booking_requests WHERE email='new@example.com'").get()!.referral_code,expected);
      assert.equal(notifiedCode,expected);
    } finally { globalThis.fetch = oldFetch; sqlite.close(); }
  }
});
