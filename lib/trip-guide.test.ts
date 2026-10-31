import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { z } from "zod";
import * as guide from "./trip-guide.ts";
import * as requests from "./lead-request.ts";
import * as consultation from "./consultation.ts";
import * as referrals from "./salon-referrals.ts";
import { databaseFixture, loadModule } from "../test-support/lead-fixture.ts";

const uuid = () => crypto.randomUUID();
const leadInput = () => ({ firstName: "Traveler", email: "Traveler@Example.test ", phone: "", city: "Columbus", timing: "june_2027" as const,
  source: "website" as "website" | "meta", referralCode: "columbus-uppercuts", marketingConsent: false, submissionId: `website:${uuid()}`, attribution: { ...guide.emptyAttribution, utmCampaign: "vietnam-june" } });
async function fixture() {
  const f = databaseFixture();
  const runtime: Record<string, unknown> = { DB: f.db, SQUARE_ENV: "production", INQUIRY_REMINDERS_ENABLED: "true", MAILERSEND_API_TOKEN: "test", MAILERSEND_FROM_EMAIL: "test@example.test", CONSULTATION_CALENDAR_ID: "calendar", GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON: "test-only" };
  const storage = await loadModule<{ ensureTripGuideStorage(): Promise<void>; tripGuideStorageStatements: string[] }>("lib/trip-guide-storage.ts", { "cloudflare:workers": { env: runtime } });
  const emails: Record<string, unknown>[] = [], ownerEmails: unknown[] = [], subscriptions: unknown[] = [];
  let emailFails = false, calendarFails = false;
  const booked = new Set<string>();
  let onCalendar: (() => void) | undefined;
  const service = await loadModule<{ saveTripGuideLead(input: ReturnType<typeof leadInput>): Promise<{ created: boolean; emailStatus: string }> }>("lib/trip-guide-service.ts", {
    "cloudflare:workers": { env: runtime }, "./trip-guide-storage": storage, "./trip-guide": guide,
    "./trip-guide-email": { sendTripGuideEmail: async (input: Record<string, unknown>) => { emails.push(input); if (emailFails) throw new Error("Uncertain delivery"); return { sentAt: new Date().toISOString(), messageId: "test" }; } },
    "./mailersend-transactional": { sendTripGuideEmailMessage: async (input: unknown) => { ownerEmails.push(input); return { sentAt: new Date().toISOString(), messageId: "owner-test" }; } },
    "./mailerlite": { addConsentedSubscriber: async (input: unknown) => { subscriptions.push(input); return "subscribed"; } },
  });
  const reminders = await loadModule<{ sendDueTripGuideReminders(now: Date): Promise<unknown> }>("lib/trip-guide-reminders.ts", {
    "cloudflare:workers": { env: runtime }, "./trip-guide-storage": storage,
    "./inquiry-reminder-storage": { ensureInquiryReminderStorage: async () => {} }, "./consultation": consultation,
    "./consultation-calendar": { hasBookedConsultation: async (email: string) => { onCalendar?.(); if (calendarFails) throw new Error("Unavailable"); return booked.has(email); } },
    "./mailersend-transactional": { sendTripGuideEmailMessage: async (input: Record<string, unknown>) => { emails.push(input); if (emailFails) throw new Error("Uncertain delivery"); return { sentAt: "2026-11-03T17:00:00Z", messageId: "test" }; } },
  });
  return { ...f, runtime, storage, emails, ownerEmails, subscriptions, booked, save: service.saveTripGuideLead, run: reminders.sendDueTripGuideReminders,
    failEmail: () => { emailFails = true; }, failCalendar: (value: boolean) => { calendarFails = value; }, onCalendar: (fn: () => void) => { onCalendar = fn; } };
}
const DAY3 = new Date("2026-11-03T17:00:00Z"), DAY7 = new Date("2026-11-07T17:00:00Z");
async function ready() {
  const f = await fixture(); await f.save(leadInput()); f.emails.length = 0;
  f.sqlite.exec("UPDATE trip_guide_leads SET created_at='2026-10-31T17:00:00Z'");
  return f;
}

