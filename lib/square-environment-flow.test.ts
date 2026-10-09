import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../db/schema.ts";
import * as squareConfig from "./square-config.ts";

// Load the actual Worker modules with isolated Cloudflare/provider dependencies.
// No network requests, customer emails, or real databases are used in these tests.
type Stubs = Record<string, Record<string, unknown>>;
async function loadWorkerModule(file: string, stubs: Stubs): Promise<Record<string, (...args: never[]) => Promise<unknown>>> {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const key = `__squareEnvironmentTest_${crypto.randomUUID()}`;
  const globals = globalThis as unknown as Record<string, unknown>;
  globals[key] = stubs;
  let code = outputText;
  const parsed = ts.createSourceFile(file, outputText, ts.ScriptTarget.ESNext, true);
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;
    assert.ok(bindings && ts.isNamedImports(bindings), `Unsupported test import in ${file}`);
    const exported = bindings.elements.map((binding) => {
      const name = (binding.propertyName ?? binding.name).text;
      return `export const ${name} = stub[${JSON.stringify(name)}] ?? (() => { throw new Error(${JSON.stringify(`Unexpected dependency: ${specifier}.${name}`)}); });`;
    }).join("\n");
    const stubCode = `const stub = globalThis[${JSON.stringify(key)}][${JSON.stringify(specifier)}] ?? {};\n${exported}`;
    const url = `data:text/javascript;base64,${Buffer.from(stubCode).toString("base64")}`;
    code = code.replace(JSON.stringify(specifier), JSON.stringify(url));
  }
  try {
    return await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  } finally {
    delete globals[key];
  }
}

function fixture(mode: "sandbox" | "production", bookingEnvironment: "sandbox" | "production" = "sandbox") {
  const sqlite = new DatabaseSync(":memory:");
  const directory = new URL("../drizzle/", import.meta.url);
  const migrations = readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
  const latest = migrations.at(-1)!;
  for (const migration of migrations.slice(0, -1)) sqlite.exec(readFileSync(new URL(migration, directory), "utf8"));
  sqlite.exec(`INSERT INTO booking_requests
    (id, trip_slug, full_name, email, departure, room_preference, party_size,
     square_customer_id, square_deposit_order_id, square_deposit_invoice_id,
     confirmed_booking_total_cents, payment_preference, installment_autopay_status)
    VALUES (1, 'test-trip', 'Test Traveler', 'test@example.com', '2027-06-01', 'shared', 1,
     'test-customer', 'test-order', 'test-invoice', 287500, 'payment_plan', 'authorization_sending');`);
  const before = sqlite.prepare("SELECT * FROM booking_requests WHERE id = 1").get()!;
  sqlite.exec(readFileSync(new URL(latest, directory), "utf8"));
  sqlite.prepare("UPDATE booking_requests SET square_environment = ? WHERE id = 1").run(bookingEnvironment);
  sqlite.exec(`INSERT INTO payment_preference_invitations
    (id, booking_request_id, token_hash, expires_at) VALUES (1, 1, 'test-token-hash', '2099-01-01T00:00:00.000Z');
    INSERT INTO autopay_authorization_invitations
    (id, booking_request_id, token_hash, recipient_email, expires_at)
    VALUES (1, 1, 'test-token-hash', 'test@example.com', '2099-01-01T00:00:00.000Z');`);
  const db = drizzle(async (query, params, method) => {
    const statement = sqlite.prepare(query);
    if (method === "run") {
      statement.run(...params);
      return { rows: [] };
    }
    statement.setReturnArrays(true);
    return { rows: method === "get" ? statement.get(...params) as unknown as unknown[] : statement.all(...params) as unknown as unknown[][] };
  });
  const runtime = {
    SQUARE_ENV: mode,
    AUTOMATED_BOOKING_ENABLED: "false",
    SQUARE_WEBHOOK_SIGNATURE_KEY: "test-sandbox-signature",
    SQUARE_PRODUCTION_WEBHOOK_SIGNATURE_KEY: "test-production-signature",
    SQUARE_WEBHOOK_NOTIFICATION_URL: "https://example.com/api/square/webhook",
    SQUARE_PRODUCTION_WEBHOOK_NOTIFICATION_URL: "https://example.com/api/square/webhook?environment=production",
  };
  const unexpected = () => { throw new Error("A provider or state-changing dependency must not run for a blocked booking."); };
  const stubs: Stubs = {
    "cloudflare:workers": { env: runtime },
    "drizzle-orm": {},
    "@/db": { getDb: () => db },
    "@/db/schema": schema,
    "@/lib/square-config": squareConfig,
    "@/lib/traveler-agreement": {
      isValidInvitationToken: () => true,
      hashInvitationToken: async () => "test-token-hash",
    },
    "@/lib/owner-auth": { requireOwner: async () => ({ email: "owner@example.com" }) },
    "@/lib/same-origin": { hasValidOrigin: () => true },
    "@/lib/square": {
      createSquareCustomer: unexpected,
      createSquareDepositOrder: unexpected,
      createSquareDepositInvoice: unexpected,
      getSquareInvoiceVersion: unexpected,
      getSquareOrderAmountCents: unexpected,
      publishSquareInvoice: unexpected,
      findAutopayCardAndSchedule: unexpected,
      setInvoiceAutopay: unexpected,
    },
    "@/lib/mailersend-transactional": {
      sendAutopayAuthorizationInvitationEmail: unexpected,
      sendAutopayStoppedEmail: unexpected,
      sendTravelInsuranceReferralEmail: unexpected,
    },
  };
  return { sqlite, db, runtime, before, stubs };
}

