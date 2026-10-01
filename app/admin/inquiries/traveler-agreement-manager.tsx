"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Plus, ShieldCheck, UserRound } from "lucide-react";

type Traveler = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  travelerType: string;
  guardianLegalName: string | null;
  guardianRelationship: string | null;
};

type Props = {
  inquiryId: number;
  expectedPartySize: number;
  initialTravelers: Traveler[];
  agreementActive: boolean;
  acceptedTravelerIds: number[];
};

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  travelerType: "adult",
  guardianLegalName: "",
  guardianRelationship: "",
};

export function TravelerAgreementManager({ inquiryId, expectedPartySize, initialTravelers, agreementActive, acceptedTravelerIds }: Props) {
  const [travelerList, setTravelerList] = useState(initialTravelers);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(initialTravelers.length < expectedPartySize);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const complete = travelerList.length >= expectedPartySize;
  const acceptedIds = new Set(acceptedTravelerIds);
  const acceptedCount = travelerList.filter((traveler) => acceptedIds.has(traveler.id)).length;

  async function addTraveler(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/travelers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json() as { error?: string; traveler?: Traveler };
      if (!response.ok || !payload.traveler) throw new Error(payload.error || "The traveler could not be added.");
      const nextList = [...travelerList, payload.traveler];
      setTravelerList(nextList);
      setForm(emptyForm);
      if (nextList.length >= expectedPartySize) setShowForm(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The traveler could not be added.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]"><ShieldCheck className="h-4 w-4 text-[var(--orange)]" /> Traveler agreements</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">Add every traveler separately. Each adult receives an individual agreement link; a parent or guardian accepts for a minor. Square invoicing remains locked until all required acceptances are recorded.</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${complete ? "bg-emerald-100 text-emerald-900" : "bg-white text-[var(--ink)]"}`}>
          {travelerList.length} of {expectedPartySize} entered
        </span>
      </div>

      {travelerList.length > 0 && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {travelerList.map((traveler) => (
            <div key={traveler.id} className="rounded-xl border border-[var(--line)] bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="rounded-full bg-[var(--gold)]/25 p-2 text-[var(--ink)]"><UserRound className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="font-bold text-[var(--ink)]">{traveler.firstName} {traveler.lastName}</p>
                  <p className="break-all text-sm text-[var(--muted-ink)]">{traveler.email}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--orange)]">{traveler.travelerType}</p>
                  {traveler.travelerType === "minor" && traveler.guardianLegalName && (
                    <p className="mt-1 text-sm text-[var(--muted-ink)]">Guardian: {traveler.guardianLegalName}{traveler.guardianRelationship ? ` (${traveler.guardianRelationship})` : ""}</p>
                  )}
                </div>
              </div>
              <p className={`mt-3 flex items-center gap-2 text-xs font-semibold ${acceptedIds.has(traveler.id) ? "text-emerald-800" : "text-[var(--muted-ink)]"}`}><CheckCircle2 className="h-3.5 w-3.5" /> {acceptedIds.has(traveler.id) ? "Current agreement accepted" : agreementActive ? "Agreement acceptance pending" : "Agreement invitation not yet enabled"}</p>
            </div>
          ))}
        </div>
      )}

      {!complete && !showForm && (
        <button className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Add traveler
        </button>
      )}

      {!complete && showForm && (
        <form className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4" onSubmit={addTraveler}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[var(--ink)]">First name<input required maxLength={80} className="mt-1 w-full rounded-xl border border-[var(--input)] px-3 py-2 outline-none focus:border-[var(--orange)]" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
            <label className="text-sm font-semibold text-[var(--ink)]">Last name<input required maxLength={80} className="mt-1 w-full rounded-xl border border-[var(--input)] px-3 py-2 outline-none focus:border-[var(--orange)]" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
            <label className="text-sm font-semibold text-[var(--ink)]">Traveler or guardian email<input required type="email" maxLength={254} className="mt-1 w-full rounded-xl border border-[var(--input)] px-3 py-2 outline-none focus:border-[var(--orange)]" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label className="text-sm font-semibold text-[var(--ink)]">Traveler type<select className="mt-1 w-full rounded-xl border border-[var(--input)] bg-white px-3 py-2 outline-none focus:border-[var(--orange)]" value={form.travelerType} onChange={(event) => setForm({ ...form, travelerType: event.target.value })}><option value="adult">Adult</option><option value="minor">Minor</option></select></label>
            {form.travelerType === "minor" && <>
              <label className="text-sm font-semibold text-[var(--ink)]">Parent or guardian legal name<input required maxLength={160} className="mt-1 w-full rounded-xl border border-[var(--input)] px-3 py-2 outline-none focus:border-[var(--orange)]" value={form.guardianLegalName} onChange={(event) => setForm({ ...form, guardianLegalName: event.target.value })} /></label>
              <label className="text-sm font-semibold text-[var(--ink)]">Relationship to minor<input required maxLength={80} className="mt-1 w-full rounded-xl border border-[var(--input)] px-3 py-2 outline-none focus:border-[var(--orange)]" placeholder="Parent, legal guardian, etc." value={form.guardianRelationship} onChange={(event) => setForm({ ...form, guardianRelationship: event.target.value })} /></label>
            </>}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50" type="submit">{saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save traveler"}</button>
            {travelerList.length > 0 && <button disabled={saving} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--ink)]" type="button" onClick={() => setShowForm(false)}>Cancel</button>}
          </div>
          {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        </form>
      )}

      {complete && <p className="mt-4 rounded-xl border border-[var(--gold)]/50 bg-[var(--gold)]/15 p-3 text-sm font-semibold text-[var(--ink)]">{agreementActive ? `${acceptedCount} of ${expectedPartySize} traveler agreements accepted.` : "All traveler records are ready. Secure agreement links will be enabled only after the final agreement receives legal approval."}</p>}
    </section>
  );
}
