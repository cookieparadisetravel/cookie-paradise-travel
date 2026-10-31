import { env } from "cloudflare:workers";
import { ensureTripGuideStorage } from "./trip-guide-storage";
import { ensureInquiryReminderStorage } from "./inquiry-reminder-storage";
import { hasBookedConsultation } from "./consultation-calendar";
import { consultationBookingUrl } from "./consultation";
import { sendTripGuideEmailMessage } from "./mailersend-transactional";

type Candidate = { id: string; email: string; first_name: string; stop_token: string; reminder_day: 3 | 7 };
const candidatesSql = `WITH eligible AS (SELECT l.*, CASE WHEN julianday(?) - julianday(l.created_at) >= 7 THEN 7 ELSE 3 END AS reminder_day
  FROM trip_guide_leads l WHERE julianday(?) - julianday(l.created_at) >= 3
  AND l.status IN ('new','contacted','considering') AND l.travel_timing!='future' AND l.consultation_booked_at IS NULL
  AND substr(?,1,10) < '2027-06-01'
  AND NOT EXISTS (SELECT 1 FROM booking_requests b WHERE lower(trim(b.email))=l.email AND b.square_environment='production')
  AND NOT EXISTS (SELECT 1 FROM consultation_bookings c WHERE c.email=l.email))
  SELECT id,email,first_name,stop_token,reminder_day FROM eligible`;
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendDueTripGuideReminders(now = new Date()) {
  const result = { sent: 0, failed: 0, booked: 0, deferred: 0 };
  if (env.INQUIRY_REMINDERS_ENABLED !== "true" || env.SQUARE_ENV !== "production") return result;
  if (!env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON || !env.CONSULTATION_CALENDAR_ID || !env.MAILERSEND_API_TOKEN?.trim() || !env.MAILERSEND_FROM_EMAIL?.trim()) return { ...result, paused: true };
  await ensureTripGuideStorage();
  await ensureInquiryReminderStorage();
  const db = env.DB!;
  const timestamp = now.toISOString();
  const params = [timestamp,timestamp,timestamp];
  const { results } = await db.prepare(`${candidatesSql} WHERE NOT EXISTS (SELECT 1 FROM trip_guide_reminders r WHERE r.lead_id=eligible.id AND r.reminder_day=eligible.reminder_day) ORDER BY created_at LIMIT 25`).bind(...params).all<Candidate>();
  for (const lead of results) {
    const keys = [lead.id,lead.reminder_day];
    const claim = await db.prepare("INSERT INTO trip_guide_reminders (lead_id,reminder_day,status,claimed_at) VALUES (?,?,'sending',?) ON CONFLICT DO NOTHING RETURNING lead_id").bind(...keys,timestamp).first();
    if (!claim) continue;
    let booked: boolean;
    try { booked = await hasBookedConsultation(lead.email); }
    catch { await db.prepare("DELETE FROM trip_guide_reminders WHERE lead_id=? AND reminder_day=?").bind(...keys).run(); result.deferred++; continue; }
    if (booked) {
      await db.batch([
        db.prepare("INSERT INTO consultation_bookings (email,observed_at) VALUES (?,?) ON CONFLICT DO NOTHING").bind(lead.email,timestamp),
        db.prepare("UPDATE trip_guide_leads SET status=CASE WHEN status='closed' THEN status ELSE 'consultation_booked' END,consultation_booked_at=? WHERE id=?").bind(timestamp,lead.id),
        db.prepare("UPDATE trip_guide_reminders SET status='skipped' WHERE lead_id=? AND reminder_day=?").bind(...keys),
      ]);
      result.booked++; continue;
    }
    const current = await db.prepare(`${candidatesSql} WHERE id=? AND reminder_day=?`).bind(...params,...keys).first<Candidate>();
    if (!current) { await db.prepare("UPDATE trip_guide_reminders SET status='skipped' WHERE lead_id=? AND reminder_day=?").bind(...keys).run(); continue; }
    const stopUrl = `https://cookieparadisetravel.com/trip-guide/stop/${encodeURIComponent(current.stop_token)}`;
    const message = current.reminder_day === 3 ? "Have you had a chance to explore your Vietnam trip guide?" : "Still thinking about Vietnam? I'm happy to talk through your questions.";
    try {
      const delivery = await sendTripGuideEmailMessage({ toEmail: current.email, toName: current.first_name,
        subject: current.reminder_day === 3 ? "Questions about Vietnam? Let's talk" : "Still exploring Vietnam? Book a free consultation",
        text: [`Hello ${current.first_name},`, "", message, "", "Book a free 30-minute Google Meet with Trung to discuss flights, rooms or the itinerary. You do not need to be ready to book:", consultationBookingUrl, "", "You can also reply with your questions. No reservation or payment is required for this call.", "", `Stop these reminders: ${stopUrl}`, "", "Trung Le", "Cookie Paradise Travel Company"].join("\n"),
        html: `<div style="font:16px/1.7 Arial,sans-serif;color:#38281e"><p>Hello ${escape(current.first_name)},</p><p>${message}</p><p>Book a free 30-minute Google Meet with me to discuss flights, rooms or the itinerary. You do not need to be ready to book the trip.</p><p><a href="${consultationBookingUrl}">Book your free consultation</a></p><p>You can also reply with your questions. No reservation or payment is required for this call.</p><p>Trung Le<br>Cookie Paradise Travel Company</p><p style="font-size:12px"><a href="${stopUrl}">Stop these reminders</a></p></div>` });
      await db.prepare("UPDATE trip_guide_reminders SET status='sent',sent_at=?,message_id=? WHERE lead_id=? AND reminder_day=?").bind(delivery.sentAt,delivery.messageId,...keys).run();
      result.sent++;
    } catch {
      await db.prepare("UPDATE trip_guide_reminders SET status='failed' WHERE lead_id=? AND reminder_day=?").bind(...keys).run();
      result.failed++;
    }
  }
  return result;
}
