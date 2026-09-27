"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Props = { triggerLabel: string; compact?: boolean; inverse?: boolean };

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "flexible";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (typeof window === "undefined" || window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-cookie-paradise-turnstile="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Turnstile failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.dataset.cookieParadiseTurnstile = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export function BookingDialog({ triggerLabel, compact = false, inverse = false }: Props) {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [departure, setDeparture] = useState("");
  const [room, setRoom] = useState("shared");
  const [partySize, setPartySize] = useState("1");
  const [contactConsent, setContactConsent] = useState(false);
  const [sellerOfTravelStateResident, setSellerOfTravelStateResident] = useState(false);
  const [residenceState, setResidenceState] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileAvailable, setTurnstileAvailable] = useState(true);
  const [turnstileContainer, setTurnstileContainer] = useState<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken("");
    if (turnstileWidgetIdRef.current && window.turnstile) {
      window.turnstile.reset(turnstileWidgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    if (!open || !turnstileSiteKey || !turnstileContainer) return;

    let cancelled = false;

    void loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainer, {
          sitekey: turnstileSiteKey,
          action: "booking_inquiry",
          theme: "light",
          size: "flexible",
          callback: (token) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => {
            setTurnstileToken("");
            setTurnstileAvailable(false);
          },
        });
      })
      .catch(() => setTurnstileAvailable(false));

    return () => {
      cancelled = true;
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
      }
      turnstileWidgetIdRef.current = null;
    };
  }, [open, turnstileContainer, turnstileSiteKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    const form = new FormData(event.currentTarget);
    const payload = {
      fullName: form.get("fullName"),
      email: form.get("email"),
      phone: form.get("phone"),
      departure,
      room,
      partySize: Number(partySize),
      notes: form.get("notes"),
      website: form.get("website"),
      turnstileToken,
      contactConsent,
      sellerOfTravelStateResident,
      residenceState: sellerOfTravelStateResident ? residenceState : "",
      marketingConsent: form.get("marketingConsent") === "yes",
    };
    try {
      const response = await fetch("/api/booking-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        resetTurnstile();
        throw new Error("Unable to save request");
      }
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  const triggerClasses = compact
    ? "inline-flex min-h-10 items-center justify-center rounded-full border border-white/35 bg-white px-3 text-[0.7rem] font-extrabold text-[var(--navy)] transition hover:bg-[var(--gold)] sm:px-5 sm:text-sm"
    : inverse
      ? "inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--orange)] px-7 text-sm font-extrabold text-[var(--gold)] shadow-lg transition hover:-translate-y-0.5 hover:bg-[var(--navy)]"
      : "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-7 text-sm font-extrabold text-[var(--orange)] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#ffc56c]";

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) {
        setTurnstileAvailable(true);
        setTurnstileToken("");
      } else {
        setTimeout(() => setStatus("idle"), 200);
      }
    }}>
      <DialogTrigger className={triggerClasses}>
        {triggerLabel}{!compact && <ArrowRight className="h-4 w-4" />}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-0 bg-[var(--sand)] p-0 sm:max-w-2xl">
        {status === "success" ? (
          <div className="p-8 text-center sm:p-12">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[var(--orange)]" />
            <DialogTitle className="mt-5 font-serif text-3xl">Your request is in.</DialogTitle>
            <DialogDescription className="mx-auto mt-3 max-w-md text-base leading-7 text-[var(--muted-ink)]">
              This is not a confirmed reservation and no payment was collected. Trung will follow up with availability and next steps.
            </DialogDescription>
            <button className="mt-7 rounded-full bg-[var(--navy)] px-6 py-3 text-sm font-bold text-white" onClick={() => setOpen(false)}>Close</button>
          </div>
        ) : (
          <>
            <DialogHeader className="bg-[var(--navy)] px-6 py-7 text-left text-white sm:px-8">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Vietnam 2027</p>
              <DialogTitle className="font-serif text-3xl">Request a place</DialogTitle>
              <DialogDescription className="text-sm leading-6 text-white/70">
                Tell us which departure works for you. No payment is collected and this form does not confirm a reservation.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submit} className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
              <label className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                Website
                <input name="website" type="text" tabIndex={-1} autoComplete="off" />
              </label>
              <label className="field-label sm:col-span-2">Full name
                <input className="field-input" name="fullName" autoComplete="name" required maxLength={120} />
              </label>
              <label className="field-label">Email
                <input className="field-input" name="email" type="email" autoComplete="email" required maxLength={180} />
              </label>
              <label className="field-label">Phone <span className="font-normal text-[var(--muted-ink)]">(optional)</span>
                <input className="field-input" name="phone" type="tel" autoComplete="tel" maxLength={40} />
              </label>
              <div className="field-label">Preferred departure
                <Select value={departure} onValueChange={(value) => setDeparture(value ?? "")} required>
                  <SelectTrigger className="field-input h-12 w-full"><SelectValue placeholder="Choose a date" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2027-06-01">June 1, 2027</SelectItem>
                    <SelectItem value="2027-06-29">June 29, 2027</SelectItem>
                    <SelectItem value="2027-07-27">July 27, 2027</SelectItem>
                    <SelectItem value="flexible">I’m flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="field-label">Travelers
                <Select value={partySize} onValueChange={(value) => setPartySize(value ?? "1")}>
                  <SelectTrigger className="field-input h-12 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((count) => <SelectItem key={count} value={String(count)}>{count}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="field-label sm:col-span-2">Room preference
                <Select value={room} onValueChange={(value) => setRoom(value ?? "shared")}>
                  <SelectTrigger className="field-input h-12 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shared">Shared double/twin room</SelectItem>
                    <SelectItem value="private">Private room (+$399 per traveler)</SelectItem>
                    <SelectItem value="unsure">Not sure yet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="field-label sm:col-span-2">Questions or notes <span className="font-normal text-[var(--muted-ink)]">(optional)</span>
                <textarea className="field-input min-h-24 resize-y py-3" name="notes" maxLength={1000} />
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-[var(--orange)]/35 bg-[var(--gold)]/15 p-4 text-sm leading-6 text-[var(--ink)] sm:col-span-2">
                <input className="mt-1 h-4 w-4 accent-[var(--orange)]" type="checkbox" required aria-required="true" checked={contactConsent} onChange={(event) => setContactConsent(event.target.checked)} />
                <span><strong className="mb-1 inline-block rounded-full bg-[var(--orange)] px-2.5 py-0.5 text-xs uppercase tracking-[0.08em] text-white">Required</strong><br />I agree that Cookie Paradise Travel Company may contact me about this trip. This is an inquiry, not a purchase.</span>
              </label>
              <label className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 text-sm leading-6 text-[var(--ink)] sm:col-span-2">
                <input className="mt-1 h-4 w-4 accent-[var(--orange)]" type="checkbox" name="marketingConsent" value="yes" />
                <span><strong>Email me occasional travel news and future trip announcements.</strong><br /><span className="text-[var(--muted-ink)]">Optional. You can unsubscribe at any time.</span></span>
              </label>
              <div className="rounded-2xl border border-[var(--line)] bg-white p-4 sm:col-span-2">
                <label className="flex items-start gap-3 text-sm leading-6 text-[var(--ink)]">
                  <input
                    className="mt-1 h-4 w-4 accent-[var(--orange)]"
                    type="checkbox"
                    checked={sellerOfTravelStateResident}
                    onChange={(event) => {
                      setSellerOfTravelStateResident(event.target.checked);
                      if (!event.target.checked) setResidenceState("");
                    }}
                  />
                  <span><strong>I live in a state that may require seller-of-travel registration.</strong><br /><span className="text-[var(--muted-ink)]">Select this if you reside in California, Florida, Hawaii or Washington. This helps us determine whether we can proceed with a future booking.</span></span>
                </label>
                {sellerOfTravelStateResident && (
                  <div className="field-label mt-4">State of residence <span className="text-red-700">*</span>
                    <Select value={residenceState} onValueChange={(value) => setResidenceState(value ?? "")} required>
                      <SelectTrigger className="field-input mt-1 h-12 w-full"><SelectValue placeholder="Choose your state" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CA">California</SelectItem>
                        <SelectItem value="FL">Florida</SelectItem>
                        <SelectItem value="HI">Hawaii</SelectItem>
                        <SelectItem value="WA">Washington</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                {turnstileSiteKey ? (
                  <div ref={setTurnstileContainer} className="min-h-[65px] w-full" aria-label="Human verification" />
                ) : (
                  <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Human verification is not configured. Please try again later.</p>
                )}
                {!turnstileAvailable && (
                  <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">Human verification could not load. Please refresh the page and try again.</p>
                )}
              </div>
              {status === "error" && (
                <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">We couldn’t save your request. Please try again in a moment.</p>
              )}
              <button disabled={status === "saving" || !departure || !contactConsent || !turnstileToken || !turnstileAvailable || (sellerOfTravelStateResident && !residenceState)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--orange)] px-6 text-sm font-extrabold text-white transition hover:bg-[var(--navy)] disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">
                {status === "saving" ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <>Send my request <ArrowRight className="h-4 w-4" /></>}
              </button>
              <p className="text-center text-xs leading-5 text-[var(--muted-ink)] sm:col-span-2">Please do not enter passport numbers, medical information or payment details here. See our <a className="font-semibold underline" href="/privacy" target="_blank">Privacy Policy</a>.</p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
