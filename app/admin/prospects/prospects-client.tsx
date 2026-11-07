"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, Globe2, Plus, RefreshCw, Search, Settings2, X } from "lucide-react";
import { defaultQueries, fitLabels, PAGE_SIZE, prospectFits, prospectStatuses, statusLabels, type Prospect, type ProspectDashboard, type ProspectSettings } from "@/lib/web-prospects";

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50";
const primary = `${button} !border-[var(--gold)] !bg-[var(--gold)]`;
const card = "rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6";
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Indiana/Indianapolis" }).format(new Date(value)) : "Never";
const todayIndiana = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Indiana/Indianapolis", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function ProspectsClient({ initial }: { initial: ProspectDashboard }) {
  const [data, setData] = useState(initial);
  const [filters, setFilters] = useState({ q: "", status: "active", fit: "", page: 1 });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(!initial.configured);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const generation = useRef(0);
  const first = useRef(true);
  const query = new URLSearchParams({ q: filters.q, status: filters.status, fit: filters.fit, page: String(filters.page) }).toString();

  async function reload() {
    const revision = ++generation.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/prospects?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Prospects could not be loaded. Refresh or sign in again.");
      const next = await response.json() as ProspectDashboard;
      if (revision === generation.current) setData(next);
    } catch (e) { if (revision === generation.current) setError(e instanceof Error ? e.message : "Unable to load prospects."); }
    finally { if (revision === generation.current) setLoading(false); }
  }
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    void reload();
    // The query string is the complete dependency for the paginated request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function mutate(action: string, payload?: unknown) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/prospects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data: payload }) });
      const result = await response.json() as { error?: string; result?: { error?: string; added: number; checked: number } };
      if (!response.ok) throw new Error(result.error || "The update could not be completed.");
      if (action === "scan" && result.result) {
        setMessage(`${result.result.added} new prospects saved from ${result.result.checked} results checked.`);
        if (result.result.error) setError(result.result.error);
      } else setMessage(action === "settings" ? "Discovery settings saved." : "Prospect saved.");
      if (action === "update") setSelected(null);
      if (action === "create") setAdding(false);
      await reload();
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "The update could not be completed."); return false; }
    finally { setBusy(false); }
  }
  const totalActive = ["new", "reviewed", "contacted", "replied"].reduce((sum, status) => sum + (data.counts[status] || 0), 0);
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return <main className="min-h-screen bg-[var(--sand)] text-[var(--ink)]">
    <header className="border-b border-[var(--line)] bg-white">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-7">
        <div><p className="text-xs font-bold uppercase tracking-[.2em]">Cookie Paradise · Owner dashboard</p><h1 className="mt-1 font-serif text-3xl font-bold">Web prospects</h1></div>
        <a href="/admin/inquiries" className={button}><ArrowLeft size={16} /> Inquiries</a>
      </div>
    </header>
    <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-7">
      <section className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[var(--muted-ink)]">Vietnam · {data.settings.targetYear}</p>
          <h2 className="mt-2 font-serif text-2xl font-bold sm:text-3xl">Find the next travel conversation.</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">Review public travel questions, check the dates, and track your personal outreach for group tours or private / FIT trips.</p></div>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={() => setSettingsOpen(!settingsOpen)} aria-expanded={settingsOpen}><Settings2 size={16} /> Discovery settings</button>
          <button className={button} disabled={busy} onClick={() => { setAdding(!adding); setSelected(null); }}><Plus size={16} /> Add a prospect</button>
          <button className={primary} disabled={busy || !data.configured} onClick={() => void mutate("scan")}><Search size={16} /> {busy ? "Working…" : "Search now"}</button>
        </div>
      </section>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[ ["Needs review", data.counts.new || 0], ["Active prospects", totalActive], ["Contacted", data.counts.contacted || 0], ["Replied", data.counts.replied || 0] ].map(([label, value]) => <div className={`${card} !p-4`} key={label}><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-ink)]">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}
      </div>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--cream)] px-4 py-3 text-sm">
        <p><strong>{!data.configured ? "Setup needed" : data.settings.enabled ? "Daily discovery enabled" : "Daily discovery paused"}</strong> · {data.settings.queries.length} searches per run · Last attempt: {dateLabel(data.lastAttempt)} (Indiana)</p>
        <button className="inline-flex items-center gap-2 font-bold underline" disabled={busy || loading} onClick={() => void reload()}><RefreshCw size={14} /> Refresh</button>
      </section>
      <div aria-live="polite">{message && <p className="rounded-xl bg-emerald-50 p-3 text-emerald-900">{message}</p>}</div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-900">{error}</p>}
      {settingsOpen && <DiscoverySettings key={JSON.stringify(data.settings)} settings={data.settings} configured={data.configured} busy={busy} onSave={s => mutate("settings", s)} />}
      {adding && <AddProspect year={data.settings.targetYear} busy={busy} onSave={p => mutate("create", p)} onClose={() => setAdding(false)} />}
      {selected && <ProspectEditor key={`${selected.id}:${selected.version}`} prospect={selected} busy={busy} onClose={() => setSelected(null)} onSave={p => mutate("update", p)} />}
      <section className={card} aria-busy={loading}>
        <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setFilters({ ...filters, q: search, page: 1 }); }}>
          <label className="field-label min-w-48 flex-1">Search saved prospects<input className="field-input" value={search} maxLength={200} onChange={e => setSearch(e.target.value)} placeholder="Name, request, or website" /></label>
          <label className="field-label">Status<select className="field-input" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}><option value="active">Active prospects</option><option value="all">All statuses</option>{prospectStatuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
          <label className="field-label">Service fit<select className="field-input" value={filters.fit} onChange={e => setFilters({ ...filters, fit: e.target.value, page: 1 })}><option value="">All services</option>{prospectFits.map(f => <option value={f} key={f}>{fitLabels[f]}</option>)}</select></label>
          <button className={button} type="submit">Filter</button>
        </form>
        <p className="mt-5 text-sm text-[var(--muted-ink)]">{loading ? "Loading prospects…" : `${data.total} matching source posts`} · Review the original post before contacting anyone. Email permission is not inferred.</p>
        {!data.prospects.length ? <div className="py-14 text-center"><Globe2 className="mx-auto mb-4 text-[var(--muted-ink)]" size={36} /><h3 className="font-serif text-2xl font-bold">{data.total ? "No prospects on this page" : "No matching prospects yet"}</h3><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--muted-ink)]">{!data.configured ? "Connect the search API to discover public posts, or add a source link you have found." : "Run a search or adjust your filters. Posts are saved only when the excerpt contains Vietnam, travel intent, and the target year or “next year.”"}</p></div> :
          <div className="mt-4 divide-y divide-[var(--line)]">{data.prospects.map(p => <article key={p.id} className="grid gap-4 py-5 lg:grid-cols-[1fr_240px]">
            <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2 text-xs"><span className="font-bold uppercase tracking-wide">{p.source_host}</span><span className="text-[var(--muted-ink)]">· Found {dateLabel(p.discovered_at)}</span></div>
              <h3 className="break-words font-serif text-xl font-bold">{p.person_name ? `${p.person_name} · ` : ""}{p.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted-ink)]">{p.excerpt || "No excerpt saved. Open the source to review the request."}</p>
              {p.travel_timing && <p className="mt-2 text-sm"><strong>Travel timing:</strong> {p.travel_timing}</p>}
              {p.follow_up_date && <p className={`mt-2 text-sm ${p.follow_up_date <= todayIndiana() ? "font-bold text-amber-800" : ""}`}>Follow up {p.follow_up_date} · {p.next_action}</p>}
              <a className="mt-3 inline-flex items-center gap-1 text-sm font-bold underline" href={p.source_url} target="_blank" rel="noopener noreferrer">Open original post <ArrowUpRight size={14} /></a>
            </div>
            <div className="flex flex-wrap items-start gap-2 lg:flex-col"><span className={`rounded-full px-3 py-1 text-xs font-bold ${p.status === "do_not_contact" ? "bg-red-100 text-red-900" : "bg-[var(--cream)]"}`}>{statusLabels[p.status]}</span><span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs">{fitLabels[p.fit]}</span><button className={`${button} mt-1 lg:mt-auto`} disabled={busy} onClick={() => { setSelected(p); setAdding(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Review &amp; follow up</button></div>
          </article>)}</div>}
        <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-4 text-sm"><button className={button} disabled={loading || filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</button><span>Page {data.page} of {pages}</span><button className={button} disabled={loading || filters.page >= pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button></div>
      </section>
      <details className={card}><summary className="cursor-pointer font-bold">Recent discovery runs</summary><div className="mt-4 space-y-3 text-sm">{!data.runs.length && <p>No searches have run yet.</p>}{data.runs.map(run => <div key={run.id} className="border-t border-[var(--line)] pt-3"><p><strong>{dateLabel(run.started_at)} · {run.status}</strong></p><p className="mt-1">{run.queries_completed} searches completed · {run.results_checked} results checked · {run.added} new source posts saved</p>{run.error && <p className="mt-1 text-red-800">{run.error}</p>}</div>)}</div></details>
      <p className="pb-4 text-xs leading-5 text-[var(--muted-ink)]">Search covers indexed public pages in English. Private groups and unindexed posts are not available. Results may be incomplete or outdated. Prospect records stay separate from customer inquiries; saving or changing a status sends no messages and adds no marketing subscribers.</p>
    </div>
  </main>;
}

