import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import * as prospects from "./web-prospects.ts";
import { sameOrigin, boundedBody } from "./lead-request.ts";

async function loadModule(path: string, stubs: Record<string, unknown>) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  let code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const key = `__prospects_${crypto.randomUUID()}`;
  const globals = globalThis as unknown as Record<string, unknown>;
  globals[key] = stubs;
  for (const statement of ts.createSourceFile("module.ts", code, ts.ScriptTarget.ESNext, true).statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text, bindings = statement.importClause?.namedBindings;
    assert.ok(bindings && ts.isNamedImports(bindings));
    assert.ok(specifier in stubs, `Missing stub: ${specifier}`);
    const exports = bindings.elements.map(b => `export const ${b.name.text}=stub[${JSON.stringify((b.propertyName ?? b.name).text)}];`).join("\n");
    const stub = `const stub=globalThis[${JSON.stringify(key)}][${JSON.stringify(specifier)}];\n${exports}`;
    code = code.replace(JSON.stringify(specifier), JSON.stringify(`data:text/javascript;base64,${Buffer.from(stub).toString("base64")}`));
  }
  try { return await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`); }
  finally { delete globals[key]; }
}

async function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  function prepare(sql: string) {
    let args: (string | number | null)[] = [];
    return {
      bind(...values: (string | number | null)[]) { args = values; return this; },
      async run() { const result = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; },
      async first() { return sqlite.prepare(sql).get(...args) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    };
  }
  const env = { DB: { prepare, batch: async (statements: ReturnType<typeof prepare>[]) => Promise.all(statements.map(s => s.run())) }, BRAVE_SEARCH_API_KEY: "test-only-key", TAVILY_API_KEY: "" };
  const storage = await loadModule("./web-prospect-storage.ts", { "cloudflare:workers": { env }, "./web-prospects": prospects });
  const service = await loadModule("./web-prospect-service.ts", { "cloudflare:workers": { env }, "./web-prospect-storage": storage, "./web-prospects": prospects });
  await service.saveProspectSettings({ ...prospects.defaultSettings, enabled: true, queries: ["Vietnam {year} planning tour"] });
  const access = { owner: true };
  const route = await loadModule("../app/api/admin/prospects/route.ts", {
    "@/lib/owner-auth": { requireOwner: async () => access.owner ? { email: "owner@example.com" } : null },
    "@/lib/lead-request": { sameOrigin, boundedBody }, "@/lib/web-prospects": prospects, "@/lib/web-prospect-service": service,
  });
  const tavilyRoute = await loadModule("../app/api/admin/prospects/tavily/route.ts", {
    "@/lib/owner-auth": { requireOwner: async () => access.owner ? { email: "owner@example.com" } : null },
    "@/lib/lead-request": { sameOrigin, boundedBody }, "@/lib/web-prospects": prospects, "@/lib/web-prospect-service": service,
  });
  return { sqlite, env, service, storage, route, tavilyRoute, access };
}
const sourceResult = { title: "Planning a Vietnam trip in 2027", description: "We are looking for a private tour for our family trip to Vietnam in 2027. Any recommendations?", url: "https://www.reddit.com/r/travel/comments/abc123/vietnam/?utm_source=test", page_age: "2026-11-05T12:00:00Z" };
const request = (action: string, data?: unknown, origin = "https://example.com") => new Request("https://example.com/api/admin/prospects", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ action, data }) });

test("canonicalization deduplicates public thread aliases and rejects unsafe URLs", () => {
  assert.equal(prospects.canonicalSource(sourceResult.url), "https://reddit.com/comments/abc123");
  assert.equal(prospects.canonicalSource("https://old.reddit.com/r/travel/comments/abc123/other/comment/"), "https://reddit.com/comments/abc123");
  assert.equal(prospects.canonicalSource("http://www.example.com/topic/?b=2&utm_source=x&a=1#reply"), "https://example.com/topic?a=1&b=2");
  for (const url of ["javascript:alert(1)", "data:text/html,test", "https://user:pass@example.com/", "https://localhost/", "https://127.0.0.1/", "https://[::1]/", "https://example.com:8080/"]) assert.equal(prospects.canonicalSource(url), null);
});
test("matching uses visible travel evidence and flags relative-year uncertainty", () => {
  const found = prospects.candidateFromResult(sourceResult, 2027)!;
  assert.equal(found.fit, "fit");
  assert.match(found.reason, /Verify/);
  assert.equal(prospects.candidateFromResult({ ...sourceResult, title: "Vietnam vacation", description: "We are planning a trip in 2028" }, 2027), null);
  assert.equal(prospects.candidateFromResult({ ...sourceResult, title: "Vietnam tours 2027", description: "Book now. Early bird discount for group tours." }, 2027), null);
  assert.equal(prospects.candidateFromResult({ ...sourceResult, title: "Thailand trip 2027", description: "We are looking for a tour to Thailand in 2027." }, 2027), null);
  assert.match(prospects.candidateFromResult({ ...sourceResult, title: "Vietnam next year?", description: "We are planning a Vietnam trip next year." }, 2027)!.reason, /needs verification/);
  assert.equal(prospects.plainSnippet("<b>Trip</b> &amp; tour"), "Trip & tour");
});

test("discovery persists candidates, never overwrites owner notes, and suppresses duplicates", async () => {
  const f = await fixture(); const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async (input, init) => {
      calls++;
      assert.equal(new URL(String(input)).hostname, "api.search.brave.com");
      assert.match(new URL(String(input)).searchParams.get("q")!, /2027/);
      assert.equal(new Headers(init?.headers).get("X-Subscription-Token"), "test-only-key");
      return Response.json({ web: { results: [sourceResult, { ...sourceResult, url: "javascript:alert(1)" }, { title: "Buy Vietnam tour 2027", description: "Book now", url: "https://example.com/tours" }] } });
    };
    assert.deepEqual(await f.service.discoverWebProspects(), { added: 1, checked: 3, completed: 1, error: null });
    const first = (await f.service.loadProspectDashboard()).prospects[0];
    assert.equal(first.person_name, ""); assert.equal(first.contact_channel, ""); assert.equal(first.status, "new");
    await f.service.updateProspect({ id: first.id, version: 0, personName: "Public handle", travelTiming: "June 2027", partySize: "2", contactChannel: "Reply to post", fit: "fit", status: "do_not_contact", notes: "Declined contact", nextAction: "", followUpDate: null });
    f.sqlite.exec("UPDATE web_prospect_config SET last_attempt_at=NULL");
    assert.equal((await f.service.discoverWebProspects()).added, 0);
    assert.equal((await f.service.loadProspectDashboard()).prospects.length, 0);
    const saved = (await f.service.loadProspectDashboard(new URLSearchParams({ status: "all" }))).prospects[0];
    assert.equal(saved.notes, "Declined contact"); assert.equal(saved.status, "do_not_contact"); assert.equal(saved.version, 1);
    assert.equal(calls, 2);
    await assert.rejects(f.service.createProspect({ sourceUrl: sourceResult.url, title: "Duplicate", excerpt: "", personName: "", targetYear: 2027 }), /already saved/);
    const tables = f.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
    assert.deepEqual(tables.sort(), ["web_prospect_config", "web_prospect_runs", "web_prospects"]);
  } finally { globalThis.fetch = original; f.sqlite.close(); }
});

test("missing connection, pause, cooldown and concurrent scans prevent provider requests", async () => {
  const f = await fixture(); const original = globalThis.fetch;
  let release!: () => void, started!: () => void;
  const fetched = new Promise<void>(resolve => { started = resolve; });
  try {
    let calls = 0;
    globalThis.fetch = async () => { calls++; started(); await new Promise<void>(resolve => { release = resolve; }); return Response.json({ web: { results: [] } }); };
    f.env.BRAVE_SEARCH_API_KEY = "";
    assert.deepEqual(await f.service.discoverWebProspects(true), { skipped: "not_configured" });
    await assert.rejects(f.service.discoverWebProspects(), /Connect/);
    f.env.BRAVE_SEARCH_API_KEY = "test-only-key";
    await f.service.saveProspectSettings({ ...prospects.defaultSettings, queries: ["Vietnam {year}"] });
    assert.deepEqual(await f.service.discoverWebProspects(true), { skipped: "paused" });
    const running = f.service.discoverWebProspects();
    await fetched;
    await assert.rejects(f.service.discoverWebProspects(), /running|limit/);
    release(); await running;
    await assert.rejects(f.service.discoverWebProspects(), /running|limit/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; f.sqlite.close(); }
});

test("daily scan limit and provider failures are recorded without leaking secrets", async () => {
  const f = await fixture(); const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response("PRIVATE token detail", { status: 429 }); };
    for (let i = 0; i < 3; i++) {
      f.sqlite.exec("UPDATE web_prospect_config SET last_attempt_at=NULL");
      const run = await f.service.discoverWebProspects();
      assert.match(run.error, /limit/); assert.doesNotMatch(run.error, /PRIVATE/);
    }
    f.sqlite.exec("UPDATE web_prospect_config SET last_attempt_at=NULL");
    await assert.rejects(f.service.discoverWebProspects(), /limit/);
    assert.equal(calls, 3);
    const data = await f.service.loadProspectDashboard();
    assert.equal(data.runs.length, 3); assert.equal(data.runs[0].status, "error");
    assert.doesNotMatch(JSON.stringify(data), /test-only-key|PRIVATE/);
  } finally { globalThis.fetch = original; f.sqlite.close(); }
});

test("owner authorization, origin validation, bounded bodies and valid dates protect writes", async () => {
  const f = await fixture();
  try {
    f.access.owner = false;
    assert.equal((await f.route.GET(request(""))).status, 403);
    assert.equal((await f.route.POST(request("scan"))).status, 403);
    f.access.owner = true;
    assert.equal((await f.route.POST(request("scan", undefined, "https://attacker.example"))).status, 403);
    assert.equal((await f.route.POST(request("create", { title: "x".repeat(17000) }))).status, 400);
    assert.equal((await f.route.POST(request("create", { sourceUrl: "javascript:alert(1)", title: "Bad", excerpt: "", personName: "", targetYear: 2027 }))).status, 400);
    const created = await f.route.POST(request("create", { sourceUrl: "https://example.com/question", title: "Vietnam 2027?", excerpt: "Planning a trip", personName: "Traveler", targetYear: 2027 }));
    assert.equal(created.status, 200);
    const { id } = await created.json();
    const update = { id, version: 0, personName: "Traveler", travelTiming: "", partySize: "", contactChannel: "", fit: "review", status: "reviewed", notes: "Useful context", nextAction: "Follow up", followUpDate: "2027-02-30" };
    assert.equal((await f.route.POST(request("update", update))).status, 400);
    update.followUpDate = "2027-02-28";
    assert.equal((await f.route.POST(request("update", update))).status, 200);
    assert.equal((await f.route.POST(request("update", update))).status, 409);
    const response = await f.route.GET(request(""));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const data = await response.json();
    assert.equal(data.prospects[0].notes, "Useful context");
    assert.equal(data.prospects[0].follow_up_date, "2027-02-28");
  } finally { f.sqlite.close(); }
});

test("pagination and literal search preserve filtered counts", async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 27; i++) await f.service.createProspect({ sourceUrl: `https://example.com/post/${i}`, title: i === 26 ? "100% Vietnam" : "Vietnam travel", excerpt: "", personName: "", targetYear: 2027 });
    const first = await f.service.loadProspectDashboard();
    assert.equal(first.total, 27); assert.equal(first.prospects.length, 25);
    assert.equal((await f.service.loadProspectDashboard(new URLSearchParams({ page: "2" }))).prospects.length, 2);
    assert.equal((await f.service.loadProspectDashboard(new URLSearchParams({ q: "%" }))).total, 1);
  } finally { f.sqlite.close(); }
});

