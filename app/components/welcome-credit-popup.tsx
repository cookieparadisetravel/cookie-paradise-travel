"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BrandLogo } from "./brand-logo";
import { loadTurnstileScript } from "./booking-dialog";
import { welcomeConsent, welcomeTerms } from "@/lib/welcome-credit";
const key="travel-welcome-credit-v1";
function remembered(){try{return Number(localStorage.getItem(key)||0)>Date.now();}catch{return false;}}
function remember(days:number){try{localStorage.setItem(key,String(Math.max(Number(localStorage.getItem(key)||0),Date.now()+days*86400000)));}catch{/* Optional preference storage. */}}
export function WelcomeCreditPopup(){
  const pathname=usePathname();
  const [open,setOpen]=useState(false);
  const eligible=pathname === "/fit";
  useEffect(()=>{
    setOpen(false);
    if(!eligible||remembered())return;
    const timer=setTimeout(()=>{
      // Do not interrupt another dialog or someone completing a form.
      if(!remembered()&&!document.querySelector('[role="dialog"]')&&!document.activeElement?.matches("input,textarea,select")){setOpen(true);remember(7);}
    },18000);
    return()=>clearTimeout(timer);
  },[pathname,eligible]);
  if(!eligible)return null;
  return <Dialog open={open} onOpenChange={value=>{setOpen(value);if(!value)remember(7);}}>
    <div className="border-t border-[#e3d4c0] bg-[#fff9f0] px-6 py-8 text-center text-[#593412]"><p className="mb-3 font-serif text-2xl">A little welcome for your next adventure.</p><DialogTrigger className="min-h-12 rounded-full bg-[#f7b658] px-6 py-3 font-bold">Get my $50 travel credit</DialogTrigger></div>
    <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl border-[#e3d4c0] bg-[#fff9f0] p-6 text-[#593412] sm:p-8">
      <div className="max-w-[230px] pr-4"><BrandLogo/></div>
      <p className="text-xs font-bold uppercase tracking-[.18em]">Welcome to your next adventure</p>
      <DialogTitle className="font-serif text-3xl leading-tight">Your Vietnam adventure starts with $50 toward your trip.</DialogTitle>
      <DialogDescription className="text-base leading-6 text-[#593412]">Join our email list for Vietnam travel inspiration and receive a $50 welcome credit toward a hosted group trip or private Vietnam booking.</DialogDescription>
      <CreditForm source={pathname} />
    </DialogContent>
  </Dialog>;
}
function CreditForm({source}:{source:string}){
  const widget=useRef<HTMLDivElement>(null),widgetId=useRef<string|null>(null);
  const [token,setToken]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
  useEffect(()=>{
    let active=true;
    void loadTurnstileScript().then(()=>{
      if(!active||!widget.current||!window.turnstile)return;
      widgetId.current=window.turnstile.render(widget.current,{sitekey:process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()||"0x4AAAAAAFFgsW7CiOEkimz7",action:"welcome_credit",theme:"light",size:"compact",callback:value=>{setToken(value);setError("");},"expired-callback":()=>setToken(""),"error-callback":()=>{setToken("");setError("Verification could not load. Refresh to try again.");}});
    }).catch(()=>{if(active)setError("Verification could not load. Refresh to try again.");});
    return()=>{active=false;if(widgetId.current)window.turnstile?.remove(widgetId.current);widgetId.current=null;};
  },[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||!token)return;
    const data=new FormData(event.currentTarget);setBusy(true);setError("");
    try{
      const response=await fetch("/api/welcome-credit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:data.get("name"),email:data.get("email"),consent:data.get("consent")==="on",source,website:data.get("website"),turnstileToken:token})});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error||"Please try again.");
      remember(365);setDone(true);
    }catch(e){setError(e instanceof Error?e.message:"Please try again.");setToken("");if(widgetId.current)window.turnstile?.reset(widgetId.current);}
    finally{setBusy(false);}
  }
  const input="mt-1 w-full min-h-12 rounded-xl border border-[#d8ccbc] bg-white px-3 text-base";
  if(done)return <div role="status" className="space-y-3 rounded-xl bg-white p-5"><h3 className="font-serif text-2xl">Thanks for joining us!</h3><p>Your signup is recorded. For a first signup, look for your welcome email, including in spam or promotions.</p><p>Already signed up? Your original credit remains on record; repeat signups do not add credits.</p><p>When booking, ask Trung to apply your credit using this email address before confirming your booking.</p><a href="mailto:trung@cookieparadise.co?subject=My%20Vietnam%20welcome%20credit" className="font-bold underline">Contact Trung</a></div>;
  return <form onSubmit={event=>{void submit(event);}} className="space-y-4">
    <label className="block text-sm font-semibold">Name<input className={input} name="name" autoComplete="name" required maxLength={100}/></label>
    <label className="block text-sm font-semibold">Email<input className={input} name="email" type="email" autoComplete="email" required maxLength={180}/></label>
    <div hidden aria-hidden="true"><input name="website" tabIndex={-1} autoComplete="off" aria-label="Website"/></div>
    <label className="flex items-start gap-3 text-sm leading-5"><input className="mt-1 size-4 shrink-0" name="consent" type="checkbox" required/><span>{welcomeConsent}</span></label>
    <div ref={widget} className="min-h-[140px]"/>
    {error&&<p role="alert" className="text-sm text-red-800">{error}</p>}
    <button disabled={busy||!token} className="min-h-12 w-full rounded-full bg-[#f7b658] px-4 py-3 font-bold disabled:opacity-50">{busy?"Saving your signup…":"Get my $50 travel credit"}</button>
    <p className="text-xs leading-5">{welcomeTerms} <a href="/privacy" className="underline">Privacy policy</a>.</p>
  </form>;
}
