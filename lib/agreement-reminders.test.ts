import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as builders from "drizzle-orm";
import * as schema from "../db/schema.ts";
import { consultationBookingUrl } from "./consultation.ts";
import { buildPersonalizedTravelerAgreement, canonicalizeAgreement, currentTravelerAgreement, hashAgreementDocument, hashInvitationToken } from "./traveler-agreement.ts";

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

const NOW = new Date("2026-10-23T17:00:00.000Z");
const FIRST = "2026-10-16T17:00:00.000Z";
async function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const directory = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(directory).filter((f) => f.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  let afterClaim: (() => void) | undefined;
  const db = drizzle(async (query, params, method) => {
    const stmt = sqlite.prepare(query);
    if (method === "run") { stmt.run(...params); return { rows: [] }; }
    stmt.setReturnArrays(true);
    const rows = method === "get" ? stmt.get(...params) as unknown as unknown[] : stmt.all(...params) as unknown as unknown[][];
    if (query.startsWith('insert into "agreement_reminders"') && afterClaim) afterClaim();
    return { rows };
  });
  const emails: Record<string, string>[] = [];
  const runtime = { AGREEMENT_REMINDERS_ENABLED: "true", SQUARE_ENV: "production", MAILERSEND_API_TOKEN: "test-token", MAILERSEND_FROM_EMAIL: "test@example.test" };
  let beforeSend: (() => Promise<void>) | undefined;
  let throwOnSend = false;
  const stubs: Stubs = {
    "cloudflare:workers": { env: runtime },
    "drizzle-orm": builders,
    "@/db": { getDb: () => db },
    "@/db/schema": schema,
    "@/lib/agreement-reminder-storage": { ensureAgreementReminderStorage: async () => {} },
    "@/lib/traveler-agreement": { currentTravelerAgreement, hashInvitationToken, hashAgreementDocument, parseAgreementDocument: JSON.parse, isValidInvitationToken: (t: string) => /^[A-Za-z0-9_-]{43,128}$/u.test(t) },
    "@/lib/mailersend-transactional": { sendAgreementReminderEmail: async (email: Record<string, string>) => {
      if (beforeSend) await beforeSend();
      emails.push(email);
      if (throwOnSend) throw new Error("Provider response uncertain");
      return { sentAt: NOW.toISOString(), messageId: "test-message" };
    } },
  };
  const remindersModule = await load("./agreement-reminders.ts", stubs);
  const invitations = await load("./agreement-invitation.ts", stubs);
  let sequence = 0;
  async function add(sentAt: string | null = FIRST) {
    const id = ++sequence;
    await db.insert(schema.bookingRequests).values({ id, tripSlug: "discover-southern-vietnam", fullName: `Traveler ${id}`, email: `traveler${id}@example.test`, departure: "2027-06-01", roomPreference: "shared", partySize: 1, status: "booking_in_progress", squareEnvironment: "production", companyAcceptedAt: FIRST, companyAcceptedBy: "owner@example.test" });
    await db.insert(schema.travelers).values({ id, bookingRequestId: id, firstName: "Traveler", lastName: `${id}`, email: `traveler${id}@example.test` });
    const agreement = buildPersonalizedTravelerAgreement({ travelerName: `Traveler ${id}`, departure: "2027-06-01", occupancy: "Shared double/twin room", tripPriceCents: 287500 });
    const token = `${id}`.padStart(43, "a");
    await db.insert(schema.agreementInvitations).values({ id, travelerId: id, tokenHash: await hashInvitationToken(token), agreementVersion: currentTravelerAgreement.version, agreementDocumentHash: await hashAgreementDocument(agreement), agreementDocumentJson: canonicalizeAgreement(agreement), recipientEmail: `recorded${id}@example.test`, invitationEmailSentAt: sentAt, expiresAt: "2026-10-30T17:00:00.000Z" });
    return { id, token };
  }
  function sign(id: number) {
    sqlite.prepare(`INSERT INTO agreement_acceptances (invitation_id, traveler_id, agreement_version, agreement_document_hash, signer_type, signer_legal_name, traveler_initials, electronic_signature_consent, agreement_consent, deposit_acknowledged, cancellation_acknowledged, insurance_selection, ip_hash, user_agent, accepted_at) VALUES (?, ?, '1.0', 'hash', 'traveler', 'Traveler', 'TT', 1, 1, 1, 1, 'declined', 'hash', 'test', ?)`).run(id, id, NOW.toISOString());
  }
  return { sqlite, db, emails, runtime, add, sign, run: (now = NOW) => remindersModule.sendDueAgreementReminders(now), resolve: (token: string) => invitations.getAgreementInvitation(token), setBeforeSend: (f: () => Promise<void>) => { beforeSend = f; }, setAfterClaim: (f: () => void) => { afterClaim = f; }, failSend: () => { throwOnSend = true; } };
}

