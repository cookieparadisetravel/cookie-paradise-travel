"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MetaSyncStatus } from "@/lib/meta-sync";

export function MetaSyncPanel() {
  const router = useRouter();
  const [status, setStatus] = useState<MetaSyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/meta-sync", { cache: "no-store", signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); setStatus(await response.json() as MetaSyncStatus); })
      .catch(() => { if (!controller.signal.aborted) setError("Facebook sync status is unavailable. Try syncing again."); });
    return () => controller.abort();
  }, []);
  async function sync() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/meta-sync", { method: "POST" });
      const body = await response.json() as MetaSyncStatus & { error?: string };
      if (!response.ok) throw new Error(body.error || "Sync did not complete.");
      setStatus(body); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Sync did not complete."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Facebook lead connection" className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-semibold">Facebook lead connection</h2>
      <button type="button" onClick={sync} disabled={busy || status?.configured === false} className="rounded-full bg-[var(--gold)] px-5 py-2 font-semibold disabled:opacity-50">
        {busy ? "Checking Facebook…" : "Sync Facebook leads"}
      </button>
    </div>
    <p role="status" className="mt-2 text-sm">{error || status?.message || "Checking connection status…"}</p>
    {status?.checkedAt && <p className="mt-1 text-sm">Last check: {new Date(status.checkedAt).toLocaleString("en-US", { timeZone: "America/Indiana/Indianapolis" })} (Indiana)</p>}
    <p className="mt-2 text-sm opacity-75">Checks hourly for missed submissions. Syncing adds dashboard records only; it does not send emails or subscribe anyone to marketing.</p>
  </section>;
}
