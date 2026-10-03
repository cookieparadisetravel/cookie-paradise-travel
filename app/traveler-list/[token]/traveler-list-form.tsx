"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, UserRound } from "lucide-react";

type TravelerForm = {
  firstName: string;
  lastName: string;
  email: string;
  travelerType: "adult" | "minor";
  dateOfBirth: string;
  guardianLegalName: string;
  guardianRelationship: string;
};

const emptyTraveler = (): TravelerForm => ({
  firstName: "",
  lastName: "",
  email: "",
  travelerType: "adult",
  dateOfBirth: "",
  guardianLegalName: "",
  guardianRelationship: "",
});

type Props = {
  token: string;
  primaryContactName: string;
  departure: string;
  remainingTravelerCount: number;
};

export function TravelerListForm({ token, primaryContactName, departure, remainingTravelerCount }: Props) {
  const [travelers, setTravelers] = useState<TravelerForm[]>(() => Array.from({ length: remainingTravelerCount }, emptyTraveler));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [completedAt, setCompletedAt] = useState("");

  function updateTraveler(index: number, changes: Partial<TravelerForm>) {
    setTravelers((current) => current.map((traveler, travelerIndex) => travelerIndex === index ? { ...traveler, ...changes } : traveler));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/traveler-lists/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ travelers }),
      });
      const payload = await response.json() as { error?: string; completedAt?: string };
      if (!response.ok || !payload.completedAt) throw new Error(payload.error || "The traveler list could not be submitted.");
      setCompletedAt(payload.completedAt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The traveler list could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }

  if (completedAt) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-emerald-950 shadow-sm sm:p-10">
        <CheckCircle2 className="h-11 w-11 text-emerald-700" />
        <h1 className="mt-5 font-serif text-3xl sm:text-4xl">Traveler list received</h1>
        <p className="mt-4 leading-7">Thank you. Your traveler information was securely recorded on {new Date(completedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}.</p>
        <p className="mt-2 text-sm">Cookie Paradise Travel Company will review the list before sending any traveler agreements or payment invoice.</p>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--orange)]">Vietnam traveler list</p>
        <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Hello, {primaryContactName}</h1>
        <p className="mt-4 leading-7 text-[var(--muted-ink)]">Please provide the information below for {remainingTravelerCount} traveler{remainingTravelerCount === 1 ? "" : "s"} on the {departure} departure. Use each traveler’s legal name as it appears on their identification.</p>
        <div className="mt-5 flex gap-3 rounded-2xl border border-[var(--gold)]/50 bg-[var(--gold)]/15 p-4 text-sm leading-6">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--orange)]" />
          <p>Do not enter passport numbers, medical information or payment details. Adult travelers should use their own email. For a minor, use the parent or guardian’s email.</p>
        </div>
      </section>

      <form className="mt-6 space-y-5" onSubmit={submit}>
        {travelers.map((traveler, index) => (
          <section key={index} className="rounded-3xl border border-[var(--line)] bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3"><span className="rounded-full bg-[var(--gold)]/25 p-2"><UserRound className="h-5 w-5" /></span><h2 className="font-serif text-2xl">Traveler {index + 1}</h2></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Legal first name<input required maxLength={80} autoComplete="given-name" className="mt-1 w-full rounded-xl border border-[var(--input)] px-4 py-3 outline-none focus:border-[var(--orange)]" value={traveler.firstName} onChange={(event) => updateTraveler(index, { firstName: event.target.value })} /></label>
              <label className="text-sm font-semibold">Legal last name<input required maxLength={80} autoComplete="family-name" className="mt-1 w-full rounded-xl border border-[var(--input)] px-4 py-3 outline-none focus:border-[var(--orange)]" value={traveler.lastName} onChange={(event) => updateTraveler(index, { lastName: event.target.value })} /></label>
              <label className="text-sm font-semibold">Traveler type<select className="mt-1 w-full rounded-xl border border-[var(--input)] bg-white px-4 py-3 outline-none focus:border-[var(--orange)]" value={traveler.travelerType} onChange={(event) => updateTraveler(index, { travelerType: event.target.value as "adult" | "minor", dateOfBirth: "", guardianLegalName: "", guardianRelationship: "" })}><option value="adult">Adult</option><option value="minor">Minor</option></select></label>
              <label className="text-sm font-semibold">{traveler.travelerType === "minor" ? "Parent or guardian email" : "Traveler email"}<input required type="email" maxLength={254} autoComplete="email" className="mt-1 w-full rounded-xl border border-[var(--input)] px-4 py-3 outline-none focus:border-[var(--orange)]" value={traveler.email} onChange={(event) => updateTraveler(index, { email: event.target.value })} /></label>
              {traveler.travelerType === "minor" && <>
                <label className="text-sm font-semibold">Minor traveler date of birth<input required type="date" className="mt-1 w-full rounded-xl border border-[var(--input)] px-4 py-3 outline-none focus:border-[var(--orange)]" value={traveler.dateOfBirth} onChange={(event) => updateTraveler(index, { dateOfBirth: event.target.value })} /></label>
                <label className="text-sm font-semibold">Parent or guardian legal name<input required maxLength={160} className="mt-1 w-full rounded-xl border border-[var(--input)] px-4 py-3 outline-none focus:border-[var(--orange)]" value={traveler.guardianLegalName} onChange={(event) => updateTraveler(index, { guardianLegalName: event.target.value })} /></label>
                <label className="text-sm font-semibold">Relationship to minor<input required maxLength={80} placeholder="Parent, legal guardian, etc." className="mt-1 w-full rounded-xl border border-[var(--input)] px-4 py-3 outline-none focus:border-[var(--orange)]" value={traveler.guardianRelationship} onChange={(event) => updateTraveler(index, { guardianRelationship: event.target.value })} /></label>
              </>}
            </div>
          </section>
        ))}

        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</p>}
        <button disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--orange)] px-6 py-3 font-bold text-white disabled:opacity-50 sm:w-auto" type="submit">{submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : "Submit traveler list"}</button>
      </form>
    </>
  );
}
