import { env } from "cloudflare:workers";
import { defaultSettings } from "./web-prospects";

export const prospectStorageStatements = [
  `CREATE TABLE IF NOT EXISTS web_prospects (
    id text PRIMARY KEY NOT NULL, source_url text NOT NULL, source_host text NOT NULL,
    title text NOT NULL, excerpt text NOT NULL, source_date text, discovered_at text NOT NULL,
    last_seen_at text NOT NULL, origin text NOT NULL, match_reason text NOT NULL DEFAULT '',
    search_query text NOT NULL DEFAULT '', target_year integer NOT NULL,
    person_name text NOT NULL DEFAULT '', travel_timing text NOT NULL DEFAULT '', party_size text NOT NULL DEFAULT '',
    contact_channel text NOT NULL DEFAULT '', fit text NOT NULL DEFAULT 'review', status text NOT NULL DEFAULT 'new',
    notes text NOT NULL DEFAULT '', next_action text NOT NULL DEFAULT '', follow_up_date text,
    updated_at text NOT NULL, version integer NOT NULL DEFAULT 0
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS web_prospects_source_url_unique ON web_prospects(source_url)`,
  `CREATE INDEX IF NOT EXISTS web_prospects_status_idx ON web_prospects(status, discovered_at)`,
  `CREATE TABLE IF NOT EXISTS web_prospect_config (
    id integer PRIMARY KEY CHECK(id=1), settings_json text NOT NULL,
    last_attempt_at text, lease_id text, lease_until text
  )`,
  `CREATE TABLE IF NOT EXISTS web_prospect_runs (
    id text PRIMARY KEY NOT NULL, started_at text NOT NULL, finished_at text,
    status text NOT NULL, queries_completed integer NOT NULL DEFAULT 0,
    results_checked integer NOT NULL DEFAULT 0, candidates integer NOT NULL DEFAULT 0,
    added integer NOT NULL DEFAULT 0, error text
  )`,
  `CREATE INDEX IF NOT EXISTS web_prospect_runs_started_idx ON web_prospect_runs(started_at)`,
];
let initialized: Promise<void> | undefined;
export async function ensureProspectStorage() {
  if (!env.DB) throw new Error("Prospect storage is unavailable.");
  if (!initialized) initialized = (async () => {
    await env.DB!.batch(prospectStorageStatements.map(sql => env.DB!.prepare(sql)));
    await env.DB!.prepare("INSERT INTO web_prospect_config (id, settings_json) VALUES (1, ?) ON CONFLICT DO NOTHING").bind(JSON.stringify(defaultSettings)).run();
  })();
  try { await initialized; } catch (error) { initialized = undefined; throw error; }
  return env.DB;
}
