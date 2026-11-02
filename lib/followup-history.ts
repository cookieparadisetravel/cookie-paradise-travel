import { env } from "cloudflare:workers";
import { ensureTripGuideStorage } from "./trip-guide-storage";

export const followupHistoryStorageStatements = [
  `CREATE TABLE IF NOT EXISTS inquiry_followup_history (
    id text PRIMARY KEY NOT NULL, guide_lead_id text, booking_request_id integer,
    cycle_id text NOT NULL, event text NOT NULL, status text NOT NULL,
    created_at text NOT NULL, sent_at text, message_id text, details_json text,
    FOREIGN KEY (guide_lead_id) REFERENCES trip_guide_leads(id) ON DELETE cascade,
    FOREIGN KEY (booking_request_id) REFERENCES booking_requests(id) ON DELETE cascade
  )`,
  `CREATE INDEX IF NOT EXISTS inquiry_followup_history_guide_created_idx ON inquiry_followup_history(guide_lead_id,created_at)`,
  `CREATE INDEX IF NOT EXISTS inquiry_followup_history_booking_idx ON inquiry_followup_history(booking_request_id)`,
];
export async function ensureFollowupHistoryStorage() {
  if (!env.DB) throw new Error("Follow-up storage is unavailable.");
  await ensureTripGuideStorage();
  await env.DB.batch(followupHistoryStorageStatements.map(sql => env.DB!.prepare(sql)));
}
export const followupEventId = (record: string, cycle: string, event: string) => JSON.stringify([record, cycle, event]);

export async function claimFollowupEvent(input: { guideId?: string; inquiryId?: number; cycle: string; event: string; at: string }) {
  const record = input.guideId ? `guide:${input.guideId}` : `inquiry:${input.inquiryId}`;
  const id = followupEventId(record, input.cycle, input.event);
  const row = await env.DB!.prepare(`INSERT INTO inquiry_followup_history
    (id,guide_lead_id,booking_request_id,cycle_id,event,status,created_at)
    VALUES (?,?,?,?,?,'sending',?) ON CONFLICT DO NOTHING RETURNING id`)
    .bind(id,input.guideId ?? null,input.inquiryId ?? null,input.cycle,input.event,input.at).first();
  return row ? id : null;
}
export async function finishFollowupEvent(id: string, status: string, delivery?: { sentAt: string; messageId: string | null }) {
  await env.DB!.prepare("UPDATE inquiry_followup_history SET status=?,sent_at=?,message_id=? WHERE id=?")
    .bind(status,delivery?.sentAt ?? null,delivery?.messageId ?? null,id).run();
}

// Store closure time so delayed form deliveries cannot undo a later stop request.
export async function closeTripGuideLead(field: "id" | "stop_token", value: string) {
  await ensureFollowupHistoryStorage();
  const timestamp = new Date().toISOString();
  const closureId = crypto.randomUUID();
  const results = await env.DB!.batch([
    env.DB!.prepare(`INSERT INTO inquiry_followup_history
      (id,guide_lead_id,cycle_id,event,status,created_at)
      SELECT ?,id,?,'closed','closed',? FROM trip_guide_leads WHERE ${field}=? AND status!='closed'`)
      .bind(closureId,closureId,timestamp,value),
    env.DB!.prepare(`UPDATE trip_guide_leads SET status='closed' WHERE ${field}=? RETURNING id`).bind(value),
  ]);
  return results[1].results?.[0] ?? null;
}

export async function closeBookingInquiry(id: number) {
  await ensureFollowupHistoryStorage();
  const timestamp = new Date().toISOString();
  const closureId = crypto.randomUUID();
  // Include inquiries already submitted at closure, so an older duplicate cannot
  // start another cycle. Only a later new inquiry may restart follow-up.
  await env.DB!.batch([
    env.DB!.prepare(`INSERT INTO inquiry_followup_history
      (id,booking_request_id,cycle_id,event,status,created_at,details_json)
      SELECT ?,b.id,?,'closed','closed',?,json_object('lastInquiryId',(
        SELECT max(other.id) FROM booking_requests other
        WHERE lower(trim(other.email))=lower(trim(b.email)) AND other.square_environment=b.square_environment))
      FROM booking_requests b WHERE b.id=? AND b.status!='closed'`).bind(closureId,closureId,timestamp,id),
    env.DB!.prepare(`INSERT INTO inquiry_followup_history
      (id,guide_lead_id,cycle_id,event,status,created_at)
      SELECT ?,l.id,?,'closed','closed',? FROM trip_guide_leads l
      WHERE l.status!='closed' AND l.email=(SELECT lower(trim(email)) FROM booking_requests WHERE id=? AND square_environment='production' AND status!='closed')`)
      .bind(`${closureId}:guide`,closureId,timestamp,id),
    env.DB!.prepare(`UPDATE trip_guide_leads SET status='closed'
      WHERE email=(SELECT lower(trim(email)) FROM booking_requests WHERE id=? AND square_environment='production' AND status!='closed')`).bind(id),
    env.DB!.prepare("UPDATE booking_requests SET status='closed' WHERE id=?").bind(id),
  ]);
}
