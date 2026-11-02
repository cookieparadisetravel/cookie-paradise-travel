import { env } from "cloudflare:workers";
import { ensureInquirySalesStorage } from "./inquiry-sales-storage";
import { ensureInquiryReminderStorage } from "./inquiry-reminder-storage";
import { closeBookingInquiry, closeTripGuideLead } from "./followup-history";
import { salesStage, type SalesProcess } from "./inquiry-sales-types";
import { MAX_INQUIRY_NOTE_LENGTH, type InquiryNote } from "./inquiry-notes";

export const salesSelect = `SELECT p.id,p.guide_lead_id AS guideId,p.booking_request_id AS bookingId,
  coalesce(b.full_name,json_extract(h.details_json,'$.firstName'),l.first_name) AS name,
  coalesce(lower(trim(b.email)),l.email) AS email,
  coalesce(b.phone,json_extract(h.details_json,'$.phone'),l.phone,'') AS phone,
  CASE WHEN b.id IS NOT NULL THEN b.status WHEN p.archived_at IS NOT NULL THEN 'closed' ELSE l.status END AS stage,b.booking_intent AS bookingIntent,
  coalesce(b.square_environment,'production') AS squareEnvironment,
  coalesce(b.trip_slug,'vietnam-southern-charms-central-heritage') AS tripSlug,
  coalesce((SELECT source FROM trip_guide_submissions s WHERE s.lead_id=l.id AND (p.cycle_id='initial' OR s.id=p.cycle_id) ORDER BY julianday(s.created_at) ASC LIMIT 1),l.source,'website') AS source,
  (SELECT utm_source FROM trip_guide_submissions s WHERE s.lead_id=l.id AND (p.cycle_id='initial' OR s.id=p.cycle_id) ORDER BY julianday(s.created_at) ASC LIMIT 1) AS acquisitionSource,
  (SELECT utm_campaign FROM trip_guide_submissions s WHERE s.lead_id=l.id AND (p.cycle_id='initial' OR s.id=p.cycle_id) ORDER BY julianday(s.created_at) ASC LIMIT 1) AS campaign,
  (SELECT json_group_array(json_object('event',event,'at',created_at,'details',details_json)) FROM (
    SELECT event,created_at,details_json FROM inquiry_followup_history history WHERE history.cycle_id='sales'
      AND (history.guide_lead_id=p.guide_lead_id OR history.booking_request_id=p.booking_request_id)
    ORDER BY julianday(created_at) DESC,rowid DESC LIMIT 20)) AS activityJson,
  coalesce(b.referral_code,json_extract(h.details_json,'$.referralCode'),l.referral_code) AS referralCode,
  coalesce(json_extract(h.details_json,'$.timing'),l.travel_timing,'june_2027') AS timing,
  p.next_action AS nextAction,p.follow_up_date AS followUpDate,
  p.consultation_booked_at AS consultationBookedAt,p.consultation_starts_at AS consultationStartsAt,
  p.consultation_completed_at AS consultationCompletedAt,p.created_at AS createdAt,p.updated_at AS updatedAt,
  i.email_status AS invitationStatus,i.email_sent_at AS invitationSentAt
  FROM inquiry_sales p LEFT JOIN trip_guide_leads l ON l.id=p.guide_lead_id
  LEFT JOIN booking_requests b ON b.id=p.booking_request_id
  LEFT JOIN inquiry_followup_history h ON h.id=(SELECT id FROM inquiry_followup_history
    WHERE guide_lead_id=l.id AND event='reopened' ORDER BY julianday(created_at) DESC,rowid DESC LIMIT 1)
  LEFT JOIN inquiry_booking_invitations i ON i.id=(SELECT id FROM inquiry_booking_invitations
    WHERE sales_id=p.id ORDER BY julianday(created_at) DESC,rowid DESC LIMIT 1)`;

export async function loadSalesProcesses(id?: string) {
  await ensureInquirySalesStorage();
  const query = env.DB!.prepare(`${salesSelect}${id ? " WHERE p.id=?" : ""} ORDER BY julianday(p.updated_at) DESC`);
  const { results } = await (id ? query.bind(id) : query).all<SalesProcess>();
  return results.map(sale=>({ ...sale,stage:salesStage(sale.stage) }));
}
export async function getSalesProcess(id: string) {
  return (await loadSalesProcesses(id))[0] ?? null;
}
export async function recordSalesEvent(sale: SalesProcess, event: string, details: unknown, at = new Date().toISOString()) {
  await env.DB!.prepare(`INSERT INTO inquiry_followup_history
    (id,guide_lead_id,booking_request_id,cycle_id,event,status,created_at,details_json)
    VALUES (?,?,?,'sales',?,'recorded',?,?)`)
    .bind(crypto.randomUUID(),sale.guideId,sale.bookingId,event,at,JSON.stringify(details)).run();
}

