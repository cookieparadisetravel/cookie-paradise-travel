import { env } from "cloudflare:workers";

// Keep aligned with the additive, idempotent 0021 migration.
export const inquiryReminderStorageStatements = [
  `CREATE TABLE IF NOT EXISTS inquiry_reminders (
    email text NOT NULL, reminder_day integer NOT NULL, inquiry_id integer NOT NULL,
    claimed_at text NOT NULL, status text NOT NULL, sent_at text, message_id text, error text,
    PRIMARY KEY (email, reminder_day),
    FOREIGN KEY (inquiry_id) REFERENCES booking_requests(id) ON DELETE cascade
  )`,
  `CREATE TABLE IF NOT EXISTS consultation_bookings (
    email text PRIMARY KEY NOT NULL, observed_at text NOT NULL
  )`,
];
let initialized: Promise<void> | undefined;
export async function ensureInquiryReminderStorage() {
  if (!initialized) initialized = (async () => {
    if (!env.DB) throw new Error("Inquiry reminder database is unavailable.");
    await env.DB.batch(inquiryReminderStorageStatements.map((statement) => env.DB!.prepare(statement)));
  })();
  try { await initialized; } catch (error) { initialized = undefined; throw error; }
}