function DiscoverySettings({ settings, configured, busy, onSave }: { settings: ProspectSettings; configured: boolean; busy: boolean; onSave: (s: ProspectSettings) => Promise<boolean> }) {
  const [year, setYear] = useState(settings.targetYear), [queries, setQueries] = useState(settings.queries.join("\n")), [enabled, setEnabled] = useState(settings.enabled);
  return <section className={card}><h3 className="font-serif text-xl font-bold">Discovery settings</h3>
    {!configured && <div className="mt-3 rounded-xl bg-amber-50 p-4 text-sm leading-6"><p className="font-bold">Connect Brave Search to turn on automatic discovery.</p><ol className="ml-5 mt-2 list-decimal space-y-1"><li>Create a <a className="font-bold underline" href="https://api-dashboard.search.brave.com" target="_blank" rel="noopener noreferrer">Brave Search API key</a> with a plan that includes storing results.</li><li>In Cloudflare, open the <strong>cookie-paradise-travel</strong> Worker → Settings → Variables and Secrets. Add a secret named <code>BRAVE_SEARCH_API_KEY</code>, paste the key, and deploy the setting.</li><li>Refresh this page, run a search, and enable daily discovery when ready.</li></ol><p className="mt-2">Keep the API key in Cloudflare. Do not put it in a prospect note.</p></div>}
    <form className="mt-4 space-y-4" onSubmit={e => { e.preventDefault(); void onSave({ enabled, targetYear: year, queries: queries.split("\n").map(s => s.trim()).filter(Boolean) }); }}>
      <div className="flex flex-wrap items-end gap-5"><label className="field-label max-w-40">Target travel year<input type="number" className="field-input" min={2027} max={2100} value={year} onChange={e => setYear(Number(e.target.value))} required /></label><label className="flex min-h-12 items-center gap-3 text-sm font-bold"><input type="checkbox" checked={enabled} disabled={!configured} onChange={e => setEnabled(e.target.checked)} /> Search daily</label></div>
      <label className="field-label">Searches, one per line<textarea className="field-input !min-h-36 py-3" rows={4} value={queries} onChange={e => setQueries(e.target.value)} required /><span className="font-normal text-[var(--muted-ink)]">Use {"{year}"} for the target year. Up to six searches per run. Each checks up to 20 results from pages dated or updated within the past month.</span></label>
      <p className="text-xs leading-5 text-[var(--muted-ink)]">Automatic discovery runs at most once every 24 hours. Search now allows one run per hour, up to three total runs per UTC day. Search provider charges depend on your plan.</p>
      <div className="flex gap-2"><button className={primary} disabled={busy}>Save settings</button><button type="button" className={button} disabled={busy} onClick={() => setQueries(defaultQueries.join("\n"))}>Restore default searches</button></div>
    </form>
  </section>;
}

