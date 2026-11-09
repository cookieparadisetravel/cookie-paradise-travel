import { z } from "zod";

export const prospectStatuses = ["new", "reviewed", "contacted", "replied", "not_fit", "do_not_contact", "archived"] as const;
export const prospectFits = ["review", "group", "fit", "either"] as const;
export const statusLabels: Record<ProspectStatus, string> = { new: "Needs review", reviewed: "Ready to contact", contacted: "Contacted", replied: "Replied", not_fit: "Not a fit", do_not_contact: "Do not contact", archived: "Archived" };
export const fitLabels: Record<ProspectFit, string> = { review: "Fit to review", group: "Group tour", fit: "Private / FIT", either: "Either service" };
export type ProspectStatus = typeof prospectStatuses[number];
export type ProspectFit = typeof prospectFits[number];
export type DiscoveryProvider = "brave" | "tavily";
export const discoveryProviders = {
  brave: { label: "Brave", path: "/admin/prospects", apiPath: "/api/admin/prospects", secret: "BRAVE_SEARCH_API_KEY", signup: "https://api-dashboard.search.brave.com" },
  tavily: { label: "Tavily", path: "/admin/prospects/tavily", apiPath: "/api/admin/prospects/tavily", secret: "TAVILY_API_KEY", signup: "https://app.tavily.com" },
} as const;
export type Prospect = {
  id: string; source_url: string; source_host: string; title: string; excerpt: string;
  source_date: string | null; discovered_at: string; last_seen_at: string; origin: "search" | "tavily" | "manual";
  match_reason: string; search_query: string; target_year: number; person_name: string;
  travel_timing: string; party_size: string; contact_channel: string; fit: ProspectFit;
  status: ProspectStatus; notes: string; next_action: string; follow_up_date: string | null;
  updated_at: string; version: number;
};
export const defaultQueries = [
  'Vietnam {year} ("planning" OR "looking for" OR "recommend") (tour OR itinerary)',
  'Vietnam {year} site:reddit.com/r/ (tour OR trip OR travel)',
  'Vietnam {year} site:tripadvisor.com/ShowTopic (tour OR itinerary)',
  'Vietnam "next year" ("planning" OR "looking for") (tour OR trip)',
];
export const tavilyQueries = [
  'Vietnam {year} trip planning questions tour recommendations',
  'Vietnam {year} travel itinerary advice site:reddit.com',
  'Vietnam {year} guided tour or independent travel advice site:tripadvisor.com',
  'Vietnam {year} private family trip looking for recommendations',
];
export const settingsSchema = z.object({
  enabled: z.boolean(), targetYear: z.number().int().min(2027).max(2100),
  queries: z.array(z.string().trim().min(3).max(450).refine(s => s.split(/\s+/).length <= 65, "Use at most 65 words per search.")).min(1).max(6),
}).strict();
export type ProspectSettings = z.infer<typeof settingsSchema>;
export const defaultSettings: ProspectSettings = { enabled: false, targetYear: 2027, queries: defaultQueries };
export function discoveryDefaults(provider: DiscoveryProvider): ProspectSettings {
  return { ...defaultSettings, queries: provider === "tavily" ? tavilyQueries : defaultQueries };
}

// Sources are links only; the server never fetches arbitrary user-supplied URLs.
export function canonicalSource(value: string): string | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port) return null;
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!url.hostname.includes(".") || /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname) || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(":")) return null;
    if (/^(old|new|m)\.reddit\.com$/.test(url.hostname)) url.hostname = "reddit.com";
    url.protocol = "https:";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|msclkid$|ref$|share_id$|share$)/i.test(key)) url.searchParams.delete(key);
    const reddit = url.hostname === "reddit.com" && url.pathname.match(/^\/r\/[^/]+\/comments\/([a-z0-9]+)/i);
    if (reddit) { url.pathname = `/comments/${reddit[1].toLowerCase()}`; url.search = ""; }
    else url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    url.searchParams.sort();
    return url.toString();
  } catch { return null; }
}
const sourceUrl = z.string().trim().max(2048).refine(v => !!canonicalSource(v), "Enter a public http or https source link.");
const text = (n: number) => z.string().trim().max(n);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}).nullable();
export const createProspectSchema = z.object({
  sourceUrl, title: text(300).min(1), excerpt: text(2000), personName: text(150),
  targetYear: z.number().int().min(2027).max(2100),
}).strict();
export const updateProspectSchema = z.object({
  id: z.string().uuid(), version: z.number().int().nonnegative(), personName: text(150),
  travelTiming: text(300), partySize: text(100), contactChannel: text(500), fit: z.enum(prospectFits),
  status: z.enum(prospectStatuses), notes: text(5000), nextAction: text(500), followUpDate: date,
}).strict().refine(v => !v.followUpDate || !!v.nextAction, "Add a next action for the follow-up date.");
export type SearchResult = { url?: unknown; title?: unknown; description?: unknown; page_age?: unknown };
export function plainSnippet(value: unknown, max = 900) {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
export function candidateFromResult(result: SearchResult, year: number) {
  const source = typeof result.url === "string" ? canonicalSource(result.url) : null;
  const title = plainSnippet(result.title, 300), excerpt = plainSnippet(result.description);
  if (!source || !title || new URL(source).hostname.endsWith("cookieparadisetravel.com")) return null;
  const evidence = `${title} ${excerpt}`;
  const yearMentioned = new RegExp(`\\b${year}\\b`).test(evidence);
  const relativeYear = /\bnext year\b/i.test(evidence);
  if (!/\bviet\s?nam\b/i.test(evidence) || (!yearMentioned && !relativeYear)) return null;
  if (!/\b(tour|tours|trip|travel|travelling|traveling|itinerary|itineraries|visit|visiting|holiday|vacation)\b/i.test(evidence)) return null;
  // A conservative text signal, not a claim that the author has been qualified.
  if (!/\b(i|we|my|our)\b.{0,90}\b(plan|planning|looking|travel|visiting|going|trip|tour|visit|want|would|hoping)\b|\b(anyone|recommendations|advice|suggestions|looking for|which tour|what tour)\b/i.test(evidence)) return null;
  if (/\b(book now|early bird discount|limited time offer|departures guaranteed)\b/i.test(evidence)) return null;
  let sourceDate: string | null = null;
  if (typeof result.page_age === "string" && /^\d{4}-\d{2}-\d{2}/.test(result.page_age) && !Number.isNaN(Date.parse(result.page_age))) sourceDate = new Date(result.page_age).toISOString();
  const group = /\b(group tour|small group|join a group|guided group)\b/i.test(evidence);
  const fit = /\b(private tour|custom|tailor.?made|independent|family trip)\b/i.test(evidence);
  return { source, title, excerpt, sourceDate, fit: (group && fit ? "either" : group ? "group" : fit ? "fit" : "review") as ProspectFit,
    reason: yearMentioned ? `Vietnam, ${year}, and a travel-planning question appear in the search excerpt. Verify the post and dates.` : 'Vietnam and "next year" appear in the search excerpt. The travel year needs verification against the original post date.' };
}
export type ProspectRun = { id: string; started_at: string; finished_at: string | null; status: string; queries_completed: number; results_checked: number; candidates: number; added: number; error: string | null };
export type ProspectDashboard = { prospects: Prospect[]; total: number; page: number; counts: Record<string, number>; settings: ProspectSettings; configured: boolean; runs: ProspectRun[]; lastAttempt: string | null };
export const PAGE_SIZE = 25;
