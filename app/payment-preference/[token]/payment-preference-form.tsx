"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, CreditCard, Loader2, ShieldCheck, WalletCards } from "lucide-react";
import type { PaymentPreference } from "@/lib/payment-schedule";

type Props = {
  token: string;
  primaryContactName: string;
  departure: string;
  partySize: number;
  bookingTotalCents: number;
  depositAmountCents: number;
  remainingBalanceCents: number;
  installmentCount: number;
  finalPaymentDeadline: string;
  fullPaymentRequired: boolean;
};

export function PaymentPreferenceForm({
  token,
  primaryContactName,
  departure,
  partySize,
  bookingTotalCents,
  depositAmountCents,
  remainingBalanceCents,
  installmentCount,
  finalPaymentDeadline,
  fullPaymentRequired,
}: Props) {
  const [paymentPreference, setPaymentPreference] = useState<PaymentPreference | "">(fullPaymentRequired ? "full" : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completedAt, setCompletedAt] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentPreference) {
      setError("Choose a payment option before continuing.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/payment-preferences/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paymentPreference }),
      });
      const payload = await response.json() as { error?: string; completedAt?: string; publicUrl?: string };
      if (!response.ok || !payload.completedAt || !payload.publicUrl) throw new Error(payload.error || "Your payment preference could not be submitted.");
      setCompletedAt(payload.completedAt);
      window.location.assign(payload.publicUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your payment preference could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (completedAt) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-emerald-950 shadow-sm sm:p-10">
        <CheckCircle2 className="h-11 w-11 text-emerald-700" />
        <h1 className="mt-5 font-serif text-3xl sm:text-4xl">Payment preference received</h1>
        <p className="mt-4 leading-7">You selected <strong>{paymentPreference === "full" ? "pay in full" : "deposit and monthly installments"}</strong>.</p>
        <p className="mt-2 text-sm leading-6">Your Square invoice is ready. You are being redirected to Square’s secure payment page.</p>
      </section>
    );
  }

  return (
    <form onSubmit={submit}>
      <section className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Vietnam booking payment</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Hello, {primaryContactName}</h1>
        <p className="mt-4 leading-7 text-[var(--muted-ink)]">Please choose how your group would like to pay for the {departure} departure.</p>

        <dl className="mt-6 grid gap-3 rounded-2xl bg-[var(--cream)] p-5 sm:grid-cols-2">
          <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-ink)]">Confirmed booking total</dt><dd className="mt-1 text-xl font-bold">{money(bookingTotalCents)}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-ink)]">Travelers</dt><dd className="mt-1 text-xl font-bold">{partySize}</dd></div>
        </dl>

        {fullPaymentRequired ? (
          <div className="mt-6 rounded-2xl border border-[var(--gold)]/60 bg-[var(--gold)]/15 p-5">
            <div className="flex items-start gap-3"><CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-[var(--orange)]" /><div><h2 className="font-bold">Full payment is required</h2><p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">Because this booking is within 90 days of departure, the full {money(bookingTotalCents)} will be due when Square sends the invoice.</p></div></div>
          </div>
        ) : (
          <fieldset className="mt-6">
            <legend className="text-lg font-bold">Choose one payment option</legend>
            <div className="mt-3 grid gap-3">
              <PaymentOption
                checked={paymentPreference === "payment_plan"}
                icon={WalletCards}
                title="Deposit + monthly installments"
                description={`${money(depositAmountCents)} nonrefundable reservation deposit due first ($500 per traveler). The remaining ${money(remainingBalanceCents)} will be divided into ${installmentCount} monthly installment${installmentCount === 1 ? "" : "s"}, with full payment completed by ${formatDate(finalPaymentDeadline)}.`}
                onChange={() => setPaymentPreference("payment_plan")}
              />
              <PaymentOption
                checked={paymentPreference === "full"}
                icon={CreditCard}
                title="Pay in full now"
                description={`The full ${money(bookingTotalCents)} will be due when Square sends the invoice. The first ${money(depositAmountCents)} is the nonrefundable reservation-deposit portion.`}
                onChange={() => setPaymentPreference("full")}
              />
            </div>
          </fieldset>
        )}

        <div className="mt-6 flex gap-3 rounded-2xl border border-[var(--gold)]/50 bg-[var(--gold)]/10 p-4 text-sm leading-6">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--orange)]" />
          <p>Do not enter card or bank information on this page. After you confirm your preference, you will continue directly to Square’s secure payment page. Square will also email the invoice to the primary contact.</p>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
        <button disabled={submitting || !paymentPreference} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--orange)] px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" type="submit">
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing Square payment…</> : "Continue to Square payment"}
        </button>
      </section>
    </form>
  );
}

function PaymentOption({ checked, icon: Icon, title, description, onChange }: {
  checked: boolean;
  icon: typeof CreditCard;
  title: string;
  description: string;
  onChange: () => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-4 rounded-2xl border p-5 transition ${checked ? "border-[var(--orange)] bg-[var(--gold)]/10 ring-1 ring-[var(--orange)]" : "border-[var(--line)] hover:border-[var(--orange)]/60"}`}>
      <input required checked={checked} className="mt-1 accent-[var(--orange)]" name="paymentPreference" onChange={onChange} type="radio" />
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--orange)]" />
      <span><span className="block font-bold">{title}</span><span className="mt-1 block text-sm leading-6 text-[var(--muted-ink)]">{description}</span></span>
    </label>
  );
}

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
