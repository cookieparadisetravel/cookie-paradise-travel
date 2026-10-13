"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReferralControl({ code, startDate, travelerId, successful, qualifiedOn, today }: {
  code?: string; startDate?: string; travelerId?: number; successful?: boolean; qualifiedOn?: string; today: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      const body = code ? { action: "pilot", code, materialsReceivedOn: form.get("date") }
        : { action: "completion", travelerId, successful: !successful, qualifiedOn: form.get("date"), tripCompletedAndNotRefunded: form.get("confirm") === "on" };
      const response = await fetch("/api/admin/referrals", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not save.");
      setMessage("Saved."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-3">
    {(code || !successful) && <label className="block text-sm font-semibold">{code ? "Materials received on" : "Agreement and deposit qualified on"}
      <input name="date" type="date" max={today} defaultValue={startDate ?? qualifiedOn ?? ""} required className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3" />
    </label>}
    {!code && !successful && <label className="flex items-start gap-2 text-sm leading-6"><input name="confirm" type="checkbox" required className="mt-1.5 h-4 w-4 shrink-0" />I checked the deposit and signature dates, full payment, and that this traveler completed the trip without cancellation or refund.</label>}
    <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-bold text-[var(--ink)] disabled:opacity-50">{busy ? "Saving…" : code ? "Save pilot start" : successful ? "Remove from successful count" : "Confirm successful traveler"}</button>
    <p role="status" className="text-sm leading-6">{message}</p>
  </form>;
}
