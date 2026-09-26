"use client";

import { useState } from "react";

const options = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["qualified", "Qualified"],
  ["waitlist", "Waitlist"],
  ["closed", "Closed"],
] as const;

export function StatusSelect({ id, initialStatus }: { id: number; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function update(nextStatus: string) {
    const previous = status;
    setStatus(nextStatus);
    setSaving(true);
    setError(false);
    try {
      const response = await fetch(`/api/admin/inquiries/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error("Status update failed");
    } catch {
      setStatus(previous);
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <select
        aria-label="Inquiry status"
        className="rounded-lg border border-[var(--input)] bg-white px-3 py-2 text-sm font-semibold text-[var(--ink)]"
        disabled={saving}
        value={status}
        onChange={(event) => update(event.target.value)}
      >
        {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      {error && <p className="mt-1 text-xs text-red-700">Could not save.</p>}
    </div>
  );
}