test("partial provider failure keeps saved prospects and records the incomplete run", async () => {
  const f = await fixture(); const original = globalThis.fetch;
  try {
    await f.service.saveProspectSettings({ ...prospects.defaultSettings, enabled: true, queries: ["Vietnam {year} trip", "Vietnam {year} tour"] });
    let calls = 0;
    globalThis.fetch = async () => ++calls === 1 ? Response.json({ web: { results: [sourceResult] } }) : new Response("Private provider details", { status: 503 });
    const result = await f.service.discoverWebProspects();
    assert.equal(result.added, 1); assert.equal(result.completed, 1); assert.match(result.error, /provider/);
    const data = await f.service.loadProspectDashboard();
    assert.equal(data.prospects.length, 1); assert.equal(data.runs[0].status, "partial");
    assert.equal(f.sqlite.prepare("SELECT lease_id FROM web_prospect_config").get()!.lease_id, null);
  } finally { globalThis.fetch = original; f.sqlite.close(); }
});

test("runtime bootstrap and migration can run in either order without changing saved records", async () => {
  const migration = readFileSync(new URL("../drizzle/0028_sparkling_gamma_corps.sql", import.meta.url), "utf8");
  const f = await fixture();
  try {
    await f.service.createProspect({ sourceUrl: "https://example.com/preserved", title: "Saved request", excerpt: "", personName: "", targetYear: 2027 });
    f.sqlite.exec(migration); f.sqlite.exec(migration);
    assert.equal((await f.service.loadProspectDashboard()).total, 1);
    const other = new DatabaseSync(":memory:");
    try {
      other.exec(migration);
      for (const statement of f.storage.prospectStorageStatements) other.exec(statement);
      other.prepare("INSERT INTO web_prospect_config(id,settings_json) VALUES (1,?)").run(JSON.stringify(prospects.defaultSettings));
      assert.equal(other.prepare("SELECT count(*) AS n FROM web_prospect_config").get()!.n, 1);
    } finally { other.close(); }
  } finally { f.sqlite.close(); }
});

