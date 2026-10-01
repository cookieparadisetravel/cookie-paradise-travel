"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import type { AgreementDocument } from "@/lib/traveler-agreement";

type Props = {
  token: string;
  agreement: AgreementDocument;
  traveler: {
    firstName: string;
    lastName: string;
    email: string;
    travelerType: string;
    guardianLegalName: string | null;
    guardianRelationship: string | null;
  };
};

type FormState = {
  signerLegalName: string;
  travelerInitials: string;
  guardianRelationship: string;
  electronicSignatureConsent: boolean;
  agreementConsent: boolean;
  depositAcknowledged: boolean;
  cancellationAcknowledged: boolean;
  insuranceSelection: string;
  insuranceProvider: string;
  photoMediaOptIn: boolean;
};

const initialForm: FormState = {
  signerLegalName: "",
  travelerInitials: "",
  guardianRelationship: "",
  electronicSignatureConsent: false,
  agreementConsent: false,
  depositAcknowledged: false,
  cancellationAcknowledged: false,
  insuranceSelection: "",
  insuranceProvider: "",
  photoMediaOptIn: false,
};

export function AgreementAcceptanceForm({ token, agreement, traveler }: Props) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [acceptedAt, setAcceptedAt] = useState("");
  const isMinor = traveler.travelerType === "minor";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/traveler-agreements/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json() as { error?: string; acceptedAt?: string };
      if (!response.ok || !payload.acceptedAt) throw new Error(payload.error || "Your acceptance could not be recorded.");
      setAcceptedAt(payload.acceptedAt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your acceptance could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  if (acceptedAt) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-emerald-950 shadow-sm">
        <CheckCircle2 className="h-10 w-10 text-emerald-700" />
        <h2 className="mt-4 font-serif text-3xl">Agreement accepted</h2>
        <p className="mt-3 leading-7">Thank you. Your acceptance was securely recorded on {new Date(acceptedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}.</p>
        <p className="mt-2 text-sm">Cookie Paradise Travel Company will review the completed booking before issuing any payment invoice.</p>
      </div>
    );
  }

  return (
    <>
      <section className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Traveler</p>
        <h1 className="mt-2 font-serif text-3xl text-[var(--ink)] sm:text-4xl">{traveler.firstName} {traveler.lastName}</h1>
        <p className="mt-2 text-[var(--muted-ink)]">{traveler.email}</p>
        {isMinor && <p className="mt-4 rounded-2xl border border-[var(--gold)]/60 bg-[var(--gold)]/15 p-4 font-semibold text-[var(--ink)]">A parent or legal guardian must complete the single acceptance section for this minor traveler.</p>}
      </section>

      <article className="mt-6 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-9">
        <div className="border-b border-[var(--line)] pb-6">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Version {agreement.version} · Effective {agreement.effectiveDate}</p>
          <h2 className="mt-2 font-serif text-3xl text-[var(--ink)]">{agreement.title}</h2>
        </div>
        <div className="mt-7 space-y-8">
          {agreement.sections.map((section) => (
            <section key={section.heading}>
              <h3 className="font-serif text-2xl text-[var(--ink)]">{section.heading}</h3>
              <div className="mt-3 space-y-3 leading-7 text-[var(--ink)]">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}
        </div>
      </article>

      <form className="mt-6 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-9" onSubmit={submit}>
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-[var(--orange)]" />
          <h2 className="font-serif text-3xl text-[var(--ink)]">Acceptance</h2>
        </div>
        <p className="mt-3 leading-7 text-[var(--muted-ink)]">Complete every required item below. Your typed legal name and submission will serve as your electronic signature.</p>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold text-[var(--ink)]">{isMinor ? "Parent or guardian legal name" : "Traveler legal name"}<input required maxLength={160} className="mt-2 w-full rounded-xl border border-[var(--input)] px-4 py-3 outline-none focus:border-[var(--orange)]" value={form.signerLegalName} onChange={(event) => setForm({ ...form, signerLegalName: event.target.value })} /></label>
          <label className="text-sm font-semibold text-[var(--ink)]">Traveler initials<input required maxLength={12} className="mt-2 w-full rounded-xl border border-[var(--input)] px-4 py-3 uppercase outline-none focus:border-[var(--orange)]" value={form.travelerInitials} onChange={(event) => setForm({ ...form, travelerInitials: event.target.value })} /></label>
          {isMinor && <label className="text-sm font-semibold text-[var(--ink)]">Relationship to minor<input required maxLength={80} className="mt-2 w-full rounded-xl border border-[var(--input)] px-4 py-3 outline-none focus:border-[var(--orange)]" value={form.guardianRelationship} onChange={(event) => setForm({ ...form, guardianRelationship: event.target.value })} /></label>}
          <label className="text-sm font-semibold text-[var(--ink)]">Travel insurance decision<select required className="mt-2 w-full rounded-xl border border-[var(--input)] bg-white px-4 py-3 outline-none focus:border-[var(--orange)]" value={form.insuranceSelection} onChange={(event) => setForm({ ...form, insuranceSelection: event.target.value })}><option value="">Choose one</option><option value="purchased">I have purchased travel insurance</option><option value="will_purchase">I intend to purchase travel insurance</option><option value="declined">I decline travel insurance</option></select></label>
          {(form.insuranceSelection === "purchased" || form.insuranceSelection === "will_purchase") && <label className="text-sm font-semibold text-[var(--ink)]">Insurance provider, if known<input maxLength={120} className="mt-2 w-full rounded-xl border border-[var(--input)] px-4 py-3 outline-none focus:border-[var(--orange)]" value={form.insuranceProvider} onChange={(event) => setForm({ ...form, insuranceProvider: event.target.value })} /></label>}
        </div>

        <div className="mt-7 space-y-4">
          <RequiredCheckbox checked={form.electronicSignatureConsent} onChange={(value) => setForm({ ...form, electronicSignatureConsent: value })}>I consent to use an electronic signature and understand it has the same legal effect as a handwritten signature.</RequiredCheckbox>
          <RequiredCheckbox checked={form.agreementConsent} onChange={(value) => setForm({ ...form, agreementConsent: value })}>I have read, understand and agree to the Traveler Agreement and Booking Terms shown above.</RequiredCheckbox>
          <RequiredCheckbox checked={form.depositAcknowledged} onChange={(value) => setForm({ ...form, depositAcknowledged: value })}>I understand that the first $500 per traveler is a nonrefundable reservation deposit, subject to the agreement.</RequiredCheckbox>
          <RequiredCheckbox checked={form.cancellationAcknowledged} onChange={(value) => setForm({ ...form, cancellationAcknowledged: value })}>I have reviewed and acknowledge the cancellation terms in the agreement.</RequiredCheckbox>
          <label className="flex gap-3 rounded-2xl border border-[var(--line)] p-4 text-sm leading-6 text-[var(--ink)]"><input className="mt-1 h-4 w-4 accent-[var(--orange)]" type="checkbox" checked={form.photoMediaOptIn} onChange={(event) => setForm({ ...form, photoMediaOptIn: event.target.checked })} /><span><strong>Optional:</strong> I permit Cookie Paradise Travel Company to use trip photos or video featuring me for promotional purposes.</span></label>
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
        <button disabled={submitting} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--orange)] px-6 py-3 font-bold text-white disabled:opacity-50 sm:w-auto" type="submit">{submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Recording…</> : "Accept and sign agreement"}</button>
      </form>
    </>
  );
}

function RequiredCheckbox({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) {
  return <label className="flex gap-3 rounded-2xl border border-[var(--line)] p-4 text-sm leading-6 text-[var(--ink)]"><input required className="mt-1 h-4 w-4 accent-[var(--orange)]" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{children} <strong className="text-[var(--orange)]">Required</strong></span></label>;
}
