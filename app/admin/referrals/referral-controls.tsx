"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReferralControl({ code, startDate, travelerId, successful, qualifiedOn, referrerName, referrerLabel = "Referrer", today }: {
  code?: string; startDate?: string; travelerId?: number; successful?: boolean; qualifiedOn?: string;
  referrerName?: string; referrerLabel?: string; today: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const remove = submitter?.value === "remove";
    setBusy(true); setMessage("");
    try {
      const body = code ? { action: "pilot", code, materialsReceivedOn: form.get("date") }
        : (successful && !remove) || submitter?.value === "recipient" ? { action: "recipient", travelerId, referrerName: form.get("referrer") }
        : { action: "completion", travelerId, successful: !remove, referrerName: form.get("referrer"), qualifiedOn: form.get("date"), tripCompletedAndNotRefunded: form.get("confirm") === "on" };
      const response = await fetch("/api/admin/referrals", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not save.");
      setMessage("Saved."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-3">
    {!code && <label className="block text-sm font-semibold">{referrerLabel} name or unique identifier
      <input name="referrer" type="text" minLength={2} maxLength={120} defaultValue={referrerName ?? ""} required className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3" />
      <span className="mt-1 block text-xs font-normal leading-5 text-[var(--muted-ink)]">Use the same name or identifier for this person every time. Add an identifier when names match. Changing it recalculates that person’s earnings and bonuses.</span>
    </label>}
    {(code || !successful) && <label className="block text-sm font-semibold">{code ? "Materials received on" : "Agreement and deposit qualified on"}
      <input name="date" type="date" max={today} defaultValue={startDate ?? qualifiedOn ?? ""} required className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3" />
    </label>}
    {!code && !successful && <label className="flex items-start gap-2 text-sm leading-6"><input name="confirm" type="checkbox" required className="mt-1.5 h-4 w-4 shrink-0" />I checked the deposit and signature dates, full payment, and that this traveler completed the trip without cancellation or refund.</label>}
    <div className="flex flex-wrap gap-2">
      <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-bold text-[var(--ink)] disabled:opacity-50">{busy ? "Saving…" : code ? "Save pilot start" : successful ? "Save referrer" : "Confirm successful traveler"}</button>
      {!code && !successful && <button type="submit" value="recipient" formNoValidate disabled={busy} className="min-h-11 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold disabled:opacity-50">Save referrer only</button>}
      {!code && successful && <button type="submit" value="remove" formNoValidate disabled={busy} className="min-h-11 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold disabled:opacity-50">Remove from successful count</button>}
    </div>
    <p role="status" className="text-sm leading-6">{message}</p>
  </form>;
}
