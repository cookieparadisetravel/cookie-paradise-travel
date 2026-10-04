"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inquiryStageOptions, normalizeInquiryStage } from "@/lib/inquiry-stage";

export function StatusSelect({ compact = false, id, initialStatus }: { compact?: boolean; id: number; initialStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(() => normalizeInquiryStage(initialStatus));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);

  async function update(nextStatus: string) {
    const previous = status;
    setStatus(nextStatus);
    setSaving(true);
    setError(false);
    setSaved(false);
    try {
      const response = await fetch(`/api/admin/inquiries/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("Status update failed");
      setSaved(true);
      router.refresh();
    } catch {
      setStatus(previous);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={compact ? "inline-block" : "min-w-40"}>
      <label className={compact ? "sr-only" : "block text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-ink)]"} htmlFor={`inquiry-status-${id}`}>Stage</label>
      <select
        aria-describedby={compact ? `inquiry-status-note-${id}` : undefined}
        aria-label="Inquiry stage"
        className={compact
          ? "h-8 w-auto max-w-[9.5rem] rounded-full border border-[#d99a3b] bg-[var(--gold)] px-3 py-0 text-sm font-extrabold leading-none text-[var(--ink)] shadow-sm hover:bg-[#ffc56c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/50"
          : "mt-1 w-full rounded-lg border border-[var(--input)] bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/40"}
        disabled={saving}
        id={`inquiry-status-${id}`}
        title={compact ? "Manual sales stage; this does not prove agreement or payment completion." : undefined}
        value={status}
        onChange={(event) => update(event.target.value)}
      >
        {inquiryStageOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <p aria-live="polite" className={`${compact ? "sr-only" : "mt-1 text-xs"} font-semibold ${error ? "text-red-700" : "text-[var(--muted-ink)]"}`} id={compact ? `inquiry-status-note-${id}` : undefined}>
        {saving ? "Saving…" : error ? "Could not save." : saved ? "Saved" : compact ? "Manual stage only" : "Update after each follow-up."}
      </p>
    </div>
  );
}
