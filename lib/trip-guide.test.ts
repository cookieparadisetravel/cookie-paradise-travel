import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { z } from "zod";
import * as guide from "./trip-guide.ts";
import * as requests from "./lead-request.ts";
import * as consultation from "./consultation.ts";
import * as referrals from "./salon-referrals.ts";
import { loadSalesModules } from "../test-support/sales-fixture.ts";
import * as stages from "./inquiry-stage.ts";
import { databaseFixture, loadModule } from "../test-support/lead-fixture.ts";

const uuid = () => crypto.randomUUID();
const leadInput = () => ({ firstName: "Traveler", email: "Traveler@Example.test ", phone: "", city: "Columbus", timing: "june_2027" as guide.LeadTiming,
  source: "website" as "website" | "meta", referralCode: "columbus-uppercuts", marketingConsent: false, submissionId: `website:${uuid()}`, attribution: { ...guide.emptyAttribution, utmCampaign: "vietnam-june" } });
async function fixture() {
  const f = databaseFixture();
  const runtime: Record<string, unknown> = { DB: f.db, SQUARE_ENV: "production", INQUIRY_REMINDERS_ENABLED: "true", MAILERSEND_API_TOKEN: "test", MAILERSEND_FROM_EMAIL: "test@example.test", CONSULTATION_CALENDAR_ID: "calendar", GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON: "test-only" };
  const storage = await loadModule<{ ensureTripGuideStorage(): Promise<void>; tripGuideStorageStatements: string[] }>("lib/trip-guide-storage.ts", { "cloudflare:workers": { env: runtime } });
  const history = await loadModule<typeof import("./followup-history")>("lib/followup-history.ts", { "cloudflare:workers": { env: runtime }, "./trip-guide-storage": storage });
  const { sales,salesStorage }=await loadSalesModules(runtime,history);
  const emails: Record<string, unknown>[] = [], ownerEmails: unknown[] = [], subscriptions: unknown[] = [];
  let emailFails = false, calendarFails = false;
  const booked = new Set<string>();
  let onCalendar: (() => void) | undefined;
  type Input = ReturnType<typeof leadInput> & { submittedAt?: string; contactConsent?: boolean };
  type Save = (input: Input) => Promise<{ created: boolean; emailStatus: string }>;
  const service = await loadModule<{ saveTripGuideLead: Save; saveMetaDashboardLead: Save }>("lib/trip-guide-service.ts", {
    "cloudflare:workers": { env: runtime }, "./trip-guide-storage": storage, "./followup-history": history, "./trip-guide": guide,
    "./trip-guide-email": { sendTripGuideEmail: async (input: Record<string, unknown>) => { emails.push(input); if (emailFails) throw new Error("Uncertain delivery"); return { sentAt: new Date().toISOString(), messageId: "test" }; } },
    "./mailersend-transactional": { sendTripGuideEmailMessage: async (input: unknown) => { ownerEmails.push(input); return { sentAt: new Date().toISOString(), messageId: "owner-test" }; } },
    "./mailerlite": { addConsentedSubscriber: async (input: unknown, options: unknown) => { subscriptions.push({ input, options }); return "synced"; } },
  });
  const reminders = await loadModule<{ sendDueTripGuideReminders(now: Date): Promise<unknown> }>("lib/trip-guide-reminders.ts", {
    "cloudflare:workers": { env: runtime }, "./trip-guide-storage": storage, "./followup-history": history,
    "./inquiry-reminder-storage": { ensureInquiryReminderStorage: async () => {} }, "./consultation": consultation,
    "./consultation-calendar": { hasBookedConsultation: async (email: string) => { onCalendar?.(); if (calendarFails) throw new Error("Unavailable"); return booked.has(email); } },
    "./mailersend-transactional": { sendTripGuideEmailMessage: async (input: Record<string, unknown>) => { emails.push(input); if (emailFails) throw new Error("Uncertain delivery"); return { sentAt: "2026-11-03T17:00:00Z", messageId: "test" }; } },
  });
  return { ...f, runtime, storage, history, sales,salesStorage, emails, ownerEmails, subscriptions, booked, save: service.saveTripGuideLead, saveMeta: service.saveMetaDashboardLead, run: reminders.sendDueTripGuideReminders,
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
test("Facebook dashboard intake saves Yes and No without sending any messages or subscribing anyone", async () => {
  for (const consent of [true,false]) {
    const f = await fixture(); f.runtime.ADMIN_OWNER_EMAIL="owner@example.test";
    f.runtime.OWNER_NOTIFICATION_WEBHOOK_URL="https://example.test/owner-alert";
    const input = {...leadInput(),source:"meta" as const,contactConsent:consent,marketingConsent:true,
      submittedAt:"2026-10-31T17:00:00Z",submissionId:"meta:dashboard",formId:"222"};
    assert.equal((await f.saveMeta(input)).emailStatus,"manual_follow_up");
    await f.saveMeta(input);
    await f.run(DAY3); await f.run(DAY7);
    assert.equal(f.emails.length,0); assert.equal(f.ownerEmails.length,0); assert.equal(f.subscriptions.length,0);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trip_guide_leads").get()!.n,1);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trip_guide_submissions").get()!.n,1);
    const row=f.sqlite.prepare("SELECT * FROM trip_guide_submission_preferences").get()!;
    assert.equal(row.contact_consent,consent ? 1 : 0); assert.equal(row.followup_mode,"manual");
    assert.equal(f.sqlite.prepare("SELECT contact_consented_at FROM trip_guide_leads").get()!.contact_consented_at,consent ? new Date(input.submittedAt).toISOString() : "");
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM booking_requests").get()!.n,0);
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trip_guide_reminders").get()!.n,0);
    const inbox=await loadModule<{loadLeadInbox():Promise<{leads:{contact_permission:number;followup_mode:string}[]}>}>("lib/lead-inbox.ts",{
      "cloudflare:workers":{env:f.runtime},"./trip-guide-storage":f.storage,"./followup-history":f.history,"./inquiry-sales-storage":f.salesStorage});
    const saved=(await inbox.loadLeadInbox()).leads[0];
    assert.equal(saved.contact_permission,consent ? 1 : 0); assert.equal(saved.followup_mode,"manual");
  }
});
test("a returning Facebook lead receives its requested guide and a later No stops website reminders",async()=>{
  const f=await ready(); f.runtime.ADMIN_OWNER_EMAIL="owner@example.test";
  f.sqlite.exec("UPDATE trip_guide_leads SET status='closed'");
  const input={...leadInput(),source:"meta" as const,contactConsent:false,submittedAt:"2026-12-01T12:00:00Z",submissionId:"meta:manual-renewal"};
  assert.equal((await f.saveMeta(input)).emailStatus,"sent");
  await f.saveMeta(input); await f.run(new Date("2026-12-08T12:00:00Z"));
  assert.equal(f.emails.length,1);assert.equal(f.ownerEmails.length,1);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM inquiry_followup_history WHERE event='reopened'").get()!.n,1);
  const g=await ready();
  await g.saveMeta({...input,submissionId:"meta:declined-existing"});
  await g.run(new Date("2026-12-08T12:00:00Z"));assert.equal(g.emails.length,0);
  assert.equal(g.sqlite.prepare("SELECT count(*) n FROM trip_guide_leads").get()!.n,1);
});
test("permission replay cannot rewrite a stored No and additive permission storage is repeatable",async()=>{
  const f=await fixture();
  const input={...leadInput(),source:"meta" as const,contactConsent:false,submissionId:"meta:immutable"};
  await f.saveMeta(input);await f.saveMeta({...input,contactConsent:true});
  assert.equal(f.sqlite.prepare("SELECT contact_consent FROM trip_guide_submission_preferences").get()!.contact_consent,0);
  const migration=readFileSync(new URL("../drizzle/0027_facebook_dashboard_permissions.sql",import.meta.url),"utf8");
  f.sqlite.exec(migration);f.sqlite.exec(migration);
  for(const sql of f.storage.tripGuideStorageStatements) f.sqlite.exec(sql);
  assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
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
test("guide owner alerts use the notification inbox separately from the admin identity", async () => {
  const f = await fixture();
  f.runtime.ADMIN_OWNER_EMAIL = "owner@example.test";
  f.runtime.OWNER_NOTIFICATION_EMAIL = " business@example.test ";
  await f.save(leadInput());
  assert.equal((f.ownerEmails[0] as { toEmail: string }).toEmail, "business@example.test");
  assert.equal(f.runtime.ADMIN_OWNER_EMAIL, "owner@example.test");
});
test("provider failure preserves the lead and is never automatically resent; Sandbox intake is refused", async () => {
  const f = await fixture(), input = leadInput(); f.failEmail();
  assert.equal((await f.save(input)).emailStatus, "failed"); await f.save(input);
  assert.equal(f.emails.length, 1); assert.equal(f.sqlite.prepare("SELECT guide_email_status FROM trip_guide_leads").get()!.guide_email_status, "failed");
  const g = await fixture(); g.runtime.SQUARE_ENV = "sandbox"; await assert.rejects(g.save(input)); assert.equal(g.emails.length, 0);
  assert.equal(g.sqlite.prepare("SELECT count(*) n FROM trip_guide_leads").get()!.n, 0);
});
test("full names without a city are saved intact and news opt-ins target Interest List", async () => {
  const f = await fixture();
  const parsed = requests.guideRequestSchema.parse({ fullName: "  Alex Morgan Lee  ", email: "Alex@Example.test", timing: "not_sure", contactConsent: true,
    marketingConsent: true, submissionId: uuid(), turnstileToken: "test" });
  assert.equal(parsed.firstName, "Alex Morgan Lee");
  assert.equal(parsed.city, "Not provided");
  await f.save({ ...leadInput(), ...parsed, attribution: guide.campaignAttribution(parsed.attribution), submissionId: `website:${parsed.submissionId}` });
  const row = f.sqlite.prepare("SELECT first_name,city,contact_consented_at,marketing_consent,mailerlite_status FROM trip_guide_leads").get()!;
  assert.equal(row.first_name, "Alex Morgan Lee"); assert.equal(row.city, "Not provided");
  assert.ok(row.contact_consented_at); assert.equal(row.marketing_consent, 1); assert.equal(row.mailerlite_status, "synced");
  assert.deepEqual(f.subscriptions, [{ input: { firstName: "Alex", lastName: "Morgan Lee", email: "alex@example.test" }, options: { groupName: "Interest List" } }]);
  assert.equal(requests.guideRequestSchema.safeParse({ fullName: "", email: "alex@example.test", timing: "not_sure", contactConsent: true, submissionId: uuid(), turnstileToken: "test" }).success, false);
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
  const body = { firstName: "Traveler", email: "test@example.test", city: "Columbus", timing: "not_sure", contactConsent: true, marketingConsent: true, submissionId: uuid(), turnstileToken: "test" };
  const request = (payload: unknown, origin = "https://example.test") => new Request("https://example.test/api/trip-guide", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", cookie: "cp_travel_referral=columbus-uppercuts" }, body: JSON.stringify(payload) });
  assert.equal((await route.POST(request(body,"https://other.test"))).status, 403);
  assert.equal((await route.POST(request({ ...body, contactConsent: false }))).status, 400);
  assert.equal((await route.POST(request({ ...body, marketingConsent: false }))).status, 400);
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
    assert.equal((await route.POST(request({ ...body, firstName: undefined, fullName: "Alex Morgan Lee", city: undefined }))).status, 201);
    assert.equal((saved[1] as { firstName: string }).firstName, "Alex Morgan Lee");
    assert.equal((saved[1] as { city: string }).city, "Not provided");
  } finally { globalThis.fetch = original; }
});

test("owner lead updates reject unauthenticated and cross-origin calls before storage", async () => {
  let owner: unknown = null, writes = 0;
  const route = await loadModule<{ PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> }>("app/api/admin/inquiries/guide/[id]/route.ts", {
    "cloudflare:workers": { env: {} }, zod: { z }, "@/lib/owner-auth": { requireOwner: async () => owner },
    "@/lib/lead-request": requests, "@/lib/trip-guide": guide, "@/lib/trip-guide-storage": { ensureTripGuideStorage: async () => { writes++; } }, "@/lib/followup-history": {}, "@/lib/inquiry-stage":stages, "@/lib/inquiry-sales":{},
  });
  const run = (origin?: string) => route.PATCH(new Request("https://example.test/api/admin/inquiries/guide/test", { method: "PATCH", headers: origin ? { Origin: origin } : {}, body: JSON.stringify({ status: "closed" }) }), { params: Promise.resolve({ id: uuid() }) });
  assert.equal((await run("https://example.test")).status, 403); owner = { email: "owner@example.test" };
  assert.equal((await run()).status, 403); assert.equal((await run("https://other.test")).status, 403); assert.equal(writes, 0);
});

test("owner inbox loads real source/delivery data and authorized stage updates suppress reminders", async () => {
  const f = await ready();
  await f.save({ ...leadInput(), source: "meta", submissionId: "meta:456", attribution: { ...guide.emptyAttribution } });
  const row = f.sqlite.prepare("SELECT id FROM trip_guide_leads").get()!;
  const inbox = await loadModule<{ loadLeadInbox(page?: number): Promise<{ leads: { sources: string; campaign: string; guide_email_status: string }[]; totals: { total: number } }> }>("lib/lead-inbox.ts", { "cloudflare:workers": { env: f.runtime }, "./trip-guide-storage": f.storage, "./followup-history": f.history, "./inquiry-sales-storage": f.salesStorage });
  const data = await inbox.loadLeadInbox();
  assert.equal(data.totals.total,1); assert.equal(data.leads[0].sources,"website,meta"); assert.equal(data.leads[0].campaign,"vietnam-june"); assert.equal(data.leads[0].guide_email_status,"sent");
  const route = await loadModule<{ PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> }>("app/api/admin/inquiries/guide/[id]/route.ts", {
    "cloudflare:workers": { env: f.runtime }, zod: { z }, "@/lib/owner-auth": { requireOwner: async () => ({ email: "owner@example.test" }) }, "@/lib/lead-request": requests, "@/lib/trip-guide": guide, "@/lib/trip-guide-storage": f.storage, "@/lib/followup-history": f.history, "@/lib/inquiry-stage":stages,"@/lib/inquiry-sales":f.sales,
  });
  const request = new Request(`https://example.test/api/admin/inquiries/guide/${row.id}`, { method: "PATCH", headers: { Origin: "https://example.test" }, body: JSON.stringify({ status: "consultation_booked" }) });
  assert.equal((await route.PATCH(request,{ params: Promise.resolve({ id: String(row.id) }) })).status,200);
  assert.ok(f.sqlite.prepare("SELECT consultation_booked_at FROM trip_guide_leads").get()!.consultation_booked_at);
  await f.run(DAY3); assert.equal(f.emails.length,0);
});

test("confirmed reminder stop closes only the matching guide lead and preserves newsletter consent", async () => {
  const f = await fixture(); await f.save({ ...leadInput(), marketingConsent: true }); f.emails.length=0;
  const row = f.sqlite.prepare("SELECT stop_token FROM trip_guide_leads").get()!;
  const route = await loadModule<{ POST(request: Request): Promise<Response> }>("app/api/trip-guide/stop/route.ts", { "cloudflare:workers": { env: f.runtime }, "@/lib/lead-request": requests, "@/lib/trip-guide-storage": f.storage, "@/lib/followup-history": f.history });
  const run = (origin: string, token = String(row.stop_token)) => route.POST(new Request("https://example.test/api/trip-guide/stop", { method: "POST", headers: { Origin: origin, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) }));
  assert.equal((await run("https://other.test")).status,403);
  assert.equal(f.sqlite.prepare("SELECT status FROM trip_guide_leads").get()!.status,"new");
  const response = await run("https://example.test"); assert.equal(response.status,303);
  assert.equal(f.sqlite.prepare("SELECT status FROM trip_guide_leads").get()!.status,"closed");
  assert.equal(f.sqlite.prepare("SELECT marketing_consent FROM trip_guide_leads").get()!.marketing_consent,1);
  await f.run(DAY3); assert.equal(f.emails.length,0);
});

test("unified inquiries loads every guide request and scopes details without creating bookings", async () => {
  const f = await fixture(); await f.storage.ensureTripGuideStorage();
  const insert = f.sqlite.prepare("INSERT INTO trip_guide_leads (id,first_name,email,city,travel_timing,source,contact_consented_at,stop_token,created_at) VALUES (?,?,?,?,?,?,?,?,?)");
  const ids: string[] = [];
  for (let i=0; i<105; i++) {
    const id=uuid(); ids.push(id);
    insert.run(id,`Guide ${i}`,`guide${i}@example.test`,"Not provided","not_sure","website","2026-11-01T12:00:00Z",uuid(),"2026-11-01T12:00:00Z");
  }
  const inbox = await loadModule<{ loadLeadInbox(page?: number | null, filter?: { id?: string; email?: string }): Promise<{ leads: { id: string }[] }> }>("lib/lead-inbox.ts", { "cloudflare:workers": { env: f.runtime }, "./trip-guide-storage": f.storage, "./followup-history": f.history, "./inquiry-sales-storage": f.salesStorage });
  assert.equal((await inbox.loadLeadInbox()).leads.length,100);
  assert.equal((await inbox.loadLeadInbox(null)).leads.length,105);
  assert.deepEqual((await inbox.loadLeadInbox(null,{ id: ids[104] })).leads.map(row=>row.id),[ids[104]]);
  assert.deepEqual((await inbox.loadLeadInbox(null,{ email: " GUIDE104@example.test " })).leads.map(row=>row.id),[ids[104]]);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM booking_requests").get()!.n,0);
  assert.equal(f.emails.length,0);
});

test("a fresh guide request reopens a closed lead, alerts the owner and preserves original delivery history", async () => {
  const f = await ready(); f.runtime.ADMIN_OWNER_EMAIL = "owner@example.test";
  await f.run(DAY3); await f.run(DAY7);
  const original = f.sqlite.prepare("SELECT * FROM trip_guide_leads").get()!;
  await f.history.closeTripGuideLead("id",String(original.id));
  const request = { ...leadInput(), source: "meta" as const, submittedAt: "2026-12-01T12:00:00Z", submissionId: "meta:returning",
    firstName: "Returning Traveler", timing: "not_sure" as guide.LeadTiming, phone: "5551234" };
  const result = await f.save(request);
  assert.equal(result.emailStatus,"sent");
  assert.equal(f.sqlite.prepare("SELECT status FROM trip_guide_leads").get()!.status,"new");
  const retained = f.sqlite.prepare("SELECT * FROM trip_guide_leads").get()!;
  for (const field of ["id","first_name","created_at","stop_token","guide_email_status","guide_email_sent_at"]) assert.equal(retained[field],original[field]);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trip_guide_reminders WHERE status='sent'").get()!.n,2);
  assert.equal(f.ownerEmails.length,1); assert.match(JSON.stringify(f.ownerEmails[0]),/Returning Vietnam/);
  assert.equal(f.emails.at(-1)!.stopToken,original.stop_token);
  await f.save(request); assert.equal(f.ownerEmails.length,1);
  const inbox = await loadModule<{ loadLeadInbox(): Promise<{ leads: { first_name: string; phone: string; renewed_at: string; followup_history: string }[] }> }>("lib/lead-inbox.ts", { "cloudflare:workers": { env: f.runtime }, "./trip-guide-storage": f.storage, "./followup-history": f.history, "./inquiry-sales-storage": f.salesStorage });
  const lead = (await inbox.loadLeadInbox()).leads[0];
  assert.equal(lead.first_name,"Returning Traveler"); assert.equal(lead.phone,"5551234"); assert.equal(lead.renewed_at,new Date(request.submittedAt).toISOString());
  assert.match(lead.followup_history,/reopened/); assert.match(lead.followup_history,/owner_notification/);
  f.emails.length=0;
  await f.run(new Date("2026-12-04T11:59:59Z")); assert.equal(f.emails.length,0);
  await Promise.all([f.run(new Date("2026-12-04T12:00:00Z")),f.run(new Date("2026-12-04T12:00:00Z"))]);
  await f.run(new Date("2026-12-08T12:00:00Z")); await f.run(new Date("2026-12-08T12:00:00Z"));
  assert.equal(f.emails.length,2);
  assert.match(String(f.emails[0].text),/Hello Returning Traveler/);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM inquiry_followup_history WHERE event IN ('reminder_3','reminder_7') AND status='sent'").get()!.n,2);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM trip_guide_reminders WHERE status='sent'").get()!.n,2);
  await f.history.closeTripGuideLead("id",String(original.id)); await f.save(request);
  assert.equal(f.sqlite.prepare("SELECT status FROM trip_guide_leads").get()!.status,"closed");
  await f.run(new Date("2026-12-12T12:00:00Z")); assert.equal(f.emails.length,2);
});

