import { env } from "cloudflare:workers";

// Additive and safe before or after the matching Drizzle migration is applied.
export const tripGuideStorageStatements = [
  `CREATE TABLE IF NOT EXISTS trip_guide_leads (
    id text PRIMARY KEY NOT NULL, first_name text NOT NULL, email text NOT NULL,
    phone text NOT NULL DEFAULT '', city text NOT NULL, travel_timing text NOT NULL,
    referral_code text, source text NOT NULL, status text NOT NULL DEFAULT 'new',
    contact_consented_at text NOT NULL, marketing_consent integer NOT NULL DEFAULT 0,
    marketing_consented_at text, guide_email_status text NOT NULL DEFAULT 'pending',
    guide_email_claimed_at text, guide_email_sent_at text, guide_email_message_id text,
    owner_notification_status text NOT NULL DEFAULT 'pending', mailerlite_status text NOT NULL DEFAULT 'not_requested',
    contacted_at text, consultation_booked_at text, stop_token text NOT NULL, created_at text NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS trip_guide_leads_email_unique ON trip_guide_leads(email)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS trip_guide_leads_stop_token_unique ON trip_guide_leads(stop_token)`,
  `CREATE INDEX IF NOT EXISTS trip_guide_leads_created_idx ON trip_guide_leads(created_at)`,
  `CREATE TABLE IF NOT EXISTS trip_guide_submissions (
    id text PRIMARY KEY NOT NULL, lead_id text NOT NULL REFERENCES trip_guide_leads(id) ON DELETE cascade,
    source text NOT NULL, form_id text NOT NULL DEFAULT '', utm_source text NOT NULL DEFAULT '',
    utm_medium text NOT NULL DEFAULT '', utm_campaign text NOT NULL DEFAULT '', utm_content text NOT NULL DEFAULT '',
    utm_term text NOT NULL DEFAULT '', audience text NOT NULL DEFAULT '', campaign_id text NOT NULL DEFAULT '',
    ad_set_id text NOT NULL DEFAULT '', ad_id text NOT NULL DEFAULT '', marketing_consent integer NOT NULL DEFAULT 0,
    created_at text NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS trip_guide_submissions_lead_idx ON trip_guide_submissions(lead_id)`,
  `CREATE TABLE IF NOT EXISTS trip_guide_reminders (
    lead_id text NOT NULL REFERENCES trip_guide_leads(id) ON DELETE cascade, reminder_day integer NOT NULL,
    status text NOT NULL, claimed_at text NOT NULL, sent_at text, message_id text,
    PRIMARY KEY (lead_id, reminder_day)
  )`,
];
let initialized: Promise<void> | undefined;
export async function ensureTripGuideStorage() {
  if (!initialized) initialized = (async () => {
    if (!env.DB) throw new Error("Lead storage is unavailable.");
    await env.DB.batch(tripGuideStorageStatements.map(statement => env.DB!.prepare(statement)));
  })();
  try { await initialized; } catch (error) { initialized = undefined; throw error; }
}