// Import the real SQL builders while substituting only Cloudflare/provider modules.
const sqlBuilders = await import("drizzle-orm");
function addSqlBuilders(stubs: Stubs) { stubs["drizzle-orm"] = sqlBuilders; return stubs; }
function rowSnapshot(sqlite: DatabaseSync) {
  return sqlite.prepare("SELECT * FROM booking_requests WHERE id = 1").get();
}
function request() { return new Request("https://example.com/api/test", { method: "POST", body: JSON.stringify({ stopSource: "owner_decision" }) }); }
const ownerContext = { params: Promise.resolve({ id: "1" }) };

test("the generated additive migration labels old records Sandbox without changing their stored data", () => {
  const { sqlite, before } = fixture("production");
  try {
    const after = rowSnapshot(sqlite)!;
    assert.equal(after.square_environment, "sandbox");
    const { square_environment: environment, ...unchanged } = after;
    assert.equal(environment, "sandbox");
    assert.deepEqual(unchanged, { ...before });
    sqlite.exec(`INSERT INTO booking_requests
      (trip_slug, full_name, email, departure, room_preference, party_size, square_environment)
      VALUES ('test-trip', 'Production Test', 'test@example.com', '2027-06-01', 'shared', 1, 'production');`);
    assert.equal(sqlite.prepare("SELECT square_environment FROM booking_requests WHERE id = 2").get()!.square_environment, "production");
  } finally { sqlite.close(); }
});

test("invoice creation refuses cross-environment stored IDs before contacting Square or changing the booking", async () => {
  for (const [active, stored] of [["production", "sandbox"], ["sandbox", "production"]] as const) {
    const { sqlite, stubs } = fixture(active, stored);
    try {
      const before = rowSnapshot(sqlite);
      const worker = await loadWorkerModule("lib/booking-invoice.ts", addSqlBuilders(stubs));
      const result = await worker.createBookingInvoice({ inquiryId: 1, acceptedBy: "Test Owner" } as never) as { ok: boolean; status: number; error: string };
      assert.equal(result.ok, false);
      assert.equal(result.status, 409);
      assert.match(result.error, /payment environment/u);
      assert.deepEqual(rowSnapshot(sqlite), before);
    } finally { sqlite.close(); }
  }
});

