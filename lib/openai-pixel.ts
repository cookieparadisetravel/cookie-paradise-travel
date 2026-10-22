// Public website identifier, not an API key. Never put Ads/CAPI secrets here.
const PIXEL_ID = "7ZT5FMamVi8T66hkGRyYBc";
export const measurementConsentStorageKey = "cp-travel-openai-measurement-consent";
export type MeasurementPreference = "granted" | "denied" | null;

type PixelCommand = (...args: unknown[]) => void;
type PixelQueue = PixelCommand & { q: unknown[][] };

declare global {
  interface Window { oaiq?: PixelCommand }
}

const listeners = new Set<() => void>();
const measuredResponses = new WeakSet<object>();
let memoryPreference: MeasurementPreference = null;
let memoryOnly = false;
let initialized = false;
let pendingQueue: PixelQueue | undefined;

export function getMeasurementPreference(): MeasurementPreference {
  if (typeof window === "undefined") return null;
  if (memoryOnly) return memoryPreference;
  try {
    const value = window.localStorage.getItem(measurementConsentStorageKey);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return memoryPreference;
  }
}

export function getServerMeasurementPreference() { return "loading" as const; }

function clearMeasurementCookies() {
  for (const name of ["__oppref", "__obref"]) {
    const expiry = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    document.cookie = expiry;
    document.cookie = `${expiry}; Domain=${window.location.hostname}`;
  }
}

function synchronizePixel() {
  if (typeof window === "undefined") return;
  try {
    if (getMeasurementPreference() !== "granted") {
      try {
        if (pendingQueue && window.oaiq === pendingQueue) {
          // Withdrawal must also suppress leads waiting for the async SDK.
          pendingQueue.q = [["consent", false], ...pendingQueue.q.filter(([command]) => command === "init")];
        } else {
          window.oaiq?.("consent", false);
        }
      } finally {
        clearMeasurementCookies();
      }
      return;
    }
    // The SDK belongs only on the public trip page, never on private forms.
    if (window.location.pathname !== "/") return;

    if (!window.oaiq) {
      const queue: PixelQueue = Object.assign(
        (...args: unknown[]) => { queue.q.push(args); },
        { q: [] as unknown[][] },
      );
      pendingQueue = queue;
      window.oaiq = queue;
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
      script.onerror = () => {
        if (window.oaiq === queue) {
          delete window.oaiq;
          initialized = false;
          pendingQueue = undefined;
        }
        script.remove();
      };
      document.head.appendChild(script);
    }
    window.oaiq("consent", true);
    if (!initialized) {
      window.oaiq("init", { pixelId: PIXEL_ID });
      initialized = true;
    }
  } catch {
    // Advertising measurement must never interrupt an inquiry or a consent choice.
  }
}

function refreshPreference() {
  synchronizePixel();
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== measurementConsentStorageKey) return;
  // Read the latest value rather than replaying possibly stale storage events.
  memoryOnly = false;
  memoryPreference = null;
  refreshPreference();
}

export function subscribeToMeasurementPreference(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  if (listeners.size === 0) {
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refreshPreference);
    window.addEventListener("pageshow", refreshPreference);
  }
  listeners.add(listener);
  synchronizePixel();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refreshPreference);
      window.removeEventListener("pageshow", refreshPreference);
    }
  };
}

export function setMeasurementPreference(choice: "granted" | "denied") {
  memoryPreference = choice;
  try {
    window.localStorage.setItem(measurementConsentStorageKey, choice);
    memoryOnly = false;
  } catch {
    // Respect the current tab's explicit choice even if storage is unavailable.
    memoryOnly = true;
  }
  refreshPreference();
}

export function trackSavedInquiry(result: unknown, submittedIntent: string) {
  try {
    if (typeof window === "undefined" || window.location.pathname !== "/") return;
    if (submittedIntent !== "needs_information" && submittedIntent !== "ready_to_book") return;
    if (!result || typeof result !== "object"
      || !("ok" in result) || result.ok !== true
      || !("bookingIntent" in result) || result.bookingIntent !== submittedIntent) return;

    // Recheck storage on every event; a different tab may just have revoked consent.
    synchronizePixel();
    if (getMeasurementPreference() !== "granted" || !initialized || !window.oaiq) return;
    if (measuredResponses.has(result)) return;
    measuredResponses.add(result);
    window.oaiq("measure", "lead_created", { type: "customer_action" }, { opt_out: true });
  } catch {
    // A saved inquiry stays successful if the SDK or its browser APIs fail.
  }
}
