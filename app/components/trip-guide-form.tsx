"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Download, Loader2 } from "lucide-react";
import { loadTurnstileScript } from "./booking-dialog";
import { attributionFromSearch, leadCities, tripGuideUrl } from "@/lib/trip-guide";
import { consultationBookingUrl } from "@/lib/consultation";

export function TripGuideForm() {
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const submissionId = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "success">("idle");
  const [emailStatus, setEmailStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void loadTurnstileScript().then(() => {
      if (!active || !widget.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(widget.current, {
        sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "0x4AAAAAAFFgsW7CiOEkimz7",
        action: "trip_guide", theme: "light", size: window.matchMedia("(max-width: 400px)").matches ? "compact" : "flexible",
        callback: value => { setToken(value); setVerificationError(""); },
        "expired-callback": () => setToken(""),
        "error-callback": () => { setToken(""); setVerificationError("Verification could not load. Please refresh or book a consultation below."); },
      });
    }).catch(() => { if (active) setVerificationError("Verification could not load. Please refresh or book a consultation below."); });
    return () => { active = false; if (widgetId.current) window.turnstile?.remove(widgetId.current); widgetId.current = null; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) { setError("Please complete the human verification."); return; }
    const data = new FormData(event.currentTarget);
    submissionId.current ??= crypto.randomUUID();
    setStatus("saving"); setError("");
    try {
      const response = await fetch("/api/trip-guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        firstName: data.get("firstName"), email: data.get("email"), phone: data.get("phone") || "", city: data.get("city"), timing: data.get("timing"),
        contactConsent: data.get("contactConsent") === "on", marketingConsent: data.get("marketingConsent") === "on", website: data.get("website") || "",
        turnstileToken: token, submissionId: submissionId.current, attribution: attributionFromSearch(window.location.search),
      }) });
      const result = await response.json() as { error?: string; emailStatus?: string };
      if (!response.ok) throw new Error(result.error || "We could not save your request. Please try again.");
      setEmailStatus(result.emailStatus ?? ""); setStatus("success");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "We could not save your request. Please try again.");
      setStatus("idle"); setToken("");
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    }
  }

  const inputClass = "mt-1.5 min-h-12 w-full rounded-xl border border-[#d8ccbc] bg-white px-3 text-base text-[#38281e] outline-offset-2 focus:outline-2 focus:outline-[#87551f]";
  return <div id="get-guide" className="scroll-mt-6 rounded-[1.75rem] border border-[#e6d8c5] bg-[#fffcf7] p-6 text-[#38281e] shadow-2xl shadow-black/10 sm:p-8">
    {status === "success" ? <div role="status" aria-live="polite">
      <CheckCircle2 className="mb-5 h-10 w-10 text-[#6a733c]" aria-hidden="true" />
      <h2 className="font-serif text-3xl">Your Vietnam guide is ready</h2>
      <p className="mt-4 leading-7">Thanks—your inquiry has been saved. {emailStatus === "sent" ? "A copy of the guide has been emailed to you." : emailStatus === "already_requested" ? "If you requested the guide before, use the links below to open it again or book a call." : "Use the download below now. Email delivery was not confirmed; Trung can help with any questions."}</p>
      <a className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#593412] px-5 py-3 text-center font-bold text-white" href={tripGuideUrl} target="_blank" rel="noopener noreferrer"><Download size={18} /> Open the trip guide (PDF)</a>
      <a className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#593412] px-5 py-3 text-center font-bold" href={consultationBookingUrl} target="_blank" rel="noopener noreferrer">Book a free 30-minute call <ArrowRight size={18} /></a>
      <p className="mt-5 text-sm leading-6 text-[#6c6055]">No payment was collected. This is not a confirmed reservation.</p>
    </div> : <>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#84511e]">Start with the details</p>
      <h2 className="mt-3 font-serif text-3xl leading-tight">Get your free Vietnam trip guide</h2>
      <p className="mt-3 text-sm leading-6 text-[#6c6055]">The daily itinerary, pricing and what&apos;s included—plus an invitation to talk it through with Trung.</p>
      <form onSubmit={event => { void submit(event); }} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">First name<input className={inputClass} name="firstName" autoComplete="given-name" required maxLength={60} /></label><label className="text-sm font-semibold">Email<input className={inputClass} name="email" type="email" autoComplete="email" required maxLength={180} /></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Your city<select className={inputClass} name="city" defaultValue="" required><option value="" disabled>Select a city</option>{leadCities.map(city => <option key={city}>{city}</option>)}</select></label><label className="text-sm font-semibold">Travel interest<select className={inputClass} name="timing" defaultValue="" required><option value="" disabled>Select an option</option><option value="june_2027">June 1-8, 2027</option><option value="not_sure">I&apos;m still deciding</option><option value="future">A future departure</option></select></label></div>
        <label className="block text-sm font-semibold">Phone <span className="font-normal text-[#6c6055]">(optional; no automated texts)</span><input className={inputClass} name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
        <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="flex gap-3 text-sm leading-6"><input className="mt-1 h-4 w-4 shrink-0 accent-[#593412]" type="checkbox" name="contactConsent" required /><span>Send me the guide and let Trung contact me about this trip, including up to two consultation reminders if I haven&apos;t booked a call.</span></label>
        <label className="flex gap-3 text-sm leading-6 text-[#6c6055]"><input className="mt-1 h-4 w-4 shrink-0 accent-[#593412]" type="checkbox" name="marketingConsent" /><span>Also send me occasional future trip news. <span className="font-semibold">Optional.</span></span></label>
        <div ref={widget} className="min-h-[140px] max-w-full overflow-hidden min-[401px]:min-h-[65px]" />
        {(error || verificationError) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm leading-6 text-red-900">{error || verificationError}</p>}
        <button disabled={status === "saving" || !token} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#593412] px-4 py-3 font-bold text-white transition hover:bg-[#75481b] disabled:cursor-wait disabled:opacity-60">{status === "saving" ? <><Loader2 className="animate-spin" size={18} /> Saving your request...</> : <>Send my free guide <ArrowRight size={18} /></>}</button>
        <p className="text-xs leading-5 text-[#6c6055]">No payment or booking obligation. We respect your <a className="underline" href="/privacy">privacy</a>. Prefer to talk first? <a className="font-semibold underline" href={consultationBookingUrl} target="_blank" rel="noopener noreferrer">Book a free 30-minute call.</a></p>
      </form>
    </>}
  </div>;
}