test("a matching Production booking still reaches the existing agreement lock", async () => {
  const { sqlite, stubs } = fixture("production", "production");
  try {
    stubs["@/lib/agreement-readiness"] = { getAgreementReadiness: async () => ({ readyForInvoice: false, message: "Every traveler must sign." }) };
    const worker = await loadWorkerModule("lib/booking-invoice.ts", addSqlBuilders(stubs));
    const result = await worker.createBookingInvoice({ inquiryId: 1, acceptedBy: "Test Owner" } as never) as { error: string; status: number };
    assert.equal(result.status, 409);
    assert.match(result.error, /Payment invoice is locked/u);
  } finally { sqlite.close(); }
});

test("an old payment-choice link is blocked even if it has no stored Square IDs", async () => {
  const { sqlite, stubs } = fixture("production");
  try {
    sqlite.exec("UPDATE booking_requests SET square_customer_id = NULL, square_deposit_order_id = NULL, square_deposit_invoice_id = NULL");
    const loader = await loadWorkerModule("lib/payment-preference-invitation.ts", addSqlBuilders(stubs));
    stubs["@/lib/payment-preference-invitation"] = loader;
    const route = await loadWorkerModule("app/api/payment-preferences/[token]/route.ts", stubs);
    const before = rowSnapshot(sqlite);
    const response = await route.POST(request() as never, { params: Promise.resolve({ token: "test-token" }) } as never) as Response;
    assert.equal(response.status, 409);
    assert.match((await response.json() as { error: string }).error, /Sandbox testing/u);
    assert.equal(sqlite.prepare("SELECT completed_at FROM payment_preference_invitations WHERE id = 1").get()!.completed_at, null);
    assert.deepEqual(rowSnapshot(sqlite), before);
  } finally { sqlite.close(); }
});

test("completed payment-choice links cannot expose an old invoice as a new Production payment", async () => {
  const { sqlite, stubs } = fixture("production");
  try {
    sqlite.exec("UPDATE payment_preference_invitations SET completed_at = '2026-10-01T00:00:00.000Z'");
    const worker = await loadWorkerModule("lib/payment-preference-invitation.ts", addSqlBuilders(stubs));
    const result = await worker.getPaymentPreferenceInvitation("test-token" as never) as { status: string };
    assert.equal(result.status, "environment_mismatch");
  } finally { sqlite.close(); }
});

test("old autopay links reject before fetching a card or recording consent", async () => {
  const { sqlite, stubs } = fixture("production");
  try {
    const loader = await loadWorkerModule("lib/autopay-authorization-invitation.ts", addSqlBuilders(stubs));
    stubs["@/lib/autopay-authorization-invitation"] = loader;
    const route = await loadWorkerModule("app/api/autopay-authorizations/[token]/route.ts", stubs);
    const before = rowSnapshot(sqlite);
    const response = await route.POST(request() as never, { params: Promise.resolve({ token: "test-token" }) } as never) as Response;
    assert.equal(response.status, 409);
    assert.equal(sqlite.prepare("SELECT completed_at FROM autopay_authorization_invitations WHERE id = 1").get()!.completed_at, null);
    assert.deepEqual(rowSnapshot(sqlite), before);
  } finally { sqlite.close(); }
});

