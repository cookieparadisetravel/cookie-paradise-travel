"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, LockKeyhole } from "lucide-react";

type Props = {
  id: number;
  partySize: number;
  departure: string;
  daysUntilDeparture: number | null;
  email: string;
  initialStatus: string;
  initialUrl: string | null;
  agreementReady: boolean;
  agreementReadinessMessage: string;
};

export function DepositInvoiceAction({ id, partySize, departure, daysUntilDeparture, email, initialStatus, initialUrl, agreementReady, agreementReadinessMessage }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [invoiceUrl, setInvoiceUrl] = useState(initialUrl);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [bookingTotal, setBookingTotal] = useState("");
  const paymentPercent = daysUntilDeparture !== null && daysUntilDeparture <= 90 ? 100 : 50;
  const bookingTotalNumber = Number(bookingTotal);
  const amount = Number.isFinite(bookingTotalNumber) ? bookingTotalNumber * paymentPercent / 100 : 0;
  const alreadyCreated = ["unpaid", "paid", "scheduled", "partially_paid"].includes(status);
  const retrying = status !== "not_created";

  async function createInvoice() {
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/inquiries/${id}/square-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingTotalDollars: bookingTotalNumber }),
      });
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
        <p className="mt-1 text-sm text-emerald-900/80">Payment invoice for {partySize} traveler{partySize === 1 ? "" : "s"}</p>
        {invoiceUrl && <a className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-emerald-900 underline" href={invoiceUrl} target="_blank" rel="noreferrer">Open Square invoice <ExternalLink className="h-3.5 w-3.5" /></a>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-4">
      <p className="text-sm font-bold text-[var(--ink)]">Square payment invoice</p>
      <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">{paymentPercent === 50 ? "50% is due upon booking acceptance; the first $500 per traveler is nonrefundable, and the remaining 50% is due 90 days before departure." : "This departure is within 90 days, so the full booking price is due upon acceptance; the first $500 per traveler is nonrefundable."}</p>
      {!agreementReady && <p className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--gold)]/60 bg-[var(--gold)]/15 p-3 text-sm font-semibold leading-6 text-[var(--ink)]"><LockKeyhole className="mt-1 h-4 w-4 shrink-0" /> <span><strong>Invoice locked.</strong> {agreementReadinessMessage}</span></p>}
      <label className="mt-3 block text-sm font-semibold text-[var(--ink)]">
        Confirmed total booking price
        <span className="mt-1 flex items-center rounded-xl border border-[var(--line)] bg-white px-3"><span className="text-[var(--muted-ink)]">$</span><input disabled={!agreementReady} className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none disabled:cursor-not-allowed disabled:opacity-50" type="number" min="1" max="100000" step="0.01" value={bookingTotal} onChange={(event) => setBookingTotal(event.target.value)} placeholder="Enter total including supplements" /></span>
      </label>
      {bookingTotalNumber > 0 && <p className="mt-2 text-sm font-bold text-[var(--ink)]">Invoice amount: ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({paymentPercent}%)</p>}
      {!confirming ? (
        <button disabled={!agreementReady || !Number.isFinite(bookingTotalNumber) || bookingTotalNumber <= 0 || departure === "flexible"} className="mt-3 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--navy)] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setConfirming(true)}>
          {retrying ? "Retry payment invoice" : "Prepare payment invoice"}
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-[var(--orange)]/30 bg-white p-4">
          <p className="text-sm leading-6 text-[var(--ink)]">This action records Cookie Paradise Travel Company’s acceptance of the booking. Square will create a <strong>${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> invoice and email it to <strong>{email}</strong>. This action sends a real Sandbox invoice.</p>
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
