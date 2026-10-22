"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  getMeasurementPreference, getServerMeasurementPreference, setMeasurementPreference,
  subscribeToMeasurementPreference, type MeasurementPreference,
} from "@/lib/openai-pixel";

function useMeasurementPreference() {
  return useSyncExternalStore<MeasurementPreference | "loading">(
    subscribeToMeasurementPreference, getMeasurementPreference, getServerMeasurementPreference,
  );
}

function PreferenceButtons({ preference }: { preference: MeasurementPreference | "loading" }) {
  return (
    <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" onClick={() => setMeasurementPreference("denied")} aria-pressed={preference === "denied"} className="min-h-10 rounded-full border border-[var(--line)] px-5 text-sm font-semibold text-[var(--ink)]">
        Decline measurement
      </button>
      <button type="button" onClick={() => setMeasurementPreference("granted")} aria-pressed={preference === "granted"} className="min-h-10 rounded-full bg-[var(--orange)] px-5 text-sm font-bold text-white">
        Allow measurement
      </button>
    </div>
  );
}

export function MeasurementConsentBanner() {
  const preference = useMeasurementPreference();
  if (preference !== null) return null;
  return (
    <aside aria-label="Optional advertising measurement" className="fixed bottom-3 left-3 right-3 z-[45] mx-auto max-w-3xl rounded-2xl border border-[var(--line)] bg-white p-4 shadow-2xl sm:bottom-5 sm:p-5">
      <p className="text-sm font-bold text-[var(--ink)]">Optional advertising measurement</p>
      <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)] sm:text-sm">
        May we use cookies and the OpenAI Pixel to measure whether ChatGPT ads lead to trip inquiries?
        You can decline and still make an inquiry or book. Change your choice in our <Link href="/privacy" className="font-semibold underline">Privacy Policy</Link>.
      </p>
      <PreferenceButtons preference={preference} />
    </aside>
  );
}

export function MeasurementPreferences() {
  const preference = useMeasurementPreference();
  return (
    <div className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-5">
      <p className="text-sm font-semibold" aria-live="polite">
        Measurement preference: {preference === "loading" ? "Loading…" : preference === "granted" ? "Allowed" : preference === "denied" ? "Declined" : "Not selected"}
      </p>
      <PreferenceButtons preference={preference} />
    </div>
  );
}
