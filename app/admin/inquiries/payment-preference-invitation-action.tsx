"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy, Link2, Loader2, LockKeyhole, Mail, WalletCards } from "lucide-react";
import type { PaymentPreference } from "@/lib/payment-schedule";

type Props = {
  inquiryId: number;
  agreementReady: boolean;
  agreementReadinessMessage: string;
  initialBookingTotalCents: number | null;
  initialPaymentPreference: string | null;
  initialSelectedAt: string | null;
  invoiceExists: boolean;
};

export function PaymentPreferenceInvitationAction({
  inquiryId,
  agreementReady,
  agreementReadinessMessage,
  initialBookingTotalCents,
  initialPaymentPreference,
  initialSelectedAt,
  invoiceExists,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [bookingTotal, setBookingTotal] = useState(initialBookingTotalCents ? (initialBookingTotalCents / 100).toFixed(2) : "");
  const [paymentPreference, setPaymentPreference] = useState<PaymentPreference | null>(isPaymentPreference(initialPaymentPreference) ? initialPaymentPreference : null);
  const [selectedAt, setSelectedAt] = useState(initialSelectedAt);
  const [invitationUrl, setInvitationUrl] = useState("");
  const [primaryContact, setPrimaryContact] = useState({ name: "", email: "" });
  const [copied, setCopied] = useState(false);
  const [emailDraftCopied, setEmailDraftCopied] = useState(false);
  const [error, setError] = useState("");
  const bookingTotalNumber = Number(bookingTotal);
  const canCreate = agreementReady && !invoiceExists && Number.isFinite(bookingTotalNumber) && bookingTotalNumber > 0;
  const formattedTotal = Number.isFinite(bookingTotalNumber) && bookingTotalNumber > 0
    ? bookingTotalNumber.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "the confirmed booking total";
  const emailSubject = "Choose your payment option for your Vietnam trip";
  const emailBody = `Hi ${primaryContact.name},

Your confirmed group booking total is ${formattedTotal}. Please use the secure link below to choose either pay in full or the $500-per-traveler deposit with monthly installments:

${invitationUrl}

The link expires in seven days and can be submitted once. No payment information is entered on the Cookie Paradise Travel Company page. After you confirm your choice, you will continue directly to Square's secure payment page.

Thank you,
Trung
Cookie Paradise Travel Company`;
  const gmailHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(primaryContact.email)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  async function createInvitation() {
    setCreating(true);
    setError("");
    setCopied(false);
    setEmailDraftCopied(false);
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/payment-preference-invitation`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingTotalDollars: bookingTotalNumber }),
      });
      const payload = await response.json() as {
        error?: string;
        invitationUrl?: string;
        primaryContactName?: string;
        primaryContactEmail?: string;
        bookingTotalCents?: number;
      };
      if (!response.ok || !payload.invitationUrl || !payload.primaryContactName || !payload.primaryContactEmail) {
        throw new Error(payload.error || "The payment-choice link could not be created.");
      }
      setInvitationUrl(payload.invitationUrl);
      setPrimaryContact({ name: payload.primaryContactName, email: payload.primaryContactEmail });
      setPaymentPreference(null);
      setSelectedAt(null);
      if (payload.bookingTotalCents) setBookingTotal((payload.bookingTotalCents / 100).toFixed(2));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The payment-choice link could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed. Select and copy the link manually.");
    }
  }

  async function copyEmailDraft() {
    try {
      await navigator.clipboard.writeText(`To: ${primaryContact.email}\nSubject: ${emailSubject}\n\n${emailBody}`);
      setEmailDraftCopied(true);
      window.setTimeout(() => setEmailDraftCopied(false), 2000);
    } catch {
      setError("Copy failed. Copy the secure link and prepare the email manually.");
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]"><WalletCards className="h-4 w-4 text-[var(--orange)]" /> Customer payment preference</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">Set the confirmed booking total, then send the primary contact a secure, one-time link to choose a payment option and continue directly to Square.</p>
        </div>
        {paymentPreference && <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">Choice received</span>}
      </div>

      {!agreementReady && !invoiceExists && <p className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--gold)]/60 bg-[var(--gold)]/15 p-3 text-sm font-semibold leading-6 text-[var(--ink)]"><LockKeyhole className="mt-1 h-4 w-4 shrink-0" /> <span><strong>Payment choice locked.</strong> {agreementReadinessMessage}</span></p>}
      {invoiceExists && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">The Square invoice has already been created, so the recorded payment preference can no longer be changed here.</p>}
      {paymentPreference && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
        <p className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4" /> {paymentPreference === "full" ? "Pay in full now" : "Deposit + monthly installments"}</p>
        <p className="mt-1">Confirmed booking total: {formattedTotal}{selectedAt ? ` · selected ${new Date(selectedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` : ""}</p>
      </div>}

      {!invoiceExists && <label className="mt-4 block text-sm font-semibold text-[var(--ink)]">
        Confirmed total booking price
        <span className="mt-1 flex items-center rounded-xl border border-[var(--line)] bg-white px-3"><span className="text-[var(--muted-ink)]">$</span><input disabled={!agreementReady || creating} className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none disabled:cursor-not-allowed disabled:opacity-50" type="number" min="1" max="100000" step="0.01" value={bookingTotal} onChange={(event) => setBookingTotal(event.target.value)} placeholder="Enter total including supplements" /></span>
      </label>}

      {!invoiceExists && !invitationUrl && <button disabled={!canCreate || creating} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={createInvitation}>
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        {creating ? "Creating…" : paymentPreference ? "Create replacement payment-choice link" : "Create payment-choice link"}
      </button>}

      {!invoiceExists && invitationUrl && <div className="mt-4 space-y-2">
        <label className="block text-xs font-semibold text-[var(--ink)]">Copy this link now. Creating a replacement will revoke this one.
          <input readOnly className="mt-1 w-full rounded-lg border border-[var(--input)] bg-[var(--cream)] px-3 py-2 font-mono text-xs" value={invitationUrl} />
        </label>
        <div className="flex flex-wrap gap-2">
          <a className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-3 py-2 text-xs font-bold text-white" href={gmailHref} target="_blank" rel="noreferrer"><Mail className="h-3.5 w-3.5" /> Open Gmail draft</a>
          <button className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--ink)]" type="button" onClick={copyEmailDraft}>{emailDraftCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{emailDraftCopied ? "Email draft copied" : "Copy email draft"}</button>
          <button className="inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-3 py-2 text-xs font-bold text-white" type="button" onClick={copyInvitation}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy link"}</button>
          <button disabled={creating} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--ink)] disabled:opacity-50" type="button" onClick={createInvitation}>Replace link</button>
        </div>
      </div>}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
    </section>
  );
}

function isPaymentPreference(value: string | null): value is PaymentPreference {
  return value === "payment_plan" || value === "full";
}
