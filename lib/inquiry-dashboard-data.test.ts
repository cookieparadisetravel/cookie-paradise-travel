import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as sqlBuilders from "drizzle-orm";
import * as schema from "../db/schema.ts";
import { todayInIndiana } from "./payment-schedule.ts";
import { getSquareBookingEnvironmentError } from "./square-config.ts";
import type { AgreementReadiness } from "./agreement-readiness";
import type { DashboardInquiry } from "../app/admin/inquiries/dashboard-types";

type Stubs = Record<string, Record<string, unknown>>;

// Exercise the real dashboard SQL against an isolated database, without Cloudflare or emails.
async function loadModule(file: string, stubs: Stubs): Promise<Record<string, unknown>> {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const key = `__inquiryDashboardTest_${crypto.randomUUID()}`;
  const globals = globalThis as unknown as Record<string, unknown>;
  globals[key] = stubs;
  let code = outputText;
  const parsed = ts.createSourceFile(file, outputText, ts.ScriptTarget.ESNext, true);
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    const bindings = statement.importClause?.namedBindings;
    assert.ok(bindings && ts.isNamedImports(bindings));
    const exports = bindings.elements.map((binding) => {
      const name = (binding.propertyName ?? binding.name).text;
      return `export const ${name} = stub[${JSON.stringify(name)}];`;
    }).join("\n");
    const stubCode = `const stub = globalThis[${JSON.stringify(key)}][${JSON.stringify(specifier)}];\n${exports}`;
    code = code.replace(JSON.stringify(specifier), JSON.stringify(`data:text/javascript;base64,${Buffer.from(stubCode).toString("base64")}`));
  }
  try {
    return await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  } finally {
    delete globals[key];
  }
}

async function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  const directory = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  }
  const queries: { sql: string; rowCount: number }[] = [];
  const db = drizzle(async (query, params, method) => {
    const statement = sqlite.prepare(query);
    if (method === "run") {
      statement.run(...params);
      return { rows: [] };
    }
    statement.setReturnArrays(true);
    const rows = method === "get"
      ? statement.get(...params) as unknown as unknown[]
      : statement.all(...params) as unknown as unknown[][];
    queries.push({ sql: query, rowCount: rows?.length ?? 0 });
    return { rows };
  });
  await db.insert(schema.bookingRequests).values([
    { id: 1, tripSlug: "test", fullName: "Sandbox Test", email: "sandbox@example.com", departure: "2027-06-01", roomPreference: "shared", partySize: 2, squareEnvironment: "sandbox" },
    { id: 2, tripSlug: "test", fullName: "Production Test", email: "production@example.com", departure: "2027-06-01", roomPreference: "shared", partySize: 1, squareEnvironment: "production" },
  ]);
  await db.insert(schema.travelers).values([
    { id: 1, bookingRequestId: 1, firstName: "First", lastName: "Test", email: "first@example.com" },
    { id: 2, bookingRequestId: 1, firstName: "Second", lastName: "Test", email: "second@example.com" },
    { id: 3, bookingRequestId: 2, firstName: "Third", lastName: "Test", email: "third@example.com" },
  ]);
  const sentAt = "2026-10-09T12:00:00.000Z";
  await db.insert(schema.agreementInvitations).values([1, 2, 3].map((id) => ({
    id,
    travelerId: id,
    tokenHash: `agreement-token-${id}`,
    agreementVersion: "test-version",
    agreementDocumentHash: `hash-${id}`,
    agreementDocumentJson: JSON.stringify({ document: "large stored agreement ".repeat(20_000) }),
    recipientEmail: `traveler-${id}@example.com`,
    invitationEmailSentAt: sentAt,
    expiresAt: "2099-01-01T00:00:00.000Z",
    createdAt: sentAt,
  })));
  await db.insert(schema.agreementAcceptances).values({
    invitationId: 3,
    travelerId: 3,
    agreementVersion: "test-version",
    agreementDocumentHash: "hash-3",
    signerType: "adult",
    signerLegalName: "Third Test",
    travelerInitials: "TT",
    electronicSignatureConsent: true,
    agreementConsent: true,
    depositAcknowledged: true,
    cancellationAcknowledged: true,
    insuranceSelection: "purchase",
    ipHash: "test-hash",
    userAgent: "test",
    acceptedAt: sentAt,
  });
  for (const id of [1, 2]) {
    await db.insert(schema.travelerListInvitations).values({ bookingRequestId: id, tokenHash: `traveler-token-${id}`, expiresAt: "2099-01-01T00:00:00.000Z", createdAt: sentAt });
    await db.insert(schema.paymentPreferenceInvitations).values({ bookingRequestId: id, tokenHash: `payment-token-${id}`, expiresAt: "2099-01-01T00:00:00.000Z", createdAt: sentAt });
  }
  const stubs: Stubs = {
    "cloudflare:workers": { env: { SQUARE_ENV: "production" } },
    "drizzle-orm": sqlBuilders,
    "@/db": { getDb: () => db },
    "@/db/schema": schema,
    "@/lib/payment-schedule": { todayInIndiana },
    "@/lib/traveler-agreement": { currentTravelerAgreement: { version: "test-version" } },
    "@/lib/square-config": { getSquareBookingEnvironmentError },
  };
  const readinessModule = await loadModule("lib/agreement-readiness.ts", stubs);
  const readinessCalls: number[] = [];
  const getReadiness = readinessModule.getAgreementReadiness as (id: number, partySize: number) => Promise<AgreementReadiness>;
  stubs["@/lib/agreement-readiness"] = {
    getAgreementReadiness: async (id: number, partySize: number) => {
      readinessCalls.push(id);
      return getReadiness(id, partySize);
    },
  };
  const dashboardModule = await loadModule("app/admin/inquiries/dashboard-data.ts", stubs);
  const load = dashboardModule.loadInquiryDashboardData as (id?: number) => Promise<{ inquiries: DashboardInquiry[] }>;
  return { sqlite, queries, readinessCalls, load };
}

