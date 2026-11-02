import { env } from "cloudflare:workers";
import { ensureInquiryReminderStorage } from "./inquiry-reminder-storage";
import { ensureFollowupHistoryStorage, claimFollowupEvent, finishFollowupEvent } from "./followup-history";
import { hasBookedConsultation } from "./consultation-calendar";
import { sendInquiryReminderEmail } from "./mailersend-transactional";

type Candidate = { id: number; email: string; full_name: string; reminder_day: 3 | 7; renewed: number };

// Anchor to the first information inquiry after the most recent Closed inquiry.
// Repeated submissions in an active cycle keep its original clock and delivery claims.
// Only the latest due stage is sent after an outage; day three never follows day seven.
const candidatesSql = `WITH initial AS (
  SELECT b.*, lower(trim(b.email)) AS normalized_email,
    EXISTS (SELECT 1 FROM booking_requests closed WHERE lower(trim(closed.email))=lower(trim(b.email))
      AND closed.square_environment='production' AND closed.status='closed' AND closed.id<b.id) AS renewed,
    CASE WHEN julianday(?) - julianday(b.created_at) >= 7 THEN 7 ELSE 3 END AS reminder_day
  FROM booking_requests b
  WHERE b.booking_intent = 'needs_information' AND b.square_environment = 'production'
    AND b.id = (SELECT first.id FROM booking_requests first
      WHERE lower(trim(first.email)) = lower(trim(b.email))
        AND first.booking_intent = 'needs_information' AND first.square_environment = 'production'
        AND first.id > coalesce((SELECT max(coalesce(json_extract(h.details_json,'$.lastInquiryId'),closed.id)) FROM booking_requests closed
          LEFT JOIN inquiry_followup_history h ON h.booking_request_id=closed.id AND h.event='closed'
          WHERE lower(trim(closed.email))=lower(trim(b.email)) AND closed.square_environment='production' AND closed.status='closed'),0)
      ORDER BY julianday(first.created_at), first.id LIMIT 1)
    AND julianday(?) - julianday(b.created_at) >= 3
    AND b.contact_consent = 1 AND b.seller_of_travel_state_resident = 0
    AND b.status IN ('new', 'considering', 'contacted')
    AND (b.departure = 'flexible' OR b.departure > substr(?, 1, 10))
    AND NOT EXISTS (SELECT 1 FROM booking_requests other
      WHERE lower(trim(other.email)) = lower(trim(b.email)) AND other.square_environment = 'production'
        AND (other.status!='closed' OR other.id>=b.id)
        AND (other.booking_intent = 'ready_to_book'
          OR other.status IN ('booking_in_progress', 'reserved', 'qualified', 'closed', 'waitlist')
          OR other.contact_consent = 0 OR other.company_accepted_at IS NOT NULL
          OR other.square_deposit_invoice_id IS NOT NULL))
    AND NOT EXISTS (SELECT 1 FROM consultation_bookings c WHERE c.email = lower(trim(b.email)))
) SELECT id, normalized_email AS email, full_name, reminder_day, renewed FROM initial`;

export async function sendDueInquiryReminders(now = new Date()) {
  const result = { sent: 0, failed: 0, booked: 0, deferred: 0 };
  if (env.INQUIRY_REMINDERS_ENABLED !== "true" || env.SQUARE_ENV !== "production") return result;
  // A missing calendar connection pauses the entire job before claiming or emailing anyone.
  if (!env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON || !env.CONSULTATION_CALENDAR_ID
    || !env.MAILERSEND_API_TOKEN?.trim() || !env.MAILERSEND_FROM_EMAIL?.trim()) {
    return { ...result, paused: true };
  }
  await ensureInquiryReminderStorage();
  await ensureFollowupHistoryStorage();
  if (!env.DB) throw new Error("Inquiry reminder database is unavailable.");
  const db = env.DB;
  const timestamp = now.toISOString();
  const params = [timestamp, timestamp, timestamp];
  const { results: candidates } = await db.prepare(`${candidatesSql}
    WHERE (renewed=0 AND NOT EXISTS (SELECT 1 FROM inquiry_reminders r WHERE r.email = initial.normalized_email AND r.reminder_day = initial.reminder_day))
      OR (renewed=1 AND NOT EXISTS (SELECT 1 FROM inquiry_followup_history h WHERE h.booking_request_id=initial.id AND h.event='reminder_'||initial.reminder_day))
    ORDER BY julianday(created_at), id LIMIT 50`).bind(...params).all<Candidate>();
  for (const candidate of candidates) {
    const keys = [candidate.email, candidate.reminder_day];
    const historyClaim = candidate.renewed ? await claimFollowupEvent({ inquiryId: candidate.id, cycle: String(candidate.id), event: `reminder_${candidate.reminder_day}`, at: timestamp }) : null;
    const claim = candidate.renewed ? historyClaim : await db.prepare(`INSERT INTO inquiry_reminders (email,reminder_day,inquiry_id,claimed_at,status)
      VALUES (?,?,?,?,'sending') ON CONFLICT DO NOTHING RETURNING inquiry_id`)
      .bind(...keys, candidate.id, timestamp).first();
    if (!claim) continue;
    async function finish(status: string, delivery?: { sentAt: string; messageId: string | null }) {
      if (historyClaim) await finishFollowupEvent(historyClaim,status,delivery);
      else await db.prepare("UPDATE inquiry_reminders SET status=?,sent_at=?,message_id=? WHERE email=? AND reminder_day=?")
        .bind(status,delivery?.sentAt ?? null,delivery?.messageId ?? null,...keys).run();
    }
    let booked: boolean;
    try {
      booked = await hasBookedConsultation(candidate.email);
    } catch {
      // No provider request has been made, so it is safe to retry the lookup next hour.
      if (historyClaim) await db.prepare("DELETE FROM inquiry_followup_history WHERE id=?").bind(historyClaim).run();
      else await db.prepare("DELETE FROM inquiry_reminders WHERE email=? AND reminder_day=?").bind(...keys).run();
      result.deferred++;
      continue;
    }
    if (booked) {
      await db.prepare("INSERT INTO consultation_bookings (email,observed_at) VALUES (?,?) ON CONFLICT DO NOTHING").bind(candidate.email, timestamp).run();
      await finish("skipped");
      result.booked++;
      continue;
    }
    // Booking progress or a closed inquiry can change while the calendar request is in flight.
    const current = await db.prepare(`${candidatesSql} WHERE id=? AND reminder_day=?`).bind(...params, candidate.id, candidate.reminder_day).first<Candidate>();
    if (!current) {
      await finish("skipped");
      continue;
    }
    try {
      const delivery = await sendInquiryReminderEmail({ toEmail: current.email, toName: current.full_name, reminderDay: current.reminder_day });
      await finish("sent",delivery);
      result.sent++;
    } catch {
      // A timeout may follow provider acceptance; retain the claim to avoid duplicate emails.
      await finish("failed");
      if (!historyClaim) await db.prepare("UPDATE inquiry_reminders SET error=? WHERE email=? AND reminder_day=?")
        .bind("Delivery not confirmed; review MailerSend before manually retrying.", ...keys).run();
      result.failed++;
    }
  }
  return result;
}