function AddProspect({ year, busy, onSave, onClose }: { year: number; busy: boolean; onSave: (p: unknown) => Promise<boolean>; onClose: () => void }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    void onSave({ sourceUrl: f.get("sourceUrl"), title: f.get("title"), excerpt: f.get("excerpt"), personName: f.get("personName"), targetYear: Number(f.get("targetYear")) });
  }
  return <section className={card}><div className="flex justify-between gap-3"><h3 className="font-serif text-xl font-bold">Add a prospect from a source post</h3><button aria-label="Close add prospect" onClick={onClose} disabled={busy}><X size={20} /></button></div>
    <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      <label className="field-label sm:col-span-2">Original post URL<input name="sourceUrl" className="field-input" type="url" placeholder="https://…" maxLength={2048} required /></label>
      <label className="field-label sm:col-span-2">Request title<input name="title" className="field-input" maxLength={300} placeholder="What are they asking about?" required /></label>
      <label className="field-label">Public name or handle, if known<input name="personName" className="field-input" maxLength={150} /></label>
      <label className="field-label">Target year<input name="targetYear" className="field-input" type="number" min={2027} max={2100} defaultValue={year} required /></label>
      <label className="field-label sm:col-span-2">Request excerpt or your summary<textarea name="excerpt" className="field-input py-3" rows={3} maxLength={2000} /></label>
      <div><button className={primary} disabled={busy}>Save prospect</button></div>
    </form>
  </section>;
}

