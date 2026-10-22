"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const PIXEL_ID = "7ZT5FMamVi8T66hkGRyYBc";
const CONSENT_KEY = "cp-travel-openai-measurement-consent";

type Choice = "granted" | "denied";
type Preference = Choice | null;
type PixelQueue = ((...args: unknown[]) => void) & { q: IArguments[] };

declare global {
  interface Window {
    oaiq?: (...args: unknown[]) => void;
  }
}

let consentGrantedThisPage = false;
let initialized = false;

function storedPreference(): Preference {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function initializePixel() {
  if (typeof window === "undefined" || !consentGrantedThisPage) return;

  if (!window.oaiq) {
    // Matches OpenAI's documented bootstrap queue so conversion calls made
    // before its asynchronous SDK finishes loading are not lost.
    const q = function () { q.q.push(arguments); } as PixelQueue;
    q.q = [];
    window.oaiq = q;

    const js = document.createElement("script");
    js.async = true;
    js.src = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
    document.head.appendChild(js);
  }

  window.oaiq("consent", true);
  if (!initialized) {
    window.oaiq("init", { pixelId: PIXEL_ID });
    initialized = true;
  }
}

function savePreference(choice: Choice) {
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    // The current page can still respect the visitor's choice if storage is blocked.
  }

  consentGrantedThisPage = choice === "granted";
  if (choice === "denied") {
    // Clear Pixel cookies after withdrawal and suppress all subsequent events.
    window.oaiq?.("consent", false);
  } else if (window.location.pathname === "/") {
    initializePixel();
  }
}

export function trackLeadCreated() {
  if (typeof window === "undefined" || !consentGrantedThisPage) return;
  window.oaiq?.("measure", "lead_created", { type: "customer_action" });
}

export function MeasurementConsentBanner() {
  const [preference, setPreference] = useState<Preference | "loading">("loading");

  useEffect(() => {
    const stored = storedPreference();
    setPreference(stored);
    consentGrantedThisPage = stored === "granted";
    if (stored === "granted") initializePixel();
  }, []);

  if (preference === "loading" || preference !== null) return null;

  const choose = (value: Choice) => {
    savePreference(value);
    setPreference(value);
  };

  return (
    <aside
      aria-label="Optional advertising measurement"
      className="fixed bottom-3 left-3 right-3 z-40 mx-auto max-w-3xl rounded-2xl border border-[var(--line)] bg-white p-4 shadow-2xl sm:bottom-5 sm:p-5"
    >
      <p className="text-sm font-bold text-[var(--ink)]">Optional advertising measurement</p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)] sm:text-sm">
        May we use the OpenAI Pixel to measure when ChatGPT advertisements lead to trip inquiries?
        It uses cookies for attribution. This is optional and does not affect your ability to book.
        Read our <Link href="/privacy" className="font-semibold underline">Privacy Policy</Link>.
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => choose("denied")} className="min-h-10 rounded-full border border-[var(--line)] px-5 text-sm font-semibold text-[var(--ink)]">
          Decline
        </button>
        <button type="button" onClick={() => choose("granted")} className="min-h-10 rounded-full bg-[var(--orange)] px-5 text-sm font-bold text-white">
          Allow measurement
        </button>
      </div>
    </aside>
  );
}

export function MeasurementPreferences() {
  const [preference, setPreference] = useState<Preference | "loading">("loading");

  useEffect(() => {
    setPreference(storedPreference());
  }, []);

  const choose = (value: Choice) => {
    savePreference(value);
    setPreference(value);
  };

  return (
    <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-5">
      <p className="text-sm font-semibold">
        Measurement preference: {preference === "loading" ? "Loading…" : preference === "granted" ? "Allowed" : preference === "denied" ? "Declined" : "Not selected"}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => choose("granted")} aria-pressed={preference === "granted"} className="min-h-10 rounded-full bg-[var(--orange)] px-5 text-sm font-bold text-white">
          Allow measurement
        </button>
        <button type="button" onClick={() => choose("denied")} aria-pressed={preference === "denied"} className="min-h-10 rounded-full border border-[var(--line)] px-5 text-sm font-semibold">
          Decline measurement
        </button>
      </div>
    </div>
  );
}