test("recorded autopay recovery refuses a different environment without changing its evidence record", async () => {
  const { sqlite, stubs } = fixture("production");
  try {
    sqlite.exec(`INSERT INTO autopay_authorizations (
      id, booking_request_id, invitation_id, status, cardholder_name, cardholder_email,
      consented_at, consented_at_local, ip_hash, user_agent, agreement_version,
      authorization_version, authorization_text, square_customer_id, square_card_id,
      card_brand, card_last_4, square_invoice_id, schedule_snapshot, total_cents, final_due_date
    ) VALUES (
      1, 1, 1, 'saving', 'Test Traveler', 'test@example.com',
      '2026-10-01T00:00:00.000Z', 'Test timestamp', 'test-hash', 'test-agent', '1.0',
      'test-version', 'Test consent', 'test-customer', 'test-card',
      'VISA', '1111', 'test-invoice', '[]', 237500, '2027-03-01'
    )`);
    const before = rowSnapshot(sqlite);
    const authorizationBefore = sqlite.prepare("SELECT * FROM autopay_authorizations WHERE id = 1").get();
    const worker = await loadWorkerModule("lib/autopay-authorization-service.ts", addSqlBuilders(stubs));
    const result = await worker.activateRecordedAutopayAuthorization(1 as never) as { ok: boolean; status: string };
    assert.equal(result.ok, false);
    assert.equal(result.status, "environment_mismatch");
    assert.deepEqual(rowSnapshot(sqlite), before);
    assert.deepEqual(sqlite.prepare("SELECT * FROM autopay_authorizations WHERE id = 1").get(), authorizationBefore);
  } finally { sqlite.close(); }
});

for (const file of ["autopay-retry", "autopay-stop", "payment-preference-invitation"]) {
  test(`owner ${file} rejects the wrong environment without changing state`, async () => {
    const { sqlite, stubs } = fixture("production");
    try {
      const worker = await loadWorkerModule(`app/api/admin/inquiries/[id]/${file}/route.ts`, addSqlBuilders(stubs));
      const before = rowSnapshot(sqlite);
      const body = file === "payment-preference-invitation"
        ? { bookingTotalDollars: 2875, perTravelerPriceCents: 287500, privateRoomCount: 0 }
        : { stopSource: "owner_decision" };
      stubs["@/lib/trip-pricing"] = { isPublishedPerTravelerPriceCents: () => true };
      // Load again with the price-validator dependency available for the invitation route.
      const route = file === "payment-preference-invitation"
        ? await loadWorkerModule(`app/api/admin/inquiries/[id]/${file}/route.ts`, stubs)
        : worker;
      const response = await route.POST(new Request("https://example.com/api/test", { method: "POST", body: JSON.stringify(body) }) as never, ownerContext as never) as Response;
      assert.equal(response.status, 409);
      assert.deepEqual(rowSnapshot(sqlite), before);
    } finally { sqlite.close(); }
  });
}

test("disabled automation prevents continuations from querying or sending agreements/payment links", async () => {
  const stubs: Stubs = {
    "cloudflare:workers": { env: { AUTOMATED_BOOKING_ENABLED: "false", SQUARE_ENV: "sandbox" } },
    "drizzle-orm": sqlBuilders,
  };
  const worker = await loadWorkerModule("lib/booking-automation.ts", stubs);
  assert.equal(await worker.startAutomatedReadyToBookFlow({ inquiryId: 1, requestUrl: "https://example.com" } as never), "not_requested");
  await worker.continueAutomatedBookingAfterTravelerList({ inquiryId: 1, requestUrl: "https://example.com" } as never);
  await worker.continueAutomatedBookingAfterAgreement({ inquiryId: 1, requestUrl: "https://example.com" } as never);
});

test("enabled Production automation cannot advance an existing Sandbox booking", async () => {
  const { sqlite, stubs, runtime } = fixture("production");
  try {
    runtime.AUTOMATED_BOOKING_ENABLED = "true";
    sqlite.exec("UPDATE booking_requests SET booking_intent = 'ready_to_book', automated_booking_status = 'agreements_sent'");
    const before = rowSnapshot(sqlite);
    const worker = await loadWorkerModule("lib/booking-automation.ts", addSqlBuilders(stubs));
    assert.equal(await worker.startAutomatedReadyToBookFlow({ inquiryId: 1, requestUrl: "https://example.com" } as never), "not_requested");
    await worker.continueAutomatedBookingAfterTravelerList({ inquiryId: 1, requestUrl: "https://example.com" } as never);
    await worker.continueAutomatedBookingAfterAgreement({ inquiryId: 1, requestUrl: "https://example.com" } as never);
    assert.deepEqual(rowSnapshot(sqlite), before);
  } finally { sqlite.close(); }
});