test("Tavily has independent configuration and never falls back to Brave", async () => {
  const f = await fixture(); const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error("No provider request expected"); };
    const initial = await f.service.loadProspectDashboard(new URLSearchParams(), "tavily");
    assert.equal(initial.configured, false);
    assert.equal(initial.settings.enabled, false);
    assert.deepEqual(initial.settings.queries, prospects.tavilyQueries);
    assert.deepEqual(await f.service.discoverWebProspects(true, "tavily"), { skipped: "not_configured" });
    await assert.rejects(f.service.discoverWebProspects(false, "tavily"), /Connect/);
    await assert.rejects(f.service.saveProspectSettings({ ...initial.settings, enabled: true }, "tavily"), /Connect/);
    f.env.TAVILY_API_KEY = "test-tavily-key";
    assert.deepEqual(await f.service.discoverWebProspects(true, "tavily"), { skipped: "paused" });
    await f.service.saveProspectSettings({ ...initial.settings, targetYear: 2028, queries: ["Vietnam {year} tour"] }, "tavily");
    assert.equal((await f.service.loadProspectDashboard()).settings.targetYear, 2027);
    assert.equal((await f.service.loadProspectDashboard()).settings.enabled, true);
    assert.equal((await f.service.loadProspectDashboard(new URLSearchParams(), "tavily")).settings.targetYear, 2028);
  } finally { globalThis.fetch = original; f.sqlite.close(); }
});

