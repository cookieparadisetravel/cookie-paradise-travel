import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, CalendarDays, Check, MapPin, Plane, Users } from "lucide-react";
import { HeroVideo } from "../components/hero-video";
import { TripGuideForm } from "../components/trip-guide-form";
import { BookingDialog } from "../components/booking-dialog";
import { ReferralBrand, ReferralProvider } from "../components/referral-brand";
import { getSalonPartner, REFERRAL_COOKIE } from "@/lib/salon-referrals";
import { consultationBookingUrl } from "@/lib/consultation";
import { getPublicTripAvailability } from "@/lib/public-trip-availability";
import { vietnamDeparture } from "@/lib/trip-availability";
import { TripAvailability } from "../components/trip-availability";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vietnam Small-Group Trip, June 2027 | Free Trip Guide | Cookie Paradise Travel",
  description: "Explore Vietnam with a Columbus, Indiana-based travel company. June 1-8, 2027: Ho Chi Minh City, Mekong Delta, Hue and Hoi An. Get the free itinerary and pricing or book a call with Trung.",
  alternates: { canonical: "https://cookieparadisetravel.com/vietnam" },
  openGraph: { title: "Your Vietnam adventure starts here", description: "June 1-8, 2027 · 8 days · Small group · Get the free trip guide", url: "https://cookieparadisetravel.com/vietnam", images: ["https://cookieparadisetravel.com/vietnam-hero-poster.webp"] },
};

