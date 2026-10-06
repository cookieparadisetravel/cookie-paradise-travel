"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Link2, Loader2, MailCheck, Plus, ShieldCheck, UserRound } from "lucide-react";
import type { AgreementInvitationDelivery } from "./dashboard-types";
import { privateRoomSupplementCents, publishedPerTravelerPricesCents, publishedTravelerCountByPriceCents } from "@/lib/trip-pricing";

type Traveler = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  travelerType: string;
  dateOfBirth: string | null;
  guardianLegalName: string | null;
  guardianRelationship: string | null;
  confirmedTripPriceCents: number | null;
  confirmedOccupancy: string | null;
};

type Props = {
  inquiryId: number;
  expectedPartySize: number;
  initialTravelers: Traveler[];
  agreementActive: boolean;
  acceptedTravelerIds: number[];
  initialInvitationDeliveries: Record<number, AgreementInvitationDelivery>;
  invoiceExists: boolean;
};

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  travelerType: "adult",
  dateOfBirth: "",
  guardianLegalName: "",
  guardianRelationship: "",
};

export function TravelerAgreementManager({ inquiryId, expectedPartySize, initialTravelers, agreementActive, acceptedTravelerIds, initialInvitationDeliveries, invoiceExists }: Props) {
  const router = useRouter();
  const [travelerList, setTravelerList] = useState(initialTravelers);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invitationDeliveries, setInvitationDeliveries] = useState<Record<number, AgreementInvitationDelivery>>(initialInvitationDeliveries);
  const [invitationErrors, setInvitationErrors] = useState<Record<number, string>>({});
  const [creatingInvitationFor, setCreatingInvitationFor] = useState<number | null>(null);
  const [savingPrices, setSavingPrices] = useState(false);
  const [publishedBasePriceCents, setPublishedBasePriceCents] = useState<number>(() => inferPublishedBasePrice(initialTravelers));
  const [priceMismatchConfirmed, setPriceMismatchConfirmed] = useState(false);
  const [priceValues, setPriceValues] = useState<Record<number, string>>(() => Object.fromEntries(
    initialTravelers.map((traveler) => [traveler.id, traveler.confirmedTripPriceCents ? (traveler.confirmedTripPriceCents / 100).toFixed(2) : ""]),
  ));
  const [occupancyValues, setOccupancyValues] = useState<Record<number, string>>(() => Object.fromEntries(
    initialTravelers.map((traveler) => [traveler.id, traveler.confirmedOccupancy ?? ""]),
  ));
  const complete = travelerList.length === expectedPartySize;
  const travelerCountMismatch = travelerList.length > expectedPartySize;
  const acceptedIds = new Set(acceptedTravelerIds);
  const acceptedCount = travelerList.filter((traveler) => acceptedIds.has(traveler.id)).length;
  const pricingLocked = invoiceExists || Object.keys(invitationDeliveries).length > 0 || acceptedCount > 0;
  const pricingComplete = complete && travelerList.every((traveler) => {
    const value = Number(priceValues[traveler.id]);
    return Number.isFinite(value) && value >= 500 && ["shared", "private"].includes(occupancyValues[traveler.id] ?? "");
  });
  const mismatchedTravelerIds = travelerList.filter((traveler) => {
    const enteredCents = Math.round(Number(priceValues[traveler.id]) * 100);
    const occupancy = occupancyValues[traveler.id];
    if (!Number.isSafeInteger(enteredCents) || enteredCents < 1 || (occupancy !== "shared" && occupancy !== "private")) return false;
    return enteredCents !== expectedTravelerPriceCents(publishedBasePriceCents, occupancy);
  }).map((traveler) => traveler.id);
  const pricesReadyToSave = pricingComplete && (mismatchedTravelerIds.length === 0 || priceMismatchConfirmed);

  async function saveTravelerPrices() {
    setSavingPrices(true);
    setError("");
    try {
      const prices = travelerList.map((traveler) => ({
        travelerId: traveler.id,
        tripPriceCents: Math.round(Number(priceValues[traveler.id]) * 100),
        occupancy: occupancyValues[traveler.id],
      }));
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/traveler-prices`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prices, publishedBasePriceCents, priceMismatchConfirmed }),
      });
      const payload = await response.json() as { error?: string; prices?: Array<{ travelerId: number; tripPriceCents: number; occupancy: string }> };
      if (!response.ok || !payload.prices) throw new Error(payload.error || "The traveler prices could not be saved.");
      const saved = new Map(payload.prices.map((price) => [price.travelerId, price.tripPriceCents]));
      setTravelerList((current) => current.map((traveler) => ({
        ...traveler,
        confirmedTripPriceCents: saved.get(traveler.id) ?? traveler.confirmedTripPriceCents,
        confirmedOccupancy: payload.prices?.find((price) => price.travelerId === traveler.id)?.occupancy ?? traveler.confirmedOccupancy,
      })));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The traveler prices could not be saved.");
    } finally {
      setSavingPrices(false);
    }
  }

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
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The traveler could not be added.");
    } finally {
      setSaving(false);
    }
  }

  async function createInvitation(travelerId: number) {
    setCreatingInvitationFor(travelerId);
    setInvitationErrors((current) => ({ ...current, [travelerId]: "" }));
    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}/travelers/${travelerId}/agreement-invitation`, {
        method: "POST",
      });
      const payload = await response.json() as { error?: string; sentTo?: string; sentAt?: string; expiresAt?: string };
      if (!response.ok || !payload.sentTo || !payload.sentAt || !payload.expiresAt) {
        throw new Error(payload.error || "The secure agreement email could not be sent.");
      }
      setInvitationDeliveries((current) => ({
        ...current,
        [travelerId]: {
          email: payload.sentTo!,
          sentAt: payload.sentAt!,
          expiresAt: payload.expiresAt!,
          revokedAt: null,
          acceptedAt: null,
        },
      }));
      router.refresh();
    } catch (cause) {
      setInvitationErrors((current) => ({
        ...current,
        [travelerId]: cause instanceof Error ? cause.message : "The secure agreement email could not be sent.",
      }));
    } finally {
      setCreatingInvitationFor(null);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]"><ShieldCheck className="h-4 w-4 text-[var(--orange)]" /> Traveler agreements</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">Add every traveler separately. Each adult receives an individual agreement link; a parent or guardian accepts for a minor. Square invoicing remains locked until all required acceptances are recorded.</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${travelerCountMismatch ? "bg-red-100 text-red-900" : complete ? "bg-emerald-100 text-emerald-900" : "bg-white text-[var(--ink)]"}`}>
          {travelerList.length} of {expectedPartySize} entered
        </span>
      </div>

      {travelerCountMismatch && <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900">Traveler-count mismatch: this booking has {travelerList.length} traveler records for a party of {expectedPartySize}. Agreement and payment steps remain blocked until the extra record is resolved.</p>}

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
              <label className="mt-3 block text-xs font-bold text-[var(--ink)]">Confirmed Trip Price
                <span className="mt-1 flex items-center rounded-xl border border-[var(--input)] bg-white px-3"><span className="text-[var(--muted-ink)]">$</span><input aria-label={`Confirmed Trip Price for ${traveler.firstName} ${traveler.lastName}`} disabled={pricingLocked || acceptedIds.has(traveler.id)} inputMode="decimal" pattern="[0-9]*[.]?[0-9]{0,2}" className="min-w-0 flex-1 bg-transparent px-2 py-2 outline-none disabled:cursor-not-allowed disabled:opacity-60" value={priceValues[traveler.id] ?? ""} onChange={(event) => {
                  if (!/^\d*(?:\.\d{0,2})?$/.test(event.target.value)) return;
                  setPriceValues((current) => ({ ...current, [traveler.id]: event.target.value }));
                  setPriceMismatchConfirmed(false);
                }} /></span>
                {(() => {
                  const occupancy = occupancyValues[traveler.id];
                  if (occupancy !== "shared" && occupancy !== "private") return <span className="mt-1 block font-medium text-[var(--muted-ink)]">Choose occupancy to calculate the expected price.</span>;
                  const expectedCents = expectedTravelerPriceCents(publishedBasePriceCents, occupancy);
                  const enteredCents = Math.round(Number(priceValues[traveler.id]) * 100);
                  const matches = Number.isSafeInteger(enteredCents) && enteredCents === expectedCents;
                  return <span className={`mt-1 flex items-center gap-1 font-semibold ${matches ? "text-emerald-800" : "text-amber-800"}`}>{matches ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />} Expected: {money(expectedCents)}{occupancy === "private" ? ` (${money(publishedBasePriceCents)} + ${money(privateRoomSupplementCents)} private-room supplement)` : " for shared occupancy"}.</span>;
                })()}
              </label>
              <label className="mt-3 block text-xs font-bold text-[var(--ink)]">Confirmed occupancy
                <select disabled={pricingLocked || acceptedIds.has(traveler.id)} className="mt-1 min-h-10 w-full rounded-xl border border-[var(--input)] bg-white px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60" value={occupancyValues[traveler.id] ?? ""} onChange={(event) => {
                  setOccupancyValues((current) => ({ ...current, [traveler.id]: event.target.value }));
                  setPriceMismatchConfirmed(false);
                }}>
                  <option value="">Choose occupancy</option>
                  <option value="shared">Shared double/twin room</option>
                  <option value="private">Private room supplement</option>
                </select>
              </label>
              <p className={`mt-3 flex items-center gap-2 text-xs font-semibold ${acceptedIds.has(traveler.id) ? "text-emerald-800" : "text-[var(--muted-ink)]"}`}><CheckCircle2 className="h-3.5 w-3.5" /> {acceptedIds.has(traveler.id) ? "Current agreement accepted" : agreementActive ? "Agreement acceptance pending" : "Agreement invitation not yet enabled"}</p>
              {!acceptedIds.has(traveler.id) && (
                <div className="mt-3">
                  {!invitationDeliveries[traveler.id] ? (
                    <button
                      disabled={!agreementActive || !pricingComplete || creatingInvitationFor === traveler.id}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-45"
                      type="button"
                      onClick={() => createInvitation(traveler.id)}
                    >
                      {creatingInvitationFor === traveler.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                      Email secure link
                    </button>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold leading-5 text-emerald-900">
                      <p className="flex items-start gap-2"><MailCheck className="mt-0.5 h-4 w-4 shrink-0" /> <span>Agreement email recorded as sent to {invitationDeliveries[traveler.id].email} on {formatTimestamp(invitationDeliveries[traveler.id].sentAt)}.</span></p>
                      <details className="mt-2 text-[var(--ink)]">
                        <summary className="cursor-pointer font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--gold)]/35">More options</summary>
                        <button disabled={!agreementActive || !pricingComplete || creatingInvitationFor === traveler.id} className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-2 text-xs font-bold disabled:opacity-45" type="button" onClick={() => createInvitation(traveler.id)}>{creatingInvitationFor === traveler.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />} Send replacement email</button>
                      </details>
                    </div>
                  )}
                  {invitationErrors[traveler.id] && <p className="mt-2 text-xs font-semibold text-red-700">{invitationErrors[traveler.id]}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {complete && !travelerCountMismatch && !pricingLocked && (
        <div className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4">
          <p className="text-sm font-bold text-[var(--ink)]">Individual agreement prices</p>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">Select the published package price used for this booking. Each traveler’s expected Trip Price is checked against that amount and the selected occupancy.</p>
          <label className="mt-3 block max-w-lg text-xs font-bold text-[var(--ink)]">Published package price
            <select className="mt-1 min-h-11 w-full rounded-xl border border-[var(--input)] bg-white px-3 text-sm font-semibold" value={publishedBasePriceCents} onChange={(event) => {
              setPublishedBasePriceCents(Number(event.target.value));
              setPriceMismatchConfirmed(false);
            }}>
              {publishedPerTravelerPricesCents.map((price) => <option key={price} value={price}>{money(price)} per traveler ({publishedTravelerCountByPriceCents[price]} travelers)</option>)}
            </select>
          </label>
          {mismatchedTravelerIds.length === 0 && pricingComplete && <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950"><CheckCircle2 className="h-4 w-4" /> Every traveler price matches the published package price and occupancy.</p>}
          {mismatchedTravelerIds.length > 0 && <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="flex items-start gap-2 font-bold"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {mismatchedTravelerIds.length} traveler price{mismatchedTravelerIds.length === 1 ? " does" : "s do"} not match the expected amount.</p>
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-white/70 p-2 text-xs font-bold"><input checked={priceMismatchConfirmed} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--orange)]" onChange={(event) => setPriceMismatchConfirmed(event.target.checked)} type="checkbox" /><span>I reviewed the differences and confirm that the entered traveler prices are correct.</span></label>
          </div>}
          <button disabled={!pricesReadyToSave || savingPrices} className="mt-3 inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" onClick={saveTravelerPrices}>{savingPrices ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {savingPrices ? "Saving…" : "Save traveler prices"}</button>
        </div>
      )}

      {!complete && !travelerCountMismatch && !showForm && (
        <button className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Add traveler
        </button>
      )}

      {!complete && !travelerCountMismatch && showForm && (
        <form className="mt-4 rounded-xl border border-[var(--line)] bg-white p-4" onSubmit={addTraveler}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[var(--ink)]">First name<input required maxLength={80} className="mt-1 w-full rounded-xl border border-[var(--input)] px-3 py-2 outline-none focus:border-[var(--orange)]" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
            <label className="text-sm font-semibold text-[var(--ink)]">Last name<input required maxLength={80} className="mt-1 w-full rounded-xl border border-[var(--input)] px-3 py-2 outline-none focus:border-[var(--orange)]" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
            <label className="text-sm font-semibold text-[var(--ink)]">Traveler or guardian email<input required type="email" maxLength={254} className="mt-1 w-full rounded-xl border border-[var(--input)] px-3 py-2 outline-none focus:border-[var(--orange)]" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label className="text-sm font-semibold text-[var(--ink)]">Traveler type<select className="mt-1 w-full rounded-xl border border-[var(--input)] bg-white px-3 py-2 outline-none focus:border-[var(--orange)]" value={form.travelerType} onChange={(event) => setForm({ ...form, travelerType: event.target.value, dateOfBirth: "", guardianLegalName: "", guardianRelationship: "" })}><option value="adult">Adult</option><option value="minor">Minor</option></select></label>
            {form.travelerType === "minor" && <>
              <label className="text-sm font-semibold text-[var(--ink)]">Minor date of birth<input required type="date" className="mt-1 w-full rounded-xl border border-[var(--input)] px-3 py-2 outline-none focus:border-[var(--orange)]" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} /></label>
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

      {complete && <p className="mt-4 rounded-xl border border-[var(--gold)]/50 bg-[var(--gold)]/15 p-3 text-sm font-semibold text-[var(--ink)]">{agreementActive ? `${acceptedCount} of ${expectedPartySize} traveler agreements accepted. Save and verify all traveler prices before sending the first agreement link.` : "All traveler records are ready. Secure agreement links are not active."}</p>}
    </section>
  );
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Indiana/Indianapolis",
  });
}

function expectedTravelerPriceCents(basePriceCents: number, occupancy: string) {
  return basePriceCents + (occupancy === "private" ? privateRoomSupplementCents : 0);
}

function inferPublishedBasePrice(travelers: Traveler[]) {
  for (const basePriceCents of publishedPerTravelerPricesCents) {
    const matches = travelers.length > 0 && travelers.every((traveler) => traveler.confirmedTripPriceCents !== null
      && (traveler.confirmedOccupancy === "shared" || traveler.confirmedOccupancy === "private")
      && traveler.confirmedTripPriceCents === expectedTravelerPriceCents(basePriceCents, traveler.confirmedOccupancy));
    if (matches) return basePriceCents;
  }
  return publishedPerTravelerPricesCents[0];
}

function money(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
