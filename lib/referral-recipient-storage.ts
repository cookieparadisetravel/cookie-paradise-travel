import { env } from "cloudflare:workers";

// Aligned with the additive, idempotent 0022 migration.
export const referralRecipientStorageStatements = [
  `CREATE TABLE IF NOT EXISTS referral_recipients (
    traveler_id integer PRIMARY KEY NOT NULL, referrer_name text NOT NULL,
    updated_by text NOT NULL, updated_at text NOT NULL,
    FOREIGN KEY (traveler_id) REFERENCES travelers(id) ON DELETE cascade
  )`,
];
let initialized: Promise<void> | undefined;
export async function ensureReferralRecipientStorage() {
  if (!initialized) initialized = (async () => {
    if (!env.DB) throw new Error("Referral recipient database is unavailable.");
    await env.DB.batch(referralRecipientStorageStatements.map((statement) => env.DB!.prepare(statement)));
  })();
  try { await initialized; } catch (error) { initialized = undefined; throw error; }
}
