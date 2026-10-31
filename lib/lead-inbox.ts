import { env } from "cloudflare:workers";
import { ensureTripGuideStorage } from "./trip-guide-storage";

export type GuideLeadRow = {
  id: string; first_name: string; email: string; phone: string; city: string; travel_timing: string; status: string;
  source: string; sources: string; referral_code: string | null; guide_email_status: string; guide_email_sent_at: string | null;
  contacted_at: string | null; consultation_booked_at: string | null; created_at: string; marketing_consent: number;
  campaign: string | null; audience: string | null; ad_id: string | null; submission_count: number; booking_id: number | null;
  reminder_days_sent: string | null; reminder_failures: number;
};
export async function loadLeadInbox(page = 1) {
  await ensureTripGuideStorage();
  const db = env.DB!;
  const { results } = await db.prepare(`SELECT l.id,l.first_name,l.email,l.phone,l.city,l.travel_timing,l.status,l.source,l.referral_code,
    l.guide_email_status,l.guide_email_sent_at,l.contacted_at,l.consultation_booked_at,l.created_at,l.marketing_consent,
    (SELECT group_concat(DISTINCT source) FROM trip_guide_submissions WHERE lead_id=l.id) AS sources,
    (SELECT utm_campaign FROM trip_guide_submissions WHERE lead_id=l.id ORDER BY created_at DESC LIMIT 1) AS campaign,
    (SELECT audience FROM trip_guide_submissions WHERE lead_id=l.id ORDER BY created_at DESC LIMIT 1) AS audience,
    (SELECT ad_id FROM trip_guide_submissions WHERE lead_id=l.id ORDER BY created_at DESC LIMIT 1) AS ad_id,
    (SELECT count(*) FROM trip_guide_submissions WHERE lead_id=l.id) AS submission_count,
    (SELECT id FROM booking_requests WHERE lower(trim(email))=l.email AND square_environment='production' ORDER BY id DESC LIMIT 1) AS booking_id,
    (SELECT group_concat(reminder_day) FROM trip_guide_reminders WHERE lead_id=l.id AND status='sent') AS reminder_days_sent,
    (SELECT count(*) FROM trip_guide_reminders WHERE lead_id=l.id AND status IN ('failed','sending')) AS reminder_failures
    FROM trip_guide_leads l ORDER BY created_at DESC LIMIT 100 OFFSET ?`).bind((page-1)*100).all<GuideLeadRow>();
  const totals = await db.prepare(`SELECT count(*) AS total,sum(status='new') AS new_count,sum(status='consultation_booked') AS consultation_count,
    sum(guide_email_status IN ('failed','not_configured','sending')) AS delivery_attention FROM trip_guide_leads`).first<{ total: number; new_count: number; consultation_count: number; delivery_attention: number }>();
  return { leads: results, totals: totals ?? { total: 0, new_count: 0, consultation_count: 0, delivery_attention: 0 } };
}
