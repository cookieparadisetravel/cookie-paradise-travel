import { env } from "cloudflare:workers";

// Only the new reminder table/index are created here; existing booking data is untouched.
// Keep these statements aligned with the idempotent 0020 migration.
export const reminderStorageStatements = [
  `CREATE TABLE IF NOT EXISTS agreement_reminders (
    traveler_id integer PRIMARY KEY NOT NULL,
    invitation_id integer NOT NULL,
    token_hash text NOT NULL,
    first_email_sent_at text NOT NULL,
    claimed_at text NOT NULL,
    status text NOT NULL,
    sent_at text,
    message_id text,
    error text,
    FOREIGN KEY (traveler_id) REFERENCES travelers(id) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (invitation_id) REFERENCES agreement_invitations(id) ON UPDATE no action ON DELETE cascade
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS agreement_reminders_token_hash_unique ON agreement_reminders (token_hash)",
];

let initialized: Promise<void> | undefined;

export async function ensureAgreementReminderStorage() {
  if (!initialized) {
    initialized = (async () => {
      if (!env.DB) throw new Error("Agreement reminder database is unavailable.");
      await env.DB.batch(reminderStorageStatements.map((statement) => env.DB!.prepare(statement)));
    })();
  }
  try {
    await initialized;
  } catch (error) {
    initialized = undefined;
    throw error;
  }
}