async function signedWebhook(runtime: Record<string, string>, environment: "sandbox" | "production", body: string) {
  const url = environment === "production" ? runtime.SQUARE_PRODUCTION_WEBHOOK_NOTIFICATION_URL : runtime.SQUARE_WEBHOOK_NOTIFICATION_URL;
  const keyText = environment === "production" ? runtime.SQUARE_PRODUCTION_WEBHOOK_SIGNATURE_KEY : runtime.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(keyText), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(url + body));
  return new Request(url, { method: "POST", headers: { "x-square-hmacsha256-signature": Buffer.from(signature).toString("base64") }, body });
}

test("a signed inactive-environment webhook is acknowledged without database writes or provider calls", async () => {
  const { sqlite, stubs, runtime } = fixture("sandbox");
  try {
    const worker = await loadWorkerModule("app/api/square/webhook/route.ts", addSqlBuilders(stubs));
    const before = rowSnapshot(sqlite);
    const body = JSON.stringify({ type: "invoice.payment_made", data: { object: { invoice: { id: "test-invoice", status: "PAID", version: 2 } } } });
    const response = await worker.POST(await signedWebhook(runtime, "production", body) as never) as Response;
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { reason: string }).reason, "inactive_environment");
    assert.deepEqual(rowSnapshot(sqlite), before);
  } finally { sqlite.close(); }
});

test("an active Production webhook cannot update a Sandbox row even when the invoice ID matches", async () => {
  const { sqlite, stubs, runtime } = fixture("production");
  try {
    const worker = await loadWorkerModule("app/api/square/webhook/route.ts", addSqlBuilders(stubs));
    const before = rowSnapshot(sqlite);
    const body = JSON.stringify({ type: "invoice.payment_made", data: { object: { invoice: { id: "test-invoice", status: "PAID", version: 2 } } } });
    const response = await worker.POST(await signedWebhook(runtime, "production", body) as never) as Response;
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { updated: boolean }).updated, false);
    assert.deepEqual(rowSnapshot(sqlite), before);
  } finally { sqlite.close(); }
});

test("matching webhook events update the right booking and preserve the version guard", async () => {
  for (const environment of ["sandbox", "production"] as const) {
    const { sqlite, stubs, runtime } = fixture(environment, environment);
    try {
      const worker = await loadWorkerModule("app/api/square/webhook/route.ts", addSqlBuilders(stubs));
      for (const [version, status, updated] of [[2, "PAID", true], [1, "UNPAID", false], [2, "UNPAID", false]] as const) {
        const body = JSON.stringify({ type: "invoice.updated", data: { object: { invoice: { id: "test-invoice", status, version } } } });
        const response = await worker.POST(await signedWebhook(runtime, environment, body) as never) as Response;
        assert.equal(response.status, 200);
        assert.equal((await response.json() as { updated: boolean }).updated, updated);
      }
      assert.equal(rowSnapshot(sqlite)!.square_deposit_invoice_status, "paid");
      assert.equal(rowSnapshot(sqlite)!.square_deposit_invoice_version, 2);
    } finally { sqlite.close(); }
  }
});

test("webhook signature and malformed JSON rejection remain 403 and 400", async () => {
  const { sqlite, stubs, runtime } = fixture("sandbox");
  try {
    const worker = await loadWorkerModule("app/api/square/webhook/route.ts", addSqlBuilders(stubs));
    const unsigned = await worker.POST(new Request(runtime.SQUARE_WEBHOOK_NOTIFICATION_URL, { method: "POST", body: "{}" }) as never) as Response;
    assert.equal(unsigned.status, 403);
    const malformed = await worker.POST(await signedWebhook(runtime, "sandbox", "{") as never) as Response;
    assert.equal(malformed.status, 400);
  } finally { sqlite.close(); }
});