test("renewed guide reminders ignore older closed bookings but keep consultation, active booking and future-interest stops", async () => {
  for (const stop of ["none","active","booked","future"]) {
    const f = await ready();
    f.sqlite.exec("UPDATE trip_guide_leads SET status='closed'");
    f.sqlite.exec(`INSERT INTO booking_requests (trip_slug,full_name,email,departure,room_preference,party_size,square_environment,status,created_at)
      VALUES ('vietnam','Traveler','traveler@example.test','2027-06-01','shared',1,'production','closed','2026-10-01T12:00:00Z')`);
    await f.save({ ...leadInput(), source: "meta", submittedAt: "2026-12-01T12:00:00Z", submissionId: "meta:renewed", timing: stop==="future" ? "future" : "june_2027" });
    f.emails.length=0;
    if (stop==="active") f.sqlite.exec("UPDATE booking_requests SET status='new'");
    if (stop==="booked") f.booked.add("traveler@example.test");
    await f.run(new Date("2026-12-04T12:00:00Z")); await f.run(new Date("2026-12-08T12:00:00Z"));
    assert.equal(f.emails.length,stop==="none" ? 2 : 0,stop);
  }
});

test("delayed Meta deliveries cannot undo a newer closure or renewal", async () => {
  const f = await ready();
  const id = String(f.sqlite.prepare("SELECT id FROM trip_guide_leads").get()!.id);
  await f.history.closeTripGuideLead("id",id);
  await f.save({ ...leadInput(), source: "meta", submissionId: "meta:delayed", submittedAt: "2026-11-01T00:00:00Z" });
  assert.equal(f.sqlite.prepare("SELECT status FROM trip_guide_leads").get()!.status,"closed");
  await f.save({ ...leadInput(), source: "meta", submissionId: "meta:latest", submittedAt: "2026-12-10T00:00:00Z" });
  await f.history.closeTripGuideLead("id",id);
  await f.save({ ...leadInput(), source: "meta", submissionId: "meta:out-of-order", submittedAt: "2026-12-09T00:00:00Z" });
  assert.equal(f.sqlite.prepare("SELECT status FROM trip_guide_leads").get()!.status,"closed");
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM inquiry_followup_history WHERE event='reopened'").get()!.n,1);
});

