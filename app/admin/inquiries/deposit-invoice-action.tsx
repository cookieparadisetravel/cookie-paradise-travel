"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, LockKeyhole } from "lucide-react";
import {
  applyPaymentPreference,
  createPaymentPlan,
} from "@/lib/payment-schedule";
import type { SquareMode } from "./dashboard-types";
import { getSquareInvoiceStatusPresentation } from "./square-invoice-status";

type Props = {
  id: number;
  partySize: number;
  departure: string;
  acceptanceDate: string;
  email: string;
  initialStatus: string;
  initialUrl: string | null;
  agreementReady: boolean;
  agreementReadinessMessage: string;
  confirmedBookingTotalCents: number | null;
  initialPaymentPreference: string | null;
  paymentPreferenceSelectedAt: string | null;
  creatingClaimIsStale: boolean;
  squareMode: SquareMode;
};

export function DepositInvoiceAction({ id, partySize, departure, acceptanceDate, email, initialStatus, initialUrl, agreementReady, agreementReadinessMessage, confirmedBookingTotalCents, initialPaymentPreference, paymentPreferenceSelectedAt, creatingClaimIsStale, squareMode }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState(initialStatus);
  const [invoiceUrl, setInvoiceUrl] = useState(initialUrl);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bookingTotalCents = confirmedBookingTotalCents ?? 0;
  const paymentPreference = initialPaymentPreference === "payment_plan" || initialPaymentPreference === "full"
    ? initialPaymentPreference
    : null;
  let paymentPlan = null;
  let paymentPlanError = "";
  if (bookingTotalCents > 0 && paymentPreference && departure !== "flexible") {
    try {
      const standardPaymentPlan = createPaymentPlan({ bookingTotalCents, partySize, departure, acceptanceDate });
      paymentPlan = applyPaymentPreference(standardPaymentPlan, bookingTotalCents, paymentPreference);
    } catch (cause) {
      paymentPlanError = cause instanceof Error ? cause.message : "The payment schedule could not be calculated.";
    }
  }
  const amount = (paymentPlan?.initialAmountCents ?? 0) / 100;
  const total = (paymentPlan ? bookingTotalCents : 0) / 100;
  const statusPresentation = getSquareInvoiceStatusPresentation(status);
  const recoverable = status === "error" || status === "draft" || (status === "creating" && creatingClaimIsStale);
  const recoveryLabel = status === "draft"
    ? "Resume draft invoice"
    : status === "creating"
      ? "Resume invoice creation"
      : "Retry Square invoice";
  const recoveryDescription = status === "draft"
    ? "Square still reports a draft. The backend can safely reclaim this state and resume publishing while preserving duplicate-invoice protection."
    : status === "creating"
      ? "Invoice creation has remained in progress beyond the backend’s five-minute timeout. The backend can safely reclaim the stale attempt."
      : "The application recorded an invoice error. Review the safeguards below before retrying.";
  const recoveryIsError = status === "error";

  async function createInvoice() {
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/inquiries/${id}/square-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json() as { error?: string; publicUrl?: string | null; status?: string };
      if (!response.ok) throw new Error(payload.error || "Square could not create the invoice.");
      setStatus(payload.status || "published");
      setInvoiceUrl(payload.publicUrl || null);
      setConfirming(false);
      router.refresh();
    } catch (cause) {
      setStatus("error");
      setError(cause instanceof Error ? cause.message : "Square could not create the invoice.");
    } finally {
      setSending(false);
    }
  }

  if (!recoverable && statusPresentation.invoiceExists) {
    const cardClasses = statusPresentation.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : statusPresentation.tone === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : statusPresentation.tone === "danger"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-slate-200 bg-slate-50 text-slate-800";
    return (
      <div className={`rounded-2xl border p-4 ${cardClasses}`}>
        <p className="flex items-center gap-2 text-sm font-bold">{statusPresentation.tone === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {statusPresentation.label}</p>
        <p className="mt-1 text-sm opacity-85">{statusPresentation.description} Invoice for {partySize} traveler{partySize === 1 ? "" : "s"}.</p>
        {invoiceUrl && <a className="mt-3 inline-flex items-center gap-1 text-sm font-bold underline" href={invoiceUrl} target="_blank" rel="noreferrer">Open Square invoice <ExternalLink className="h-3.5 w-3.5" /></a>}
      </div>
    );
  }

  if (!recoverable) {
    const inProgress = status === "creating";
    return (
      <div className={`rounded-2xl border p-4 ${inProgress ? "border-amber-200 bg-amber-50" : "border-[var(--line)] bg-[var(--cream)]"}`}>
        <p className="text-sm font-bold text-[var(--ink)]">{statusPresentation.label}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">{inProgress ? "Refresh to load the latest persisted Square status. Manual recovery appears only after a recorded error." : "The secure payment-choice flow prepares an unpublished Square draft after the customer records a choice. The draft is issued only after every required Agreement 1.0 acceptance is complete and you approve it."}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 ${recoveryIsError ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
      <p className={`text-sm font-bold ${recoveryIsError ? "text-red-900" : "text-amber-950"}`}>{status === "draft" ? "Square invoice draft requires attention" : status === "creating" ? "Square invoice creation is stale" : "Square invoice error"}</p>
      <p className={`mt-1 text-sm leading-6 ${recoveryIsError ? "text-red-900/80" : "text-amber-950/80"}`}>{recoveryDescription}</p>
      {!agreementReady && <p className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--gold)]/60 bg-[var(--gold)]/15 p-3 text-sm font-semibold leading-6 text-[var(--ink)]"><LockKeyhole className="mt-1 h-4 w-4 shrink-0" /> <span><strong>Invoice locked.</strong> {agreementReadinessMessage}</span></p>}
      {agreementReady && !paymentPreference && <p className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--gold)]/60 bg-[var(--gold)]/15 p-3 text-sm font-semibold leading-6 text-[var(--ink)]"><LockKeyhole className="mt-1 h-4 w-4 shrink-0" /> <span><strong>Invoice locked.</strong> The primary contact has not submitted a payment preference.</span></p>}
      {paymentPreference && bookingTotalCents > 0 && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"><strong>Customer selected:</strong> {paymentPreference === "full" ? "Pay in full now" : "Deposit + monthly installments"} · {(bookingTotalCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}{paymentPreferenceSelectedAt ? ` · ${new Date(paymentPreferenceSelectedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` : ""}</p>}
      {paymentPlan && <div className="mt-3 rounded-xl border border-[var(--line)] bg-white p-3 text-sm text-[var(--ink)]">
        <p className="font-bold">{paymentPlan.paymentType === "deposit" ? "Single payment-plan invoice" : "Full-payment invoice"}: ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total</p>
        <p className="mt-1 leading-6 text-[var(--muted-ink)]">Due when sent: ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{paymentPlan.paymentType === "deposit" ? " nonrefundable reservation deposit" : " full payment"}.</p>
        {paymentPlan.installments.length > 0 && <p className="mt-1 leading-6 text-[var(--muted-ink)]">Remaining balance: ${(paymentPlan.remainingBalanceCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in {paymentPlan.installments.length} installment{paymentPlan.installments.length === 1 ? "" : "s"}, from {formatDate(paymentPlan.installments[0].dueDate)} through {formatDate(paymentPlan.installments.at(-1)!.dueDate)}.</p>}
        {paymentPlan.installments.length > 0 && <p className="mt-2 text-xs leading-5 text-[var(--muted-ink)]">Square will place the deposit and every installment on this one invoice and send a reminder seven days before each installment is due. Automatic card charges are not enabled.</p>}
        {paymentPlan.paymentType === "deposit" && paymentPlan.installments.length === 0 && <p className="mt-1 text-[var(--muted-ink)]">The reservation deposit covers the full confirmed booking total.</p>}
      </div>}
      {paymentPlanError && <p className="mt-2 text-sm font-semibold text-red-700">{paymentPlanError}</p>}
      {!confirming ? (
        <button disabled={!agreementReady || !paymentPreference || !paymentPlan || departure === "flexible"} className="mt-3 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white hover:bg-[var(--navy)] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => setConfirming(true)}>
          {recoveryLabel}
        </button>
      ) : (
        <div className="mt-3 rounded-xl border border-[var(--orange)]/30 bg-white p-4">
          <p className="text-sm leading-6 text-[var(--ink)]">Square <strong>{squareMode === "sandbox" ? "Sandbox" : "Production"}</strong> will resume one <strong>${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> invoice and email it to <strong>{email}</strong>. {paymentPlan?.paymentType === "deposit" ? `The first $${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} is due now; the remaining payments follow the schedule below.` : "The full amount is due now."} The server rechecks the invoice state and duplicate-invoice safeguards before continuing.</p>
          {paymentPlan && paymentPlan.installments.length > 0 && <div className="mt-3 rounded-lg bg-[var(--cream)] p-3 text-xs leading-5 text-[var(--ink)]">
            <p className="font-bold">Planned monthly balance payments</p>
            <ol className="mt-1 grid gap-x-4 sm:grid-cols-2">
              {paymentPlan.installments.map((installment, index) => <li key={installment.dueDate}>{index + 1}. {formatDate(installment.dueDate)} — ${(installment.amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>)}
            </ol>
          </div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={sending} className="inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={createInvoice}>
              {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Resuming…</> : recoveryLabel}
            </button>
            <button disabled={sending} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--ink)]" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
