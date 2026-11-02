import { env } from "cloudflare:workers";
import { getSalesProcess, recordSalesEvent, setSalesStage } from "./inquiry-sales";
import { ensureInquirySalesStorage } from "./inquiry-sales-storage";
import { sendTripGuideEmailMessage } from "./mailersend-transactional";
import { consultationBookingUrl } from "./consultation";
import type { SalesProcess } from "./inquiry-sales-types";

export async function salesTokenHash(token: string) {
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
const validToken=(token:string)=>/^[a-f0-9]{64}$/.test(token);
const openStages="('new','considering','contacted','consultation_booked','booking_in_progress')";
// Shared, transaction-time checks. A saved agreement or invoice keeps the existing booking locked.
const eligibleSql=`p.id=i.sales_id AND p.archived_at IS NULL AND i.revoked_at IS NULL AND i.completed_at IS NULL AND julianday(i.expires_at)>julianday(?)
  AND coalesce(b.status,l.status) IN ${openStages}
  AND (b.id IS NULL OR (b.square_environment='production' AND b.trip_slug='vietnam-southern-charms-central-heritage' AND b.booking_intent='needs_information'
    AND b.company_accepted_at IS NULL AND b.square_deposit_invoice_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM agreement_invitations a JOIN travelers t ON t.id=a.traveler_id WHERE t.booking_request_id=b.id)))`;
const joins="JOIN inquiry_sales p ON p.id=i.sales_id LEFT JOIN booking_requests b ON b.id=p.booking_request_id LEFT JOIN trip_guide_leads l ON l.id=p.guide_lead_id";

export async function sendSalesBookingInvitation(sale: SalesProcess, submissionId: string) {
  if (env.SQUARE_ENV!=="production" || sale.squareEnvironment!=="production") throw new Error("Booking invitations are available for production inquiries only.");
  if (!env.MAILERSEND_API_TOKEN?.trim() || !env.MAILERSEND_FROM_EMAIL?.trim()) throw new Error("Booking invitation email is not configured.");
  const previous=await env.DB!.prepare("SELECT sales_id,email_status FROM inquiry_booking_invitations WHERE id=?").bind(submissionId).first<{sales_id:string;email_status:string}>();
  if (previous) {
    if (previous.sales_id!==sale.id) throw new Error("This submission has already been used.");
    return { emailStatus:previous.email_status };
  }
  const now=new Date().toISOString();
  const expires=new Date(Date.now()+7*86400000).toISOString();
  const token=[...crypto.getRandomValues(new Uint8Array(32))].map(byte=>byte.toString(16).padStart(2,"0")).join("");
  const hash=await salesTokenHash(token);
  const db=env.DB!;
  const created=await db.batch([
    db.prepare(`INSERT INTO inquiry_booking_invitations (id,sales_id,token_hash,expires_at,created_at)
      SELECT ?,p.id,?,?,? FROM inquiry_sales p LEFT JOIN booking_requests b ON b.id=p.booking_request_id
      LEFT JOIN trip_guide_leads l ON l.id=p.guide_lead_id
      WHERE p.id=? AND p.archived_at IS NULL AND coalesce(b.status,l.status) IN ${openStages}
      AND (b.id IS NULL OR (b.square_environment='production' AND b.trip_slug='vietnam-southern-charms-central-heritage' AND b.booking_intent='needs_information'
        AND b.company_accepted_at IS NULL AND b.square_deposit_invoice_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM agreement_invitations a JOIN travelers t ON t.id=a.traveler_id WHERE t.booking_request_id=b.id)))
      ON CONFLICT DO NOTHING RETURNING id`).bind(submissionId,hash,expires,now,sale.id),
    db.prepare(`UPDATE inquiry_booking_invitations SET revoked_at=? WHERE sales_id=? AND id!=? AND completed_at IS NULL
      AND revoked_at IS NULL AND EXISTS (SELECT 1 FROM inquiry_booking_invitations WHERE id=? AND token_hash=?)`)
      .bind(now,sale.id,submissionId,submissionId,hash),
  ]);
  if (!created[0].results?.length) {
    const replay=await db.prepare("SELECT email_status FROM inquiry_booking_invitations WHERE id=? AND sales_id=?").bind(submissionId,sale.id).first<{email_status:string}>();
    if (replay) return {emailStatus:replay.email_status};
    throw new Error("This inquiry cannot start a new booking invitation. Continue its existing booking controls, or review its stage first.");
  }
  const url=`https://cookieparadisetravel.com/start-booking/${token}`;
  const text=[`Hello ${sale.name},`,"","When you're ready, use your secure link to continue your Discover Southern Vietnam booking request for June 1–8, 2027:",url,"","Your saved contact details are included. Please review the trip selections and complete the remaining details. Submitting this form starts the next booking step; no payment is collected and your reservation is not yet confirmed.","","The link expires in seven days. If you're still deciding, reply with your questions or book a free 30-minute call:",consultationBookingUrl,"","Trung Le","Cookie Paradise Travel Company"].join("\n");
  let emailStatus="failed";
  try {
    const delivery=await sendTripGuideEmailMessage({toEmail:sale.email,toName:sale.name,subject:"Your next step for Discover Southern Vietnam",text,
      html:`<div style="font:16px/1.7 Arial,sans-serif;color:#000"><p>Hello ${escape(sale.name)},</p><p>Ready to continue your Discover Southern Vietnam booking request for June 1–8, 2027?</p><p><a style="display:inline-block;padding:14px 22px;border-radius:28px;background:#593412;color:#fff;text-decoration:none" href="${url}">Continue my booking request</a></p><p>Your saved contact details are included. Review the trip selections and complete the remaining details. No payment is collected by this form and your reservation is not yet confirmed.</p><p>This secure link expires in seven days. If you're still deciding, reply with your questions or <a href="${consultationBookingUrl}">book a free 30-minute call</a>.</p><p>Trung Le<br>Cookie Paradise Travel Company</p></div>`});
    await db.prepare("UPDATE inquiry_booking_invitations SET email_status='sent',email_sent_at=?,email_message_id=? WHERE id=?")
      .bind(delivery.sentAt,delivery.messageId,submissionId).run();
    emailStatus="sent";
  } catch {
    // An ambiguous provider response is never automatically resent.
    await db.prepare("UPDATE inquiry_booking_invitations SET email_status='failed' WHERE id=?").bind(submissionId).run();
  }
  await recordSalesEvent(sale,"booking_invitation",{emailStatus,expiresAt:expires});
  if (emailStatus==="sent" && sale.stage==="new") await setSalesStage(sale,"considering");
  return {emailStatus};
}

export type SalesInvitationContext={ id:string; salesId:string; bookingId:number|null; completedAt:string|null; expiresAt:string; revokedAt:string|null; sale:SalesProcess };
export async function getSalesBookingInvitation(token:string):Promise<SalesInvitationContext|null> {
  if (!validToken(token) || env.SQUARE_ENV!=="production") return null;
  await ensureInquirySalesStorage(false);
  const row=await env.DB!.prepare(`SELECT id,sales_id AS salesId,booking_request_id AS bookingId,
    completed_at AS completedAt,expires_at AS expiresAt,revoked_at AS revokedAt FROM inquiry_booking_invitations WHERE token_hash=?`)
    .bind(await salesTokenHash(token)).first<Omit<SalesInvitationContext,"sale">>();
  if (!row || row.revokedAt || (!row.completedAt && Date.parse(row.expiresAt)<=Date.now())) return null;
  const sale=await getSalesProcess(row.salesId);
  if (!sale || sale.squareEnvironment!=="production" || (!row.completedAt && ["closed","waitlist","reserved"].includes(sale.stage))) return null;
  if (!row.completedAt) {
    const usable=await env.DB!.prepare(`SELECT i.id FROM inquiry_booking_invitations i ${joins} WHERE i.id=? AND ${eligibleSql}`)
      .bind(row.id,new Date().toISOString()).first();
    if (!usable) return null;
  }
  return {...row,sale};
}

export type SalesBookingInput={firstName:string;lastName:string;fullName:string;email:string;phone:string;departure:string;room:string;partySize:number;notes:string;
  marketingConsent:boolean;sellerOfTravelStateResident:boolean;residenceState:string;bookingPaused:boolean};
export async function completeSalesBookingInvitation(context:SalesInvitationContext,input:SalesBookingInput) {
  if (env.SQUARE_ENV!=="production" || context.sale.squareEnvironment!=="production" || input.email!==context.sale.email) throw new Error("Please use the email address this booking link was sent to.");
  const db=env.DB!;
  if (context.completedAt && context.bookingId) return {bookingId:context.bookingId,started:false};
  const now=new Date().toISOString(),nonce=crypto.randomUUID();
  const common=[input.fullName,input.email,input.phone,input.departure,input.room,input.partySize,input.notes,input.marketingConsent?1:0,input.marketingConsent?now:null,
    input.sellerOfTravelStateResident?1:0,input.sellerOfTravelStateResident?input.residenceState:null,input.bookingPaused?"paused":"not_requested",now];
  let first:D1PreparedStatement;
  if (!context.sale.bookingId) {
    first=db.prepare(`INSERT INTO booking_requests
      (full_name,email,phone,departure,room_preference,party_size,notes,marketing_consent,marketing_consented_at,
       seller_of_travel_state_resident,residence_state,automated_booking_status,automated_booking_updated_at,
       trip_slug,square_environment,contact_consent,contact_consented_at,booking_intent,status,referral_code,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?, 'vietnam-southern-charms-central-heritage','production',1,?,'ready_to_book',?,?,?
      FROM inquiry_booking_invitations i ${joins} WHERE i.id=? AND p.booking_request_id IS NULL AND ${eligibleSql} RETURNING id`)
      .bind(...common,now,input.bookingPaused?"new":"booking_in_progress",context.sale.referralCode,now,context.id,now);
  } else {
    first=db.prepare(`UPDATE booking_requests SET
      full_name=?,email=?,phone=?,departure=?,room_preference=?,party_size=?,notes=?,marketing_consent=CASE WHEN marketing_consent=1 THEN 1 ELSE ? END,
      marketing_consented_at=CASE WHEN marketing_consent=1 THEN marketing_consented_at ELSE ? END,
      seller_of_travel_state_resident=CASE WHEN seller_of_travel_state_resident=1 THEN 1 ELSE ? END,
      residence_state=CASE WHEN seller_of_travel_state_resident=1 THEN residence_state ELSE ? END,automated_booking_status=?,automated_booking_updated_at=?,
      contact_consent=1,contact_consented_at=?,booking_intent='ready_to_book',status=?
      WHERE id=? AND (SELECT count(*) FROM travelers WHERE booking_request_id=booking_requests.id)<=?
      AND EXISTS (SELECT 1 FROM inquiry_booking_invitations i ${joins} WHERE i.id=? AND b.id=booking_requests.id AND ${eligibleSql}) RETURNING id`)
      .bind(...common,now,input.bookingPaused?"new":"booking_in_progress",context.sale.bookingId,input.partySize,context.id,now);
  }
  // D1 batches run in one SQLite transaction. changes() gates the completion on this
  // request's insert/update; its random nonce gates every subsequent dependent write.
  const bookingExpression=context.sale.bookingId ? "p.booking_request_id" : "last_insert_rowid()";
  await db.batch([
    first,
    db.prepare(`UPDATE inquiry_booking_invitations SET booking_request_id=(SELECT ${bookingExpression} FROM inquiry_sales p WHERE p.id=sales_id),
      completed_at=?,completion_nonce=? WHERE id=? AND completed_at IS NULL AND revoked_at IS NULL AND changes()=1`).bind(now,nonce,context.id),
    db.prepare(`UPDATE inquiry_sales SET booking_request_id=(SELECT booking_request_id FROM inquiry_booking_invitations WHERE id=?),
      next_action='',follow_up_date=NULL,updated_at=? WHERE id=?
      AND EXISTS (SELECT 1 FROM inquiry_booking_invitations WHERE id=? AND completion_nonce=?)`).bind(context.id,now,context.salesId,context.id,nonce),
    db.prepare(`INSERT INTO travelers (booking_request_id,first_name,last_name,email,traveler_type)
      SELECT booking_request_id,?,?,?,'adult' FROM inquiry_booking_invitations WHERE id=? AND completion_nonce=? AND ?=1
      AND NOT EXISTS (SELECT 1 FROM travelers WHERE booking_request_id=inquiry_booking_invitations.booking_request_id)`)
      .bind(input.firstName,input.lastName,input.email,context.id,nonce,input.partySize),
    db.prepare(`UPDATE travelers SET first_name=?,last_name=?,email=? WHERE booking_request_id=(
      SELECT booking_request_id FROM inquiry_booking_invitations WHERE id=? AND completion_nonce=?) AND ?=1
      AND (SELECT count(*) FROM travelers t WHERE t.booking_request_id=travelers.booking_request_id)=1
      AND traveler_type='adult' AND date_of_birth IS NULL AND guardian_legal_name IS NULL AND confirmed_trip_price_cents IS NULL
      AND trim(first_name||' '||last_name)=? AND lower(trim(email))=?`)
      .bind(input.firstName,input.lastName,input.email,context.id,nonce,input.partySize,context.sale.name,context.sale.email),
    db.prepare(`UPDATE trip_guide_leads SET status='booking_in_progress' WHERE id=(SELECT guide_lead_id FROM inquiry_sales WHERE id=?)
      AND EXISTS (SELECT 1 FROM inquiry_booking_invitations WHERE id=? AND completion_nonce=?)`).bind(context.salesId,context.id,nonce),
    db.prepare(`INSERT INTO inquiry_followup_history (id,guide_lead_id,booking_request_id,cycle_id,event,status,created_at)
      SELECT ?,p.guide_lead_id,p.booking_request_id,'sales','booking_started','recorded',? FROM inquiry_sales p
      JOIN inquiry_booking_invitations i ON i.sales_id=p.id WHERE i.id=? AND i.completion_nonce=?`).bind(nonce,now,context.id,nonce),
  ]);
  const row=await db.prepare("SELECT booking_request_id,completion_nonce FROM inquiry_booking_invitations WHERE id=?").bind(context.id).first<{booking_request_id:number|null;completion_nonce:string|null}>();
  if (!row?.booking_request_id) throw new Error("This booking link is no longer available. Please contact Trung for the next step.");
  return {bookingId:row.booking_request_id,started:row.completion_nonce===nonce};
}
