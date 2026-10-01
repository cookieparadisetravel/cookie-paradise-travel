"use client";

import { useState } from "react";

const options = [
  ["new", "New"],
  ["contacted", "Follow-up sent"],
  ["qualified", "Ready to book"],
  ["waitlist", "Waitlist"],
  ["closed", "Closed"],
] as const;

export function StatusSelect({ id, initialStatus }: { id: number; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
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
    } catch {
      setStatus(previous);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-40">
      <label className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-ink)]" htmlFor={`inquiry-status-${id}`}>Stage</label>
      <select
        aria-label="Inquiry status"
        className="mt-1 w-full rounded-lg border border-[var(--input)] bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)]"
        disabled={saving}
        id={`inquiry-status-${id}`}
        value={status}
        onChange={(event) => update(event.target.value)}
      >
        {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <p aria-live="polite" className={`mt-1 text-xs font-semibold ${error ? "text-red-700" : "text-[var(--muted-ink)]"}`}>
        {saving ? "Saving…" : error ? "Could not save." : saved ? "Saved" : "Update after each follow-up."}
      </p>
    </div>
  );
}
