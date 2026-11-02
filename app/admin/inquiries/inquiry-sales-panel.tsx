"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SalesProcess } from "@/lib/inquiry-sales-types";
import { inquiryStageLabel, inquiryStageOptions } from "@/lib/inquiry-stage";
const timestamp=(value:string)=>new Date(value).toLocaleString("en-US",{timeZone:"America/Indiana/Indianapolis",dateStyle:"medium",timeStyle:"short"});

export function InquirySalesPanel({sale}:{sale:SalesProcess}) {
  const router=useRouter();
  const [nextAction,setNextAction]=useState(sale.nextAction);
  const [dueDate,setDueDate]=useState(sale.followUpDate || "");
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  const inFlight=useRef(false),submission=useRef<string|null>(null);
  async function update(payload:Record<string,unknown>) {
    if (inFlight.current) return;
    inFlight.current=true;setBusy(true);setMessage("");setError("");
    try {
      const response=await fetch(payload.action==="stage" ? `/api/admin/inquiries/guide/${sale.guideId}` : `/api/admin/inquiries/sales/${sale.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload.action==="stage" ? {status:payload.status} : payload)});
      const result=await response.json() as {error?:string;emailStatus?:string};
      if (!response.ok) throw new Error(result.error || "The update could not be saved.");
      setMessage(payload.action==="start_booking" ? result.emailStatus==="sent" ? "Secure booking link emailed to the customer." : "Email delivery was not confirmed. Review the delivery history before creating a replacement." : "Saved.");
      if (payload.action==="start_booking") submission.current=null;
      router.refresh();
    } catch(failure) {setError(failure instanceof Error ? failure.message : "The update could not be saved.");}
    finally {inFlight.current=false;setBusy(false);}
  }
  const activity:{event:string;at:string;details:string|null}[]=JSON.parse(sale.activityJson || "[]");
  const activityLabels:Record<string,string>={stage_changed:"Stage updated",follow_up_saved:"Follow-up saved",consultation_booked:"Consultation booked",consultation_completed:"Call completed",booking_invitation:"Booking invitation",booking_started:"Booking started"};
  const active=!["closed","waitlist","reserved"].includes(sale.stage);
  const canStart=active && sale.bookingIntent!=="ready_to_book" && sale.squareEnvironment==="production" && (!sale.tripSlug || sale.tripSlug==="vietnam-southern-charms-central-heritage");
  return <section className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6" aria-label="Sales process">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-2xl font-bold">Sales process</h2>{sale.bookingId ? <span className="rounded-full bg-[var(--cream)] px-3 py-1 text-sm font-bold">{inquiryStageLabel(sale.stage) || sale.stage}</span> : <label className="text-sm font-bold">Inquiry stage<select className="ml-3 min-h-11 rounded-xl border border-[var(--line)] bg-white px-3" value={sale.stage} disabled={busy} onChange={event=>{void update({action:"stage",status:event.target.value});}}>{inquiryStageOptions.map(([value,label])=><option key={value} value={value} disabled={value==="reserved"}>{label}</option>)}</select></label>}</div>
    <ol className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Sales milestones">
      <li>✓ {sale.guideId ? "Guide requested" : "Inquiry received"}</li><li>{sale.consultationBookedAt ? "✓" : "○"} Consultation booked</li><li>{sale.bookingIntent==="ready_to_book" ? "✓" : "○"} Booking started</li><li>{sale.stage==="reserved" ? "✓" : "○"} Reserved</li>
    </ol>
    {sale.consultationBookedAt && <p className="mt-3 text-sm leading-6">{sale.consultationStartsAt ? `Consultation: ${timestamp(sale.consultationStartsAt)} · Indiana time` : "Consultation booking recorded; calendar details are not yet available."}{sale.consultationCompletedAt && ` · Completed ${timestamp(sale.consultationCompletedAt)}`}</p>}
    <form className="mt-5 grid gap-4 sm:grid-cols-[1fr_190px_auto] sm:items-end" onSubmit={event=>{event.preventDefault();void update({action:"followup",nextAction,dueDate:dueDate || null});}}>
      <label className="text-sm font-bold">Next action<input className="field-input mt-2 w-full font-normal" value={nextAction} disabled={busy} onChange={event=>setNextAction(event.target.value)} maxLength={500} placeholder="Discuss flights, answer room questions…" /></label>
      <label className="text-sm font-bold">Follow-up date (Indiana)<input className="field-input mt-2 w-full font-normal" type="date" disabled={busy} value={dueDate} onChange={event=>setDueDate(event.target.value)} /></label>
      <button className="min-h-11 rounded-full bg-[var(--gold)] px-5 text-sm font-bold disabled:opacity-50" disabled={busy} type="submit">Save follow-up</button>
    </form>
    {active && <div className="mt-4 flex flex-wrap gap-3">
      {sale.stage==="new" && <button disabled={busy} className="min-h-11 rounded-full border border-[var(--line)] px-4 text-sm font-bold disabled:opacity-50" onClick={()=>{void update({action:"contacted"});}}>Mark contacted</button>}
      {sale.squareEnvironment==="production" && !sale.consultationBookedAt && <button disabled={busy} className="min-h-11 rounded-full border border-[var(--line)] px-4 text-sm font-bold disabled:opacity-50" onClick={()=>{void update({action:"consultation_booked"});}}>Mark consultation booked</button>}
      {sale.squareEnvironment==="production" && sale.consultationBookedAt && !sale.consultationCompletedAt && <button disabled={busy} className="min-h-11 rounded-full border border-[var(--line)] px-4 text-sm font-bold disabled:opacity-50" onClick={()=>{void update({action:"consultation_completed"});}}>Record call completed</button>}
      {canStart && <button disabled={busy} className="min-h-11 rounded-full bg-[var(--orange)] px-5 text-sm font-bold text-white disabled:opacity-50" onClick={()=>{submission.current ??= crypto.randomUUID();void update({action:"start_booking",submissionId:submission.current});}}>{sale.invitationStatus ? "Email replacement booking link" : "Start booking · Email secure link"}</button>}
    </div>}
    {canStart && <p className="mt-3 text-sm leading-6">Booking links are for June 1–8, 2027 and are valid for seven days. A replacement link expires the previous one. The customer reviews their saved details and chooses to proceed before agreement and payment steps begin.</p>}
    {sale.invitationStatus && <p className="mt-3 text-sm">Latest booking invitation: {sale.invitationStatus.replaceAll("_"," ")}{sale.invitationSentAt && ` · ${timestamp(sale.invitationSentAt)} · Indiana time`}</p>}
    {activity.length>0 && <details className="mt-4 border-t border-[var(--line)] pt-4"><summary className="cursor-pointer text-sm font-bold">Sales activity · Indiana time</summary><ul className="mt-3 space-y-2 text-sm">{activity.map((item,index)=>{const details=item.details ? JSON.parse(item.details) as Record<string,unknown> : {};return <li key={index}>{timestamp(item.at)} · {activityLabels[item.event] || item.event}{item.event==="follow_up_saved" && typeof details.nextAction==="string" ? ` · ${details.nextAction || "Follow-up cleared"}${typeof details.dueDate==="string" ? ` · Due ${details.dueDate}` : ""}` : ""}{item.event==="stage_changed" && typeof details.to==="string" ? ` · ${inquiryStageLabel(details.to) || details.to}` : ""}</li>;})}</ul></details>}
    {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    <p role="status" className="mt-3 text-sm">{message}</p>
  </section>;
}
