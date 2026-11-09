import { env } from "cloudflare:workers";
import { recoverMetaLeads, type MetaRecoveryConfig, type MetaRecoveryResult } from "./meta-lead-recovery";
import { saveMetaDashboardLead } from "./trip-guide-service";

export type MetaSyncStatus = {
  configured: boolean; running: boolean; checkedAt: string | null; lastSuccessAt: string | null;
  result: MetaRecoveryResult | null; message: string;
};
function configuration(): MetaRecoveryConfig | null {
  const cfg = env as unknown as Record<string, string | undefined>;
  const formIds = [...new Set((cfg.META_FORM_IDS ?? "").split(",").map(value => value.trim()).filter(Boolean))];
  if (env.SQUARE_ENV !== "production" || !cfg.META_PAGE_ACCESS_TOKEN?.trim() || !/^v\d+\.\d+$/.test(cfg.META_GRAPH_API_VERSION ?? "") ||
    !cfg.META_CONTACT_CONSENT_FIELD?.trim() || !/^\d{1,32}$/.test(cfg.META_PAGE_ID ?? "") ||
    !formIds.length || formIds.length > 20 || formIds.some(id => !/^\d{1,32}$/.test(id))) return null;
  return { token: cfg.META_PAGE_ACCESS_TOKEN.trim(), version: cfg.META_GRAPH_API_VERSION!, formIds,
    consentField: cfg.META_CONTACT_CONSENT_FIELD.trim(), timingField: cfg.META_TRAVEL_TIMING_FIELD?.trim() || undefined };
}
async function storage() {
  if (!env.DB) throw new Error("Dashboard storage is unavailable.");
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS meta_lead_sync (
    id INTEGER PRIMARY KEY CHECK(id=1), lease_id TEXT, lease_until TEXT,
    checked_at TEXT, last_success_at TEXT, result_json TEXT
  )`).run();
  await env.DB.prepare("INSERT INTO meta_lead_sync(id) VALUES(1) ON CONFLICT(id) DO NOTHING").run();
  return env.DB;
}
export async function metaSyncStatus(): Promise<MetaSyncStatus> {
  const configured = Boolean(configuration());
  if (!configured) return { configured, running: false, checkedAt: null, lastSuccessAt: null, result: null,
    message: "Facebook recovery is not configured. Check the Page token, Page ID, form IDs, API version, and contact-permission field in Cloudflare." };
  const db = await storage();
  const row = await db.prepare("SELECT * FROM meta_lead_sync WHERE id=1").first<{ lease_until: string | null; checked_at: string | null; last_success_at: string | null; result_json: string | null }>();
  const running = Boolean(row?.lease_until && row.lease_until > new Date().toISOString());
  const result: MetaRecoveryResult | null = row?.result_json ? JSON.parse(row.result_json) : null;
  return { configured, running, checkedAt: row?.checked_at ?? null, lastSuccessAt: row?.last_success_at ?? null, result,
    message: running ? "Facebook sync is running."
      : result?.errors.length ? result.errors.join(" ")
      : result ? `Checked ${result.checked} Facebook submissions: ${result.added} new dashboard contacts, ${result.existing} already saved.`
      : "Recovery has not run yet. Sync now to check for missing Facebook leads." };
}
export async function synchronizeMetaLeads(): Promise<MetaSyncStatus> {
  const config = configuration();
  if (!config) return metaSyncStatus();
  const db = await storage();
  const now = new Date().toISOString(), lease = crypto.randomUUID();
  // Avoid overlapping hourly/manual runs, and permit recovery after a terminated worker.
  const claim = await db.prepare(`UPDATE meta_lead_sync SET lease_id=?,lease_until=?
    WHERE id=1 AND (lease_until IS NULL OR lease_until<=?) RETURNING id`)
    .bind(lease, new Date(Date.now() + 15 * 60_000).toISOString(), now).first();
  if (!claim) return metaSyncStatus();
  try {
    const result = await recoverMetaLeads(config, saveMetaDashboardLead);
    const at = new Date().toISOString();
    await db.prepare(`UPDATE meta_lead_sync SET checked_at=?,result_json=?,
      last_success_at=CASE WHEN ?=0 THEN ? ELSE last_success_at END,
      lease_id=NULL,lease_until=NULL WHERE id=1 AND lease_id=?`)
      .bind(at, JSON.stringify(result), result.errors.length, at, lease).run();
  } finally {
    await db.prepare("UPDATE meta_lead_sync SET lease_id=NULL,lease_until=NULL WHERE id=1 AND lease_id=?").bind(lease).run();
  }
  return metaSyncStatus();
}