test("renewed-cycle calendar errors release only unattempted claims; uncertain deliveries never resend", async () => {
  const f = await ready(); f.sqlite.exec("UPDATE trip_guide_leads SET status='closed'");
  await f.save({ ...leadInput(), source: "meta", submittedAt: "2026-12-01T12:00:00Z", submissionId: "meta:retry" });
  f.emails.length=0; f.failCalendar(true);
  await f.run(new Date("2026-12-04T12:00:00Z"));
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM inquiry_followup_history WHERE event='reminder_3'").get()!.n,0);
  f.failCalendar(false); f.failEmail();
  await f.run(new Date("2026-12-04T12:00:00Z")); await f.run(new Date("2026-12-04T12:00:00Z"));
  assert.equal(f.emails.length,1);
  assert.equal(f.sqlite.prepare("SELECT status FROM inquiry_followup_history WHERE event='reminder_3'").get()!.status,"failed");
});

test("follow-up runtime storage and migration are additive and repeatable", async () => {
  const f = await fixture();
  const migration = readFileSync(new URL("../drizzle/0025_white_moira_mactaggert.sql",import.meta.url),"utf8");
  f.sqlite.exec("DROP TABLE inquiry_followup_history");
  await f.history.ensureFollowupHistoryStorage();
  f.sqlite.exec(migration); f.sqlite.exec(migration);
  for (const sql of f.history.followupHistoryStorageStatements) f.sqlite.exec(sql);
  assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
});