test("guide intake deduplicates normalized email across website and Meta without creating a booking", async () => {
  const f = await fixture();
  const input = leadInput();
  assert.equal((await f.save(input)).emailStatus, "sent");
  await f.save(input);
  await f.save({ ...input, email: "traveler@example.test", source: "meta", firstName: "Changed", submissionId: "meta:123" });
  assert.equal(f.emails.length, 1);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trip_guide_leads").get()!.n, 1);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trip_guide_submissions").get()!.n, 2);
  assert.equal(f.sqlite.prepare("SELECT first_name FROM trip_guide_leads").get()!.first_name, "Traveler");
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM booking_requests").get()!.n, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM travelers").get()!.n, 0);
});
test("submission replay cannot target another email, add consent or reopen a closed lead", async () => {
  const f = await fixture(), input = leadInput();
  await f.save(input);
  f.sqlite.exec("UPDATE trip_guide_leads SET status='closed'");
  await f.save({ ...input, marketingConsent: true });
  await assert.rejects(f.save({ ...input, email: "other@example.test" }));
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trip_guide_leads").get()!.n, 1);
  assert.equal(f.sqlite.prepare("SELECT status FROM trip_guide_leads").get()!.status, "closed");
  assert.equal(f.subscriptions.length, 0); assert.equal(f.emails.length, 1);
});
test("marketing is separate, opt-in only and idempotent; owner alert uses the configured owner", async () => {
  const f = await fixture(), input = leadInput(); f.runtime.ADMIN_OWNER_EMAIL = "owner@example.test";
  await f.save(input); assert.equal(f.subscriptions.length, 0);
  await f.save({ ...input, submissionId: `website:${uuid()}`, marketingConsent: true });
  await f.save({ ...input, submissionId: `website:${uuid()}`, marketingConsent: true });
  assert.equal(f.subscriptions.length, 1); assert.equal(f.ownerEmails.length, 1);
  assert.equal((f.ownerEmails[0] as { toEmail: string }).toEmail, "owner@example.test");
});
test("provider failure preserves the lead and is never automatically resent; Sandbox intake is refused", async () => {
  const f = await fixture(), input = leadInput(); f.failEmail();
  assert.equal((await f.save(input)).emailStatus, "failed"); await f.save(input);
  assert.equal(f.emails.length, 1); assert.equal(f.sqlite.prepare("SELECT guide_email_status FROM trip_guide_leads").get()!.guide_email_status, "failed");
  const g = await fixture(); g.runtime.SQUARE_ENV = "sandbox"; await assert.rejects(g.save(input)); assert.equal(g.emails.length, 0);
  assert.equal(g.sqlite.prepare("SELECT count(*) n FROM trip_guide_leads").get()!.n, 0);
});
test("runtime storage and migration are additive and idempotent in either order", async () => {
  const f = await fixture();
  f.sqlite.exec("DROP TABLE trip_guide_reminders; DROP TABLE trip_guide_submissions; DROP TABLE trip_guide_leads;");
  await f.storage.ensureTripGuideStorage();
  const migration = readFileSync(new URL("../drizzle/0024_wide_sleeper.sql", import.meta.url), "utf8");
  f.sqlite.exec(migration); f.sqlite.exec(migration);
  for (const sql of f.storage.tripGuideStorageStatements) f.sqlite.exec(sql);
  await f.save(leadInput());
  assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(), []);
});
test("guide reminders send once at day three and seven, with a stop link and real call URL", async () => {
  const f = await ready(); await f.run(new Date(DAY3.getTime()-1)); assert.equal(f.emails.length, 0);
  await Promise.all([f.run(DAY3),f.run(DAY3)]); assert.equal(f.emails.length, 1);
  await f.run(DAY7); await f.run(DAY7); assert.equal(f.emails.length, 2);
  for (const email of f.emails) { assert.ok(String(email.text).includes(consultation.consultationBookingUrl)); assert.ok(String(email.html).includes("/trip-guide/stop/")); }
});
test("guide reminders stop for closed, progressed, future, existing booking and calendar-booked leads", async () => {
  for (const update of ["status='closed'", "status='consultation_booked'", "status='booking_in_progress'", "travel_timing='future'", "consultation_booked_at='2026-11-01'"]) {
    const f = await ready(); f.sqlite.exec(`UPDATE trip_guide_leads SET ${update}`); await f.run(DAY3); assert.equal(f.emails.length, 0);
  }
  const f = await ready(); f.sqlite.exec("INSERT INTO booking_requests (trip_slug,full_name,email,departure,room_preference,party_size,square_environment) VALUES ('vietnam','Traveler',' TRAVELER@example.test ','2027-06-01','shared',1,'production')"); await f.run(DAY3); assert.equal(f.emails.length, 0);
  const g = await ready(); await g.run(DAY3); g.booked.add("traveler@example.test"); await g.run(DAY7); assert.equal(g.emails.length, 1);
  assert.equal(g.sqlite.prepare("SELECT status FROM trip_guide_leads").get()!.status, "consultation_booked");
});
test("calendar failure defers safely, closes are rechecked, uncertain sends are not retried", async () => {
  const f = await ready(); f.failCalendar(true); await f.run(DAY3); assert.equal(f.emails.length, 0);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trip_guide_reminders").get()!.n, 0);
  f.failCalendar(false); f.onCalendar(() => f.sqlite.exec("UPDATE trip_guide_leads SET status='closed'")); await f.run(DAY3); assert.equal(f.emails.length, 0);
  const g = await ready(); g.failEmail(); await g.run(DAY3); await g.run(DAY3); assert.equal(g.emails.length, 1);
  assert.equal(g.sqlite.prepare("SELECT status FROM trip_guide_reminders").get()!.status, "failed");
});
test("catchup sends only the latest reminder and jobs pause on missing configuration or past departure", async () => {
  const f = await ready(); await f.run(DAY7); assert.equal(f.emails.length, 1); assert.match(String(f.emails[0].subject), /Still exploring/);
  for (const [key,value] of [["SQUARE_ENV","sandbox"],["INQUIRY_REMINDERS_ENABLED","false"],["GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON",""]]) {
    const g = await ready(); g.runtime[key] = value; await g.run(DAY3); assert.equal(g.emails.length, 0);
  }
  const g = await ready(); await g.run(new Date("2027-06-01T00:00:00Z")); assert.equal(g.emails.length, 0);
});
test("campaign parsing whitelists fields, bounds values and keeps targeting separate from residence", () => {
  const attribution = guide.attributionFromSearch("?utm_source=facebook&utm_campaign=test&audience=columbus&ad_id=123&campaign_id=invalid&fbclid=private&email=person@example.test");
  assert.equal(attribution.adId, "123"); assert.equal(attribution.campaignId, ""); assert.equal(attribution.audience, "columbus");
  assert.ok(!JSON.stringify(attribution).includes("private")); assert.ok(!JSON.stringify(attribution).includes("person@"));
  assert.equal(guide.campaignAttribution({ utmCampaign: "x".repeat(1000) }).utmCampaign.length, 120);
});
test("guide email escapes names and accurately describes dates, price and lack of reservation", async () => {
  const m = await loadModule<{ buildTripGuideEmail(input: { firstName: string; timing: string; stopToken: string }): { html: string; text: string } }>("lib/trip-guide-email.ts", { "./consultation": consultation, "./trip-guide": guide, "./mailersend-transactional": { sendTripGuideEmailMessage: async () => ({}) } });
  const message = m.buildTripGuideEmail({ firstName: "<Traveler>", timing: "future", stopToken: uuid() });
  assert.ok(message.html.includes("&lt;Traveler&gt;")); assert.ok(!message.html.includes("<Traveler>"));
  assert.match(message.text, /future dates have not been announced/); assert.match(message.text, /US\$2,875/); assert.match(message.text, /No payment was collected/);
});

