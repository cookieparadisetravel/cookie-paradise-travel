import { env } from "cloudflare:workers";
import { ensureProspectStorage, discoveryTables } from "./web-prospect-storage";
import { candidateFromResult, canonicalSource, settingsSchema, discoveryDefaults, prospectStatuses, prospectFits, PAGE_SIZE, type DiscoveryProvider, type Prospect, type ProspectDashboard, type ProspectRun, type ProspectSettings, type SearchResult, type createProspectSchema, type updateProspectSchema } from "./web-prospects";
import type { z } from "zod";

export class ProspectError extends Error {}
export function searchConfigured(provider: DiscoveryProvider = "brave") { return !!(provider === "tavily" ? env.TAVILY_API_KEY : env.BRAVE_SEARCH_API_KEY)?.trim(); }
async function configuration(provider: DiscoveryProvider) {
  const db = await ensureProspectStorage(provider);
  const tables = discoveryTables(provider);
  const row = await db.prepare(`SELECT settings_json, last_attempt_at FROM ${tables.config} WHERE id=1`).first<{ settings_json: string; last_attempt_at: string | null }>();
  return { settings: settingsSchema.parse(row ? JSON.parse(row.settings_json) : discoveryDefaults(provider)), lastAttempt: row?.last_attempt_at ?? null };
}
export async function loadProspectDashboard(params = new URLSearchParams(), provider: DiscoveryProvider = "brave"): Promise<ProspectDashboard> {
  const db = await ensureProspectStorage(provider);
  const tables = discoveryTables(provider);
  const { settings, lastAttempt } = await configuration(provider);
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
    db.prepare(`SELECT * FROM ${tables.runs} ORDER BY started_at DESC LIMIT 5`).all<ProspectRun>(),
  ]);
  return { prospects: rows.results, total: total?.n ?? 0, page, counts: Object.fromEntries(countRows.results.map(r => [r.status, r.n])), settings, configured: searchConfigured(provider), runs: runs.results.map(r => r.status === "running" && Date.parse(r.started_at) < Date.now() - 300000 ? { ...r, status: "interrupted", error: "This search did not finish. You can try again after the cooldown." } : r), lastAttempt };
}
export async function saveProspectSettings(settings: ProspectSettings, provider: DiscoveryProvider = "brave") {
  if (settings.enabled && !searchConfigured(provider)) throw new ProspectError("Connect the search API before enabling daily discovery.");
  const db = await ensureProspectStorage(provider);
  const tables = discoveryTables(provider);
  await db.prepare(`UPDATE ${tables.config} SET settings_json=? WHERE id=1`).bind(JSON.stringify(settings)).run();
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

async function searchWeb(query: string, provider: DiscoveryProvider): Promise<SearchResult[]> {
  let response: Response;
  try {
    if (provider === "tavily") {
      response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.TAVILY_API_KEY!.trim()}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, search_depth: "basic", auto_parameters: false, topic: "general", max_results: 20,
          time_range: "month", include_published_date: true, language: "en", safe_search: true,
          include_answer: false, include_raw_content: false, include_images: false }),
        signal: AbortSignal.timeout(15000), redirect: "manual",
      });
    } else {
      const url = new URL("https://api.search.brave.com/res/v1/web/search");
      url.search = new URLSearchParams({ q: query, count: "20", search_lang: "en", country: "ALL", freshness: "pm", text_decorations: "false", result_filter: "web", safesearch: "moderate" }).toString();
      response = await fetch(url, { headers: { "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY!.trim(), Accept: "application/json" }, signal: AbortSignal.timeout(15000), redirect: "manual" });
    }
  } catch (error) {
    if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) throw new ProspectError("The search provider timed out after 15 seconds. Try again later.");
    throw new ProspectError("The search provider could not be reached. Try again later.");
  }
  // Workers supports manual/follow, not redirect:error. Reject redirects here
  // so API credentials are never forwarded to a different destination.
  if (response.status >= 300 && response.status < 400) throw new ProspectError("The search provider returned an unexpected redirect. No redirect was followed.");
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new ProspectError("The search provider rejected the API key. Check the key and plan in Cloudflare.");
    if ([429, 432, 433].includes(response.status)) throw new ProspectError("The search provider rate or credit limit was reached.");
    throw new ProspectError("The search provider returned an error. Try again later.");
  }
  try {
    const body = await response.json() as { results?: unknown; web?: { results?: SearchResult[] } };
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    if (provider === "tavily") {
      if (!Array.isArray(body.results)) throw new Error();
      return body.results.slice(0, 20).filter((r: unknown) => r && typeof r === "object" && !Array.isArray(r)).map((r: { url?: unknown; title?: unknown; content?: unknown; published_date?: unknown }) => ({
        url: r.url, title: r.title, description: r.content,
        page_age: typeof r.published_date === "string" && !Number.isNaN(Date.parse(r.published_date)) ? new Date(r.published_date).toISOString() : undefined,
      }));
    }
    if (body.web?.results !== undefined && !Array.isArray(body.web.results)) throw new Error();
    return (body.web?.results ?? []).slice(0, 20);
  } catch { throw new ProspectError("The search provider returned an unexpected response."); }
}