test("closing a production booking also closes its guide follow-up; a later fresh guide request reopens it", async () => {
  const f=await ready();
  f.sqlite.exec(`INSERT INTO booking_requests (trip_slug,full_name,email,departure,room_preference,party_size,square_environment)
    VALUES ('vietnam','Traveler',' TRAVELER@example.test ','2027-06-01','shared',1,'production')`);
  await f.history.closeBookingInquiry(1);
  assert.equal(f.sqlite.prepare("SELECT status FROM trip_guide_leads").get()!.status,"closed");
  const before=f.emails.length;
  await f.run(DAY7); assert.equal(f.emails.length,before);
  await f.save({ ...leadInput(), source: "meta", submittedAt: "2026-12-01T12:00:00Z", submissionId: "meta:after-booking-closed" });
  assert.equal(f.sqlite.prepare("SELECT status FROM trip_guide_leads").get()!.status,"new");
  await f.history.closeBookingInquiry(1);
  assert.equal(f.sqlite.prepare("SELECT status FROM trip_guide_leads").get()!.status,"new");
  f.emails.length=0;
  await f.run(new Date("2026-12-04T12:00:00Z")); assert.equal(f.emails.length,1);
  f.onCalendar(()=>{f.sqlite.exec("UPDATE trip_guide_leads SET status='closed'");});
  await f.run(new Date("2026-12-08T12:00:00Z")); assert.equal(f.emails.length,1);
});

 test("guide requests retry prior failed marketing sync without duplicate guide delivery or extra credits", async () => {
  for (const status of ["error", "not_configured"]) {
    const f=await fixture(); const input={...leadInput(),marketingConsent:true};
    await f.save(input);
    f.sqlite.prepare("UPDATE trip_guide_leads SET mailerlite_status=?").run(status);
    await f.save({...input,submissionId:`website:${uuid()}`});
    assert.equal(f.subscriptions.length,2);
    assert.equal(f.emails.length,1);
    assert.equal(f.sqlite.prepare("SELECT mailerlite_status FROM trip_guide_leads").get()!.mailerlite_status,"synced");
    await f.save({...input,submissionId:`website:${uuid()}`});
    assert.equal(f.subscriptions.length,2);
  }
});

