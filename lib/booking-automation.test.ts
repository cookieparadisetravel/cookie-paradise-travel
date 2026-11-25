import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as builders from "drizzle-orm";
import * as schema from "../db/schema.ts";
import * as agreement from "./traveler-agreement.ts";
import * as payments from "./payment-schedule.ts";
import * as pricing from "./trip-pricing.ts";
import * as square from "./square-config.ts";
import * as safe from "./safe-error.ts";
import * as residency from "./residency-review.ts";

type Stubs = Record<string, Record<string, unknown>>;
async function load(file: string, stubs: Stubs): Promise<Record<string, (...args: unknown[]) => Promise<unknown>>> {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  const key = `__agreementReminderTest_${crypto.randomUUID()}`;
  const globals = globalThis as unknown as Record<string, unknown>;
  globals[key] = stubs;
  let code = outputText;
  const parsed = ts.createSourceFile(file, code, ts.ScriptTarget.ESNext, true);
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    assert.ok(bindings && ts.isNamedImports(bindings));
    const exports = bindings.elements.map((b) => `export const ${(b.propertyName ?? b.name).text} = stub[${JSON.stringify((b.propertyName ?? b.name).text)}];`).join("\n");
    const stub = `const stub = globalThis[${JSON.stringify(key)}][${JSON.stringify(statement.moduleSpecifier.text)}];\n${exports}`;
    code = code.replace(JSON.stringify(statement.moduleSpecifier.text), JSON.stringify(`data:text/javascript;base64,${Buffer.from(stub).toString("base64")}`));
  }
  try { return await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`); }
  finally { delete globals[key]; }
}

async function fixture(state: string | null = "CA", partySize = 1) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  const directory = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(directory).filter(f => f.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  const db = drizzle(async (query, params, method) => {
    const stmt = sqlite.prepare(query);
    if (method === "run") { stmt.run(...params); return { rows: [] }; }
    stmt.setReturnArrays(true);
    return { rows: method === "get" ? stmt.get(...params) as unknown as unknown[] : stmt.all(...params) as unknown as unknown[][] };
  });
  const emails: { kind: string; toEmail: string }[] = [];
  const runtime = { AUTOMATED_BOOKING_ENABLED: "true", SQUARE_ENV: "production" };
  let signed = false;
  const delivery = (kind: string) => async (input: { toEmail: string }) => {
    emails.push({ kind, toEmail: input.toEmail }); return { sentAt: new Date().toISOString(), messageId: "test" };
  };
  const flow = await load("./booking-automation.ts", {
    "cloudflare:workers": { env: runtime }, "drizzle-orm": builders, "@/db": { getDb: () => db }, "@/db/schema": schema,
    "@/lib/residency-review": residency, "@/lib/square-config": square, "@/lib/safe-error": safe,
    "@/lib/booking-meals": { bookingIncludesAllMeals: async (id: number) => sqlite.prepare("SELECT all_meals_included FROM booking_meal_preferences WHERE booking_request_id=?").get(id)?.all_meals_included === 1 },
    "@/lib/traveler-agreement": agreement, "@/lib/payment-schedule": payments, "@/lib/trip-pricing": pricing,
    "@/lib/agreement-readiness": { getAgreementReadiness: async () => ({ readyForInvoice: signed }) },
    "@/lib/mailersend-transactional": { sendAgreementInvitationEmail: delivery("agreement"), sendPaymentChoiceInvitationEmail: delivery("payment"), sendTravelerListInvitationEmail: delivery("travelers") },
  });
  await db.insert(schema.bookingRequests).values({ id: 1, tripSlug: "discover-southern-vietnam", fullName: "Test Traveler", email: "test@example.test", departure: "2027-06-01", roomPreference: "shared", partySize, bookingIntent: "ready_to_book", squareEnvironment: "production", sellerOfTravelStateResident: true, residenceState: state });
  async function addTraveler(id: number) { await db.insert(schema.travelers).values({ id, bookingRequestId: 1, firstName: "Test", lastName: `Traveler${id}`, email: `test${id}@example.test`, travelerType: "adult" }); }
  if (partySize === 1) await addTraveler(1);
  const input = { inquiryId: 1, requestUrl: "https://example.test/" };
  return { sqlite, emails, runtime, addTraveler, sign: () => { signed = true; }, start: () => flow.startAutomatedReadyToBookFlow(input), afterList: () => flow.continueAutomatedBookingAfterTravelerList(input), afterAgreement: () => flow.continueAutomatedBookingAfterAgreement(input) };
}

test("California single-traveler booking reaches agreement and payment setup without clearing residence", async () => {
  const f = await fixture();
  assert.equal(await f.start(), "agreements_sent");
  assert.deepEqual(f.emails.map(e => e.kind), ["agreement"]);
  const row = f.sqlite.prepare("SELECT residence_state,seller_of_travel_state_resident FROM booking_requests").get()!;
  assert.equal(row.residence_state, "CA"); assert.equal(row.seller_of_travel_state_resident, 1);
  await f.afterAgreement(); assert.equal(f.emails.length, 1);
  f.sign(); await f.afterAgreement(); await f.afterAgreement();
  assert.deepEqual(f.emails.map(e => e.kind), ["agreement", "payment"]);
  assert.equal(f.sqlite.prepare("SELECT automated_booking_status FROM booking_requests").get()!.automated_booking_status, "payment_choice_sent");
});

test("California group booking continues after the traveler list", async () => {
  const f = await fixture("CA", 2);
  assert.equal(await f.start(), "traveler_list_sent");
  await f.addTraveler(1); await f.addTraveler(2); await f.afterList();
  assert.deepEqual(f.emails.map(e => e.kind), ["travelers", "agreement", "agreement"]);
  f.sign(); await f.afterAgreement(); assert.equal(f.emails.at(-1)!.kind, "payment");
});

test("other flagged states and unknown flagged residence retain their holds", async () => {
  for (const state of ["FL", "HI", "MD", "WA", null]) {
    const f = await fixture(state);
    assert.equal(await f.start(), "blocked"); f.sign(); await f.afterList(); await f.afterAgreement();
    assert.equal(f.emails.length, 0);
  }
});

test("an existing California residency hold can continue after signing, but unrelated holds cannot", async () => {
  for (const message of [residency.RESIDENCY_REVIEW_HOLD_MESSAGE, "Unrelated hold"]) {
    const f = await fixture();
    f.sqlite.prepare("UPDATE booking_requests SET automated_booking_status='blocked',automated_booking_error=?").run(message);
    f.sqlite.exec("UPDATE travelers SET confirmed_trip_price_cents=287500,confirmed_occupancy='shared'");
    f.sign(); await f.afterAgreement(); await f.afterAgreement();
    assert.equal(f.emails.length, message === residency.RESIDENCY_REVIEW_HOLD_MESSAGE ? 1 : 0);
  }
});

test("California remains subject to the global automation switch and payment environment", async () => {
  const f = await fixture(); f.runtime.AUTOMATED_BOOKING_ENABLED = "false";
  assert.equal(await f.start(), "not_requested");
  f.runtime.AUTOMATED_BOOKING_ENABLED = "true"; f.runtime.SQUARE_ENV = "sandbox";
  assert.equal(await f.start(), "not_requested"); assert.equal(f.emails.length, 0);
});

test("December California booking preserves departure through agreement and payment setup", async () => {
  const f = await fixture();
  f.sqlite.prepare("UPDATE booking_requests SET departure='2027-12-27'").run();
  assert.equal(await f.start(), "agreements_sent");
  f.sign(); await f.afterAgreement();
  assert.deepEqual(f.emails.map(e => e.kind), ["agreement", "payment"]);
  assert.equal(f.sqlite.prepare("SELECT departure FROM booking_requests").get()!.departure, "2027-12-27");
});


test("summer bookings retain their departure through agreement and payment setup", async () => {
  for (const departure of ["2027-06-15", "2027-06-29", "2027-07-13", "2027-07-27", "2027-08-10"]) {
    const f = await fixture();
    f.sqlite.prepare("UPDATE booking_requests SET departure=?").run(departure);
    assert.equal(await f.start(), "agreements_sent");
    f.sign(); await f.afterAgreement();
    assert.deepEqual(f.emails.map(e => e.kind), ["agreement", "payment"]);
    assert.equal(f.sqlite.prepare("SELECT departure FROM booking_requests").get()!.departure, departure);
  }
});

test("selected all-meals upgrade follows a couple through agreements and payment total", async () => {
  const f = await fixture("CA", 2);
  f.sqlite.exec("INSERT INTO booking_meal_preferences VALUES (1,1)");
  assert.equal(await f.start(), "traveler_list_sent");
  await f.addTraveler(1); await f.addTraveler(2); await f.afterList();
  assert.deepEqual(f.sqlite.prepare("SELECT confirmed_trip_price_cents FROM travelers").all().map(row => row.confirmed_trip_price_cents), [300_000,300_000]);
  for (const row of f.sqlite.prepare("SELECT agreement_document_json FROM agreement_invitations").all()) {
    assert.match(String(row.agreement_document_json), /Selected upgrade — all tour meals/);
    assert.match(String(row.agreement_document_json), /\$3,000\.00/);
  }
  f.sign(); await f.afterAgreement();
  assert.equal(f.sqlite.prepare("SELECT confirmed_booking_total_cents FROM booking_requests").get()!.confirmed_booking_total_cents, 600_000);
});

test("private-room meal upgrade costs $3,399 and does not rewrite emailed agreements", async () => {
  const f = await fixture();
  f.sqlite.exec("UPDATE booking_requests SET room_preference='private'; INSERT INTO booking_meal_preferences VALUES (1,1)");
  assert.equal(await f.start(), "agreements_sent");
  assert.equal(f.sqlite.prepare("SELECT confirmed_trip_price_cents FROM travelers").get()!.confirmed_trip_price_cents, 339_900);
  const snapshot = f.sqlite.prepare("SELECT agreement_document_json FROM agreement_invitations").get()!.agreement_document_json;
  await f.start();
  assert.equal(f.sqlite.prepare("SELECT agreement_document_json FROM agreement_invitations").get()!.agreement_document_json, snapshot);
  assert.equal(f.emails.length,1);
});