export async function setSalesStage(sale: SalesProcess, stage: string) {
  if (stage === "reserved" && !sale.bookingId) throw new Error("Complete the booking process before marking this inquiry Reserved.");
  const now = new Date().toISOString();
  if (stage === "closed") {
    if (sale.bookingId) await closeBookingInquiry(sale.bookingId);
    else if (sale.guideId) await closeTripGuideLead("id",sale.guideId);
  } else if (sale.bookingId) {
    await env.DB!.prepare("UPDATE booking_requests SET status=? WHERE id=?").bind(stage,sale.bookingId).run();
    if (sale.guideId) await env.DB!.prepare("UPDATE trip_guide_leads SET status=? WHERE id=?").bind(stage,sale.guideId).run();
  } else if (sale.guideId) {
    await env.DB!.prepare(`UPDATE trip_guide_leads SET status=?,contacted_at=CASE WHEN ?='considering'
      THEN coalesce(contacted_at,?) ELSE contacted_at END WHERE id=?`).bind(stage,stage,now,sale.guideId).run();
  }
  await env.DB!.prepare("UPDATE inquiry_sales SET updated_at=? WHERE id=?").bind(now,sale.id).run();
  if (salesStage(sale.stage) !== stage) await recordSalesEvent(sale,"stage_changed",{ from:sale.stage,to:stage },now);
}

export async function saveSalesFollowUp(sale: SalesProcess, nextAction: string, dueDate: string | null) {
  const now = new Date().toISOString();
  await env.DB!.prepare("UPDATE inquiry_sales SET next_action=?,follow_up_date=?,updated_at=? WHERE id=?")
    .bind(nextAction,dueDate,now,sale.id).run();
  await recordSalesEvent(sale,"follow_up_saved",{ nextAction,dueDate },now);
}
export async function markSalesConsultation(sale: SalesProcess, startsAt?: string) {
  if (sale.squareEnvironment!=="production") throw new Error("Consultation tracking is available for production inquiries only.");
  if (["closed","waitlist"].includes(salesStage(sale.stage))) return;
  await ensureInquiryReminderStorage();
  const now = new Date().toISOString();
  const statements = [
    env.DB!.prepare(`UPDATE inquiry_sales SET consultation_booked_at=coalesce(consultation_booked_at,?),
      consultation_starts_at=coalesce(?,consultation_starts_at),updated_at=? WHERE id=?`).bind(now,startsAt ?? null,now,sale.id),
    env.DB!.prepare("INSERT INTO consultation_bookings (email,observed_at) VALUES (?,?) ON CONFLICT DO NOTHING").bind(sale.email,now),
  ];
  if (sale.guideId) statements.push(env.DB!.prepare(`UPDATE trip_guide_leads SET
    status=CASE WHEN status IN ('new','contacted','consultation_booked') THEN 'considering' ELSE status END,
    consultation_booked_at=coalesce(consultation_booked_at,?) WHERE id=? AND status NOT IN ('closed','waitlist')`).bind(now,sale.guideId));
  if (sale.bookingId) statements.push(env.DB!.prepare(`UPDATE booking_requests SET status='considering'
    WHERE id=? AND status IN ('new','contacted') AND booking_intent='needs_information'`).bind(sale.bookingId));
  await env.DB!.batch(statements);
  if (!sale.consultationBookedAt) await recordSalesEvent(sale,"consultation_booked",{ startsAt:startsAt ?? null },now);
}
export async function completeSalesConsultation(sale: SalesProcess) {
  if (!sale.consultationBookedAt) throw new Error("Record a booked consultation first.");
  const now = new Date().toISOString();
  const changed = await env.DB!.prepare(`UPDATE inquiry_sales SET consultation_completed_at=?,updated_at=?
    WHERE id=? AND consultation_completed_at IS NULL RETURNING id`).bind(now,now,sale.id).first();
  if (changed) await recordSalesEvent(sale,"consultation_completed",{},now);
}

