"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, KeyRound, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import type { AgreementDocument } from "@/lib/traveler-agreement";

type Props = {
  token: string;
  agreement: AgreementDocument;
  traveler: {
    firstName: string;
    lastName: string;
    email: string;
    travelerType: string;
    dateOfBirth: string | null;
    guardianLegalName: string | null;
    guardianRelationship: string | null;
    recipientEmail: string;
    emailVerifiedAt: string | null;
  };
};

type FormState = {
  signerLegalName: string;
  travelerInitials: string;
  guardianRelationship: string;
  minorDateOfBirth: string;
  electronicSignatureConsent: boolean;
  electronicRecordsDisclosureAccepted: boolean;
  agreementConsent: boolean;
  depositAcknowledged: boolean;
  cancellationAcknowledged: boolean;
  insuranceSelection: string;
  insuranceAcknowledged: boolean;
  releaseAcknowledged: boolean;
  insuranceProvider: string;
  photoMediaOptIn: boolean;
};

const initialForm: FormState = {
  signerLegalName: "",
  travelerInitials: "",
  guardianRelationship: "",
  minorDateOfBirth: "",
  electronicSignatureConsent: false,
  electronicRecordsDisclosureAccepted: false,
  agreementConsent: false,
  depositAcknowledged: false,
  cancellationAcknowledged: false,
  insuranceSelection: "",
  insuranceAcknowledged: false,
  releaseAcknowledged: false,
  insuranceProvider: "",
  photoMediaOptIn: false,
};

