import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";

export async function loadModule<T>(file: string, stubs: Record<string, Record<string, unknown>>): Promise<T> {
  let code = ts.transpileModule(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const key = `__leadTest_${crypto.randomUUID()}`;
  const globals = globalThis as unknown as Record<string, unknown>;
  globals[key] = stubs;
  for (const statement of ts.createSourceFile(file, code, ts.ScriptTarget.ESNext, true).statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    assert.ok(bindings && ts.isNamedImports(bindings), "Test loader expects named imports");
    assert.ok(stubs[statement.moduleSpecifier.text], `Missing stub: ${statement.moduleSpecifier.text}`);
    const exports = bindings.elements.map(binding => `export const ${binding.name.text} = stub[${JSON.stringify((binding.propertyName ?? binding.name).text)}];`).join("\n");
    const stub = `const stub=globalThis[${JSON.stringify(key)}][${JSON.stringify(statement.moduleSpecifier.text)}];${exports}`;
    code = code.replace(JSON.stringify(statement.moduleSpecifier.text), JSON.stringify(`data:text/javascript;base64,${Buffer.from(stub).toString("base64")}`));
  }
  try { return await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`); }
  finally { delete globals[key]; }
}

type Bound = string | number | null;
type Statement = { bind(...values: Bound[]): Statement; all(): Promise<{ results: unknown[] }>; first(): Promise<unknown>; run(): Promise<unknown>; execute(): unknown[] };
export function databaseFixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  const directory = new URL("../drizzle/", import.meta.url);
  for (const file of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  const db = {
    prepare(sql: string): Statement {
      let params: Bound[] = [];
      const statement: Statement = {
        bind(...values) { params = values; return statement; },
        async all() { return { results: sqlite.prepare(sql).all(...params) }; },
        async first() { return sqlite.prepare(sql).get(...params) ?? null; },
        async run() { return sqlite.prepare(sql).run(...params); },
        execute() { const prepared = sqlite.prepare(sql); if (prepared.columns().length) return prepared.all(...params); prepared.run(...params); return []; },
      };
      return statement;
    },
    async batch(statements: Statement[]) {
      sqlite.exec("BEGIN");
      try { const results = statements.map(statement => ({ results: statement.execute() })); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  return { sqlite, db };
}
