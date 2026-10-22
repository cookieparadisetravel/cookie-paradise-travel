import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as clickReference from "./openai-click-reference.ts";
import * as referrals from "./salon-referrals.ts";

type PixelModule = typeof import("./openai-pixel.ts");
type Command = ((...args: unknown[]) => void) & { q?: unknown[][] };
type Script = { src?: string; async?: boolean; onerror?: () => void; remove: () => void };
type Element = { type: string; props: { children?: unknown; onSubmit?: (event: unknown) => Promise<void> } };
const consentKey = "cp-travel-openai-measurement-consent";
const saved = () => ({ ok: true, bookingIntent: "needs_information", automationStatus: "not_requested" });

function load(file: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = vm.createContext({
    exports: {}, ...globals,
    require(name: string) {
      assert.ok(name in imports, `Unexpected test import: ${name}`);
      return imports[name];
    },
  });
  vm.runInContext(code, context, { filename: file });
  return context.exports;
}

// Separate VM modules model independent browser tabs. No SDK requests are made.
function browser(storage = new Map<string, string>(), pathname = "/") {
  const scripts: Script[] = [];
  const calls: unknown[][] = [];
  const cookieWrites: string[] = [];
  const handlers = new Map<string, Set<(event: { key?: string | null }) => void>>();
  let blocked = false;
  const window = {
    location: { pathname, hostname: "cookieparadisetravel.com" },
    localStorage: {
      getItem(key: string) { if (blocked) throw Error("Storage blocked"); return storage.get(key) ?? null; },
      setItem(key: string, value: string) { if (blocked) throw Error("Storage blocked"); storage.set(key, value); },
    },
    oaiq: undefined as Command | undefined,
    addEventListener(name: string, handler: (event: { key?: string | null }) => void) {
      const set = handlers.get(name) ?? new Set(); set.add(handler); handlers.set(name, set);
    },
    removeEventListener(name: string, handler: (event: { key?: string | null }) => void) { handlers.get(name)?.delete(handler); },
  };
  const document = {
    set cookie(value: string) { cookieWrites.push(value); },
    createElement() { return { remove() {} }; },
    head: { appendChild(script: Script) { scripts.push(script); } },
  };
  const pixel = load("lib/openai-pixel.ts", {}, { window, document }) as PixelModule;
  function loadSdk() {
    const queued = window.oaiq?.q ?? [];
    window.oaiq = (...args: unknown[]) => { calls.push(args); };
    for (const args of queued) window.oaiq(...args);
  }
  return {
    pixel, window, calls, scripts, cookieWrites, handlers, loadSdk,
    blockStorage() { blocked = true; },
    emit(name: string, event: { key?: string | null } = {}) { for (const handler of handlers.get(name) ?? []) handler(event); },
  };
}

function measures(tab: ReturnType<typeof browser>) { return tab.calls.filter(([command]) => command === "measure"); }

test("measurement remains off until explicit permission, including declined and malformed preferences", () => {
  for (const value of [null, "denied", "invalid"]) {
    const tab = browser(value === null ? new Map() : new Map([[consentKey, value]]));
    const unsubscribe = tab.pixel.subscribeToMeasurementPreference(() => {});
    tab.pixel.trackSavedInquiry(saved(), "needs_information");
    assert.equal(tab.scripts.length, 0);
    assert.equal(measures(tab).length, 0);
    tab.pixel.setMeasurementPreference("denied");
    assert.equal(tab.scripts.length, 0);
    unsubscribe();
    assert.equal([...tab.handlers.values()].reduce((sum, handlers) => sum + handlers.size, 0), 0);
  }
});

test("one confirmed saved inquiry sends one lead after consent, without contact or payment fields", () => {
  const tab = browser();
  tab.pixel.subscribeToMeasurementPreference(() => {});
  tab.pixel.setMeasurementPreference("granted");
  tab.loadSdk();
  const result = { ...saved(), email: "private@example.test", notes: "private notes" };
  tab.pixel.trackSavedInquiry(result, "needs_information");
  tab.pixel.trackSavedInquiry(result, "needs_information");
  assert.equal(tab.scripts.length, 1);
  assert.equal(tab.calls.filter(([command]) => command === "init").length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(measures(tab))), [
    ["measure", "lead_created", { type: "customer_action" }, { opt_out: true }],
  ]);
  assert.equal(JSON.stringify(measures(tab)).includes("private"), false);
});

test("ignored honeypots, failures, missing confirmations and intent mismatches are not leads", () => {
  const tab = browser(new Map([[consentKey, "granted"]]));
  tab.pixel.subscribeToMeasurementPreference(() => {});
  tab.loadSdk();
  for (const result of [null, {}, { ok: true }, { ok: false, bookingIntent: "needs_information" }, { error: "Unavailable" }, { ok: true, bookingIntent: "ready_to_book" }]) {
    tab.pixel.trackSavedInquiry(result, "needs_information");
  }
  tab.pixel.trackSavedInquiry(saved(), "");
  assert.equal(measures(tab).length, 0);
  tab.pixel.trackSavedInquiry({ ok: true, bookingIntent: "ready_to_book", automationStatus: "blocked" }, "ready_to_book");
  assert.equal(measures(tab).length, 1); // Saved inquiries are leads, not confirmed bookings.
});

