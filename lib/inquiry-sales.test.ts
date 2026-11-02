import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { databaseFixture,loadModule } from "../test-support/lead-fixture.ts";
import { loadSalesModules } from "../test-support/sales-fixture.ts";
import * as requestHelpers from "./lead-request.ts";
import * as noteHelpers from "./inquiry-notes.ts";
import { nextSalesAction,salesFunnel,indianaDate } from "./inquiry-sales-types.ts";

async function fixture() {
  const f=databaseFixture();
  const runtime:Record<string,unknown>={DB:f.db,SQUARE_ENV:"production",MAILERSEND_API_TOKEN:"test",MAILERSEND_FROM_EMAIL:"owner@example.test",GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON:"test",CONSULTATION_CALENDAR_ID:"calendar"};
  const guideStorage=await loadModule<typeof import("./trip-guide-storage")>("lib/trip-guide-storage.ts",{"cloudflare:workers":{env:runtime}});
  const history=await loadModule<typeof import("./followup-history")>("lib/followup-history.ts",{"cloudflare:workers":{env:runtime},"./trip-guide-storage":guideStorage});
  const emails:Record<string,unknown>[]=[];
  let failDelivery=false;
  const modules=await loadSalesModules(runtime,history,async input=>{emails.push(input);if(failDelivery) throw new Error("Uncertain delivery");return{sentAt:new Date().toISOString(),messageId:"test-email"};});
  function guide(email="traveler@example.test",created="2026-11-01T12:00:00Z") {
    const id=crypto.randomUUID();
    f.sqlite.prepare(`INSERT INTO trip_guide_leads (id,first_name,email,phone,city,travel_timing,referral_code,source,contact_consented_at,stop_token,created_at)
      VALUES (?,'Alex Traveler',?,'5551234','Not provided','june_2027','columbus-uppercuts','website',?,?,?)`).run(id,email,created,crypto.randomUUID(),created);
    return id;
  }
  function booking(email="traveler@example.test",created="2026-11-02T12:00:00Z") {
    return Number(f.sqlite.prepare(`INSERT INTO booking_requests (trip_slug,full_name,email,phone,departure,room_preference,party_size,booking_intent,contact_consent,square_environment,created_at)
      VALUES ('vietnam-southern-charms-central-heritage','Alex Traveler',?,'5551234','2027-06-01','shared',1,'needs_information',1,'production',?) RETURNING id`).get(email,created)!.id);
  }
  async function invite(salesId:string) {
    const sale=await modules.sales.getSalesProcess(salesId);assert.ok(sale);
    await modules.invitations.sendSalesBookingInvitation(sale,crypto.randomUUID());
    const token=String(emails.at(-1)!.text).match(/\/start-booking\/([a-f0-9]{64})/)![1];
    const context=await modules.invitations.getSalesBookingInvitation(token);assert.ok(context);
    return {token,context};
  }
  return {...f,...modules,runtime,history,guideStorage,emails,guide,booking,invite,failDelivery:()=>{failDelivery=true;}};
}
const input={firstName:"Alex",lastName:"Traveler",fullName:"Alex Traveler",email:"traveler@example.test",phone:"5551234",departure:"2027-06-01",room:"shared",partySize:1,notes:"Room questions",marketingConsent:false,sellerOfTravelStateResident:false,residenceState:"",bookingPaused:false};