test("reminds once at seven full days, never earlier, and both links share one acceptance", async () => {
  const f = await fixture();
  const original = await f.add();
  assert.deepEqual(await f.run(new Date(NOW.getTime() - 1)), { sent: 0, failed: 0 });
  assert.deepEqual(await f.run(), { sent: 1, failed: 0 });
  assert.equal(f.emails[0].toEmail, "recorded1@example.test");
  const token = f.emails[0].invitationUrl.split("/").at(-1)!;
  const initial = await f.resolve(original.token) as { status: string; invitation: { invitationId: number } };
  const reminder = await f.resolve(token) as typeof initial;
  assert.equal(initial.status, "ready");
  assert.equal(reminder.status, "ready");
  assert.equal(initial.invitation.invitationId, reminder.invitation.invitationId);
  f.sign(original.id);
  assert.equal((await f.resolve(token) as { status: string }).status, "accepted");
  assert.equal((await f.resolve(original.token) as { status: string }).status, "accepted");
  await f.run();
  assert.equal(f.emails.length, 1);
});

test("excludes signed, revoked, expired, unsent, closed, waitlisted, Sandbox, screened and past-trip bookings", async () => {
  const f = await fixture();
  for (let i = 1; i <= 10; i++) await f.add(i === 4 ? null : FIRST);
  f.sign(1);
  f.sqlite.exec("UPDATE agreement_invitations SET revoked_at = '2026-10-20T17:00:00.000Z' WHERE id = 2; UPDATE agreement_invitations SET expires_at = '2026-10-23T17:00:00.000Z' WHERE id = 3; UPDATE booking_requests SET status = 'closed' WHERE id = 5; UPDATE booking_requests SET status = 'waitlist' WHERE id = 6; UPDATE booking_requests SET square_environment = 'sandbox' WHERE id = 7; UPDATE booking_requests SET seller_of_travel_state_resident = 1 WHERE id = 8; UPDATE booking_requests SET departure = '2026-10-20' WHERE id = 9; UPDATE agreement_invitations SET agreement_version = 'old' WHERE id = 10;");
  assert.deepEqual(await f.run(), { sent: 0, failed: 0 });
  assert.equal(f.emails.length, 0);
});

test("replacement emails do not reset the original seven-day clock", async () => {
  const f = await fixture();
  await f.add("2026-10-22T17:00:00.000Z");
  f.sqlite.exec("INSERT INTO agreement_invitations (traveler_id,token_hash,agreement_version,agreement_document_hash,invitation_email_sent_at,expires_at,revoked_at) VALUES (1,'old-token','1.0','hash','2026-10-16T17:00:00.000Z','2026-10-30T17:00:00.000Z','2026-10-22T17:00:00.000Z')");
  assert.deepEqual(await f.run(), { sent: 1, failed: 0 });
  assert.equal(f.emails.length, 1);
});

test("overlapping hourly runs and scheduler retries cannot send a second reminder", async () => {
  const f = await fixture();
  await f.add();
  await Promise.all([f.run(), f.run()]);
  await f.run();
  assert.equal(f.emails.length, 1);
});

test("unconfirmed delivery is recorded and not automatically retried", async () => {
  const f = await fixture();
  await f.add(); f.failSend();
  assert.deepEqual(await f.run(), { sent: 0, failed: 1 });
  await f.run();
  assert.equal(f.emails.length, 1);
  assert.equal(f.sqlite.prepare("SELECT status FROM agreement_reminders").get()!.status, "failed");
});

test("reminders are disabled outside explicit Production configuration", async () => {
  const f = await fixture(); await f.add();
  f.runtime.SQUARE_ENV = "sandbox";
  await f.run();
  f.runtime.SQUARE_ENV = "production"; f.runtime.AGREEMENT_REMINDERS_ENABLED = "false";
  await f.run(); assert.equal(f.emails.length, 0);
});

test("minor reminders go to the recorded recipient and address the guardian", async () => {
  const f = await fixture(); await f.add();
  f.sqlite.exec("UPDATE travelers SET traveler_type='minor',guardian_legal_name='Parent Example' WHERE id=1");
  await f.run(); assert.equal(f.emails[0].toName, "Parent Example");
});