export async function loadSalesNotes(sale: SalesProcess) {
  const { results } = await env.DB!.prepare(`SELECT id,body,created_by AS createdBy,created_at AS createdAt
    FROM inquiry_sales_notes WHERE sales_id=? OR sales_id IN (SELECT id FROM inquiry_sales WHERE guide_lead_id=?)
    UNION ALL SELECT id,body,created_by AS createdBy,created_at AS createdAt FROM inquiry_owner_notes
    WHERE booking_request_id=? OR booking_request_id IN (SELECT booking_request_id FROM inquiry_sales WHERE guide_lead_id=?) ORDER BY createdAt DESC,id DESC`).bind(sale.id,sale.guideId,sale.bookingId,sale.guideId).all<InquiryNote>();
  return results;
}
export async function saveSalesNote(sale: SalesProcess, note: { id: string; body: string }, owner: string) {
  if (!note.body.trim() || note.body.length>MAX_INQUIRY_NOTE_LENGTH) throw new Error("Enter a valid note.");
  await env.DB!.prepare(`INSERT INTO inquiry_sales_notes (id,sales_id,body,created_by,created_at)
    VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING`).bind(note.id,sale.id,note.body,owner,new Date().toISOString()).run();
  const saved = await env.DB!.prepare(`SELECT id,body,created_by AS createdBy,created_at AS createdAt
    FROM inquiry_sales_notes WHERE id=? AND sales_id=?`).bind(note.id,sale.id).first<InquiryNote>();
  if (!saved || saved.body!==note.body || saved.createdBy!==owner) throw new Error("This submission has already been used. Reload and try again.");
  return saved;
}

// A new public booking can continue an unconverted, active guide inquiry. Existing
// bookings and their financial records are never merged or reassigned by email.
export async function connectNewBookingToSales(bookingId: number) {
  await ensureInquirySalesStorage();
  const db=env.DB!;
  const booking=await db.prepare("SELECT email,square_environment,trip_slug FROM booking_requests WHERE id=?").bind(bookingId).first<{email:string;square_environment:string;trip_slug:string}>();
  if (!booking || booking.square_environment!=="production" || booking.trip_slug!=="vietnam-southern-charms-central-heritage") return;
  const unconverted=await db.prepare(`SELECT p.id FROM inquiry_sales p JOIN trip_guide_leads l ON l.id=p.guide_lead_id
    WHERE p.booking_request_id IS NULL AND p.archived_at IS NULL AND l.email=? AND l.status NOT IN ('closed','waitlist','reserved')`).bind(booking.email.trim().toLowerCase()).first<{id:string}>();
  if (!unconverted) {
    const linked=await getSalesForBooking(bookingId);
    if (linked?.guideId && linked.referralCode) await db.prepare("UPDATE booking_requests SET referral_code=? WHERE id=? AND referral_code IS NULL")
      .bind(linked.referralCode,bookingId).run();
    return linked?.referralCode;
  }
  // Bootstrap made a booking-only record. It has no customer history yet.
  await db.batch([
    db.prepare(`DELETE FROM inquiry_sales WHERE id=? AND guide_lead_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM inquiry_sales_notes WHERE sales_id=inquiry_sales.id)
      AND NOT EXISTS (SELECT 1 FROM inquiry_booking_invitations WHERE sales_id=inquiry_sales.id)`)
      .bind(`b_${bookingId}`),
    db.prepare(`UPDATE inquiry_sales SET booking_request_id=?,updated_at=? WHERE id=? AND booking_request_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM inquiry_sales other WHERE other.booking_request_id=?)`)
      .bind(bookingId,new Date().toISOString(),unconverted.id,bookingId),
  ]);
  const linked=await getSalesForBooking(bookingId);
  if (linked?.guideId && linked.referralCode) await db.prepare("UPDATE booking_requests SET referral_code=? WHERE id=? AND referral_code IS NULL")
    .bind(linked.referralCode,bookingId).run();
  return linked?.referralCode;
}

export async function getSalesForGuide(guideId:string) {
  await ensureInquirySalesStorage();
  const row=await env.DB!.prepare("SELECT id FROM inquiry_sales WHERE guide_lead_id=? AND archived_at IS NULL ORDER BY julianday(created_at) DESC LIMIT 1").bind(guideId).first<{id:string}>();
  return row ? getSalesProcess(row.id) : null;
}
export async function getSalesForBooking(bookingId:number) {
  await ensureInquirySalesStorage();
  const row=await env.DB!.prepare("SELECT id FROM inquiry_sales WHERE booking_request_id=?").bind(bookingId).first<{id:string}>();
  return row ? getSalesProcess(row.id) : null;
}