test("guide interest is a real sales process with shared stages, follow-up and private dated notes",async()=>{
  const f=await fixture(),id=f.guide();
  let sale=await f.sales.getSalesForGuide(id);assert.ok(sale);
  assert.equal(sale.stage,"new");assert.equal(sale.bookingId,null);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM booking_requests").get()!.n,0);
  assert.equal(nextSalesAction(sale,"2026-11-02")!.label,"Contact customer and invite them to a free call");
  const note={id:crypto.randomUUID(),body:"Concerned about flights; discuss after our call."};
  await f.sales.saveSalesNote(sale,note,"owner@example.test");await f.sales.saveSalesNote(sale,note,"owner@example.test");
  await assert.rejects(f.sales.saveSalesNote(sale,{...note,body:"Changed"},"owner@example.test"));
  await f.sales.setSalesStage(sale,"considering");
  await f.sales.saveSalesFollowUp(sale,"Discuss flight options","2026-11-04");
  sale=await f.sales.getSalesForGuide(id);assert.ok(sale);
  assert.equal(sale.stage,"considering");assert.equal(nextSalesAction(sale,"2026-11-04")!.due,true);
  assert.equal((await f.sales.loadSalesNotes(sale)).length,1);
  await f.sales.markSalesConsultation(sale,"2026-11-05T15:00:00Z");
  sale=await f.sales.getSalesForGuide(id);assert.ok(sale);
  assert.equal(sale.stage,"considering");assert.equal(sale.consultationStartsAt,"2026-11-05T15:00:00Z");
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM consultation_bookings").get()!.n,1);
  await f.sales.completeSalesConsultation(sale);
  assert.ok((await f.sales.getSalesForGuide(id))!.consultationCompletedAt);
  await assert.rejects(f.sales.setSalesStage(sale,"reserved"));
});

test("a secure booking handoff converts the same inquiry, preserves notes/referral and creates only one booking under concurrent submits",async()=>{
  const f=await fixture(),guideId=f.guide();const sale=await f.sales.getSalesForGuide(guideId);assert.ok(sale);
  await f.sales.saveSalesNote(sale,{id:crypto.randomUUID(),body:"Prefers twin beds"},"owner@example.test");
  await f.sales.saveSalesFollowUp(sale,"Answer room questions","2026-11-03");
  const {token,context}=await f.invite(sale.id);
  assert.ok(!String(f.sqlite.prepare("SELECT token_hash FROM inquiry_booking_invitations").get()!.token_hash).includes(token));
  const completed=await Promise.all([f.invitations.completeSalesBookingInvitation(context,input),f.invitations.completeSalesBookingInvitation(context,{...input,firstName:"Second",lastName:"Submission",fullName:"Second Submission",room:"private"})]);
  assert.equal(completed.filter(result=>result.started).length,1);assert.equal(completed[0].bookingId,completed[1].bookingId);
  const expectedName=completed[0].started ? "Alex Traveler" : "Second Submission";
  assert.equal(f.sqlite.prepare("SELECT full_name FROM booking_requests").get()!.full_name,expectedName);
  assert.equal(f.sqlite.prepare("SELECT first_name||' '||last_name AS name FROM travelers").get()!.name,expectedName);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM booking_requests").get()!.n,1);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM travelers").get()!.n,1);
  assert.equal(f.sqlite.prepare("SELECT referral_code FROM booking_requests").get()!.referral_code,"columbus-uppercuts");
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM agreement_invitations").get()!.n,0);
  const converted=await f.sales.getSalesForBooking(completed[0].bookingId);assert.ok(converted);
  assert.equal(converted.id,sale.id);assert.equal(converted.stage,"booking_in_progress");assert.equal(converted.followUpDate,null);
  assert.equal((await f.sales.loadSalesNotes(converted))[0].body,"Prefers twin beds");
  const repeated=await f.invitations.getSalesBookingInvitation(token);assert.ok(repeated);
  assert.equal((await f.invitations.completeSalesBookingInvitation(repeated,input)).started,false);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM inquiry_followup_history WHERE event='booking_started'").get()!.n,1);
  assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
});

test("an information inquiry upgrades in place without replacing its existing traveler or notes",async()=>{
  const f=await fixture(),id=f.booking();
  f.sqlite.prepare("INSERT INTO travelers (booking_request_id,first_name,last_name,email) VALUES (?,'Alex','Traveler','traveler@example.test')").run(id);
  f.sqlite.prepare("INSERT INTO inquiry_owner_notes (id,booking_request_id,body,created_by,created_at) VALUES (?,?,?,'owner@example.test','2026-11-02T12:00:00Z')").run(crypto.randomUUID(),id,"Original booking discussion");
  const sale=await f.sales.getSalesForBooking(id);assert.ok(sale);const {context}=await f.invite(sale.id);
  const converted=await f.invitations.completeSalesBookingInvitation(context,{...input,phone:"5557890"});
  assert.equal(converted.bookingId,id);assert.equal(f.sqlite.prepare("SELECT count(*) n FROM booking_requests").get()!.n,1);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM travelers").get()!.n,1);
  assert.equal(f.sqlite.prepare("SELECT id FROM travelers").get()!.id,1);
  assert.equal(f.sqlite.prepare("SELECT booking_intent FROM booking_requests").get()!.booking_intent,"ready_to_book");
  assert.equal((await f.sales.loadSalesNotes((await f.sales.getSalesForBooking(id))!))[0].body,"Original booking discussion");
});

