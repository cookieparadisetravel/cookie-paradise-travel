import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { Miniflare } from "miniflare";

test("real Workers Request accepts both search adapters and redirects never forward credentials", async () => {
  const source = readFileSync(new URL("./web-prospect-service.ts", import.meta.url), "utf8");
  const parsed = ts.createSourceFile("service.ts", source, ts.ScriptTarget.ESNext, true);
  const adapter = parsed.statements.find(s => ts.isFunctionDeclaration(s) && s.name?.text === "searchWeb");
  assert.ok(adapter, "The runtime test must execute the production search adapter");
  const code = ts.transpileModule(adapter.getText(parsed), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const runtime = new Miniflare({
    modules: true,
    // Pinned to the local workerd binary; production uses a newer compatibility date.
    compatibilityDate: "2026-05-22",
    script: `
      const env = {TAVILY_API_KEY: "test-tavily", BRAVE_SEARCH_API_KEY: "test-brave"};
      class ProspectError extends Error {}
      let mode, calls;
      globalThis.fetch = async (input, init) => {
        calls++;
        // Unlike Node's Request, this real workerd constructor rejects redirect:error.
        const request = new Request(input, init);
        if (request.redirect !== "manual") throw new Error("Unsafe redirect handling");
        if (mode === "redirect") return new Response(null, {status: 307, headers: {Location: "https://untrusted.example"}});
        if (mode === "timeout") throw new DOMException("Sensitive provider details", "TimeoutError");
        if (mode === "network") throw new TypeError("Sensitive connection details");
        return Response.json(new URL(request.url).hostname === "api.tavily.com"
          ? {results: [{url: "https://example.com/trip", title: "Vietnam 2027", content: "We are planning a trip"}]}
          : {web: {results: [{url: "https://example.com/trip", title: "Vietnam 2027", description: "We are planning a trip"}]}});
      };
      ${code}
      export default {async fetch(request) {
        const params = new URL(request.url).searchParams;
        mode = params.get("mode"); calls = 0;
        try { return Response.json({results: await searchWeb("Vietnam 2027 trip", params.get("provider")), calls}); }
        catch (error) { return Response.json({error: error.message, calls}); }
      }};
    `,
  });
  try {
    for (const provider of ["brave", "tavily"]) {
      const run = async (mode: string) => (await runtime.dispatchFetch(`https://test.example/?provider=${provider}&mode=${mode}`)).json() as Promise<{ results?: unknown[]; error?: string; calls: number }>;
      const success = await run("success");
      assert.equal(success.error, undefined);
      assert.equal(success.results?.length, 1);
      const redirect = await run("redirect");
      assert.match(redirect.error!, /unexpected redirect/);
      assert.equal(redirect.calls, 1);
      assert.match((await run("timeout")).error!, /timed out after 15 seconds/);
      const network = await run("network");
      assert.match(network.error!, /could not be reached/);
      assert.doesNotMatch(network.error!, /Sensitive/);
    }
  } finally { await runtime.dispose(); }
});