test("Tavily uses bounded basic search and preserves suppressed posts across providers", async () => {
  const f = await fixture(); const original = globalThis.fetch;
  try {
    f.env.TAVILY_API_KEY = " test-tavily-key ";
    await f.service.saveProspectSettings({ ...prospects.defaultSettings, queries: ["Vietnam {year} private trip"] }, "tavily");
    let calls = 0;
    globalThis.fetch = async (input, init) => {
      calls++;
      assert.equal(String(input), "https://api.tavily.com/search");
      assert.equal(init?.method, "POST");
      assert.equal(init?.redirect, "manual");
      assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-tavily-key");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.search_depth, "basic"); assert.equal(body.auto_parameters, false);
      assert.equal(body.max_results, 20); assert.equal(body.include_answer, false);
      assert.equal(body.include_raw_content, false); assert.equal(body.time_range, "month");
      assert.match(body.query, /2027/);
      return Response.json({ results: [{ title: sourceResult.title, url: sourceResult.url, content: sourceResult.description, published_date: "Thu, 05 Nov 2026 12:00:00 GMT" }, null] });
    };
    assert.equal((await f.service.discoverWebProspects(false, "tavily")).added, 1);
    const tavily = await f.service.loadProspectDashboard(new URLSearchParams(), "tavily");
    assert.equal(tavily.runs.length, 1);
    assert.equal(tavily.prospects[0].origin, "tavily");
    assert.equal(tavily.prospects[0].source_date, "2026-11-05T12:00:00.000Z");
    assert.equal(JSON.stringify(tavily).includes("test-tavily-key"), false);
    const p = tavily.prospects[0];
    await f.service.updateProspect({ id: p.id, version: 0, personName: "Traveler", travelTiming: "", partySize: "", contactChannel: "", fit: "fit", status: "do_not_contact", notes: "No outreach", nextAction: "", followUpDate: null });
    // Brave is immediately eligible: Tavily's lease and cooldown are independent.
    globalThis.fetch = async () => Response.json({ web: { results: [sourceResult] } });
    assert.equal((await f.service.discoverWebProspects()).added, 0);
    const saved = (await f.service.loadProspectDashboard(new URLSearchParams({ status: "all" }))).prospects[0];
    assert.equal(saved.status, "do_not_contact"); assert.equal(saved.notes, "No outreach");
    assert.equal(saved.origin, "tavily"); assert.equal(saved.version, 1);
    assert.equal((await f.service.loadProspectDashboard()).runs.length, 1);
    await assert.rejects(f.service.discoverWebProspects(false, "tavily"), /running|limit/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; f.sqlite.close(); }
});

test("Tavily failures are recorded without leaking provider responses or keys", async () => {
  const f = await fixture(); const original = globalThis.fetch;
  try {
    f.env.TAVILY_API_KEY = "private-tavily-key";
    await f.service.saveProspectSettings({ ...prospects.defaultSettings, queries: ["Vietnam {year} trip"] }, "tavily");
    const responses = [new Response("private-tavily-key", { status: 401 }), new Response("sensitive credit details", { status: 432 }), Response.json({ unexpected: "sensitive payload" })];
    for (const [index, response] of responses.entries()) {
      f.sqlite.exec("UPDATE tavily_prospect_config SET last_attempt_at=NULL");
      globalThis.fetch = async () => response;
      const run = await f.service.discoverWebProspects(false, "tavily");
      assert.equal(run.added, 0);
      assert.match(run.error, index === 0 ? /rejected/ : index === 1 ? /credit limit/ : /unexpected response/);
      assert.doesNotMatch(JSON.stringify(await f.service.loadProspectDashboard(new URLSearchParams(), "tavily")), /private-tavily-key|sensitive/);
      assert.equal(f.sqlite.prepare("SELECT lease_id FROM tavily_prospect_config").get()!.lease_id, null);
    }
    await assert.rejects(f.service.discoverWebProspects(false, "tavily"), /limit/);
  } finally { globalThis.fetch = original; f.sqlite.close(); }
});

test("Tavily routes enforce owner access, same origin and the separate settings target", async () => {
  const f = await fixture();
  try {
    f.access.owner = false;
    assert.equal((await f.tavilyRoute.GET(request(""))).status, 403);
    assert.equal((await f.tavilyRoute.POST(request("scan"))).status, 403);
    f.access.owner = true;
    assert.equal((await f.tavilyRoute.POST(request("scan", undefined, "https://attacker.example"))).status, 403);
    assert.equal((await f.tavilyRoute.POST(request("settings", { ...prospects.defaultSettings, enabled: true }))).status, 409);
    assert.equal((await f.tavilyRoute.POST(request("settings", { ...prospects.defaultSettings, targetYear: 2028 }))).status, 200);
    const response = await f.tavilyRoute.GET(request(""));
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal((await response.json()).settings.targetYear, 2028);
    assert.equal((await f.service.loadProspectDashboard()).settings.targetYear, 2027);
  } finally { f.sqlite.close(); }
});

test("Tavily migration and runtime bootstrap are additive and repeatable", async () => {
  const migration = readFileSync(new URL("../drizzle/0031_tavily_discovery.sql", import.meta.url), "utf8");
  const f = await fixture();
  try {
    await f.service.createProspect({ sourceUrl: "https://example.com/keep", title: "Saved request", excerpt: "", personName: "", targetYear: 2027 });
    await f.service.loadProspectDashboard(new URLSearchParams(), "tavily");
    f.sqlite.exec(migration); f.sqlite.exec(migration);
    assert.equal((await f.service.loadProspectDashboard()).total, 1);
    const other = new DatabaseSync(":memory:");
    try {
      other.exec(migration);
      for (const statement of f.storage.prospectStorageStatements) other.exec(statement.replaceAll("web_prospect_config", "tavily_prospect_config").replaceAll("web_prospect_runs", "tavily_prospect_runs"));
      assert.equal(other.prepare("SELECT count(*) AS n FROM tavily_prospect_runs").get()!.n, 0);
    } finally { other.close(); }
  } finally { f.sqlite.close(); }
});