test("booking invitations honor expiry, replacement, closed requests, email binding and document locks",async()=>{
  for (const stop of ["expired","replaced","closed","wrong_email"]) {
    const f=await fixture(),guide=f.guide(),sale=await f.sales.getSalesForGuide(guide);assert.ok(sale);
    const {context,token}=await f.invite(sale.id);
    if(stop==="expired") f.sqlite.exec("UPDATE inquiry_booking_invitations SET expires_at='2026-01-01T00:00:00Z'");
    if(stop==="replaced") await f.invite(sale.id);
    if(stop==="closed") await f.sales.setSalesStage(sale,"closed");
    if(stop!=="wrong_email") assert.equal(await f.invitations.getSalesBookingInvitation(token),null,stop);
    await assert.rejects(f.invitations.completeSalesBookingInvitation(context,stop==="wrong_email" ? {...input,email:"other@example.test"}:input));
    assert.equal(f.sqlite.prepare("SELECT count(*) n FROM booking_requests").get()!.n,0,stop);
  }
  for (const lock of ["company_accepted_at='2026-11-01'","square_deposit_invoice_id='existing'"]) {
    const f=await fixture(),id=f.booking(),sale=await f.sales.getSalesForBooking(id);assert.ok(sale);
    const {context}=await f.invite(sale.id);
    f.sqlite.exec(`UPDATE booking_requests SET ${lock}`);
    await assert.rejects(f.invitations.completeSalesBookingInvitation(context,input));
    assert.equal(f.sqlite.prepare("SELECT booking_intent FROM booking_requests").get()!.booking_intent,"needs_information");
    await assert.rejects(f.invitations.sendSalesBookingInvitation((await f.sales.getSalesForBooking(id))!,crypto.randomUUID()));
  }
});

test("invitation delivery is claimed once and an uncertain response is not resent by a retry",async()=>{
  const f=await fixture(),id=f.guide(),sale=await f.sales.getSalesForGuide(id);assert.ok(sale);f.failDelivery();
  const submission=crypto.randomUUID();
  assert.equal((await f.invitations.sendSalesBookingInvitation(sale,submission)).emailStatus,"failed");
  await f.invitations.sendSalesBookingInvitation(sale,submission);assert.equal(f.emails.length,1);
  f.runtime.SQUARE_ENV="sandbox";await assert.rejects(f.invitations.sendSalesBookingInvitation(sale,crypto.randomUUID()));
});

test("fresh interest after closing a converted inquiry creates a new cycle and preserves the old booking and customer notes",async()=>{
  const f=await fixture(),id=f.guide();const sale=await f.sales.getSalesForGuide(id);assert.ok(sale);
  await f.sales.saveSalesNote(sale,{id:crypto.randomUUID(),body:"First conversation"},"owner@example.test");
  const {context}=await f.invite(sale.id);const first=await f.invitations.completeSalesBookingInvitation(context,input);
  await f.sales.setSalesStage((await f.sales.getSalesForBooking(first.bookingId))!,"closed");
  f.sqlite.prepare(`INSERT INTO inquiry_followup_history (id,guide_lead_id,cycle_id,event,status,created_at,details_json)
    VALUES (?,?,'website:renewed','reopened','new','2026-12-01T12:00:00Z','{}')`).run(crypto.randomUUID(),id);
  f.sqlite.prepare("UPDATE trip_guide_leads SET status='new' WHERE id=?").run(id);
  const renewed=await f.sales.getSalesForGuide(id);assert.ok(renewed);
  assert.notEqual(renewed.id,sale.id);assert.equal(renewed.bookingId,null);assert.equal(renewed.stage,"new");
  assert.equal((await f.sales.loadSalesNotes(renewed))[0].body,"First conversation");
  assert.equal(f.sqlite.prepare("SELECT status FROM booking_requests WHERE id=?").get(first.bookingId)!.status,"closed");
  const records=await f.sales.loadSalesProcesses();assert.equal(records.filter(row=>row.guideId===id && row.stage==="new").length,1);
  assert.equal(records.filter(row=>nextSalesAction(row,"2026-12-02")).length,1);
});

