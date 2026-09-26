"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";

type Props = {
  id: number;
  partySize: number;
  email: string;
  initialStatus: string;
  initialUrl: string | null;
};

export function DepositInvoiceAction({ id, partySize, email, initialStatus, initialUrl }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [invoiceUrl, setInvoiceUrl] = useState(initialUrl);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const amount = partySize * 500;
  const alreadyCreated = !["not_created", "error"].includes(status);

  async function createInvoice() {
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/inquiries/${id}/square-deposit`, { method: "POST" });
      const payload = await response.json() as { error?: string; publicUrl?: string | null; status?: string };
      if (!response.ok) throw new Error(payload.error || "Square could not create the invoice.");
      setStatus(payload.status || "published");
      setInvoiceUrl(payload.publicUrl || null);
      setConfirming(false);
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Square could not create the invoice.");
    } finally {
      setSending(false);
    }
  }

  if (alreadyCreated) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-900"><CheckCircle2 className="h-4 w-4" /> Deposit invoice {status.replaceAll("_", " ")}</p>
        <p className="mt-1 text-sm text-emerald-900/80">${amount.toLocaleString("en-US")} for {partySize} traveler{partySize === 1 ? "" : "s"}</p>
        {invoiceUrl && <a className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-emerald-900 underline" href={invoiceUrl} target="_blank" rel="noreferrer">Open Square invoice <ExternalLink className="h-3.5 w-3.5" /></a>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-4">
      <p className="text-sm font-bold text-[var(--ink)]">Square deposit invoice</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">${amount.toLocaleString("en-US")} total — $500 × {partySize} traveler{partySize === 1 ? "" : "s"}</p>
      {!confirming ? (
        <button className="mt-3 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--navy)]" onClick={() => setConfirming(true)}>
          Prepare deposit invoice
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-[var(--orange)]/30 bg-white p-4">
          <p className="text-sm leading-6 text-[var(--ink)]">Square will create the invoice and email it to <strong>{email}</strong>. This action sends a real Sandbox invoice.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={sending} className="inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={createInvoice}>
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Confirm and email invoice"}
            </button>
            <button disabled={sending} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--ink)]" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}