test("withdrawal in another tab immediately gates events and updates existing subscribers", () => {
  const storage = new Map([[consentKey, "granted"]]);
  const trip = browser(storage);
  let notices = 0;
  trip.pixel.subscribeToMeasurementPreference(() => { notices++; });
  trip.loadSdk();
  const privacy = browser(storage, "/privacy");
  privacy.pixel.setMeasurementPreference("denied");
  // Simulate a submit before the browser delivers the asynchronous storage event.
  trip.pixel.trackSavedInquiry(saved(), "needs_information");
  assert.equal(measures(trip).length, 0);
  trip.emit("storage", { key: consentKey });
  assert.equal(notices, 1);
  assert.equal(trip.pixel.getMeasurementPreference(), "denied");
  assert.ok(trip.calls.some(([command, value]) => command === "consent" && value === false));
  assert.ok(privacy.cookieWrites.some(value => value.startsWith("__oppref=;")));
  assert.ok(privacy.cookieWrites.some(value => value.startsWith("__obref=;")));
  assert.equal(privacy.scripts.length, 0);
  privacy.pixel.setMeasurementPreference("granted");
  trip.emit("storage", { key: consentKey });
  trip.pixel.trackSavedInquiry(saved(), "needs_information");
  assert.equal(measures(trip).length, 1);
  assert.equal(trip.calls.filter(([command]) => command === "init").length, 1);
});

test("withdrawal discards lead events queued before the asynchronous SDK finishes loading", () => {
  const storage = new Map([[consentKey, "granted"]]);
  const trip = browser(storage);
  trip.pixel.subscribeToMeasurementPreference(() => {});
  trip.pixel.trackSavedInquiry(saved(), "needs_information");
  assert.ok(trip.window.oaiq?.q?.some(([command]) => command === "measure"));
  browser(storage, "/privacy").pixel.setMeasurementPreference("denied");
  trip.emit("storage", { key: consentKey });
  trip.loadSdk();
  assert.equal(measures(trip).length, 0);
  assert.deepEqual(trip.calls[0], ["consent", false]);
  trip.pixel.setMeasurementPreference("granted");
  assert.equal(measures(trip).length, 0); // Suppressed leads are never replayed.
});

test("cleared storage and restored/focused tabs recheck the current consent", () => {
  const storage = new Map([[consentKey, "granted"]]);
  const tab = browser(storage);
  tab.pixel.subscribeToMeasurementPreference(() => {});
  tab.loadSdk();
  storage.clear();
  tab.emit("storage", { key: null });
  tab.emit("pageshow");
  tab.emit("focus");
  assert.equal(tab.pixel.getMeasurementPreference(), null);
  tab.pixel.trackSavedInquiry(saved(), "needs_information");
  assert.equal(measures(tab).length, 0);
});

test("blocked browser storage respects only the current tab's explicit choice", () => {
  const tab = browser();
  tab.blockStorage();
  tab.pixel.subscribeToMeasurementPreference(() => {});
  tab.pixel.trackSavedInquiry(saved(), "needs_information");
  assert.equal(tab.scripts.length, 0);
  tab.pixel.setMeasurementPreference("granted");
  tab.loadSdk();
  tab.pixel.trackSavedInquiry(saved(), "needs_information");
  assert.equal(measures(tab).length, 1);
  tab.pixel.setMeasurementPreference("denied");
  tab.pixel.trackSavedInquiry(saved(), "needs_information");
  assert.equal(measures(tab).length, 1);
});

test("SDK failures are swallowed, and withdrawal clears cookies even if the SDK throws", () => {
  const tab = browser(new Map([[consentKey, "granted"]]));
  tab.pixel.subscribeToMeasurementPreference(() => {});
  tab.loadSdk();
  tab.window.oaiq = () => { throw Error("SDK failure"); };
  assert.doesNotThrow(() => tab.pixel.trackSavedInquiry(saved(), "needs_information"));
  assert.doesNotThrow(() => tab.pixel.setMeasurementPreference("denied"));
  assert.equal(tab.pixel.getMeasurementPreference(), "denied");
  assert.ok(tab.cookieWrites.some(value => value.startsWith("__obref=;")));
});

test("failed SDK downloads can retry without replaying an earlier inquiry", () => {
  const tab = browser(new Map([[consentKey, "granted"]]));
  tab.pixel.subscribeToMeasurementPreference(() => {});
  tab.pixel.trackSavedInquiry(saved(), "needs_information");
  tab.scripts[0].onerror?.();
  assert.equal(tab.window.oaiq, undefined);
  tab.pixel.trackSavedInquiry(saved(), "needs_information");
  tab.loadSdk();
  assert.equal(tab.scripts.length, 2);
  assert.equal(measures(tab).length, 1);
});