test("normal website booking attaches to unconverted interest without merging other bookings",async()=>{
  const f=await fixture(),id=f.guide();const sale=await f.sales.getSalesForGuide(id);assert.ok(sale);
  const booked=f.booking();await f.sales.connectNewBookingToSales(booked);
  assert.equal((await f.sales.getSalesForBooking(booked))!.id,sale.id);
  const second=f.booking();await f.sales.connectNewBookingToSales(second);
  assert.notEqual((await f.sales.getSalesForBooking(second))!.id,sale.id);
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM booking_requests").get()!.n,2);
});

test("sales runtime setup and migration are additive, idempotent and safe in either order",async()=>{
  const f=await fixture();f.guide();await f.salesStorage.ensureInquirySalesStorage();
  const migration=readFileSync(new URL("../drizzle/0026_mean_natasha_romanoff.sql",import.meta.url),"utf8");
  f.sqlite.exec(migration);f.sqlite.exec(migration);await f.salesStorage.ensureInquirySalesStorage();
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM inquiry_sales").get()!.n,1);
  assert.deepEqual(f.sqlite.prepare("PRAGMA foreign_key_check").all(),[]);
});

test("calendar synchronization advances only active inquiries, records the real appointment and leaves payment steps untouched",async()=>{
  const f=await fixture(),guideId=f.guide();
  let fail=false;const lookedUp:string[]=[];
  const calendar=await loadModule<typeof import("./inquiry-sales-calendar")>("lib/inquiry-sales-calendar.ts",{
    "cloudflare:workers":{env:f.runtime},"./inquiry-sales-storage":f.salesStorage,"./inquiry-sales":f.sales,
    "./consultation-calendar":{findCustomerConsultation:async(email:string)=>{lookedUp.push(email);if(fail)throw new Error("Unavailable");return {startsAt:"2026-11-05T15:00:00Z"};}},
  });
  await calendar.synchronizeInquiryConsultations();let sale=await f.sales.getSalesForGuide(guideId);assert.ok(sale);
  assert.equal(sale.stage,"considering");assert.equal(sale.consultationStartsAt,"2026-11-05T15:00:00Z");
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM agreement_invitations").get()!.n,0);assert.equal(f.emails.length,0);
  const closed=f.guide("closed@example.test");await f.sales.setSalesStage((await f.sales.getSalesForGuide(closed))!,"closed");
  const second=f.guide("second@example.test");fail=true;await calendar.synchronizeInquiryConsultations();
  assert.equal(lookedUp.includes("closed@example.test"),false);sale=await f.sales.getSalesForGuide(second);assert.equal(sale!.stage,"new");
});

test("owner sales endpoints reject unauthorized and cross-origin writes before loading customer data",async()=>{
  let owner:unknown=null,reads=0;
  const route=await loadModule<typeof import("../app/api/admin/inquiries/sales/[id]/route")>("app/api/admin/inquiries/sales/[id]/route.ts",{
    zod:{z},"@/lib/owner-auth":{requireOwner:async()=>owner},"@/lib/lead-request":requestHelpers,
    "@/lib/inquiry-sales":{getSalesProcess:async()=>{reads++;return null;}},"@/lib/inquiry-booking-invitations":{},
  });
  const request=(origin?:string)=>new Request("https://example.test/api/admin/inquiries/sales/g_test",{method:"PATCH",headers:origin?{Origin:origin}:{},body:JSON.stringify({action:"contacted"})});
  const params={params:Promise.resolve({id:"g_test"})};
  assert.equal((await route.PATCH(request("https://example.test"),params)).status,403);owner={email:"owner@example.test"};
  assert.equal((await route.PATCH(request("https://other.test"),params)).status,403);assert.equal((await route.PATCH(request(),params)).status,403);assert.equal(reads,0);
  const notes=await loadModule<typeof import("../app/api/admin/inquiries/sales/[id]/notes/route")>("app/api/admin/inquiries/sales/[id]/notes/route.ts",{
    zod:{z},"@/lib/owner-auth":{requireOwner:async()=>null},"@/lib/lead-request":requestHelpers,"@/lib/inquiry-sales":{},"@/lib/inquiry-notes":noteHelpers,
  });
  assert.equal((await notes.GET(request(),params)).status,403);
});