export function AgreementAcceptanceForm({ token, agreement, traveler }: Props) {
  const [form, setForm] = useState({ ...initialForm, minorDateOfBirth: traveler.dateOfBirth ?? "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [acceptedAt, setAcceptedAt] = useState("");
  const [signedPdfBase64, setSignedPdfBase64] = useState("");
  const [signedPdfFilename, setSignedPdfFilename] = useState("signed-traveler-agreement.pdf");
  const [copyEmailStatus, setCopyEmailStatus] = useState<"sent" | "error" | "">("");
  const [emailVerified, setEmailVerified] = useState(Boolean(traveler.emailVerifiedAt));
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [viewedToEnd, setViewedToEnd] = useState(false);
  const agreementEndRef = useRef<HTMLDivElement>(null);
  const isMinor = traveler.travelerType === "minor";

  useEffect(() => {
    const element = agreementEndRef.current;
    if (!element || viewedToEnd) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setViewedToEnd(true);
    }, { threshold: 0.8 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewedToEnd]);

  async function sendVerificationCode() {
    setSendingCode(true);
    setVerificationError("");
    try {
      const response = await fetch(`/api/traveler-agreements/${encodeURIComponent(token)}/verification-code`, { method: "POST" });
      const payload = await response.json() as { error?: string; maskedEmail?: string; verified?: boolean };
      if (!response.ok) throw new Error(payload.error || "The verification code could not be sent.");
      if (payload.verified) {
        setEmailVerified(true);
        setVerificationMessage("Email address already verified.");
      } else {
        setVerificationMessage(`A six-digit code was sent to ${payload.maskedEmail || "your recorded email address"}.`);
      }
    } catch (cause) {
      setVerificationError(cause instanceof Error ? cause.message : "The verification code could not be sent.");
    } finally {
      setSendingCode(false);
    }
  }

  async function verifyCode() {
    setVerifyingCode(true);
    setVerificationError("");
    try {
      const response = await fetch(`/api/traveler-agreements/${encodeURIComponent(token)}/verify-code`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: verificationCode }),
      });
      const payload = await response.json() as { error?: string; verified?: boolean };
      if (!response.ok || !payload.verified) throw new Error(payload.error || "The code could not be verified.");
      setEmailVerified(true);
      setVerificationCode("");
      setVerificationMessage("Email verified. You may now sign the agreement.");
    } catch (cause) {
      setVerificationError(cause instanceof Error ? cause.message : "The code could not be verified.");
    } finally {
      setVerifyingCode(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/traveler-agreements/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, agreementViewedToEnd: viewedToEnd }),
      });
      const payload = await response.json() as {
        error?: string;
        acceptedAt?: string;
        signedPdfBase64?: string;
        signedPdfFilename?: string;
        copyEmailStatus?: "sent" | "error";
      };
      if (!response.ok || !payload.acceptedAt) throw new Error(payload.error || "Your acceptance could not be recorded.");
      setAcceptedAt(payload.acceptedAt);
      setSignedPdfBase64(payload.signedPdfBase64 ?? "");
      setSignedPdfFilename(payload.signedPdfFilename ?? "signed-traveler-agreement.pdf");
      setCopyEmailStatus(payload.copyEmailStatus ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your acceptance could not be recorded.");
    } finally {
      setSubmitting(false);
    }
  }

  function downloadSignedPdf() {
    if (!signedPdfBase64) return;
    const binary = atob(signedPdfBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = signedPdfFilename;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (acceptedAt) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-emerald-950 shadow-sm">
        <CheckCircle2 className="h-10 w-10 text-emerald-700" />
        <h2 className="mt-4 font-serif text-3xl">Agreement accepted</h2>
        <p className="mt-3 leading-7">Thank you. Your acceptance was securely recorded on {new Date(acceptedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}.</p>
        {copyEmailStatus === "sent" && <p className="mt-2 text-sm">A PDF copy of the signed agreement was emailed to the verified address.</p>}
        {copyEmailStatus === "error" && <p role="alert" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">Your signature was recorded, but the email copy could not be delivered. Download and keep the signed PDF below, then contact Cookie Paradise Travel Company for assistance.</p>}
        {signedPdfBase64 && <button className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-800 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-900" type="button" onClick={downloadSignedPdf}><Download className="h-4 w-4" /> Download signed PDF</button>}
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

      <section className="mt-6 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-9">
        <div className="flex items-center gap-3">
          {emailVerified ? <MailCheck className="h-6 w-6 text-emerald-700" /> : <KeyRound className="h-6 w-6 text-[var(--orange)]" />}
          <h2 className="font-serif text-3xl text-[var(--ink)]">Verify your email</h2>
        </div>
        {emailVerified ? (
          <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-950">Email verified. Continue reviewing the agreement below.</p>
        ) : (
          <>
            <p className="mt-3 leading-7 text-[var(--muted-ink)]">For your protection, request a one-time code sent to the email address where this agreement link was delivered.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <button disabled={sendingCode} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--line)] px-5 py-3 text-sm font-bold text-[var(--ink)] disabled:opacity-50" type="button" onClick={sendVerificationCode}>{sendingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Send verification code</button>
              <label className="text-sm font-semibold text-[var(--ink)]">Six-digit code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" className="mt-2 w-full rounded-xl border border-[var(--input)] px-4 py-3 tracking-[0.25em] outline-none focus:border-[var(--orange)] sm:w-48" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/gu, ""))} /></label>
              <button disabled={verifyingCode || verificationCode.length !== 6} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--orange)] px-5 py-3 text-sm font-bold text-white disabled:opacity-50" type="button" onClick={verifyCode}>{verifyingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Verify</button>
            </div>
            {verificationMessage && <p className="mt-4 text-sm font-semibold text-emerald-800">{verificationMessage}</p>}
            {verificationError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{verificationError}</p>}
          </>
        )}
      </section>

      <article className="mt-6 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-9">
        <div className="border-b border-[var(--line)] pb-6">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Version {agreement.version} · Effective {agreement.effectiveDate}</p>
          <h2 className="mt-2 font-serif text-3xl text-[var(--ink)]">{agreement.title}</h2>
          <a className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--line)] px-5 py-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--sand)]" href={`/api/traveler-agreements/${encodeURIComponent(token)}/document`}><Download className="h-4 w-4" /> Download agreement PDF</a>
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
          <div ref={agreementEndRef} className="rounded-2xl border border-[var(--gold)]/60 bg-[var(--gold)]/15 p-4 text-sm font-semibold text-[var(--ink)]">You have reached the end of the agreement. You may now complete the acceptance section below.</div>
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
          {isMinor && <label className="text-sm font-semibold text-[var(--ink)]">Minor traveler date of birth<input required type="date" className="mt-2 w-full rounded-xl border border-[var(--input)] px-4 py-3 outline-none focus:border-[var(--orange)]" value={form.minorDateOfBirth} onChange={(event) => setForm({ ...form, minorDateOfBirth: event.target.value })} /></label>}
          <label className="text-sm font-semibold text-[var(--ink)]">Travel insurance decision<select required className="mt-2 w-full rounded-xl border border-[var(--input)] bg-white px-4 py-3 outline-none focus:border-[var(--orange)]" value={form.insuranceSelection} onChange={(event) => setForm({ ...form, insuranceSelection: event.target.value })}><option value="">Choose one</option><option value="purchased">I have purchased travel insurance</option><option value="will_purchase">I intend to purchase travel insurance</option><option value="declined">I decline travel insurance</option></select></label>
          {(form.insuranceSelection === "purchased" || form.insuranceSelection === "will_purchase") && <label className="text-sm font-semibold text-[var(--ink)]">Insurance provider, if known<input maxLength={120} className="mt-2 w-full rounded-xl border border-[var(--input)] px-4 py-3 outline-none focus:border-[var(--orange)]" value={form.insuranceProvider} onChange={(event) => setForm({ ...form, insuranceProvider: event.target.value })} /></label>}
        </div>

        <div className="mt-7 space-y-4">
          <RequiredCheckbox checked={form.electronicSignatureConsent} onChange={(value) => setForm({ ...form, electronicSignatureConsent: value, electronicRecordsDisclosureAccepted: value })}>I consent to use an electronic signature and understand it has the same legal effect as a handwritten signature. I can request a paper copy at no charge, or withdraw consent to electronic signing, by emailing <a className="font-bold underline" href="mailto:trung@cookieparadisetravel.com">trung@cookieparadisetravel.com</a>. I need a device that can receive email and open PDF files.</RequiredCheckbox>
          <RequiredCheckbox checked={form.agreementConsent} onChange={(value) => setForm({ ...form, agreementConsent: value })}>I have read, understand and agree to the Traveler Agreement and Booking Terms shown above.</RequiredCheckbox>
          <RequiredCheckbox checked={form.depositAcknowledged} onChange={(value) => setForm({ ...form, depositAcknowledged: value })}>I understand that the $500 per traveler reservation deposit is nonrefundable, subject to Sections 4, 12 and 14 of the agreement.</RequiredCheckbox>
          <RequiredCheckbox checked={form.cancellationAcknowledged} onChange={(value) => setForm({ ...form, cancellationAcknowledged: value })}>I have reviewed and acknowledge the cancellation terms in the agreement.</RequiredCheckbox>
          <RequiredCheckbox checked={form.insuranceAcknowledged} onChange={(value) => setForm({ ...form, insuranceAcknowledged: value })}>I separately confirm the travel-insurance decision selected above.</RequiredCheckbox>
          <RequiredCheckbox checked={form.releaseAcknowledged} onChange={(value) => setForm({ ...form, releaseAcknowledged: value })}>I separately acknowledge the responsibility, release, assumption-of-risk and limitation provisions in the agreement.</RequiredCheckbox>
          <label className="flex gap-3 rounded-2xl border border-[var(--line)] p-4 text-sm leading-6 text-[var(--ink)]"><input className="mt-1 h-4 w-4 accent-[var(--orange)]" type="checkbox" checked={form.photoMediaOptIn} onChange={(event) => setForm({ ...form, photoMediaOptIn: event.target.checked })} /><span><strong>Optional:</strong> I permit Cookie Paradise Travel Company to use trip photos or video featuring me for promotional purposes.</span></label>
        </div>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
        {!emailVerified && <p className="mt-5 text-sm font-semibold text-red-800">Verify your email before signing.</p>}
        {!viewedToEnd && <p className="mt-2 text-sm font-semibold text-[var(--muted-ink)]">Read to the end of the agreement before signing.</p>}
        <button disabled={submitting || !emailVerified || !viewedToEnd} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--orange)] px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" type="submit">{submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Recording…</> : "Accept and sign agreement"}</button>
      </form>
    </>
  );
}

function RequiredCheckbox({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) {
  return <label className="flex gap-3 rounded-2xl border border-[var(--line)] p-4 text-sm leading-6 text-[var(--ink)]"><input required className="mt-1 h-4 w-4 accent-[var(--orange)]" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{children} <strong className="text-[var(--orange)]">Required</strong></span></label>;
}
