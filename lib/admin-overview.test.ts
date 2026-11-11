import assert from "node:assert/strict";
import test from "node:test";
import { workspaceOverview } from "./admin-overview.ts";
import type { SalesProcess } from "./inquiry-sales-types.ts";
import type { DashboardInquiry } from "../app/admin/inquiries/dashboard-types.ts";
import type { GuideLeadRow } from "./lead-inbox.ts";

const sale=(id:string,values:Partial<SalesProcess>={}):SalesProcess=>({id,guideId:id,bookingId:null,name:id,email:"test@example.test",phone:"",stage:"new",bookingIntent:null,squareEnvironment:"production",source:"website",referralCode:null,timing:"",nextAction:"",followUpDate:null,consultationBookedAt:null,consultationStartsAt:null,consultationCompletedAt:null,createdAt:"2026-11-01",updatedAt:"2026-11-01",invitationStatus:null,invitationSentAt:null,...values});
const lead=(id:string,values:Partial<GuideLeadRow>={})=>({id,source:"website",contact_permission:1,status:"new",guide_email_status:"pending",...values}) as GuideLeadRow;
const booking=(values:Partial<DashboardInquiry>={})=>({squareEnvironment:"production",status:"new",bookingIntent:"ready_to_book",partySize:1,...values}) as DashboardInquiry;

test("Today counts real reservations by party size and excludes sandbox and inactive bookings",()=>{
  const result=workspaceOverview([booking(),booking({status:"reserved",partySize:3}),booking({status:"closed"}),booking({status:"waitlist"}),booking({squareEnvironment:"sandbox",status:"reserved",partySize:9})],[lead("one"),lead("two",{guide_email_status:"sent"})],[sale("real",{consultationBookedAt:"2026-11-01"}),sale("test",{squareEnvironment:"sandbox",consultationBookedAt:"2026-11-01"})],"2026-11-11");
  assert.deepEqual(result.metrics,{guides:2,calls:1,started:2,reservedTravelers:3});assert.equal(result.guideReview,1);
});
test("Today suppresses declined guide follow-ups and completed sales while preserving booking actions",()=>{
  const result=workspaceOverview([], [lead("declined",{contact_permission:0}),lead("booked",{contact_permission:0})], [sale("declined"),sale("booked",{bookingId:42}),sale("closed",{stage:"closed"}),sale("reserved",{stage:"reserved"}),sale("sandbox",{squareEnvironment:"sandbox"})],"2026-11-11");
  assert.deepEqual(result.actions.map(action=>[action.id,action.href]),[["booked","/admin/inquiries/42?section=overview"]]);
});
test("Today puts overdue work first, then new inquiries and upcoming consultations",()=>{
  const rows=[sale("call",{stage:"considering",consultationBookedAt:"2026-11-01",consultationStartsAt:"2026-11-12T15:00:00Z"}),sale("new"),sale("later",{stage:"considering",nextAction:"Follow up",followUpDate:"2026-11-15"}),sale("due",{stage:"considering",nextAction:"Follow up",followUpDate:"2026-11-10"})];
  const result=workspaceOverview([],rows.map(row=>lead(row.id)),rows,"2026-11-11");
  assert.deepEqual(result.actions.map(action=>action.id),["due","new","call","later"]);assert.equal(result.actions[0].due,true);
});
