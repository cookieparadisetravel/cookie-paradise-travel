import assert from "node:assert/strict";
import test from "node:test";
import { loadModule } from "../test-support/lead-fixture.ts";

const input = { firstName: "Alex", lastName: "Morgan Lee", email: "alex@example.test" };
const moduleWith = (runtime: Record<string, string>) => loadModule<{
  addConsentedSubscriber(subscriber: typeof input, options?: { groupName?: string }): Promise<string>;
}>("lib/mailerlite.ts", { "cloudflare:workers": { env: runtime } });

test("guide sync uses the exact Interest List group, keeps names, and never forces resubscription", async () => {
  const service = await moduleWith({ MAILERLITE_API_TOKEN: "test-only", MAILERLITE_GROUP_ID: "99" });
  const calls: { url: URL; init?: RequestInit }[] = [];
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: new URL(String(url)), init });
      return calls.length === 1
        ? Response.json({ data: [{ id: "1", name: "Interest List Archive" }, { id: "2", name: "Interest List" }] })
        : Response.json({ data: { id: "3", status: "unconfirmed" } }, { status: 201 });
    };
    assert.equal(await service.addConsentedSubscriber(input, { groupName: "Interest List" }), "synced");
    assert.equal(calls[0].url.searchParams.get("filter[name]"), "Interest List");
    const sent = JSON.parse(String(calls[1].init?.body));
    assert.deepEqual(sent.groups, ["2"]);
    assert.deepEqual(sent.fields, { name: "Alex", last_name: "Morgan Lee" });
    assert.equal(sent.resubscribe, false);
    assert.equal(sent.status, undefined);
  } finally { globalThis.fetch = original; }
});

test("missing or ambiguous Interest List never falls back to the booking group", async () => {
  const service = await moduleWith({ MAILERLITE_API_TOKEN: "test-only", MAILERLITE_GROUP_ID: "99" });
  const original = globalThis.fetch;
  try {
    for (const groups of [[{ id: "1", name: "Interest List Archive" }], [{ id: "1", name: "Interest List" }, { id: "2", name: "Interest List" }]]) {
      let calls = 0;
      globalThis.fetch = async () => { calls++; return Response.json({ data: groups }); };
      assert.equal(await service.addConsentedSubscriber(input, { groupName: "Interest List" }), "not_configured");
      assert.equal(calls, 1);
    }
    globalThis.fetch = async () => { throw new Error("No token must not make network requests"); };
    assert.equal(await (await moduleWith({})).addConsentedSubscriber(input, { groupName: "Interest List" }), "not_configured");
  } finally { globalThis.fetch = original; }
});

test("the existing booking integration keeps its configured group and reports provider failures", async () => {
  const service = await moduleWith({ MAILERLITE_API_TOKEN: "test-only", MAILERLITE_GROUP_ID: "99" });
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "https://connect.mailerlite.com/api/subscribers");
      assert.deepEqual(JSON.parse(String(init?.body)).groups, ["99"]);
      return Response.json({}, { status: 422 });
    };
    assert.equal(await service.addConsentedSubscriber(input), "error");
    globalThis.fetch = async () => Response.json({}, { status: 401 });
    assert.equal(await service.addConsentedSubscriber(input, { groupName: "Interest List" }), "error");
  } finally { globalThis.fetch = original; }
});