// The existing hourly Worker cron checks eligibility; discovery runs at most once
// per 24 hours automatically. Manual runs have a one-hour cooldown and a shared
// limit of three runs per UTC day. No mail, marketing, or booking code is invoked.
export async function discoverWebProspects(scheduled = false, provider: DiscoveryProvider = "brave") {
  if (!searchConfigured(provider)) {
    if (scheduled) return { skipped: "not_configured" };
    throw new ProspectError("Connect the search API in Cloudflare first.");
  }
  const db = await ensureProspectStorage(provider);
  const tables = discoveryTables(provider);
  const { settings } = await configuration(provider);
  if (scheduled && !settings.enabled) return { skipped: "paused" };
  const now = new Date(), started = now.toISOString(), runId = crypto.randomUUID();
  const cooldown = new Date(now.getTime() - (scheduled ? 24 : 1) * 3600000).toISOString();
  const day = started.slice(0, 10) + "T00:00:00.000Z";
  const claim = await db.prepare(`UPDATE ${tables.config} SET lease_id=?, lease_until=?, last_attempt_at=?
    WHERE id=1 AND (lease_until IS NULL OR lease_until<?)
    AND (last_attempt_at IS NULL OR last_attempt_at<=?)
    AND (SELECT count(*) FROM ${tables.runs} WHERE started_at>=?)<3`)
    .bind(runId, new Date(now.getTime() + 180000).toISOString(), started, started, cooldown, day).run();
  if (!claim.meta.changes) {
    if (scheduled) return { skipped: "not_due" };
    throw new ProspectError("A search is running or the search limit was reached. Allow one hour between searches and at most three runs per day.");
  }
  let completed = 0, checked = 0, candidates = 0, added = 0;
  let failure: string | null = null;
  try {
    await db.prepare(`INSERT INTO ${tables.runs} (id,started_at,status) VALUES (?,?,'running')`).bind(runId, started).run();
    for (const [index, template] of settings.queries.entries()) {
      // Keep requests below one per second, including fast provider responses.
      if (index) await new Promise(resolve => setTimeout(resolve, 1100));
      const query = template.replaceAll("{year}", String(settings.targetYear));
      const results = await searchWeb(query, provider);
      completed++; checked += results.length;
      const writes: D1PreparedStatement[] = [];
      for (const result of results) {
        if (!result || typeof result !== "object") continue;
        const candidate = candidateFromResult(result, settings.targetYear);
        if (!candidate) continue;
        candidates++;
        writes.push(db.prepare(`INSERT INTO web_prospects
          (id,source_url,source_host,title,excerpt,source_date,discovered_at,last_seen_at,origin,match_reason,search_query,target_year,fit,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_url) DO NOTHING`)
          .bind(crypto.randomUUID(), candidate.source, new URL(candidate.source).hostname, candidate.title, candidate.excerpt, candidate.sourceDate, started, started, provider === "tavily" ? "tavily" : "search", candidate.reason, query, settings.targetYear, candidate.fit, started));
        // Preserve edits, status, suppression, and the original evidence on repeats.
        writes.push(db.prepare("UPDATE web_prospects SET last_seen_at=? WHERE source_url=?").bind(started, candidate.source));
      }
      // A bounded batch avoids one Worker subrequest for every saved result.
      if (writes.length) {
        const saved = await db.batch(writes);
        for (let i = 0; i < saved.length; i += 2) added += saved[i].meta.changes;
      }
      await db.prepare(`UPDATE ${tables.runs} SET queries_completed=?,results_checked=?,candidates=?,added=? WHERE id=?`)
        .bind(completed, checked, candidates, added, runId).run();
    }
  } catch (error) {
    failure = error instanceof ProspectError ? error.message : "The search could not finish. Any prospects already saved have been kept.";
  } finally {
    await db.batch([
      db.prepare(`UPDATE ${tables.runs} SET finished_at=?,status=?,queries_completed=?,results_checked=?,candidates=?,added=?,error=? WHERE id=?`)
        .bind(new Date().toISOString(), failure ? (completed ? "partial" : "error") : "complete", completed, checked, candidates, added, failure, runId),
      db.prepare(`UPDATE ${tables.config} SET lease_id=NULL,lease_until=NULL WHERE id=1 AND lease_id=?`).bind(runId),
    ]);
  }
  return { added, checked, completed, error: failure };
}
