import { env } from "cloudflare:workers";
import { ensureTripGuideStorage } from "./trip-guide-storage";
import { ensureFollowupHistoryStorage, claimFollowupEvent, finishFollowupEvent } from "./followup-history";
import { ensureInquiryReminderStorage } from "./inquiry-reminder-storage";
import { hasBookedConsultation } from "./consultation-calendar";
import { consultationBookingUrl } from "./consultation";
import { sendTripGuideEmailMessage } from "./mailersend-transactional";

type Candidate = { id: string; email: string; first_name: string; stop_token: string; reminder_day: 3 | 7; cycle_id: string | null };
const candidatesSql = `WITH latest AS (
  SELECT l.*, h.cycle_id, coalesce(h.created_at,l.created_at) AS cycle_at,
    coalesce(json_extract(h.details_json,'$.firstName'),l.first_name) AS current_name,
    coalesce(json_extract(h.details_json,'$.timing'),l.travel_timing) AS current_timing,
    coalesce(p.followup_mode,CASE WHEN coalesce(json_extract(h.details_json,'$.source'),l.source)='meta' THEN 'manual' ELSE 'automatic' END) AS followup_mode,
    coalesce((SELECT pref.contact_consent FROM trip_guide_submissions s
      JOIN trip_guide_submission_preferences pref ON pref.submission_id=s.id
      WHERE s.lead_id=l.id ORDER BY julianday(s.created_at) DESC,s.rowid DESC LIMIT 1),1) AS current_contact_consent
  FROM trip_guide_leads l LEFT JOIN inquiry_followup_history h ON h.id=(
    SELECT id FROM inquiry_followup_history WHERE guide_lead_id=l.id AND event='reopened'
    ORDER BY julianday(created_at) DESC,rowid DESC LIMIT 1)
  LEFT JOIN trip_guide_submission_preferences p ON p.submission_id=coalesce(h.cycle_id,
    (SELECT id FROM trip_guide_submissions WHERE lead_id=l.id ORDER BY julianday(created_at),rowid LIMIT 1))
), eligible AS (SELECT l.*, CASE WHEN julianday(?) - julianday(l.cycle_at) >= 7 THEN 7 ELSE 3 END AS reminder_day
  FROM latest l WHERE julianday(?) - julianday(l.cycle_at) >= 3
  AND l.status IN ('new','contacted','considering') AND l.current_timing!='future' AND l.consultation_booked_at IS NULL
  AND l.followup_mode='automatic' AND l.current_contact_consent=1
  AND substr(?,1,10) < '2027-06-01'
  AND NOT EXISTS (SELECT 1 FROM booking_requests b WHERE lower(trim(b.email))=l.email AND b.square_environment='production'
    AND (b.status!='closed' OR julianday(coalesce((SELECT max(created_at) FROM inquiry_followup_history
      WHERE booking_request_id=b.id AND event='closed'),b.created_at))>=julianday(l.cycle_at)))
  AND NOT EXISTS (SELECT 1 FROM consultation_bookings c WHERE c.email=l.email))
  SELECT id,email,current_name AS first_name,stop_token,reminder_day,cycle_id FROM eligible`;
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendDueTripGuideReminders(now = new Date()) {
  const result = { sent: 0, failed: 0, booked: 0, deferred: 0 };
  if (env.INQUIRY_REMINDERS_ENABLED !== "true" || env.SQUARE_ENV !== "production") return result;
  if (!env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON || !env.CONSULTATION_CALENDAR_ID || !env.MAILERSEND_API_TOKEN?.trim() || !env.MAILERSEND_FROM_EMAIL?.trim()) return { ...result, paused: true };
  await ensureTripGuideStorage();
  await ensureInquiryReminderStorage();
  await ensureFollowupHistoryStorage();
  const db = env.DB!;
  const timestamp = now.toISOString();
  const params = [timestamp,timestamp,timestamp];
  const { results } = await db.prepare(`${candidatesSql} WHERE (cycle_id IS NULL AND NOT EXISTS (SELECT 1 FROM trip_guide_reminders r WHERE r.lead_id=eligible.id AND r.reminder_day=eligible.reminder_day))
    OR (cycle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM inquiry_followup_history h WHERE h.guide_lead_id=eligible.id AND h.cycle_id=eligible.cycle_id AND h.event='reminder_'||eligible.reminder_day)) ORDER BY cycle_at LIMIT 25`).bind(...params).all<Candidate>();
  for (const lead of results) {
    const keys = [lead.id,lead.reminder_day];
    const historyClaim = lead.cycle_id ? await claimFollowupEvent({ guideId: lead.id, cycle: lead.cycle_id, event: `reminder_${lead.reminder_day}`, at: timestamp }) : null;
    const claim = lead.cycle_id ? historyClaim : await db.prepare("INSERT INTO trip_guide_reminders (lead_id,reminder_day,status,claimed_at) VALUES (?,?,'sending',?) ON CONFLICT DO NOTHING RETURNING lead_id").bind(...keys,timestamp).first();
    if (!claim) continue;
    async function finish(status: string, delivery?: { sentAt: string; messageId: string | null }) {
      if (historyClaim) await finishFollowupEvent(historyClaim,status,delivery);
      else await db.prepare("UPDATE trip_guide_reminders SET status=?,sent_at=?,message_id=? WHERE lead_id=? AND reminder_day=?")
        .bind(status,delivery?.sentAt ?? null,delivery?.messageId ?? null,...keys).run();
    }
    let booked: boolean;
    try { booked = await hasBookedConsultation(lead.email); }
    catch {
      if (historyClaim) await db.prepare("DELETE FROM inquiry_followup_history WHERE id=?").bind(historyClaim).run();
      else await db.prepare("DELETE FROM trip_guide_reminders WHERE lead_id=? AND reminder_day=?").bind(...keys).run();
      result.deferred++; continue;
    }
    if (booked) {
      await db.batch([
        db.prepare("INSERT INTO consultation_bookings (email,observed_at) VALUES (?,?) ON CONFLICT DO NOTHING").bind(lead.email,timestamp),
        db.prepare("UPDATE trip_guide_leads SET status=CASE WHEN status='closed' THEN status ELSE 'consultation_booked' END,consultation_booked_at=? WHERE id=?").bind(timestamp,lead.id),
      ]);
      await finish("skipped");
      result.booked++; continue;
    }
    const current = await db.prepare(`${candidatesSql} WHERE id=? AND reminder_day=?`).bind(...params,...keys).first<Candidate>();
    if (!current || current.cycle_id !== lead.cycle_id) { await finish("skipped"); continue; }
    const stopUrl = `https://cookieparadisetravel.com/trip-guide/stop/${encodeURIComponent(current.stop_token)}`;
    const message = current.reminder_day === 3 ? "Have you had a chance to explore your Vietnam trip guide?" : "Still thinking about Vietnam? I'm happy to talk through your questions.";
    try {
      const delivery = await sendTripGuideEmailMessage({ toEmail: current.email, toName: current.first_name,
        subject: current.reminder_day === 3 ? "Questions about Vietnam? Let's talk" : "Still exploring Vietnam? Book a free consultation",
        text: [`Hello ${current.first_name},`, "", message, "", "Book a free 30-minute Google Meet with Trung to discuss flights, rooms or the itinerary. You do not need to be ready to book:", consultationBookingUrl, "", "You can also reply with your questions. No reservation or payment is required for this call.", "", `Stop these reminders: ${stopUrl}`, "", "Trung Le", "Cookie Paradise Travel Company"].join("\n"),
        html: `<div style="font:16px/1.7 Arial,sans-serif;color:#000000"><p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#000000">Hello ${escape(current.first_name)},</p><p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#000000">${message}</p><p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#000000">Book a free 30-minute Google Meet with me to discuss flights, rooms or the itinerary. You do not need to be ready to book the trip.</p><p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#000000"><a href="${consultationBookingUrl}" style="color:#000000;text-decoration:underline">Book your free consultation</a></p><p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#000000">You can also reply with your questions. No reservation or payment is required for this call.</p><p style="font-family:Arial,sans-serif;font-size:16px;line-height:1.65;color:#000000">Trung Le<br>Cookie Paradise Travel Company</p><p style="font-size:14px"><a href="${stopUrl}" style="color:#000000;text-decoration:underline">Stop these reminders</a></p></div>` });
      await finish("sent",delivery);
      result.sent++;
    } catch {
      await finish("failed");
      result.failed++;
    }
  }
  return result;
}