const places = [
  ["01", "Ho Chi Minh City", "City landmarks, neighborhood life and a vintage-Jeep food adventure after dark."],
  ["02", "Mekong Delta", "Sampan waterways, village paths, local makers and a home-hosted lunch."],
  ["03", "Hue", "Imperial heritage, royal tombs, garden-house traditions and the Perfume River."],
  ["04", "Hoi An", "The Hai Van Pass, lantern-lit streets, basket boats and hands-on cooking."],
];
const questions = [
  ["Do I have to be ready to book?", "No. Request the guide or book a free 30-minute Google Meet with Trung to ask questions. Neither creates a reservation or payment obligation."],
  ["Where do we arrive and depart?", "Arrive in Ho Chi Minh City at Tan Son Nhat International Airport (SGN) on June 1, 2027. Depart from Da Nang International Airport (DAD), near Hoi An, on June 8. The flight from Ho Chi Minh City to Hue (HUI) is included. International airfare is separate; confirm flight plans with Trung before purchasing."],
  ["How does the group price work?", "The shared-room trip price is $2,875 per traveler with 8 travelers, $2,675 with 10, $2,605 with 12, and $2,500 with 15. The applicable price depends on the confirmed group. International airfare is not included."],
  ["Can couples share a room?", "Yes. Couples can choose a queen bed or separate beds, subject to availability. The private-room supplement applies to a single traveler who wants a room to themselves; Trung can explain the current supplement."],
  ["Who hosts the trip?", "The trip is created by Trung Le and hosted by Trung or another carefully selected Cookie Paradise Travel Company host, supported by experienced local guides. Cookie Paradise Travel Company is based in Columbus, Indiana."],
  ["What if June 2027 does not work for me?", "Choose 'A future departure' on the form. We will send this trip's guide and can discuss your interests. Future departure dates have not been announced."],
];
export default async function VietnamTrip() {
  const partner = getSalonPartner((await cookies()).get(REFERRAL_COOKIE)?.value);
  const availability = await getPublicTripAvailability(vietnamDeparture.tripSlug,vietnamDeparture.departure,vietnamDeparture.capacity);
  return <ReferralProvider partner={partner}><main className="min-h-screen bg-[var(--sand)] text-[var(--ink)]">
    <header className="bg-[var(--navy)] text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8"><div className="flex items-center gap-3"><Link href="/" className="text-sm font-bold uppercase tracking-[0.16em]">Cookie Paradise<br /><span className="text-xs font-medium tracking-[0.24em] text-[var(--gold)]">Travel Company</span></Link><ReferralBrand header /></div><a className="rounded-full border border-white/35 px-4 py-2 text-sm font-semibold hover:bg-white/10" href={consultationBookingUrl} target="_blank" rel="noopener noreferrer">Talk with Trung <span aria-hidden="true">↗</span></a></div></header>
    <section className="relative isolate overflow-hidden bg-[var(--navy)] text-white"><HeroVideo /><div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(36,21,10,.92),rgba(45,29,16,.65))]" /><div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:py-20"><div>
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Small-group travel · From Indiana to Vietnam</p><h1 className="mt-5 font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">Imagine yourself<br />in Vietnam.</h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-white/85">From Saigon&apos;s vibrant streets to Mekong waterways, imperial Hue and lantern-lit Hoi An. Eight memorable days, with the details thoughtfully arranged.</p>
      <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold"><span className="flex items-center gap-2"><CalendarDays size={18} className="text-[var(--gold)]" /> June 1–8, 2027</span><span className="flex items-center gap-2"><Users size={18} className="text-[var(--gold)]" /> 8–15 travelers</span></div>
      <p className="mt-7 text-3xl font-bold text-[var(--gold)]">$2,875 <span className="text-base font-normal text-white/80">per traveler at 8 travelers</span></p><p className="mt-2 max-w-md text-sm leading-6 text-white/75">Shared room · 8 days / 7 nights · Lower prices as the confirmed group grows · International airfare extra</p>
      <TripAvailability availability={availability} label={vietnamDeparture.label} />
      <p className="mt-8 max-w-lg text-base leading-7 text-white/85">Meet Trung, your Columbus, Indiana-based trip planner. Get the guide first, then ask your questions in a free 30-minute call.</p>
      <a href="#get-guide" className="mt-6 inline-flex items-center gap-2 font-semibold text-[var(--gold)] underline underline-offset-4 lg:hidden">Get the free trip guide <ArrowRight size={17} /></a>
    </div><TripGuideForm /></div></section>
    <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#87551f]">Four places. One unforgettable journey.</p><h2 className="mt-3 font-serif text-4xl sm:text-5xl">A closer look at Vietnam</h2></div>
      {/* Use native navigation so the browser loads the destination before scrolling to its fragment. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="inline-flex items-center gap-2 font-semibold underline underline-offset-4" href="/#daily-schedule">See the full daily itinerary <ArrowRight size={17} /></a></div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{places.map(([number,name,description]) => <article key={name} className="rounded-2xl border border-[var(--line)] bg-white/50 p-6"><span className="text-xs font-bold tracking-widest text-[#87551f]">{number}</span><h3 className="mt-4 font-serif text-2xl">{name}</h3><p className="mt-3 text-sm leading-7 text-[var(--muted-ink)]">{description}</p></article>)}</div>
      <div className="mt-10 grid gap-6 rounded-3xl bg-[#f0e6d7] p-6 sm:p-9 md:grid-cols-2"><div><h3 className="font-serif text-3xl">What&apos;s already arranged</h3><ul className="mt-5 space-y-3 text-sm leading-6">{["7 hotel nights and daily breakfast", "5 lunches and 3 dinners", "Domestic flight from Ho Chi Minh City to Hue", "Airport transfers, itinerary transport and local guides"].map(item => <li key={item} className="flex gap-3"><Check size={18} className="mt-1 shrink-0 text-[#6a733c]" />{item}</li>)}</ul></div><div className="border-t border-[#d8ccbc] pt-6 md:border-l md:border-t-0 md:pl-9 md:pt-0"><Plane className="text-[#87551f]" size={25} /><h3 className="mt-3 font-serif text-2xl">Plan your flights with confidence</h3><p className="mt-3 text-sm leading-7 text-[var(--muted-ink)]">Arrive at <strong>Ho Chi Minh City (SGN)</strong>. Depart from <strong>Da Nang (DAD)</strong>, near Hoi An. International airfare, visas, travel insurance, gratuities and personal expenses are extra.</p><a className="mt-4 inline-block font-semibold underline underline-offset-4" href={consultationBookingUrl} target="_blank" rel="noopener noreferrer">Ask Trung about travel arrangements ↗</a></div></div>
    </section>
    <section className="mx-auto max-w-4xl px-5 pb-16 sm:px-8"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#87551f]"><MapPin size={16} /> A personal conversation, close to home</p><h2 className="mt-3 font-serif text-4xl">Your questions, answered</h2><div className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">{questions.map(([question,answer]) => <details key={question} className="group py-5"><summary className="cursor-pointer text-lg font-semibold">{question}</summary><p className="mt-3 pr-4 text-base leading-8 text-[var(--muted-ink)]">{answer}</p></details>)}</div><div className="mt-10 flex flex-col items-start gap-5 rounded-3xl bg-[var(--navy)] p-7 text-white sm:p-10"><h2 className="font-serif text-3xl">Ready for the next step?</h2><p className="max-w-xl leading-7 text-white/80">Talk with Trung first, or send a booking request when you&apos;re ready. A reservation is confirmed only through the booking process.</p><div className="flex flex-wrap gap-3"><a href={consultationBookingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--gold)] px-6 py-3 font-bold text-[#38281e]">Book a free 30-minute call <ArrowRight size={18} /></a><BookingDialog triggerLabel="I'm ready to request a spot" /></div></div></section>
    <footer className="border-t border-[var(--line)] px-5 py-8 text-center text-sm leading-7 text-[var(--muted-ink)]">Cookie Paradise Travel Company LLC · Columbus, Indiana<br /><Link className="underline" href="/">Full trip website</Link><span className="mx-3">·</span><Link className="underline" href="/privacy">Privacy</Link><span className="mx-3">·</span><a className="underline" href="mailto:trung@cookieparadise.co">Email Trung</a></footer>
  </main></ReferralProvider>;
}