test("funnel counts follow guide inquiries and Indiana follow-up dates",async()=>{
  const f=await fixture(),id=f.guide();let sale=await f.sales.getSalesForGuide(id);assert.ok(sale);
  await f.sales.markSalesConsultation(sale);sale=await f.sales.getSalesForGuide(id);assert.ok(sale);
  assert.equal(salesFunnel([sale]).calls,1);assert.equal(salesFunnel([sale]).started,0);
  assert.equal(indianaDate(new Date("2026-11-03T02:00:00Z")),"2026-11-02");
});

test("saved residency holds, newsletter consent and manually entered traveler details survive an information-to-booking upgrade",async()=>{
  const f=await fixture(),id=f.booking();
  f.sqlite.prepare("UPDATE booking_requests SET seller_of_travel_state_resident=1,residence_state='CA',marketing_consent=1,marketing_consented_at='2026-10-01' WHERE id=?").run(id);
  f.sqlite.prepare("INSERT INTO travelers (booking_request_id,first_name,last_name,email,traveler_type,date_of_birth) VALUES (?,'Child','Traveler','parent@example.test','minor','2020-01-01')").run(id);
  const sale=await f.sales.getSalesForBooking(id);assert.ok(sale);
  const {context}=await f.invite(sale.id);
  await f.invitations.completeSalesBookingInvitation(context,input);
  const row=f.sqlite.prepare("SELECT seller_of_travel_state_resident,residence_state,marketing_consent,marketing_consented_at FROM booking_requests WHERE id=?").get(id)!;
  assert.equal(row.seller_of_travel_state_resident,1);assert.equal(row.residence_state,"CA");assert.equal(row.marketing_consent,1);assert.equal(row.marketing_consented_at,"2026-10-01");
  assert.equal(f.sqlite.prepare("SELECT first_name FROM travelers").get()!.first_name,"Child");
});

test("an existing agreement prevents the booking handoff from changing the inquiry",async()=>{
  const f=await fixture(),id=f.booking(),sale=await f.sales.getSalesForBooking(id);assert.ok(sale);
  const {context}=await f.invite(sale.id);
  const traveler=f.sqlite.prepare("INSERT INTO travelers (booking_request_id,first_name,last_name,email) VALUES (?,'Alex','Traveler','traveler@example.test') RETURNING id").get(id)!;
  f.sqlite.prepare("INSERT INTO agreement_invitations (traveler_id,token_hash,agreement_version,agreement_document_hash,expires_at) VALUES (?,'locked','1.0','hash','2026-12-01')").run(traveler.id!);
  await assert.rejects(f.invitations.completeSalesBookingInvitation(context,{...input,room:"private"}));
  assert.equal(f.sqlite.prepare("SELECT room_preference FROM booking_requests").get()!.room_preference,"shared");
});

test("a guide request for someone already reserved stays attached to their existing booking",async()=>{
  const f=await fixture(),book=f.booking("traveler@example.test","2026-10-01T12:00:00Z");
  f.sqlite.prepare("UPDATE booking_requests SET status='reserved',booking_intent='ready_to_book' WHERE id=?").run(book);
  await f.sales.loadSalesProcesses();
  const id=f.guide("traveler@example.test","2026-11-01T12:00:00Z");
  const sale=await f.sales.getSalesForGuide(id);assert.ok(sale);
  assert.equal(sale.bookingId,book);assert.equal(sale.stage,"reserved");assert.equal(nextSalesAction(sale,"2026-11-02"),null);
});

