import { env } from "cloudflare:workers";
export const creditStorageStatements = [
  `CREATE TABLE IF NOT EXISTS welcome_credits (
    id text PRIMARY KEY NOT NULL, email text NOT NULL UNIQUE, name text NOT NULL,
    source text NOT NULL, created_at text NOT NULL, consent_text text NOT NULL, terms_text text NOT NULL,
    sync_status text NOT NULL DEFAULT 'pending', sync_attempt_at text, sync_lease text,
    redeemed_at text, booking_reference text UNIQUE, redeemed_by text
  )`,
  `CREATE TABLE IF NOT EXISTS welcome_credit_limits (key text PRIMARY KEY NOT NULL, attempts integer NOT NULL, expires_at integer NOT NULL)`,
];
let initialized: Promise<unknown> | undefined;
export async function ensureCreditStorage() {
  if (!env.DB) throw new Error("Credit storage unavailable");
  if (!initialized) initialized = env.DB.batch(creditStorageStatements.map(sql => env.DB!.prepare(sql)));
  try { await initialized; } catch (e) { initialized = undefined; throw e; }
  return env.DB;
}