test("SSR, the privacy page and private booking links never load the SDK or track inquiries", () => {
  const server = load("lib/openai-pixel.ts", {}) as PixelModule;
  assert.equal(server.getMeasurementPreference(), null);
  assert.equal(server.getServerMeasurementPreference(), "loading");
  assert.doesNotThrow(() => server.trackSavedInquiry(saved(), "needs_information"));
  for (const path of ["/privacy", "/traveler-agreement/token", "/traveler-list/token", "/payment-preference/token", "/autopay-authorization/token", "/admin/inquiries"]) {
    const tab = browser(new Map([[consentKey, "granted"]]), path);
    tab.pixel.subscribeToMeasurementPreference(() => {});
    tab.pixel.trackSavedInquiry(saved(), "needs_information");
    assert.equal(tab.scripts.length, 0, path);
    assert.equal(measures(tab).length, 0, path);
  }
});

const element = (type: string, props: Element["props"]): Element => ({ type, props });
function findForm(value: unknown): Element | undefined {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) return value.map(findForm).find(Boolean);
  const node = value as Element;
  return node.type === "form" ? node : findForm(node.props?.children);
}

test("an SDK exception cannot change a successfully saved inquiry into an error", async () => {
  const tab = browser(new Map([[consentKey, "granted"]]));
  tab.pixel.subscribeToMeasurementPreference(() => {});
  tab.loadSdk();
  tab.window.oaiq = () => { throw Error("SDK failure"); };
  let stateIndex = 0;
  const statuses: string[] = [];
  const imports: Record<string, unknown> = {
    react: {
      useState(initial: unknown) {
        const index = stateIndex++;
        const value = index === 7 ? "needs_information" : index === 12 ? "test-turnstile-token" : initial;
        return [value, (next: string) => { if (index === 1) statuses.push(next); }];
      },
      useEffect() {}, useRef: () => ({ current: null }), useCallback: (fn: unknown) => fn,
    },
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "lucide-react": {}, "@/components/ui/dialog": {}, "@/components/ui/select": {}, "./referral-brand": {},
    "@/lib/consultation": { consultationBookingUrl: "https://example.test/consultation" },
    "@/lib/openai-pixel": tab.pixel,
  };
  const fields: Record<string, string> = { firstName: "Test", lastName: "Traveler", email: "test@example.test", phone: "555-0100", website: "", notes: "" };
  let submissions = 0;
  const dialog = load("app/components/booking-dialog.tsx", imports, {
    process: { env: {} },
    FormData: class { get(key: string) { return fields[key] ?? null; } },
    fetch: async () => { submissions++; return { ok: true, json: async () => saved() }; },
  });
  const form = findForm(dialog.BookingDialog({ triggerLabel: "Test" }));
  assert.ok(form?.props.onSubmit);
  await form.props.onSubmit({ preventDefault() {}, currentTarget: { elements: { namedItem: () => ({ validity: { valid: true } }) } } });
  assert.equal(submissions, 1);
  assert.deepEqual(statuses, ["saving", "success"]);
});

test("ad click references survive both partner redirect hops without changing the referral cookie", async () => {
  let redirected = "";
  const home = load("app/page.tsx", {
    "react/jsx-runtime": { jsx: element, jsxs: element }, "lucide-react": {},
    "./components/booking-dialog": {}, "./components/measurement-consent": {}, "./components/mobile-book-bar": {},
    "next/headers": {}, "next/navigation": { redirect: (url: string) => { redirected = url; throw Error("redirect"); } },
    "@/lib/openai-click-reference": clickReference, "@/lib/salon-referrals": referrals,
    "./components/referral-brand": {}, "@/lib/public-trip-availability": {}, "@/lib/trip-availability": {}, "./components/trip-availability": {},
  });
  const route = load("app/r/[code]/route.ts", {
    "@/lib/openai-click-reference": clickReference, "@/lib/salon-referrals": referrals,
  }, { Response, URL });
  const reference = "test+/=% &unicode-ấ";
  for (const partner of referrals.salonPartners) {
    await assert.rejects(home.default({ searchParams: Promise.resolve({ ref: partner.code, oppref: reference }) }), /redirect/u);
    assert.equal(new URL(redirected, "https://example.test").searchParams.get("oppref"), reference);
    const response = await route.GET(new Request(new URL(redirected, "https://example.test")), { params: Promise.resolve({ code: partner.code }) }) as Response;
    assert.equal(response.status, 303);
    assert.equal(new URL(response.headers.get("location")!).searchParams.get("oppref"), reference);
    assert.equal(new URL(response.headers.get("location")!).origin, "https://example.test");
    assert.match(response.headers.get("set-cookie")!, new RegExp(`${referrals.REFERRAL_COOKIE}=${partner.code};`));
    assert.match(response.headers.get("set-cookie")!, /HttpOnly; SameSite=Lax; Secure/u);
  }
  for (const value of [null, undefined, "", "x".repeat(2049), ["ambiguous"]]) {
    assert.equal(clickReference.withOpenAIClickReference("/", value), "/");
  }
  const unknown = await route.GET(new Request("https://example.test/r/unknown?oppref=test"), { params: Promise.resolve({ code: "unknown" }) }) as Response;
  assert.equal(unknown.status, 404);
});
