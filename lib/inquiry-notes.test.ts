import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
import { z } from "zod";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as sqlBuilders from "drizzle-orm";
import * as schema from "../db/schema.ts";
import * as notesConfig from "./inquiry-notes.ts";

type Context = { params: Promise<{ id: string }> };
type Handler = (request: Request, context: Context) => Promise<Response>;
type Stubs = Record<string, Record<string, unknown>>;

async function loadRoute(stubs: Stubs): Promise<{ GET: Handler; POST: Handler }> {
  const source = readFileSync(new URL("../app/api/admin/inquiries/[id]/notes/route.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  const key = `__inquiryNotesTest_${crypto.randomUUID()}`;
  const globals = globalThis as unknown as Record<string, unknown>;
  globals[key] = stubs;
  let code = outputText;
  for (const statement of ts.createSourceFile("route.ts", outputText, ts.ScriptTarget.ESNext, true).statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;
    assert.ok(bindings && ts.isNamedImports(bindings));
    const exports = bindings.elements.map((b) => {
      const name = (b.propertyName ?? b.name).text;
      return `export const ${name} = stub[${JSON.stringify(name)}];`;
    }).join("\n");
    const stubCode = `const stub = globalThis[${JSON.stringify(key)}][${JSON.stringify(specifier)}];\n${exports}`;
    code = code.replace(JSON.stringify(specifier), JSON.stringify(`data:text/javascript;base64,${Buffer.from(stubCode).toString("base64")}`));
  }
  try { return await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`); }
  finally { delete globals[key]; }
}

async function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  const directory = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  const db = drizzle(async (query, params, method) => {
    const statement = sqlite.prepare(query);
    if (method === "run") { statement.run(...params); return { rows: [] }; }
    statement.setReturnArrays(true);
    return { rows: method === "get" ? statement.get(...params) as unknown as unknown[] : statement.all(...params) as unknown as unknown[][] };
  });
  await db.insert(schema.bookingRequests).values([1, 2].map((id) => ({
    id, tripSlug: "test", fullName: "Test Customer", email: `test-${id}@example.com`, departure: "2027-06-01",
    roomPreference: "shared", partySize: 1, notes: "Original customer message", status: "new", squareEnvironment: "production" as const,
  })));
  const access = { owner: true, origin: true, dbCalls: 0 };
  const route = await loadRoute({
    "drizzle-orm": sqlBuilders, zod: { z }, "@/db/schema": schema,
    "@/db": { getDb: () => { access.dbCalls++; return db; } },
    "@/lib/owner-auth": { requireOwner: async () => access.owner ? { email: "owner@example.com" } : null },
    "@/lib/same-origin": { hasValidOrigin: () => access.origin },
    "@/lib/inquiry-notes": notesConfig,
  });
  const context = (id = "1") => ({ params: Promise.resolve({ id }) });
  const request = (payload: unknown) => new Request("https://example.com/api/admin/inquiries/1/notes", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  return { sqlite, db, access, route, context, request };
}

test("notes require the verified owner and writes require a valid origin before accessing data", async () => {
  const f = await fixture();
  try {
    f.access.owner = false;
    assert.equal((await f.route.GET(new Request("https://example.com"), f.context())).status, 403);
    assert.equal((await f.route.POST(f.request({ id: crypto.randomUUID(), body: "Private note" }), f.context())).status, 403);
    f.access.owner = true; f.access.origin = false;
    assert.equal((await f.route.POST(f.request({ id: crypto.randomUUID(), body: "Private note" }), f.context())).status, 403);
    assert.equal(f.access.dbCalls, 0);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM inquiry_owner_notes").get()!.n, 0);
  } finally { f.sqlite.close(); }
});

test("saving a note records server time and owner, preserves the original inquiry, and survives reload", async () => {
  const f = await fixture();
  try {
    const before = Date.now();
    const id = crypto.randomUUID();
    const response = await f.route.POST(f.request({ id, body: "  Called about room options.\nFollow up Friday.  " }), f.context());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const { note } = await response.json() as { note: notesConfig.InquiryNote };
    assert.equal(note.id, id);
    assert.equal(note.body, "Called about room options.\nFollow up Friday.");
    assert.equal(note.createdBy, "owner@example.com");
    assert.ok(Date.parse(note.createdAt) >= before && Date.parse(note.createdAt) <= Date.now());
    const reload = await f.route.GET(new Request("https://example.com"), f.context());
    assert.equal(reload.headers.get("cache-control"), "private, no-store");
    assert.deepEqual((await reload.json() as { notes: notesConfig.InquiryNote[] }).notes, [note]);
    const inquiry = f.sqlite.prepare("SELECT notes, status, square_environment, square_deposit_invoice_status, automated_booking_status FROM booking_requests WHERE id=1").get()!;
    assert.deepEqual({ ...inquiry }, { notes: "Original customer message", status: "new", square_environment: "production", square_deposit_invoice_status: "not_created", automated_booking_status: "not_requested" });
  } finally { f.sqlite.close(); }
});

test("notes are isolated by inquiry and returned newest first", async () => {
  const f = await fixture();
  try {
    for (const [bookingRequestId, body, createdAt] of [[1, "Earlier", "2026-10-25T12:00:00.000Z"], [2, "Other customer", "2026-10-27T12:00:00.000Z"], [1, "Latest", "2026-10-26T12:00:00.000Z"]] as const) {
      await f.db.insert(schema.inquiryOwnerNotes).values({ id: crypto.randomUUID(), bookingRequestId, body, createdAt, createdBy: "owner@example.com" });
    }
    const response = await f.route.GET(new Request("https://example.com"), f.context());
    assert.deepEqual((await response.json() as { notes: notesConfig.InquiryNote[] }).notes.map((n) => n.body), ["Latest", "Earlier"]);
  } finally { f.sqlite.close(); }
});

test("retrying the same submission cannot duplicate or overwrite a saved note", async () => {
  const f = await fixture();
  try {
    const payload = { id: crypto.randomUUID(), body: "Discussed flights" };
    const first = await (await f.route.POST(f.request(payload), f.context())).json() as { note: notesConfig.InquiryNote };
    const retry = await (await f.route.POST(f.request(payload), f.context())).json() as { note: notesConfig.InquiryNote };
    assert.deepEqual(retry.note, first.note);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM inquiry_owner_notes").get()!.n, 1);
    assert.equal((await f.route.POST(f.request({ ...payload, body: "Changed" }), f.context())).status, 409);
    assert.equal((await f.route.POST(f.request(payload), f.context("2"))).status, 409);
    assert.equal(f.sqlite.prepare("SELECT body FROM inquiry_owner_notes").get()!.body, payload.body);
  } finally { f.sqlite.close(); }
});

test("invalid, oversized, forged and nonexistent inquiry submissions do not create notes", async () => {
  const f = await fixture();
  try {
    for (const payload of [null, [], {}, { id: "bad", body: "Note" }, { id: crypto.randomUUID(), body: "  " }, { id: crypto.randomUUID(), body: "a".repeat(5001) }, { id: crypto.randomUUID(), body: "Note", createdBy: "someone@example.com" }, { id: crypto.randomUUID(), body: "Note", createdAt: "2000-01-01" }]) {
      assert.equal((await f.route.POST(f.request(payload), f.context())).status, 400);
    }
    const malformed = new Request("https://example.com", { method: "POST", body: "{" });
    assert.equal((await f.route.POST(malformed, f.context())).status, 400);
    for (const id of ["0", "-1", "1e2", "1.5", "9007199254740992"]) assert.equal((await f.route.GET(new Request("https://example.com"), f.context(id))).status, 400);
    assert.equal((await f.route.POST(f.request({ id: crypto.randomUUID(), body: "Note" }), f.context("999"))).status, 404);
    assert.equal((await f.route.GET(new Request("https://example.com"), f.context("999"))).status, 404);
    assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS n FROM inquiry_owner_notes").get()!.n, 0);
  } finally { f.sqlite.close(); }
});

test("unavailable note storage returns a safe error without exposing database details", async () => {
  const f = await fixture();
  try {
    f.sqlite.exec("DROP TABLE inquiry_owner_notes");
    for (const response of [await f.route.GET(new Request("https://example.com"), f.context()), await f.route.POST(f.request({ id: crypto.randomUUID(), body: "Note" }), f.context())]) {
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.doesNotMatch(await response.text(), /SQL|table|inquiry_owner_notes/i);
    }
  } finally { f.sqlite.close(); }
});