test('owner can record and undo an external guide email without sending or changing consent', async () => {
  const f = await fixture();
  await f.saveMeta({ ...leadInput(), source:'meta', contactConsent:true, submissionId:'meta:record-test' });
  const row = f.sqlite.prepare('SELECT id,marketing_consent,guide_email_status FROM trip_guide_leads').get()!;
  let owner = true;
  const route = await loadModule<{POST:Function}>('app/api/admin/inquiries/guide/[id]/email-record/route.ts', {
    'cloudflare:workers': {env:f.runtime}, 'zod':{z}, '@/lib/owner-auth':{requireOwner:async()=>owner},
    '@/lib/lead-request': requests, '@/lib/followup-history': f.history,
  });
  const call = (action:string, renewedAt:string|null=null) => route.POST(new Request('https://cookieparadisetravel.com/api/admin/inquiries/guide/test/email-record', {method:'POST',headers:{Origin:'https://cookieparadisetravel.com','Content-Type':'application/json'},body:JSON.stringify({action,renewedAt})}),{params:Promise.resolve({id:row.id})});
  owner=false; assert.equal((await call('record')).status,403); owner=true;
  assert.equal((await call('record')).status,200);
  assert.equal((await call('record')).status,200);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM inquiry_followup_history WHERE event='manual_guide_sent'").get()!.n,1);
  assert.equal(f.emails.length,0);
  assert.deepEqual(f.sqlite.prepare('SELECT id,marketing_consent,guide_email_status FROM trip_guide_leads').get(),row);
  assert.equal((await call('record','stale')).status,409);
  assert.equal((await call('undo')).status,200);
  assert.equal(f.sqlite.prepare("SELECT count(*) AS n FROM inquiry_followup_history WHERE event='manual_guide_sent'").get()!.n,0);
});

