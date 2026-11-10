import { env } from "cloudflare:workers";
import { ensureTripGuideStorage } from "./trip-guide-storage";
import { ensureFollowupHistoryStorage } from "./followup-history";
import { ensureInquirySalesStorage } from "./inquiry-sales-storage";

export type GuideLeadRow = {
  id: string; first_name: string; email: string; phone: string; city: string; travel_timing: string; status: string;
  source: string; sources: string; referral_code: string | null; guide_email_status: string; guide_email_sent_at: string | null;
  manual_guide_sent_at?: string | null;
  contacted_at: string | null; consultation_booked_at: string | null; created_at: string; marketing_consent: number;
  campaign: string | null; audience: string | null; ad_id: string | null; submission_count: number; booking_id: number | null;
  reminder_days_sent: string | null; reminder_failures: number;
  mailerlite_status: string;
  contact_permission?: number | null;
  followup_mode?: string;
  renewed_at?: string | null;
  renewed_email_status?: string | null;
  renewed_reminder_days_sent?: string | null;
  followup_history?: string | null;
};
export async function loadLeadInbox(page: number | null = 1, filter?: { id?: string; email?: string }) {
  await ensureTripGuideStorage();
  await ensureFollowupHistoryStorage();
  await ensureInquirySalesStorage();
  const db = env.DB!;
  const where = filter?.id ? " WHERE l.id=?" : filter?.email ? " WHERE lower(trim(l.email))=?" : "";
  const bindings: (string | number)[] = filter?.id ? [filter.id] : filter?.email ? [filter.email.trim().toLowerCase()] : [];
  if (page !== null) bindings.push((page-1)*100);
  const { results } = await db.prepare(`SELECT l.id,l.email,coalesce(b.status,l.status) AS status,
    coalesce(json_extract(h.details_json,'$.firstName'),l.first_name) AS first_name,
    coalesce(json_extract(h.details_json,'$.phone'),l.phone) AS phone,
    coalesce(json_extract(h.details_json,'$.city'),l.city) AS city,
    coalesce(json_extract(h.details_json,'$.timing'),l.travel_timing) AS travel_timing,
    coalesce(json_extract(h.details_json,'$.source'),l.source) AS source,
    CASE WHEN h.id IS NULL THEN l.referral_code ELSE json_extract(h.details_json,'$.referralCode') END AS referral_code,
    h.created_at AS renewed_at,
    (SELECT max(sent_at) FROM inquiry_followup_history WHERE guide_lead_id=l.id AND event='manual_guide_sent'
      AND cycle_id=coalesce(h.cycle_id,l.id)) AS manual_guide_sent_at,
    CASE WHEN h.id IS NOT NULL THEN coalesce((SELECT status FROM inquiry_followup_history WHERE guide_lead_id=l.id AND cycle_id=h.cycle_id AND event='guide_email'),'pending') END AS renewed_email_status,
    (SELECT group_concat(substr(event,10)) FROM inquiry_followup_history WHERE guide_lead_id=l.id AND cycle_id=h.cycle_id AND event IN ('reminder_3','reminder_7') AND status='sent') AS renewed_reminder_days_sent,
    (SELECT json_group_array(json_object('event',event,'status',status,'createdAt',created_at,'sentAt',sent_at))
      FROM (SELECT event,status,created_at,sent_at FROM inquiry_followup_history WHERE guide_lead_id=l.id ORDER BY julianday(created_at) DESC,rowid DESC)) AS followup_history,
    l.guide_email_status,l.guide_email_sent_at,l.contacted_at,l.consultation_booked_at,l.created_at,l.marketing_consent,l.mailerlite_status,
    (SELECT pref.contact_consent FROM trip_guide_submissions s JOIN trip_guide_submission_preferences pref ON pref.submission_id=s.id
      WHERE s.lead_id=l.id ORDER BY julianday(s.created_at) DESC,s.rowid DESC LIMIT 1) AS contact_permission,
    coalesce((SELECT pref.followup_mode FROM trip_guide_submission_preferences pref WHERE pref.submission_id=coalesce(h.cycle_id,
      (SELECT id FROM trip_guide_submissions WHERE lead_id=l.id ORDER BY julianday(created_at),rowid LIMIT 1))),
      CASE WHEN coalesce(json_extract(h.details_json,'$.source'),l.source)='meta' THEN 'manual' ELSE 'automatic' END) AS followup_mode,
    (SELECT group_concat(DISTINCT source) FROM trip_guide_submissions WHERE lead_id=l.id) AS sources,
    (SELECT utm_campaign FROM trip_guide_submissions WHERE lead_id=l.id AND utm_campaign!='' ORDER BY created_at DESC LIMIT 1) AS campaign,
    (SELECT audience FROM trip_guide_submissions WHERE lead_id=l.id AND audience!='' ORDER BY created_at DESC LIMIT 1) AS audience,
    (SELECT ad_id FROM trip_guide_submissions WHERE lead_id=l.id AND ad_id!='' ORDER BY created_at DESC LIMIT 1) AS ad_id,
    (SELECT count(*) FROM trip_guide_submissions WHERE lead_id=l.id) AS submission_count,
    p.booking_request_id AS booking_id,
    (SELECT group_concat(reminder_day) FROM trip_guide_reminders WHERE lead_id=l.id AND status='sent') AS reminder_days_sent,
    (SELECT count(*) FROM trip_guide_reminders WHERE lead_id=l.id AND status IN ('failed','sending')) AS reminder_failures
    FROM trip_guide_leads l LEFT JOIN inquiry_sales p ON p.id=(SELECT id FROM inquiry_sales WHERE guide_lead_id=l.id AND archived_at IS NULL ORDER BY julianday(created_at) DESC LIMIT 1)
    LEFT JOIN booking_requests b ON b.id=p.booking_request_id LEFT JOIN inquiry_followup_history h ON h.id=(
      SELECT id FROM inquiry_followup_history WHERE guide_lead_id=l.id AND event='reopened'
      ORDER BY julianday(created_at) DESC,rowid DESC LIMIT 1)
    ${where} ORDER BY coalesce(h.created_at,l.created_at) DESC${page === null ? "" : " LIMIT 100 OFFSET ?"}`).bind(...bindings).all<GuideLeadRow>();
  const totals = await db.prepare(`SELECT count(*) AS total,sum(status='new') AS new_count,sum(status='consultation_booked') AS consultation_count,
    sum(guide_email_status IN ('failed','not_configured','sending')) AS delivery_attention FROM trip_guide_leads`).first<{ total: number; new_count: number; consultation_count: number; delivery_attention: number }>();
  return { leads: results, totals: totals ?? { total: 0, new_count: 0, consultation_count: 0, delivery_attention: 0 } };
}