test("signing after candidate selection suppresses the reminder before sending", async () => {
  const f = await fixture(); await f.add();
  f.setAfterClaim(() => f.sign(1));
  assert.deepEqual(await f.run(), { sent: 0, failed: 0 });
  assert.equal(f.emails.length, 0);
  assert.equal(f.sqlite.prepare("SELECT status FROM agreement_reminders").get()!.status, "skipped");
});

test("replacement or revoked invitations invalidate the reminder link too", async () => {
  const f = await fixture(); const original = await f.add(); await f.run();
  const reminderToken = f.emails[0].invitationUrl.split("/").at(-1)!;
  f.sqlite.exec("UPDATE agreement_invitations SET revoked_at='2026-10-23T18:00:00.000Z' WHERE id=1");
  assert.equal((await f.resolve(reminderToken) as { status: string }).status, "revoked");
  assert.equal((await f.resolve(original.token) as { status: string }).status, "revoked");
});

test("missing email configuration leaves travelers eligible for a later run", async () => {
  const f = await fixture(); await f.add(); f.runtime.MAILERSEND_API_TOKEN = "";
  await assert.rejects(f.run(), /email configuration/u);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS total FROM agreement_reminders").get()!.total, 0);
});

test("reminder email includes a signing link, expiration, and no-payment explanation", async () => {
  const emailModule = await load("./mailersend-transactional.ts", { "cloudflare:workers": { env: { MAILERSEND_API_TOKEN: "test", MAILERSEND_FROM_EMAIL: "test@example.test" } }, "./consultation": { consultationBookingUrl } });
  const originalFetch = globalThis.fetch;
  let payload: Record<string, string> | undefined;
  globalThis.fetch = async (_url, options) => {
    payload = JSON.parse(options!.body as string);
    return new Response(null, { status: 202, headers: { "x-message-id": "test-id" } });
  };
  try {
    await emailModule.sendAgreementReminderEmail({ toEmail: "test@example.test", toName: "Parent <Example>", travelerName: "Minor <Example>", invitationUrl: "https://cookieparadisetravel.com/traveler-agreement/test-token", expiresAt: "2026-10-30T17:00:00.000Z" });
    assert.match(payload!.subject, /^Reminder: please sign/u);
    assert.match(payload!.html, /Review and sign agreement/u);
    assert.match(payload!.html, /Minor &lt;Example&gt;/u);
    assert.doesNotMatch(payload!.html, /Minor <Example>/u);
    assert.match(payload!.text, /Opening this link does not collect a payment/u);
    assert.match(payload!.text, /expires October 30, 2026/u);
  } finally { globalThis.fetch = originalFetch; }
});

test("storage initializes before use and remains compatible with later migration application", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON; CREATE TABLE travelers(id integer PRIMARY KEY); CREATE TABLE agreement_invitations(id integer PRIMARY KEY); INSERT INTO travelers VALUES(1); INSERT INTO agreement_invitations VALUES(1);");
  let batches = 0;
  let fail = true;
  const runtime = { DB: {
    prepare: (statement: string) => statement,
    batch: async (statements: string[]) => {
      batches++;
      if (fail) throw new Error("Temporary storage failure");
      sqlite.exec("BEGIN");
      try { for (const statement of statements) sqlite.exec(statement); sqlite.exec("COMMIT"); }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
      return [];
    },
  } };
  const storage = await load("./agreement-reminder-storage.ts", { "cloudflare:workers": { env: runtime } });
  await assert.rejects(storage.ensureAgreementReminderStorage(), /Temporary storage failure/u);
  fail = false;
  await Promise.all([storage.ensureAgreementReminderStorage(), storage.ensureAgreementReminderStorage()]);
  await storage.ensureAgreementReminderStorage();
  assert.equal(batches, 2);
  sqlite.exec("INSERT INTO agreement_reminders(traveler_id,invitation_id,token_hash,first_email_sent_at,claimed_at,status) VALUES(1,1,'hash','first','claimed','sent')");
  sqlite.exec(readFileSync(new URL("../drizzle/0020_agreement_reminders.sql", import.meta.url), "utf8"));
  assert.equal(sqlite.prepare("SELECT count(*) AS total FROM agreement_reminders").get()!.total, 1);
  assert.equal(sqlite.prepare("PRAGMA foreign_key_list(agreement_reminders)").all().length, 2);
  assert.ok(sqlite.prepare("PRAGMA index_list(agreement_reminders)").all().some((row) => row.name === "agreement_reminders_token_hash_unique" && row.unique === 1));
  sqlite.close();
});