test("new eligible Facebook requests send one guide, without marketing or reminders", async () => {
  const f=await fixture(); const input={...leadInput(),source:"meta" as const, contactConsent:true, submittedAt:"2026-11-11T12:00:00Z",submissionId:"meta:auto-new"};
  assert.equal((await f.saveMeta(input)).emailStatus,"sent");
  await f.saveMeta(input); await f.saveMeta({...input,submissionId:"meta:duplicate-email"});
  await f.run(new Date("2026-11-18T12:00:00Z"));
  assert.equal(f.emails.length,1); assert.equal(f.emails[0].includeReminders,false);
  assert.equal(f.subscriptions.length,0);
  assert.equal(f.sqlite.prepare("SELECT guide_email_status FROM trip_guide_leads").get()!.guide_email_status,"sent");
  assert.equal(f.sqlite.prepare("SELECT followup_mode FROM trip_guide_submission_preferences LIMIT 1").get()!.followup_mode,"guide_only");
});
test("Facebook automation excludes old requests and missing dates", async () => {
  for (const change of [{submittedAt:"2026-11-10T20:00:00Z"},{submittedAt:undefined}]) {
    const f=await fixture(); await f.saveMeta({...leadInput(),source:"meta",contactConsent:true,submissionId:"meta:excluded",...change});
    assert.equal(f.emails.length,0);
  }
});
test("failed Facebook guide sends are recorded for review and are not blindly retried", async () => {
  const f=await fixture(); f.failEmail();
  const input={...leadInput(),source:"meta" as const,contactConsent:true,submittedAt:"2026-11-11T12:00:00Z",submissionId:"meta:failed"};
  assert.equal((await f.saveMeta(input)).emailStatus,"failed");
  await f.saveMeta(input); assert.equal(f.emails.length,1);
});
test("guide-only email does not promise reminders", async () => {
  const m=await loadModule<typeof import('./trip-guide-email')>("lib/trip-guide-email.ts", {"./consultation":consultation,"./trip-guide":guide,"./mailersend-transactional":{sendTripGuideEmailMessage:async()=>({})}});
  const message=m.buildTripGuideEmail({firstName:"Traveler",timing:"june_2027",stopToken:uuid(),includeReminders:false});
  assert.ok(message.text.includes(guide.tripGuideUrl)); assert.ok(!message.text.includes('three and seven'));
});

test("No follow-up permission still fulfills the requested guide exactly once, preserving No", async () => {
  const f=await fixture(); const input={...leadInput(),source:"meta" as const,contactConsent:false,marketingConsent:true,submittedAt:"2026-11-11T12:00:00Z",submissionId:"meta:no-guide"};
  assert.equal((await f.saveMeta(input)).emailStatus,"sent");
  await f.saveMeta(input); await f.saveMeta({...input,submissionId:"meta:no-duplicate"});
  await f.run(new Date("2026-11-18T12:00:00Z"));
  assert.equal(f.emails.length,1); assert.equal(f.emails[0].includeReminders,false);
  assert.equal(f.subscriptions.length,0);
  const saved=f.sqlite.prepare("SELECT marketing_consent,contact_consented_at,guide_email_status FROM trip_guide_leads").get()!;
  assert.equal(saved.marketing_consent,0); assert.equal(saved.contact_consented_at,""); assert.equal(saved.guide_email_status,"sent");
  const pref=f.sqlite.prepare("SELECT contact_consent,followup_mode FROM trip_guide_submission_preferences LIMIT 1").get()!;
  assert.equal(pref.contact_consent,0); assert.equal(pref.followup_mode,"guide_only");
});