function ProspectEditor({ prospect: p, busy, onClose, onSave }: { prospect: Prospect; busy: boolean; onClose: () => void; onSave: (p: unknown) => Promise<boolean> }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    void onSave({ id: p.id, version: p.version, personName: f.get("personName"), travelTiming: f.get("travelTiming"), partySize: f.get("partySize"), contactChannel: f.get("contactChannel"), fit: f.get("fit"), status: f.get("status"), notes: f.get("notes"), nextAction: f.get("nextAction"), followUpDate: f.get("followUpDate") || null });
  }
  return <section className={`${card} ring-2 ring-[var(--gold)]`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider">Review prospect</p><h3 className="mt-1 font-serif text-xl font-bold">{p.title}</h3></div><button aria-label="Close prospect review" disabled={busy} onClick={onClose}><X size={20} /></button></div>
    <div className="mt-4 rounded-xl bg-[var(--sand)] p-4 text-sm leading-6"><p>{p.excerpt || "No excerpt saved."}</p><a className="mt-2 inline-flex items-center gap-1 font-bold underline" href={p.source_url} target="_blank" rel="noopener noreferrer">Verify original post <ArrowUpRight size={14} /></a><p className="mt-2 text-xs text-[var(--muted-ink)]">{p.match_reason || "Added manually. Verify dates and fit."} {p.source_date ? `Page date reported by search: ${dateLabel(p.source_date)}. This may be an update date.` : "Original post date has not been verified."}</p></div>
    <form className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={submit}>
      <label className="field-label">Name / handle<input className="field-input" name="personName" maxLength={150} defaultValue={p.person_name} placeholder="Unknown until verified" /></label>
      <label className="field-label">Travel timing<input className="field-input" name="travelTiming" maxLength={300} defaultValue={p.travel_timing} placeholder="Confirm year and dates" /></label>
      <label className="field-label">Travelers<input className="field-input" name="partySize" maxLength={100} defaultValue={p.party_size} placeholder="Not specified" /></label>
      <label className="field-label">Service fit<select className="field-input" name="fit" defaultValue={p.fit}>{prospectFits.map(f => <option key={f} value={f}>{fitLabels[f]}</option>)}</select></label>
      <label className="field-label">Outreach status<select className="field-input" name="status" defaultValue={p.status}>{prospectStatuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
      <label className="field-label">Contact channel provided by prospect<input className="field-input" name="contactChannel" defaultValue={p.contact_channel} maxLength={500} placeholder="Reply on original post, or supplied email" /></label>
      <label className="field-label sm:col-span-2">Next action<input className="field-input" name="nextAction" defaultValue={p.next_action} maxLength={500} placeholder="Ask about dates and group size" /></label>
      <label className="field-label">Follow-up date (Indiana)<input type="date" className="field-input" name="followUpDate" defaultValue={p.follow_up_date || ""} /></label>
      <label className="field-label sm:col-span-2 lg:col-span-3">Private notes<textarea rows={4} className="field-input py-3" name="notes" maxLength={5000} defaultValue={p.notes} placeholder="Conversation history, preferences, and useful context" /></label>
      <p className="text-xs leading-5 text-[var(--muted-ink)] sm:col-span-2 lg:col-span-3">Follow-up dates are tracked here; they do not send reminders. “Do not contact,” “Not a fit,” and “Archived” hide this source from the active list and remain saved if rediscovered.</p>
      <div className="flex gap-2"><button className={primary} disabled={busy}>Save changes</button><button type="button" className={button} disabled={busy} onClick={onClose}>Cancel</button></div>
    </form>
  </section>;
}