test("booking API uses the handoff once, retains the original referral, and leaves residency screening with the existing automation",async()=>{
  const f=await fixture(),guideId=f.guide();const sale=await f.sales.getSalesForGuide(guideId);assert.ok(sale);
  const {token}=await f.invite(sale.id);
  const {drizzle}=await import("drizzle-orm/sqlite-proxy");
  const builders=await import("drizzle-orm"),schema=await import("../db/schema.ts"),safe=await import("./safe-error.ts"),referrals=await import("./salon-referrals.ts");
  const db=drizzle(async(sql,params,method)=>{const statement=f.sqlite.prepare(sql);if(method==="run"){statement.run(...params);return {rows:[]};}statement.setReturnArrays(true);return {rows:method==="get" ? statement.get(...params) as unknown as unknown[] : statement.all(...params) as unknown as unknown[][]};});
  f.runtime.TURNSTILE_SECRET_KEY="test";f.runtime.AUTOMATED_BOOKING_ENABLED="true";
  let automationCalls=0,notifications=0;
  const route=await loadModule<typeof import("../app/api/booking-requests/route")>("app/api/booking-requests/route.ts",{
    "@/db/schema":schema,"@/db":{getDb:()=>db},"drizzle-orm":builders,"cloudflare:workers":{env:f.runtime},zod:{z},
    "@/lib/mailerlite":{addConsentedSubscriber:async()=>{throw new Error("No new marketing consent");}},
    "@/lib/owner-notification":{sendOwnerInquiryNotification:async(value:{referralCode:string})=>{assert.equal(value.referralCode,"columbus-uppercuts");notifications++;return "sent";}},
    "@/lib/booking-automation":{startAutomatedReadyToBookFlow:async(value:{inquiryId:number})=>{automationCalls++;const row=f.sqlite.prepare("SELECT seller_of_travel_state_resident,residence_state FROM booking_requests WHERE id=?").get(value.inquiryId)!;assert.equal(row.seller_of_travel_state_resident,1);assert.equal(row.residence_state,"CA");f.sqlite.prepare("UPDATE booking_requests SET automated_booking_status='blocked' WHERE id=?").run(value.inquiryId);return "blocked";}},
    "@/lib/safe-error":safe,"@/lib/square-config":{getSquareEnvironment:()=>"production"},"@/lib/salon-referrals":referrals,
    "@/lib/inquiry-sales":f.sales,"@/lib/inquiry-booking-invitations":f.invitations,"@/lib/lead-request":requestHelpers,
  });
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({success:true,action:"booking_inquiry"});
  try {
    const post=()=>route.POST(new Request("https://example.test/api/booking-requests",{method:"POST",headers:{Origin:"https://example.test","Content-Type":"application/json",cookie:"cp_travel_referral=gossip-nails"},body:JSON.stringify({...input,sellerOfTravelStateResident:true,residenceState:"CA",contactConsent:true,bookingIntent:"ready_to_book",turnstileToken:"test",bookingInvitationToken:token})}));
    const response=await post();assert.equal(response.status,201);assert.equal((await response.json() as {automationStatus:string}).automationStatus,"blocked");
    const repeat=await post();assert.equal(repeat.status,200);assert.equal((await repeat.json() as {automationStatus:string}).automationStatus,"blocked");
    assert.equal(automationCalls,1);assert.equal(notifications,1);assert.equal(f.sqlite.prepare("SELECT count(*) n FROM booking_requests").get()!.n,1);
  } finally {globalThis.fetch=original;}
});

test("Sandbox records and another trip cannot enter the production handoff or suppress production consultation reminders",async()=>{
  for (const mutation of ["square_environment='sandbox'","trip_slug='another-trip'"]) {
    const f=await fixture(),id=f.booking();f.sqlite.prepare(`UPDATE booking_requests SET ${mutation} WHERE id=?`).run(id);
    const sale=await f.sales.getSalesForBooking(id);assert.ok(sale);
    await assert.rejects(f.invitations.sendSalesBookingInvitation(sale,crypto.randomUUID()));
    assert.equal(f.emails.length,0);
    if(sale.squareEnvironment==="sandbox") {await assert.rejects(f.sales.markSalesConsultation(sale));assert.equal(f.sqlite.prepare("SELECT count(*) n FROM consultation_bookings").get()!.n,0);}
  }
});