test("public intake enforces origin, bounded bodies, explicit contact consent and Turnstile before persistence", async () => {
  const saved: unknown[] = [];
  const runtime = { TURNSTILE_SECRET_KEY: "test", SQUARE_ENV: "production" };
  const route = await loadModule<{ POST(request: Request): Promise<Response> }>("app/api/trip-guide/route.ts", {
    "cloudflare:workers": { env: runtime }, "@/lib/lead-request": requests, "@/lib/trip-guide": guide, "@/lib/salon-referrals": referrals,
    "@/lib/trip-guide-service": { saveTripGuideLead: async (input: unknown) => { saved.push(input); return { created: true, emailStatus: "sent" }; } },
  });
  const body = { firstName: "Traveler", email: "test@example.test", city: "Columbus", timing: "not_sure", contactConsent: true, marketingConsent: false, submissionId: uuid(), turnstileToken: "test" };
  const request = (payload: unknown, origin = "https://example.test") => new Request("https://example.test/api/trip-guide", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", cookie: "cp_travel_referral=columbus-uppercuts" }, body: JSON.stringify(payload) });
  assert.equal((await route.POST(request(body,"https://other.test"))).status, 403);
  assert.equal((await route.POST(request({ ...body, contactConsent: false }))).status, 400);
  assert.equal((await route.POST(request({ ...body, extra: "x".repeat(17000) }))).status, 400);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ success: true, action: "booking_inquiry", hostname: "example.test" });
    assert.equal((await route.POST(request(body))).status, 400); assert.equal(saved.length, 0);
    globalThis.fetch = async () => Response.json({ success: true, action: "trip_guide", hostname: "wrong.test" });
    assert.equal((await route.POST(request(body))).status, 400);
    globalThis.fetch = async () => Response.json({ success: true, action: "trip_guide", hostname: "example.test" });
    assert.equal((await route.POST(request(body))).status, 201);
    assert.equal((saved[0] as { referralCode: string }).referralCode, "columbus-uppercuts");
  } finally { globalThis.fetch = original; }
});

