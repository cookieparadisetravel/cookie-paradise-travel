"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, Copy, Link2, Loader2, LockKeyhole, Mail, WalletCards } from "lucide-react";
import {
  calculateExpectedBookingTotalCents,
  inferPriceCheckSelection,
  privateRoomSupplementCents,
  publishedPerTravelerPricesCents,
  publishedTravelerCountByPriceCents,
} from "@/lib/trip-pricing";
import type { PaymentPreferenceGeneratedDraft } from "./dashboard-types";
import {
  createPaymentPreferenceClientState,
  formatBookingTotal,
  reconcilePaymentPreferenceClientState,
  samePaymentPreferenceServerSnapshot,
  type PaymentPreferenceServerSnapshot,
} from "./payment-preference-state";

type Props = {
  inquiryId: number;
  agreementReady: boolean;
  agreementReadinessMessage: string;
  initialBookingTotalCents: number | null;
  initialPaymentPreference: string | null;
  initialSelectedAt: string | null;
  invoiceExists: boolean;
  partySize: number;
  roomPreference: string;
  initialGeneratedDraft?: PaymentPreferenceGeneratedDraft;
  onGeneratedDraftChange?: (draft: PaymentPreferenceGeneratedDraft) => void;
};

export function PaymentPreferenceInvitationAction({
  inquiryId,
  agreementReady,
  agreementReadinessMessage,
  initialBookingTotalCents,
  initialPaymentPreference,
  initialSelectedAt,
  invoiceExists,
  partySize,
  roomPreference,
  initialGeneratedDraft,
  onGeneratedDraftChange,
}: Props) {
  const router = useRouter();
  const initialPriceCheck = inferPriceCheckSelection({
    bookingTotalCents: initialBookingTotalCents,
    partySize,
    preferredPrivateRoomCount: roomPreference === "private" ? partySize : 0,
  });
  const serverSnapshot: PaymentPreferenceServerSnapshot = {
    bookingTotalCents: initialBookingTotalCents,
    paymentPreference: initialPaymentPreference,
    selectedAt: initialSelectedAt,
    invoiceExists,
  };
  const [creating, setCreating] = useState(false);
  const [previousServerSnapshot, setPreviousServerSnapshot] = useState(serverSnapshot);
  const [clientState, setClientState] = useState(() => createPaymentPreferenceClientState(serverSnapshot));
  const [generatedDraft, setGeneratedDraft] = useState(initialGeneratedDraft);
  const [previousGeneratedDraftId, setPreviousGeneratedDraftId] = useState(initialGeneratedDraft?.invitationId ?? null);
  const [copied, setCopied] = useState(false);
  const [emailDraftCopied, setEmailDraftCopied] = useState(false);
  const [error, setError] = useState("");
  const [perTravelerPriceCents, setPerTravelerPriceCents] = useState<number>(initialPriceCheck.perTravelerPriceCents);
  const [privateRoomCount, setPrivateRoomCount] = useState(initialPriceCheck.privateRoomCount);
  const [priceMismatchConfirmed, setPriceMismatchConfirmed] = useState(false);
  if (!samePaymentPreferenceServerSnapshot(previousServerSnapshot, serverSnapshot)) {
    setPreviousServerSnapshot(serverSnapshot);
    setClientState((current) => reconcilePaymentPreferenceClientState(current, serverSnapshot));
  }
  const generatedDraftId = initialGeneratedDraft?.invitationId ?? null;
  if (previousGeneratedDraftId !== generatedDraftId) {
    setPreviousGeneratedDraftId(generatedDraftId);
    setGeneratedDraft(initialGeneratedDraft);
  }
  const bookingTotal = clientState.bookingTotal;
  const paymentPreference = clientState.paymentPreference;
  const selectedAt = clientState.selectedAt;
  const invitationUrl = generatedDraft?.invitationUrl ?? "";
  const primaryContact = {
    name: generatedDraft?.primaryContactName ?? "",
    email: generatedDraft?.primaryContactEmail ?? "",
  };
  const bookingTotalNumber = Number(bookingTotal);
  const bookingTotalCents = Number.isFinite(bookingTotalNumber) ? Math.round(bookingTotalNumber * 100) : 0;
  const expectedBookingTotalCents = calculateExpectedBookingTotalCents({ partySize, perTravelerPriceCents, privateRoomCount });
  const priceDifferenceCents = bookingTotalCents - expectedBookingTotalCents;
  const bookingTotalIsValid = Number.isFinite(bookingTotalNumber) && bookingTotalNumber > 0;
  const priceMatches = bookingTotalIsValid && priceDifferenceCents === 0;
  const canCreate = agreementReady
    && !invoiceExists
    && bookingTotalIsValid
    && (priceMatches || priceMismatchConfirmed);
  const formattedTotal = Number.isFinite(bookingTotalNumber) && bookingTotalNumber > 0
    ? bookingTotalNumber.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "the confirmed booking total";
  const persistedTotal = initialBookingTotalCents && initialBookingTotalCents > 0
    ? (initialBookingTotalCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "Not recorded";
  const emailSubject = "Choose your payment option for Discover Southern Vietnam";
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
        body: JSON.stringify({
          bookingTotalDollars: bookingTotalNumber,
          perTravelerPriceCents,
          privateRoomCount,
          priceMismatchConfirmed,
        }),
      });
      const payload = await response.json() as {
        error?: string;
        invitationUrl?: string;
        primaryContactName?: string;
        primaryContactEmail?: string;
        bookingTotalCents?: number;
        invitationId?: number;
        createdAt?: string;
        expiresAt?: string;
      };
      if (!response.ok || !payload.invitationUrl || !payload.primaryContactName || !payload.primaryContactEmail || !payload.invitationId || !payload.createdAt || !payload.expiresAt) {
        throw new Error(payload.error || "The payment-choice link could not be created.");
      }
      const nextDraft: PaymentPreferenceGeneratedDraft = {
        invitationUrl: payload.invitationUrl,
        primaryContactName: payload.primaryContactName,
        primaryContactEmail: payload.primaryContactEmail,
        invitationId: payload.invitationId,
        createdAt: payload.createdAt,
        expiresAt: payload.expiresAt,
      };
      setGeneratedDraft(nextDraft);
      onGeneratedDraftChange?.(nextDraft);
      setClientState((current) => ({
        ...current,
        bookingTotal: formatBookingTotal(payload.bookingTotalCents ?? initialBookingTotalCents),
        bookingTotalDirty: false,
        paymentPreference: null,
        selectedAt: null,
      }));
      setPriceMismatchConfirmed(false);
      router.refresh();
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
        <p className="mt-1">Confirmed booking total: {persistedTotal}{selectedAt ? ` · selected ${new Date(selectedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` : ""}</p>
      </div>}

      {!invoiceExists && <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--cream)]/50 p-4">
        <p className="text-sm font-extrabold text-[var(--ink)]">Price accuracy check</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">Select the applicable published price and supplements. The check uses this customer’s party size of {partySize}; it does not choose the enrollment tier for you.</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-[var(--ink)]">
            Current price per traveler
            <select disabled={!agreementReady || creating} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--input)] bg-white px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" value={perTravelerPriceCents} onChange={(event) => {
              setPerTravelerPriceCents(Number(event.target.value));
              setPriceMismatchConfirmed(false);
            }}>
              {publishedPerTravelerPricesCents.map((price) => <option key={price} value={price}>{money(price)} per traveler ({publishedTravelerCountByPriceCents[price]} travelers)</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold text-[var(--ink)]">
            Travelers with private-room supplement
            <select disabled={!agreementReady || creating} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--input)] bg-white px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" value={privateRoomCount} onChange={(event) => {
              setPrivateRoomCount(Number(event.target.value));
              setPriceMismatchConfirmed(false);
            }}>
              {Array.from({ length: partySize + 1 }, (_, count) => <option key={count} value={count}>{count} {count === 1 ? "traveler" : "travelers"}</option>)}
            </select>
            <span className="mt-1 block font-medium text-[var(--muted-ink)]">{money(privateRoomSupplementCents)} each</span>
          </label>
        </div>

        <label className="mt-3 block text-sm font-semibold text-[var(--ink)]">
          Confirmed total booking price
          <span className="mt-1 flex items-center rounded-xl border border-[var(--line)] bg-white px-3"><span className="text-[var(--muted-ink)]">$</span><input disabled={!agreementReady || creating} className="min-w-0 flex-1 bg-transparent px-2 py-2 [appearance:textfield] outline-none disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" type="number" min="1" max="100000" step="0.01" value={bookingTotal} onChange={(event) => {
            const nextValue = event.target.value;
            setPriceMismatchConfirmed(false);
            setClientState((current) => ({
              ...current,
              bookingTotal: nextValue,
              bookingTotalDirty: nextValue !== formatBookingTotal(initialBookingTotalCents),
            }));
          }} placeholder="Enter total including supplements" /></span>
          {clientState.bookingTotalDirty && <span className="mt-1 block text-xs font-semibold text-amber-800">Unsaved total change. Creating or replacing the payment-choice link will save this amount.</span>}
        </label>

        <div className={`mt-3 rounded-xl border p-3 text-sm ${priceMatches ? "border-emerald-200 bg-emerald-50 text-emerald-950" : bookingTotalIsValid ? "border-red-300 bg-red-50 text-red-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
          {priceMatches ? (
            <p className="flex items-start gap-2 font-bold"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> Price check matches the expected total of {money(expectedBookingTotalCents)}.</p>
          ) : bookingTotalIsValid ? (
            <>
              <p className="flex items-start gap-2 font-bold"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Price mismatch: expected {money(expectedBookingTotalCents)}, but entered {money(bookingTotalCents)}.</p>
              <p className="mt-1 text-xs font-semibold">The entered total is {money(Math.abs(priceDifferenceCents))} {priceDifferenceCents > 0 ? "higher" : "lower"} than the price check.</p>
              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-white/70 p-2 text-xs font-bold">
                <input checked={priceMismatchConfirmed} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--orange)]" onChange={(event) => setPriceMismatchConfirmed(event.target.checked)} type="checkbox" />
                <span>I reviewed this difference and confirm that {money(bookingTotalCents)} is the correct total to send to the customer.</span>
              </label>
            </>
          ) : (
            <p className="font-semibold">Enter the booking total to run the price check. Expected total: {money(expectedBookingTotalCents)}.</p>
          )}
        </div>
      </div>}

      {!invoiceExists && !invitationUrl && <button disabled={!canCreate || creating} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={createInvitation}>
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        {creating ? "Creating…" : paymentPreference ? "Create replacement payment-choice link" : "Create payment-choice link"}
      </button>}

      {!invoiceExists && invitationUrl && <div className="mt-4">
        <a className="inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white" href={gmailHref} target="_blank" rel="noreferrer"><Mail className="h-4 w-4" /> Open Gmail draft</a>
        <p className="mt-2 text-xs text-[var(--muted-ink)]">Opening a draft does not mean the message was sent.</p>
        <details className="mt-3 rounded-xl border border-[var(--line)] bg-white p-3">
          <summary className="cursor-pointer text-xs font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/35">Copy or replace link</summary>
          <label className="mt-3 block text-xs font-semibold text-[var(--ink)]">Secure link
            <input readOnly className="mt-1 w-full rounded-lg border border-[var(--input)] bg-[var(--cream)] px-3 py-2 font-mono text-xs" value={invitationUrl} />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--ink)]" type="button" onClick={copyEmailDraft}>{emailDraftCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{emailDraftCopied ? "Email draft copied" : "Copy email draft"}</button>
          <button className="inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-3 py-2 text-xs font-bold text-white" type="button" onClick={copyInvitation}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy link"}</button>
          <button disabled={!canCreate || creating} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--ink)] disabled:opacity-50" type="button" onClick={createInvitation}>Replace link</button>
          </div>
        </details>
      </div>}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
    </section>
  );
}

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
