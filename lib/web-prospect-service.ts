import { env } from "cloudflare:workers";
import { ensureProspectStorage } from "./web-prospect-storage";
import { candidateFromResult, canonicalSource, settingsSchema, defaultSettings, prospectStatuses, prospectFits, PAGE_SIZE, type Prospect, type ProspectDashboard, type ProspectRun, type ProspectSettings, type SearchResult, type createProspectSchema, type updateProspectSchema } from "./web-prospects";
import type { z } from "zod";

export class ProspectError extends Error {}
export function searchConfigured() { return !!env.BRAVE_SEARCH_API_KEY?.trim(); }
async function configuration() {
  const db = await ensureProspectStorage();
  const row = await db.prepare("SELECT settings_json, last_attempt_at FROM web_prospect_config WHERE id=1").first<{ settings_json: string; last_attempt_at: string | null }>();
  return { settings: settingsSchema.parse(row ? JSON.parse(row.settings_json) : defaultSettings), lastAttempt: row?.last_attempt_at ?? null };
}
export async function loadProspectDashboard(params = new URLSearchParams()): Promise<ProspectDashboard> {
  const db = await ensureProspectStorage();
  const { settings, lastAttempt } = await configuration();
  const requestedPage = Number(params.get("page") || "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100000) : 1;
  const clauses: string[] = [], bindings: (string | number)[] = [];
  const status = params.get("status") ?? "active", fit = params.get("fit"), search = params.get("q")?.trim().slice(0, 200);
  if (status === "active") clauses.push("status NOT IN ('not_fit','do_not_contact','archived')");
  else if (prospectStatuses.includes(status as typeof prospectStatuses[number])) { clauses.push("status=?"); bindings.push(status); }
  if (fit && prospectFits.includes(fit as typeof prospectFits[number])) { clauses.push("fit=?"); bindings.push(fit); }
  if (search) {
    clauses.push("(title LIKE ? ESCAPE '\\' OR excerpt LIKE ? ESCAPE '\\' OR person_name LIKE ? ESCAPE '\\' OR source_host LIKE ? ESCAPE '\\')");
    const like = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    bindings.push(like, like, like, like);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const [rows, total, countRows, runs] = await Promise.all([
    db.prepare(`SELECT * FROM web_prospects ${where} ORDER BY discovered_at DESC, id DESC LIMIT ? OFFSET ?`).bind(...bindings, PAGE_SIZE, (page - 1) * PAGE_SIZE).all<Prospect>(),
    db.prepare(`SELECT count(*) AS n FROM web_prospects ${where}`).bind(...bindings).first<{ n: number }>(),
    db.prepare("SELECT status, count(*) AS n FROM web_prospects GROUP BY status").all<{ status: string; n: number }>(),
    db.prepare("SELECT * FROM web_prospect_runs ORDER BY started_at DESC LIMIT 5").all<ProspectRun>(),
  ]);
  return { prospects: rows.results, total: total?.n ?? 0, page, counts: Object.fromEntries(countRows.results.map(r => [r.status, r.n])), settings, configured: searchConfigured(), runs: runs.results.map(r => r.status === "running" && Date.parse(r.started_at) < Date.now() - 300000 ? { ...r, status: "interrupted", error: "This search did not finish. You can try again after the cooldown." } : r), lastAttempt };
}
export async function saveProspectSettings(settings: ProspectSettings) {
  if (settings.enabled && !searchConfigured()) throw new ProspectError("Connect the search API before enabling daily discovery.");
  const db = await ensureProspectStorage();
  await db.prepare("UPDATE web_prospect_config SET settings_json=? WHERE id=1").bind(JSON.stringify(settings)).run();
}
export async function createProspect(input: z.infer<typeof createProspectSchema>) {
  const db = await ensureProspectStorage();
  const source = canonicalSource(input.sourceUrl)!;
  const now = new Date().toISOString(), id = crypto.randomUUID();
  const inserted = await db.prepare(`INSERT INTO web_prospects
    (id,source_url,source_host,title,excerpt,discovered_at,last_seen_at,origin,target_year,person_name,updated_at)
    VALUES (?,?,?,?,?,?,?,'manual',?,?,?) ON CONFLICT(source_url) DO NOTHING`)
    .bind(id, source, new URL(source).hostname, input.title, input.excerpt, now, now, input.targetYear, input.personName, now).run();
  if (!inserted.meta.changes) throw new ProspectError("This source is already saved. Find it using the All statuses filter.");
  return id;
}
export async function updateProspect(input: z.infer<typeof updateProspectSchema>) {
  const db = await ensureProspectStorage();
  const saved = await db.prepare(`UPDATE web_prospects SET person_name=?,travel_timing=?,party_size=?,contact_channel=?,fit=?,status=?,notes=?,next_action=?,follow_up_date=?,updated_at=?,version=version+1 WHERE id=? AND version=?`)
    .bind(input.personName, input.travelTiming, input.partySize, input.contactChannel, input.fit, input.status, input.notes, input.nextAction, input.followUpDate, new Date().toISOString(), input.id, input.version).run();
  if (!saved.meta.changes) throw new ProspectError("This prospect has changed or is unavailable. Refresh before saving again.");
}

async function searchWeb(query: string): Promise<SearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.search = new URLSearchParams({ q: query, count: "20", search_lang: "en", country: "ALL", freshness: "pm", text_decorations: "false", result_filter: "web", safesearch: "moderate" }).toString();
  let response: Response;
  try {
    response = await fetch(url, { headers: { "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY!.trim(), Accept: "application/json" }, signal: AbortSignal.timeout(15000), redirect: "error" });
  } catch { throw new ProspectError("The search provider could not be reached. Try again later."); }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new ProspectError("The search provider rejected the API key. Check the key and plan in Cloudflare.");
    if (response.status === 429) throw new ProspectError("The search provider rate or credit limit was reached.");
    throw new ProspectError("The search provider returned an error. Try again later.");
  }
  const body = await response.json() as { web?: { results?: SearchResult[] } };
  if (!body || typeof body !== "object" || (body.web?.results !== undefined && !Array.isArray(body.web.results))) throw new ProspectError("The search provider returned an unexpected response.");
  return (body.web?.results ?? []).slice(0, 20);
}

// The existing hourly Worker cron checks eligibility; discovery runs at most once
// per 24 hours automatically. Manual runs have a one-hour cooldown and a shared
// limit of three runs per UTC day. No mail, marketing, or booking code is invoked.
export async function discoverWebProspects(scheduled = false) {
  if (!searchConfigured()) {
    if (scheduled) return { skipped: "not_configured" };
    throw new ProspectError("Connect the search API in Cloudflare first.");
  }
  const db = await ensureProspectStorage();
  const { settings } = await configuration();
  if (scheduled && !settings.enabled) return { skipped: "paused" };
  const now = new Date(), started = now.toISOString(), runId = crypto.randomUUID();
  const cooldown = new Date(now.getTime() - (scheduled ? 24 : 1) * 3600000).toISOString();
  const day = started.slice(0, 10) + "T00:00:00.000Z";
  const claim = await db.prepare(`UPDATE web_prospect_config SET lease_id=?, lease_until=?, last_attempt_at=?
    WHERE id=1 AND (lease_until IS NULL OR lease_until<?)
    AND (last_attempt_at IS NULL OR last_attempt_at<=?)
    AND (SELECT count(*) FROM web_prospect_runs WHERE started_at>=?)<3`)
    .bind(runId, new Date(now.getTime() + 180000).toISOString(), started, started, cooldown, day).run();
  if (!claim.meta.changes) {
    if (scheduled) return { skipped: "not_due" };
    throw new ProspectError("A search is running or the search limit was reached. Allow one hour between searches and at most three runs per day.");
  }
  let completed = 0, checked = 0, candidates = 0, added = 0;
  let failure: string | null = null;
  try {
    await db.prepare("INSERT INTO web_prospect_runs (id,started_at,status) VALUES (?,?,'running')").bind(runId, started).run();
    for (const [index, template] of settings.queries.entries()) {
      // Keep requests below one per second, including fast provider responses.
      if (index) await new Promise(resolve => setTimeout(resolve, 1100));
      const query = template.replaceAll("{year}", String(settings.targetYear));
      const results = await searchWeb(query);
      completed++; checked += results.length;
      const writes: D1PreparedStatement[] = [];
      for (const result of results) {
        if (!result || typeof result !== "object") continue;
        const candidate = candidateFromResult(result, settings.targetYear);
        if (!candidate) continue;
        candidates++;
        writes.push(db.prepare(`INSERT INTO web_prospects
          (id,source_url,source_host,title,excerpt,source_date,discovered_at,last_seen_at,origin,match_reason,search_query,target_year,fit,updated_at)
          VALUES (?,?,?,?,?,?,?,?,'search',?,?,?,?,?) ON CONFLICT(source_url) DO NOTHING`)
          .bind(crypto.randomUUID(), candidate.source, new URL(candidate.source).hostname, candidate.title, candidate.excerpt, candidate.sourceDate, started, started, candidate.reason, query, settings.targetYear, candidate.fit, started));
        // Preserve edits, status, suppression, and the original evidence on repeats.
        writes.push(db.prepare("UPDATE web_prospects SET last_seen_at=? WHERE source_url=?").bind(started, candidate.source));
      }
      // A bounded batch avoids one Worker subrequest for every saved result.
      if (writes.length) {
        const saved = await db.batch(writes);
        for (let i = 0; i < saved.length; i += 2) added += saved[i].meta.changes;
      }
      await db.prepare("UPDATE web_prospect_runs SET queries_completed=?,results_checked=?,candidates=?,added=? WHERE id=?")
        .bind(completed, checked, candidates, added, runId).run();
    }
  } catch (error) {
    failure = error instanceof ProspectError ? error.message : "The search could not finish. Any prospects already saved have been kept.";
  } finally {
    await db.batch([
      db.prepare(`UPDATE web_prospect_runs SET finished_at=?,status=?,queries_completed=?,results_checked=?,candidates=?,added=?,error=? WHERE id=?`)
        .bind(new Date().toISOString(), failure ? (completed ? "partial" : "error") : "complete", completed, checked, candidates, added, failure, runId),
      db.prepare("UPDATE web_prospect_config SET lease_id=NULL,lease_until=NULL WHERE id=1 AND lease_id=?").bind(runId),
    ]);
  }
  return { added, checked, completed, error: failure };
}
