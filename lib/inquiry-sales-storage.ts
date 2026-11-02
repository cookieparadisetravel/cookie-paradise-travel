import { env } from "cloudflare:workers";
import { ensureFollowupHistoryStorage } from "./followup-history";

export const inquirySalesStorageStatements = [
  `CREATE TABLE IF NOT EXISTS inquiry_sales (
    id text PRIMARY KEY NOT NULL,
    guide_lead_id text REFERENCES trip_guide_leads(id) ON DELETE cascade,
    booking_request_id integer REFERENCES booking_requests(id) ON DELETE cascade,
    cycle_id text NOT NULL DEFAULT 'initial', archived_at text,
    next_action text NOT NULL DEFAULT '', follow_up_date text,
    consultation_booked_at text, consultation_starts_at text, consultation_completed_at text,
    calendar_checked_at text, created_at text NOT NULL, updated_at text NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS inquiry_sales_guide_cycle_unique ON inquiry_sales(guide_lead_id,cycle_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS inquiry_sales_booking_unique ON inquiry_sales(booking_request_id)`,
  `CREATE INDEX IF NOT EXISTS inquiry_sales_follow_up_idx ON inquiry_sales(follow_up_date)`,
  `CREATE TABLE IF NOT EXISTS inquiry_sales_notes (
    id text PRIMARY KEY NOT NULL, sales_id text NOT NULL REFERENCES inquiry_sales(id) ON DELETE cascade,
    body text NOT NULL, created_by text NOT NULL, created_at text NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS inquiry_sales_notes_created_idx ON inquiry_sales_notes(sales_id,created_at)`,
  `CREATE TABLE IF NOT EXISTS inquiry_booking_invitations (
    id text PRIMARY KEY NOT NULL, sales_id text NOT NULL REFERENCES inquiry_sales(id) ON DELETE cascade,
    token_hash text NOT NULL, expires_at text NOT NULL, revoked_at text, completed_at text,
    completion_nonce text, booking_request_id integer REFERENCES booking_requests(id),
    email_status text NOT NULL DEFAULT 'sending', email_sent_at text, email_message_id text,
    created_at text NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS inquiry_booking_invitations_token_unique ON inquiry_booking_invitations(token_hash)`,
  `CREATE INDEX IF NOT EXISTS inquiry_booking_invitations_sales_idx ON inquiry_booking_invitations(sales_id,created_at)`,
];

// Additive bootstrap also covers an intake handled by an older Worker during rollout.
// Backfill a guide-to-booking relationship only when one matching production inquiry exists.
let initialized:Promise<void>|undefined;
export async function ensureInquirySalesStorage(seed=true) {
  if (!initialized) initialized=(async()=>{
    await ensureFollowupHistoryStorage();
    await env.DB!.batch(inquirySalesStorageStatements.map(sql=>env.DB!.prepare(sql)));
  })();
  try {await initialized;} catch(error) {initialized=undefined;throw error;}
  if (!seed) return;
  const db = env.DB!;
  await db.batch([
    db.prepare(`UPDATE inquiry_sales SET guide_lead_id=(SELECT l.id FROM trip_guide_leads l
      JOIN booking_requests b ON lower(trim(b.email))=l.email WHERE b.id=inquiry_sales.booking_request_id
      AND b.square_environment='production' AND b.trip_slug='vietnam-southern-charms-central-heritage'
      AND (b.status!='closed' OR julianday(l.created_at)<=julianday(b.created_at))
      AND NOT EXISTS (SELECT 1 FROM inquiry_sales other WHERE other.guide_lead_id=l.id)
      AND (SELECT count(*) FROM booking_requests same WHERE lower(trim(same.email))=l.email
        AND same.square_environment='production' AND same.trip_slug=b.trip_slug)=1)
      WHERE guide_lead_id IS NULL AND booking_request_id IS NOT NULL`),
    db.prepare(`INSERT INTO inquiry_sales (id,guide_lead_id,booking_request_id,consultation_booked_at,created_at,updated_at)
      SELECT 'g_'||l.id,l.id,
        (SELECT b.id FROM booking_requests b WHERE lower(trim(b.email))=l.email AND b.square_environment='production'
          AND b.trip_slug='vietnam-southern-charms-central-heritage' AND (b.status!='closed' OR julianday(l.created_at)<=julianday(b.created_at))
          AND NOT EXISTS (SELECT 1 FROM inquiry_sales other WHERE other.booking_request_id=b.id)
          AND (SELECT count(*) FROM booking_requests same WHERE lower(trim(same.email))=l.email
            AND same.square_environment='production' AND same.trip_slug=b.trip_slug)=1),
        l.consultation_booked_at,l.created_at,l.created_at
      FROM trip_guide_leads l WHERE true ON CONFLICT DO NOTHING`),
    db.prepare(`UPDATE inquiry_sales SET archived_at=(SELECT h.created_at FROM inquiry_followup_history h
      WHERE h.guide_lead_id=inquiry_sales.guide_lead_id AND h.event='reopened'
      ORDER BY julianday(h.created_at) DESC,h.rowid DESC LIMIT 1)
      WHERE guide_lead_id IS NOT NULL AND archived_at IS NULL
      AND (booking_request_id IS NULL OR EXISTS (SELECT 1 FROM booking_requests WHERE id=booking_request_id AND status='closed'))
      AND cycle_id!=coalesce((SELECT h.cycle_id FROM inquiry_followup_history h
        WHERE h.guide_lead_id=inquiry_sales.guide_lead_id AND h.event='reopened'
        ORDER BY julianday(h.created_at) DESC,h.rowid DESC LIMIT 1),cycle_id)`),
    db.prepare(`INSERT INTO inquiry_sales (id,guide_lead_id,cycle_id,created_at,updated_at)
      SELECT 'g_'||lower(hex(h.cycle_id)),l.id,h.cycle_id,h.created_at,h.created_at FROM trip_guide_leads l
      JOIN inquiry_followup_history h ON h.id=(SELECT id FROM inquiry_followup_history
        WHERE guide_lead_id=l.id AND event='reopened' ORDER BY julianday(created_at) DESC,rowid DESC LIMIT 1)
      WHERE NOT EXISTS (SELECT 1 FROM inquiry_sales active JOIN booking_requests b ON b.id=active.booking_request_id
        WHERE active.guide_lead_id=l.id AND active.archived_at IS NULL AND b.status!='closed')
      ON CONFLICT DO NOTHING`),
    db.prepare(`INSERT INTO inquiry_sales (id,booking_request_id,created_at,updated_at)
      SELECT 'b_'||b.id,b.id,b.created_at,b.created_at FROM booking_requests b WHERE true ON CONFLICT DO NOTHING`),
  ]);
}