test("inquiry detail loads only its booking, related records and agreement readiness", async () => {
  const { sqlite, queries, readinessCalls, load } = await fixture();
  try {
    const { inquiries } = await load(2);
    assert.deepEqual(inquiries.map((row) => row.id), [2]);
    assert.deepEqual(inquiries[0].travelers.map((row) => row.id), [3]);
    assert.deepEqual(readinessCalls, [2]);
    assert.deepEqual(inquiries[0].acceptedTravelerIds, [3]);
    assert.equal(inquiries[0].agreementReady, true);
    assert.equal(inquiries[0].paymentEnvironmentError, null);
    assert.deepEqual(Object.keys(inquiries[0].agreementInvitationDeliveries), ["3"]);
    assert.equal(inquiries[0].latestPaymentChoiceInvitation?.usable, true);
    assert.equal(queries.length, 7);
    assert.ok(queries.every((query) => query.rowCount <= 1));
  } finally { sqlite.close(); }
});

test("scoped detail preserves the list's agreement and payment safeguards", async () => {
  const { sqlite, load } = await fixture();
  try {
    const all = (await load()).inquiries;
    assert.equal(all.length, 2);
    for (const inquiry of all) {
      const detail = (await load(inquiry.id)).inquiries[0];
      assert.deepEqual(detail, inquiry);
    }
    const sandbox = all.find((inquiry) => inquiry.id === 1)!;
    assert.equal(sandbox.agreementReady, false);
    assert.match(sandbox.paymentEnvironmentError!, /Sandbox testing/u);
    assert.equal(sandbox.latestPaymentChoiceInvitation?.usable, false);
  } finally { sqlite.close(); }
});

test("missing inquiry returns no records and does not check unrelated agreements", async () => {
  const { sqlite, readinessCalls, load } = await fixture();
  try {
    assert.deepEqual((await load(999)).inquiries, []);
    assert.deepEqual(readinessCalls, []);
  } finally { sqlite.close(); }
});

test("dashboard queries return delivery metadata without transferring stored agreement documents", async () => {
  const { sqlite, queries, load } = await fixture();
  try {
    await load();
    const query = queries.find((entry) => entry.sql.includes('from "agreement_invitations"') && !entry.sql.includes("join"));
    assert.ok(query);
    const rows = sqlite.prepare(query.sql).all();
    assert.equal(rows.length, 3);
    for (const row of rows) {
      assert.equal(row.agreement_document_json, undefined);
      assert.equal(row.token_hash, undefined);
      assert.ok(JSON.stringify(row).length < 1000);
    }
  } finally { sqlite.close(); }
});
