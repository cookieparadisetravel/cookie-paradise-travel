"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, OctagonX } from "lucide-react";

export function AutopayStopAction({ inquiryId }: { inquiryId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stopSource, setStopSource] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function stopAutopay() {
    if (!stopSource) {
      setError("Choose how the automatic-payment stop was requested.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/autopay-stop`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stopSource }),
      });
      const payload = await response.json() as { error?: string; emailSent?: boolean };
      if (!response.ok) throw new Error(payload.error || "Automatic payments could not be turned off.");
      if (payload.emailSent === false) {
        setError("Automatic payments are off, but the customer email could not be sent. Contact the customer manually.");
      } else {
        setOpen(false);
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Automatic payments could not be turned off.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="inline-flex min-h-10 items-center gap-2 rounded-full border-2 border-red-700 bg-white px-4 py-2 text-sm font-bold text-red-800 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200" onClick={() => setOpen(true)} type="button">
        <OctagonX className="h-4 w-4" /> Stop autopay
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950">
      <h4 className="font-bold">Turn off automatic installments?</h4>
      <p className="mt-1 text-sm leading-6">Square will stop charging the saved card automatically. The remaining installments and deadlines stay on the customer’s invoice.</p>
      <label className="mt-4 block text-sm font-bold" htmlFor={`autopay-stop-source-${inquiryId}`}>How did the customer ask?</label>
      <select className="mt-2 min-h-11 w-full rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200" id={`autopay-stop-source-${inquiryId}`} onChange={(event) => setStopSource(event.target.value)} required value={stopSource}>
        <option value="">Choose one</option>
        <option value="customer_email">Customer requested by email</option>
        <option value="owner_decision">My decision</option>
        <option value="booking_cancelled">Booking cancelled</option>
      </select>
      {error && <p className="mt-3 text-sm font-semibold text-red-800" role="alert">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="inline-flex min-h-10 items-center gap-2 rounded-full bg-red-800 px-4 py-2 text-sm font-bold text-white hover:bg-red-950 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting || !stopSource} onClick={() => void stopAutopay()} type="button">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <OctagonX className="h-4 w-4" />}
          {submitting ? "Turning off…" : "Confirm stop"}
        </button>
        <button className="min-h-10 rounded-full border border-red-400 bg-white px-4 py-2 text-sm font-bold hover:bg-red-100" disabled={submitting} onClick={() => { setOpen(false); setError(""); }} type="button">Keep autopay on</button>
      </div>
    </section>
  );
}
