"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { buildAutopayAuthorizationText, formatCardBrand } from "@/lib/autopay-authorization";
import type { AutopayScheduleRequest } from "@/lib/square-autopay";

export function AutopayAuthorizationForm({ token, primaryContactName, recipientEmail, departure, cardBrand, cardLast4, requests, scheduleFingerprint }: {
  token: string;
  primaryContactName: string;
  recipientEmail: string;
  departure: string;
  cardBrand: string;
  cardLast4: string;
  requests: AutopayScheduleRequest[];
  scheduleFingerprint: string;
}) {
  const [payerName, setPayerName] = useState(primaryContactName);
  const [authorized, setAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState<"authorize" | "decline" | null>(null);
  const [completed, setCompleted] = useState<"active" | "manual" | null>(null);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitChoice("authorize");
  }

  async function submitChoice(action: "authorize" | "decline") {
    setSubmitting(action);
    setError("");
    try {
      const response = await fetch(`/api/autopay-authorizations/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          authorized: action === "authorize" ? authorized : false,
          payerName: action === "authorize" ? payerName : "",
          scheduleFingerprint,
        }),
      });
      const payload = await response.json() as { error?: string; completedAt?: string; status?: string };
      if (!response.ok || !payload.completedAt) throw new Error(payload.error || "Automatic installments could not be authorized.");
      setCompleted(payload.status === "manual" ? "manual" : "active");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Automatic installments could not be authorized.");
    } finally {
      setSubmitting(null);
    }
  }

  if (completed === "active") {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-emerald-950 shadow-sm sm:p-10">
        <CheckCircle2 className="h-11 w-11 text-emerald-700" />
        <h1 className="mt-5 font-serif text-3xl sm:text-4xl">Automatic installments authorized</h1>
        <p className="mt-4 leading-7">Square will use the saved card for the remaining installments shown below. You may contact Cookie Paradise Travel Company before a due date to withdraw authorization for future installments.</p>
      </section>
    );
  }

  if (completed === "manual") {
    return (
      <section className="rounded-3xl border border-[var(--line)] bg-white p-7 shadow-sm sm:p-10">
        <CheckCircle2 className="h-11 w-11 text-[var(--orange)]" />
        <h1 className="mt-5 font-serif text-3xl sm:text-4xl">Your installments remain manual</h1>
        <p className="mt-4 leading-7 text-[var(--muted-ink)]">No automatic-payment authorization was given. Continue paying each installment from your Square invoice by its listed due date.</p>
      </section>
    );
  }

  const remainingTotal = requests.reduce((sum, installment) => sum + installment.amountCents, 0);
  const finalDueDate = requests.reduce(
    (latest, request) => request.dueDate > latest ? request.dueDate : latest,
    "",
  );
  const authorizationText = buildAutopayAuthorizationText({
    cardholderName: payerName.trim() || "[cardholder name]",
    cardBrand,
    last4: cardLast4,
    paymentCount: requests.length,
    totalCents: remainingTotal,
    finalDueDate,
  });
  return (
    <form onSubmit={submit}>
      <section className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Optional automatic installments</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Review your remaining Square schedule</h1>
        <p className="mt-4 leading-7 text-[var(--muted-ink)]">This authorization is for the {departure} departure and was sent to {recipientEmail}. Automatic payments are optional. The person whose saved card will be charged must complete this authorization. If someone else paid the deposit, do not submit this form; contact Cookie Paradise Travel Company so the cardholder can receive a separate authorization.</p>

        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-5">
          <CreditCard className="h-6 w-6 shrink-0 text-[var(--orange)]" />
          <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-ink)]">Saved card to be charged</p><p className="mt-1 font-bold">{formatCardBrand(cardBrand)} ending in {cardLast4}</p></div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)]">
          <div className="grid grid-cols-[1fr_auto] gap-4 bg-[var(--cream)] px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-ink)]"><span>Due date</span><span>Amount</span></div>
          {requests.map((installment) => (
            <div className="grid grid-cols-[1fr_auto] gap-4 border-t border-[var(--line)] px-5 py-4" key={installment.uid}>
              <span className="font-semibold">{formatDate(installment.dueDate)}</span>
              <span className="font-bold">{money(installment.amountCents)}</span>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_auto] gap-4 border-t-2 border-[var(--brown)] bg-[var(--gold)]/10 px-5 py-4"><span className="font-bold">Total remaining</span><span className="font-bold">{money(remainingTotal)}</span></div>
        </div>

        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted-ink)]">Authorization you are giving</p>
          <p className="mt-3 text-sm leading-7">{authorizationText}</p>
        </div>

        <div className="mt-6">
          <label className="text-sm font-bold" htmlFor="payerName">Cardholder’s full legal name</label>
          <input autoComplete="cc-name" className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 outline-none focus:border-[var(--orange)] focus:ring-2 focus:ring-[var(--gold)]/40" id="payerName" maxLength={120} onChange={(event) => setPayerName(event.target.value)} required value={payerName} />
        </div>

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--gold)]/60 bg-[var(--gold)]/10 p-5">
          <input checked={authorized} className="mt-1 h-4 w-4 shrink-0 accent-[var(--orange)]" onChange={(event) => setAuthorized(event.target.checked)} required type="checkbox" />
          <span className="text-sm leading-6">I am the cardholder named above. I reviewed the saved card, exact remaining amounts, due dates, total, and complete authorization shown above. I agree to that authorization.</span>
        </label>

        <div className="mt-6 flex gap-3 rounded-2xl border border-[var(--gold)]/50 bg-[var(--gold)]/10 p-4 text-sm leading-6"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--orange)]" /><p>Cookie Paradise Travel Company does not receive or store your full card number or security code. Square securely stores and charges the selected card.</p></div>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button disabled={submitting !== null || !authorized} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--orange)] px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1" type="submit">{submitting === "authorize" ? <><Loader2 className="h-4 w-4 animate-spin" /> Authorizing…</> : "Authorize automatic installments"}</button>
          <button disabled={submitting !== null} className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[var(--brown)] bg-white px-6 py-3 font-bold text-[var(--brown)] transition hover:bg-[var(--cream)] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1" onClick={() => void submitChoice("decline")} type="button">{submitting === "decline" ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "No thanks, I’ll pay each installment manually"}</button>
        </div>
      </section>
    </form>
  );
}

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}