test("owner lead updates reject unauthenticated and cross-origin calls before storage", async () => {
  let owner: unknown = null, writes = 0;
  const route = await loadModule<{ PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> }>("app/api/admin/leads/[id]/route.ts", {
    "cloudflare:workers": { env: {} }, zod: { z }, "@/lib/owner-auth": { requireOwner: async () => owner },
    "@/lib/lead-request": requests, "@/lib/trip-guide": guide, "@/lib/trip-guide-storage": { ensureTripGuideStorage: async () => { writes++; } },
  });
  const run = (origin?: string) => route.PATCH(new Request("https://example.test/api/admin/leads/test", { method: "PATCH", headers: origin ? { Origin: origin } : {}, body: JSON.stringify({ status: "closed" }) }), { params: Promise.resolve({ id: uuid() }) });
  assert.equal((await run("https://example.test")).status, 403); owner = { email: "owner@example.test" };
  assert.equal((await run()).status, 403); assert.equal((await run("https://other.test")).status, 403); assert.equal(writes, 0);
});

test("owner inbox loads real source/delivery data and authorized stage updates suppress reminders", async () => {
  const f = await ready();
  await f.save({ ...leadInput(), source: "meta", submissionId: "meta:456", attribution: { ...guide.emptyAttribution } });
  const row = f.sqlite.prepare("SELECT id FROM trip_guide_leads").get()!;
  const inbox = await loadModule<{ loadLeadInbox(page?: number): Promise<{ leads: { sources: string; campaign: string; guide_email_status: string }[]; totals: { total: number } }> }>("lib/lead-inbox.ts", { "cloudflare:workers": { env: f.runtime }, "./trip-guide-storage": f.storage });
  const data = await inbox.loadLeadInbox();
  assert.equal(data.totals.total,1); assert.equal(data.leads[0].sources,"website,meta"); assert.equal(data.leads[0].campaign,"vietnam-june"); assert.equal(data.leads[0].guide_email_status,"sent");
  const route = await loadModule<{ PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> }>("app/api/admin/leads/[id]/route.ts", {
    "cloudflare:workers": { env: f.runtime }, zod: { z }, "@/lib/owner-auth": { requireOwner: async () => ({ email: "owner@example.test" }) }, "@/lib/lead-request": requests, "@/lib/trip-guide": guide, "@/lib/trip-guide-storage": f.storage,
  });
  const request = new Request(`https://example.test/api/admin/leads/${row.id}`, { method: "PATCH", headers: { Origin: "https://example.test" }, body: JSON.stringify({ status: "consultation_booked" }) });
  assert.equal((await route.PATCH(request,{ params: Promise.resolve({ id: String(row.id) }) })).status,200);
  assert.ok(f.sqlite.prepare("SELECT consultation_booked_at FROM trip_guide_leads").get()!.consultation_booked_at);
  await f.run(DAY3); assert.equal(f.emails.length,0);
});

test("confirmed reminder stop closes only the matching guide lead and preserves newsletter consent", async () => {
  const f = await fixture(); await f.save({ ...leadInput(), marketingConsent: true }); f.emails.length=0;
  const row = f.sqlite.prepare("SELECT stop_token FROM trip_guide_leads").get()!;
  const route = await loadModule<{ POST(request: Request): Promise<Response> }>("app/api/trip-guide/stop/route.ts", { "cloudflare:workers": { env: f.runtime }, "@/lib/lead-request": requests, "@/lib/trip-guide-storage": f.storage });
  const run = (origin: string, token = String(row.stop_token)) => route.POST(new Request("https://example.test/api/trip-guide/stop", { method: "POST", headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) }));
  assert.equal((await run("https://other.test")).status,403);
  assert.equal(f.sqlite.prepare("SELECT status FROM trip_guide_leads").get()!.status,"new");
  const response = await run("https://example.test"); assert.equal(response.status,303);
  assert.equal(f.sqlite.prepare("SELECT status FROM trip_guide_leads").get()!.status,"closed");
  assert.equal(f.sqlite.prepare("SELECT marketing_consent FROM trip_guide_leads").get()!.marketing_consent,1);
  await f.run(DAY3); assert.equal(f.emails.length,0);
});
