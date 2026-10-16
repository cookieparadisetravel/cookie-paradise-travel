import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
import * as jose from "jose";
import * as consultation from "./consultation.ts";

async function load<T>(file: string, stubs: Record<string, Record<string, unknown>>): Promise<T> {
  let code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const key = `__inquiryTest_${crypto.randomUUID()}`;
  const globals = globalThis as unknown as Record<string, unknown>;
  globals[key] = stubs;
  for (const statement of ts.createSourceFile(file, code, ts.ScriptTarget.ESNext, true).statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    assert.ok(bindings && ts.isNamedImports(bindings));
    const exports = bindings.elements.map((binding) => {
      const name = (binding.propertyName ?? binding.name).text;
      return `export const ${name} = stub[${JSON.stringify(name)}];`;
    }).join("\n");
    const stub = `const stub=globalThis[${JSON.stringify(key)}][${JSON.stringify(statement.moduleSpecifier.text)}];${exports}`;
    code = code.replace(JSON.stringify(statement.moduleSpecifier.text), JSON.stringify(`data:text/javascript;base64,${Buffer.from(stub).toString("base64")}`));
  }
  try { return await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`); }
  finally { delete globals[key]; }
}

const FIRST = "2026-10-16 17:00:00";
const DAY3 = new Date("2026-10-19T17:00:00Z");
const DAY7 = new Date("2026-10-23T17:00:00Z");
type Email = { toEmail: string; toName: string; reminderDay: 3 | 7 };

async function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  const directory = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  let afterClaim: (() => void) | undefined;
  const db = { prepare(query: string) {
    let params: (string | number | null)[] = [];
    const statement = {
      bind(...values: typeof params) { params = values; return statement; },
      async all() { return { results: sqlite.prepare(query).all(...params) }; },
      async first() {
        const row = sqlite.prepare(query).get(...params) ?? null;
        if (query.startsWith("INSERT INTO inquiry_reminders") && afterClaim) afterClaim();
        return row;
      },
      async run() { return sqlite.prepare(query).run(...params); },
    };
    return statement;
  } };
  const runtime: Record<string, unknown> = { DB: db, INQUIRY_REMINDERS_ENABLED: "true", SQUARE_ENV: "production", MAILERSEND_API_TOKEN: "test", MAILERSEND_FROM_EMAIL: "test@example.test", CONSULTATION_CALENDAR_ID: "calendar@example.test", GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON: "test-only" };
  const emails: Email[] = [];
  const booked = new Set<string>();
  let calendarFails = false;
  let sendFails = false;
  let onCalendar: (() => void) | undefined;
  const reminders = await load<{ sendDueInquiryReminders(now: Date): Promise<unknown> }>("./inquiry-reminders.ts", {
    "cloudflare:workers": { env: runtime },
    "./inquiry-reminder-storage": { ensureInquiryReminderStorage: async () => {} },
    "./consultation-calendar": { hasBookedConsultation: async (email: string) => {
      onCalendar?.();
      if (calendarFails) throw new Error("Calendar unavailable");
      return booked.has(email);
    } },
    "./mailersend-transactional": { sendInquiryReminderEmail: async (email: Email) => {
      emails.push(email);
      if (sendFails) throw new Error("Provider timeout");
      return { sentAt: DAY3.toISOString(), messageId: "test-id" };
    } },
  });
  let id = 0;
  function add(email = "customer@example.test", created = FIRST) {
    id++;
    sqlite.prepare(`INSERT INTO booking_requests (id,trip_slug,full_name,email,departure,room_preference,party_size,contact_consent,booking_intent,square_environment,created_at)
      VALUES (?,'discover-southern-vietnam','Customer',?,'2027-06-01','shared',1,1,'needs_information','production',?)`).run(id, email, created);
    return id;
  }
  return { sqlite, runtime, emails, booked, add, run: (now = DAY3) => reminders.sendDueInquiryReminders(now),
    failCalendar: (value = true) => { calendarFails = value; }, failSend: () => { sendFails = true; },
    setAfterClaim: (fn: () => void) => { afterClaim = fn; }, setOnCalendar: (fn: () => void) => { onCalendar = fn; } };
}

test("inquiry emails are due at exactly day three and day seven, each only once", async () => {
  const f = await fixture(); f.add();
  await f.run(new Date(DAY3.getTime() - 1000));
  assert.equal(f.emails.length, 0);
  await f.run(); await f.run();
  assert.deepEqual(f.emails.map((e) => e.reminderDay), [3]);
  await f.run(new Date(DAY7.getTime() - 1000));
  assert.equal(f.emails.length, 1);
  await f.run(DAY7); await f.run(new Date("2026-11-01T00:00:00Z"));
  assert.deepEqual(f.emails.map((e) => e.reminderDay), [3, 7]);
});

test("booking before the first reminder suppresses both, including repeated inquiries", async () => {
  const f = await fixture(); f.add(" Customer@Example.Test "); f.add("customer@example.test");
  f.booked.add("customer@example.test");
  await f.run(); f.booked.clear(); await f.run(DAY7);
  assert.equal(f.emails.length, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM consultation_bookings").get()!.n, 1);
});

test("booking between emails stops the second reminder", async () => {
  const f = await fixture(); f.add(); await f.run();
  f.booked.add("customer@example.test"); await f.run(DAY7);
  assert.deepEqual(f.emails.map((e) => e.reminderDay), [3]);
});

test("duplicate submissions keep the initial clock; catchup sends only day seven", async () => {
  const f = await fixture(); f.add("CUSTOMER@example.test"); f.add("customer@example.test", "2026-10-22T17:00:00Z");
  await f.run(DAY7); await f.run(DAY7);
  assert.deepEqual(f.emails, [{ toEmail: "customer@example.test", toName: "Customer", reminderDay: 7 }]);
});

test("calendar failures defer safely without consuming a reminder", async () => {
  const f = await fixture(); f.add(); f.failCalendar(); await f.run();
  assert.equal(f.emails.length, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM inquiry_reminders").get()!.n, 0);
  f.failCalendar(false); await f.run(); assert.equal(f.emails.length, 1);
});

test("missing connection, disabled flag, and Sandbox runtime never send", async () => {
  for (const [key, value] of [["GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON", ""], ["CONSULTATION_CALENDAR_ID", ""], ["INQUIRY_REMINDERS_ENABLED", "false"], ["SQUARE_ENV", "sandbox"], ["MAILERSEND_API_TOKEN", ""]]) {
    const f = await fixture(); f.add(); f.runtime[key] = value; await f.run(); assert.equal(f.emails.length, 0);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM inquiry_reminders").get()!.n, 0);
  }
});

test("inactive, ready-to-book, no consent, screened, past-departure and invoiced inquiries are excluded", async () => {
  const f = await fixture();
  const updates = ["status='closed'", "status='waitlist'", "status='booking_in_progress'", "status='reserved'", "booking_intent='ready_to_book'", "contact_consent=0", "seller_of_travel_state_resident=1", "departure='2026-10-18'", "square_environment='sandbox'", "company_accepted_at='2026-10-17'", "square_deposit_invoice_id='invoice'"];
  for (const [index, update] of updates.entries()) {
    const id = f.add(`customer${index}@example.test`);
    f.sqlite.exec(`UPDATE booking_requests SET ${update} WHERE id=${id}`);
  }
  await f.run(); assert.equal(f.emails.length, 0);
});

test("a newer inquiry progressing into booking suppresses an earlier information inquiry", async () => {
  const f = await fixture(); f.add(); const id = f.add("CUSTOMER@example.test");
  f.sqlite.exec(`UPDATE booking_requests SET booking_intent='ready_to_book' WHERE id=${id}`);
  await f.run(); assert.equal(f.emails.length, 0);
});

test("overlapping runs claim once; uncertain provider delivery is never automatically resent", async () => {
  const f = await fixture(); f.add();
  await Promise.all([f.run(), f.run()]); assert.equal(f.emails.length, 1);
  const g = await fixture(); g.add(); g.failSend(); await g.run(); await g.run();
  assert.equal(g.emails.length, 1);
  assert.equal(g.sqlite.prepare("SELECT status FROM inquiry_reminders").get()!.status, "failed");
});

test("progress during calendar lookup is checked again before sending", async () => {
  const f = await fixture(); f.add();
  f.setOnCalendar(() => f.sqlite.exec("UPDATE booking_requests SET status='closed'"));
  await f.run(); assert.equal(f.emails.length, 0);
  assert.equal(f.sqlite.prepare("SELECT status FROM inquiry_reminders").get()!.status, "skipped");
});

type CalendarModule = { isCustomerConsultation(event: unknown, email: string): boolean; hasBookedConsultation(email: string): Promise<boolean> };
const appointment = { status: "confirmed", summary: `${consultation.consultationTitle} (Customer)`, start: { dateTime: "2026-10-19T12:00:00Z" }, end: { dateTime: "2026-10-19T12:30:00Z" }, attendees: [{ email: "CUSTOMER@example.test" }] };

test("calendar matching requires the consultation title, duration and exact booking email", async () => {
  const m = await load<CalendarModule>("./consultation-calendar.ts", { "cloudflare:workers": { env: {} }, jose, "./consultation": consultation });
  assert.equal(m.isCustomerConsultation(appointment, "customer@example.test"), true);
  assert.equal(m.isCustomerConsultation({ ...appointment, attendees: [], description: "**Booked by**\nCustomer\ncustomer@example.test\n\nTrip questions" }, "customer@example.test"), true);
  for (const event of [{ ...appointment, status: "cancelled" }, { ...appointment, summary: "Unrelated meeting" }, { ...appointment, end: { dateTime: "2026-10-19T13:00:00Z" } }, { ...appointment, attendees: [{ email: "othercustomer@example.test" }] }, { ...appointment, attendees: [{ email: "customer@example.test", organizer: true }] }]) {
    assert.equal(m.isCustomerConsultation(event, "customer@example.test"), false);
  }
});

test("calendar API signs read-only assertions, paginates, rechecks events, and fails closed", async () => {
  const keys = await jose.generateKeyPair("RS256", { extractable: true });
  const runtime = { CONSULTATION_CALENDAR_ID: "calendar@example.test", GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: "service_account", client_email: "service@example.test", private_key: await jose.exportPKCS8(keys.privateKey) }) };
  const m = await load<CalendarModule>("./consultation-calendar.ts", { "cloudflare:workers": { env: runtime }, jose, "./consultation": consultation });
  const originalFetch = globalThis.fetch;
  let tokens = 0, lookups = 0;
  let fail = false, malformed = false;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "oauth2.googleapis.com") {
      tokens++;
      const body = init!.body as URLSearchParams;
      const { payload } = await jose.jwtVerify(body.get("assertion")!, keys.publicKey, { issuer: "service@example.test", audience: url.toString() });
      assert.equal(payload.scope, "https://www.googleapis.com/auth/calendar.events.readonly");
      return Response.json({ access_token: "fake-token", expires_in: 3600 });
    }
    lookups++;
    assert.equal(url.searchParams.get("q"), "customer@example.test");
    assert.equal((init!.headers as Record<string, string>).Authorization, "Bearer fake-token");
    if (fail) return new Response("Forbidden", { status: 403 });
    if (malformed) return Response.json({ accessRole: "freeBusyReader", items: [] });
    return Response.json({ accessRole: "reader", items: url.searchParams.has("pageToken") ? [appointment] : [], ...(!url.searchParams.has("pageToken") ? { nextPageToken: "next" } : {}) });
  };
  try {
    assert.equal(await m.hasBookedConsultation("customer@example.test"), true);
    assert.equal(await m.hasBookedConsultation("customer@example.test"), true);
    assert.equal(tokens, 1); assert.equal(lookups, 4);
    fail = true; await assert.rejects(m.hasBookedConsultation("customer@example.test"));
    fail = false; malformed = true; await assert.rejects(m.hasBookedConsultation("customer@example.test"));
  } finally { globalThis.fetch = originalFetch; }
});

test("templates use the real consultation URL in HTML and text with safe customer names", async () => {
  const m = await load<{ sendInquiryReminderEmail(email: Email): Promise<unknown> }>("./mailersend-transactional.ts", { "cloudflare:workers": { env: { MAILERSEND_API_TOKEN: "test", MAILERSEND_FROM_EMAIL: "test@example.test" } }, "./consultation": consultation });
  const originalFetch = globalThis.fetch;
  const payloads: { html: string; text: string; subject: string }[] = [];
  globalThis.fetch = async (_input, init) => { payloads.push(JSON.parse(String(init!.body))); return new Response(null, { status: 202 }); };
  try {
    for (const reminderDay of [3, 7] as const) await m.sendInquiryReminderEmail({ toEmail: "customer@example.test", toName: "<Customer>", reminderDay });
    for (const p of payloads) {
      assert.ok(p.html.includes(`href="${consultation.consultationBookingUrl}"`)); assert.ok(p.text.includes(consultation.consultationBookingUrl));
      assert.ok(p.html.includes("&lt;Customer&gt;")); assert.ok(!p.html.includes("<Customer>"));
      assert.ok(p.text.includes("30-minute consultation"));
    }
    assert.notEqual(payloads[0].subject, payloads[1].subject);
  } finally { globalThis.fetch = originalFetch; }
});

test("runtime storage and migration are both idempotent with equivalent tables", async () => {
  const sqlite = new DatabaseSync(":memory:");
  const m = await load<{ inquiryReminderStorageStatements: string[] }>("./inquiry-reminder-storage.ts", { "cloudflare:workers": { env: {} } });
  for (const sql of m.inquiryReminderStorageStatements) sqlite.exec(sql);
  const migration = readFileSync(new URL("../drizzle/0021_inquiry_reminders.sql", import.meta.url), "utf8");
  sqlite.exec(migration); sqlite.exec(migration);
  assert.equal(sqlite.prepare("PRAGMA table_info(inquiry_reminders)").all().length, 8);
});
