"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GuideLeadRow } from "@/lib/lead-inbox";
import { guideTimingLabel, leadStageLabel, leadStages } from "@/lib/trip-guide";
import { getSalonPartner } from "@/lib/salon-referrals";

const date = (value: string | null) => value ? new Date(value).toLocaleString("en-US", { timeZone: "America/Indiana/Indianapolis", dateStyle: "medium", timeStyle: "short" }) : "Not recorded";
export function GuideRequestSummary({ lead, showContact = true }: { lead: GuideLeadRow; showContact?: boolean }) {
  const router = useRouter();
  const history: { event: string; status: string; createdAt: string; sentAt: string | null }[] = JSON.parse(lead.followup_history || "[]");
  const historyLabel: Record<string,string> = { reopened: "New request reopened this inquiry", closed: "Request closed", guide_email: "Guide email", owner_notification: "Owner notification", reminder_3: "Day 3 consultation reminder", reminder_7: "Day 7 consultation reminder" };
  const [status, setStatus] = useState(lead.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function changeStatus(next: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/inquiries/guide/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
      if (!response.ok) throw new Error("The stage could not be saved. Please try again.");
      setStatus(next); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The stage could not be saved."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6" aria-label="Trip guide request">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-widest text-[var(--orange)]">Guide request</p><h2 className="mt-2 font-serif text-2xl font-bold">{showContact ? lead.first_name : "Trip guide and follow-up"}</h2></div>
      <label className="text-sm font-bold">Guide request stage<select className="mt-2 block min-h-11 rounded-xl border border-[var(--line)] bg-white px-3 font-normal" value={status} disabled={busy} onChange={event => { void changeStatus(event.target.value); }}>{leadStages.map(value => <option key={value} value={value}>{leadStageLabel(value)}</option>)}</select></label>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-3 [&_dt]:font-bold [&_dd]:mt-1 [&_dd]:break-words">
      {showContact && <><div><dt>Email</dt><dd><a className="underline" href={`mailto:${lead.email}`}>{lead.email}</a></dd></div><div><dt>Phone</dt><dd>{lead.phone ? <a className="underline" href={`tel:${lead.phone}`}>{lead.phone}</a> : "Not provided"}</dd></div></>}
      <div><dt>Travel interest</dt><dd>{guideTimingLabel(lead.travel_timing)}</dd></div>
      <div><dt>First requested</dt><dd>{date(lead.created_at)} · Indiana time</dd></div>
      {lead.renewed_at && <div><dt>Renewed request</dt><dd>{date(lead.renewed_at)} · Indiana time</dd></div>}
      <div><dt>Source</dt><dd>{(lead.sources || lead.source).split(",").map(value => value === "meta" ? "Facebook" : "Website").join(", ")} · {lead.submission_count} request(s)</dd></div>
      <div><dt>{lead.renewed_at ? "Original guide email" : "Guide email"}</dt><dd>{lead.guide_email_status.replaceAll("_", " ")}{lead.guide_email_sent_at && ` · ${date(lead.guide_email_sent_at)}`}</dd></div>
      <div><dt>{lead.renewed_at ? "Original consultation reminders" : "Consultation reminders"}</dt><dd>{lead.reminder_days_sent ? `Sent: day ${lead.reminder_days_sent.replaceAll(",", ", day ")}` : "None sent"}{lead.reminder_failures > 0 && " · Delivery needs review"}</dd></div>
      <div><dt>Consultation booked</dt><dd>{date(lead.consultation_booked_at)}</dd></div>
      <div><dt>First contacted</dt><dd>{date(lead.contacted_at)}</dd></div>
      <div><dt>Referral partner</dt><dd>{getSalonPartner(lead.referral_code)?.name ?? lead.referral_code ?? "Direct request"}</dd></div>
      <div><dt>Future trip news</dt><dd>{lead.marketing_consent ? "Opted in" : "Not requested"}</dd></div>
      {lead.city !== "Not provided" && <div><dt>City</dt><dd>{lead.city}</dd></div>}
      {lead.campaign && <div><dt>Campaign</dt><dd>{lead.campaign}</dd></div>}
      {lead.audience && <div><dt>Ad audience</dt><dd>{lead.audience}</dd></div>}
    </dl>
    {history.length > 0 && <div className="mt-6 border-t border-[var(--line)] pt-5"><h3 className="text-sm font-bold">Follow-up history · Indiana time</h3><ul className="mt-3 space-y-2 text-sm">{history.map((event,index) => <li key={index}>{date(event.sentAt || event.createdAt)} · {historyLabel[event.event] || event.event} · {event.status.replaceAll("_", " ")}</li>)}</ul></div>}
    {["failed", "not_configured", "sending"].includes(lead.guide_email_status) && <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-950">Guide email delivery needs review. Check the delivery record before resending; the provider may already have accepted the email.</p>}
    <p className="mt-5 text-sm leading-6 text-[var(--muted-ink)]">Mark the consultation booked or close this request to stop its guide reminders. A matching active booking inquiry also stops them automatically. A fresh guide request can reopen a closed inquiry; its earlier history stays here.</p>
    {showContact && lead.booking_id !== null && <a className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[var(--gold)] px-5 text-sm font-bold" href={`/admin/inquiries/${lead.booking_id}`}>Open booking inquiry →</a>}
  </section>;
}
