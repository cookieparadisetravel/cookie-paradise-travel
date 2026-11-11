"use client";
import { useState, type FormEvent } from "react";
import type { WelcomeCredit } from "@/lib/welcome-credit";
export function CreditsClient({credits,query}:{credits:WelcomeCredit[];query:string}){
  const [rows,setRows]=useState(credits),[error,setError]=useState(""),[busy,setBusy]=useState("");
  async function redeem(event:FormEvent<HTMLFormElement>,id:string){
    event.preventDefault();const data=new FormData(event.currentTarget);setBusy(id);setError("");
    const reference=String(data.get("reference")||"");
    try{
      const response=await fetch("/api/admin/welcome-credits",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,bookingReference:reference,applied:data.get("applied")==="on"})});
      const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error);
      setRows(current=>current.map(row=>row.id===id?{...row,redeemed_at:new Date().toISOString(),booking_reference:reference}:row));
    }catch(e){setError(e instanceof Error?e.message:"Could not save.");}finally{setBusy("");}
  }
  const date=(value:string)=>new Date(value).toLocaleString("en-US",{timeZone:"America/Indiana/Indianapolis"});
  return <main className="ws-legacy-page"><div className="mx-auto max-w-5xl">
    <p className="ws-eyebrow">A WARM WELCOME</p>
    <h1 className="font-serif text-4xl">$50 welcome credits</h1>
    <p className="my-4 max-w-3xl leading-7">One credit per subscribed email, for one hosted or private/FIT Vietnam booking. Verify the customer’s email, deduct $50 from their quote or invoice, then record the booking reference here. This ledger records the credit; it does not change agreements, prices, or Square invoices.</p>
    <p className="mb-5 text-sm">For hosted bookings, arrange the credit before sending agreements and payment requests. If documents have already been issued, reconcile the adjustment with the customer first. Only confirmed subscriptions can be marked used.</p>
    <form className="mb-6 flex flex-wrap gap-3"><input name="q" defaultValue={query} aria-label="Search name or email" placeholder="Search name or email" className="min-h-12 flex-1 rounded-xl border bg-white px-4"/><button className="rounded-full bg-[#f7b658] px-6 py-3 font-bold">Search</button></form>
    <p className="mb-4 text-sm">Showing up to 100 most recent matches. Times are shown in Indiana time. “Synced” confirms MailerLite accepted the subscription, not inbox delivery.</p>
    {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}
    {!rows.length&&<p className="rounded-2xl border bg-white p-8">No matching signups yet.</p>}
    <div className="space-y-4">{rows.map(row=><article key={row.id} className="rounded-2xl border border-[#e3d4c0] bg-white p-5">
      <div className="flex flex-wrap justify-between gap-2"><div><h2 className="text-xl font-bold">{row.name}</h2><p className="break-all">{row.email}</p></div><strong>{row.redeemed_at?"Used":row.sync_status==="synced"?"$50 available":"Signup needs attention"}</strong></div>
      <p className="mt-2 text-sm">{date(row.created_at)} · Source: {row.source} · MailerLite: {row.sync_status}</p>
      {row.redeemed_at?<p className="mt-3">Recorded {date(row.redeemed_at)} · Booking: {row.booking_reference}</p>:row.sync_status==="synced"?<form onSubmit={e=>{void redeem(e,row.id);}} className="mt-4 space-y-3"><input name="reference" aria-label={`Booking reference for ${row.name}`} required minLength={3} maxLength={150} placeholder="Booking or invoice reference" className="min-h-12 w-full rounded-xl border px-3"/><label className="flex gap-3 text-sm"><input name="applied" type="checkbox" required/>I have applied the $50 credit to this customer's booking and checked their identity.</label><button disabled={!!busy} className="rounded-full bg-[#593412] px-5 py-3 font-bold text-white disabled:opacity-50">{busy===row.id?"Saving…":"Record credit as used"}</button></form>:<p className="mt-3 text-sm">Check the subscriber in MailerLite and the integration settings. The subscriber can retry the form after one minute; do not promise email delivery until confirmed.</p>}
    </article>)}</div>
  </div></main>;
}
