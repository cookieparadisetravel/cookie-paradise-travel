/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids the vinext client-router failure observed in production. */
/* eslint-disable @next/next/no-img-element -- Responsive photographs are served as pre-sized local WebP files. */
import { publicPageMetadata } from "@/lib/public-page-metadata";
import { cookies } from "next/headers";
import { ArrowRight, ChevronDown, Plane, Users, Utensils } from "lucide-react";
import { BrandLogo } from "../components/brand-logo";
import { TripGuideForm } from "../components/trip-guide-form";
import { BookingDialog } from "../components/booking-dialog";
import { TripBudget } from "../components/trip-budget";
import { ReferralBrand, ReferralProvider } from "../components/referral-brand";
import { getSalonPartner, REFERRAL_COOKIE } from "@/lib/salon-referrals";
import { consultationBookingUrl } from "@/lib/consultation";
import { getPublicTripAvailability } from "@/lib/public-trip-availability";
import { vietnamDepartures } from "@/lib/trip-availability";
import { TripAvailability } from "../components/trip-availability";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata({
  title: "Vietnam Small-Group Tours, June & December 2027 | Itinerary & Pricing",
  description: "Discover Southern Vietnam, June 1–8, 2027 or December 27, 2027–January 3, 2028: an 8-day tour for 4–8 guests through Ho Chi Minh City, the Mekong Delta, Hue and Hoi An. See pricing, a full trip budget and the free itinerary.",
  path: "/vietnam",
  image: "/vietnam-hero-poster.webp",
  imageAlt: "Discover Southern Vietnam small-group tour",
});

const pricing = [["4–8 guests", "$2,875"]];
const inclusions = [
  { icon: Utensils, title: "Hotels & meals", description: "Seven hotel nights, seven breakfasts, five lunches and three dinners—including a home-hosted Mekong lunch and Hue royal dinner." },
  { icon: Plane, title: "Flights, transfers & Vietnam visa", description: "The Ho Chi Minh City–Hue flight, private ground transportation, scheduled airport transfers, private boats and your Vietnam visa." },
  { icon: Users, title: "Guides & experiences", description: "English-speaking local guides, admission fees and scheduled activities, from a vintage-Jeep food tour to Hoi An’s culinary challenge." },
];
const questions = [
  ["Which flights should I book?", "Plan to arrive in Ho Chi Minh City at Tan Son Nhat International Airport (SGN) on June 1 or December 27, 2027, and depart from Da Nang International Airport (DAD), near Hoi An, on June 8, 2027 or January 3, 2028, respectively. Your U.S. departure and arrival dates depend on the flight schedule. Confirm flight plans with Trung before purchasing."],
  ["Can couples share a room?", "Yes. Couples can request a queen bed or separate beds, subject to availability. The private-room supplement is for a traveler who wants a room to themselves."],
  ["Who hosts the trip?", "Your departure will be hosted by Trung or another carefully selected Cookie Paradise Travel Company host, supported by experienced local guides. Ask Trung who is planned for your trip."],
  ["Which departure dates can I choose?", "Choose June 1–8, 2027 or December 27, 2027–January 3, 2028. Each departure has its own group of 4–8 guests. Private trips can also be planned around your own dates."],
];

export default async function VietnamTrip() {
  const partner = getSalonPartner((await cookies()).get(REFERRAL_COOKIE)?.value);
  const availabilities = await Promise.all(vietnamDepartures.map(item => getPublicTripAvailability(item.tripSlug, item.departure, item.capacity)));

  return <ReferralProvider partner={partner}>
    <main className="bright-home min-h-screen bg-[var(--sand)] text-[#171717]">
      <header className="border-b border-black/10 bg-[#faf8f3]">
        <div className="site-header-bar mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="site-header-brand flex min-w-0 items-center gap-4">
            <a href="/" className="site-header-home flex min-w-0 flex-col items-start gap-2" aria-label="Cookie Paradise Travel Company home"><BrandLogo surface="light" tagline /></a>
            <ReferralBrand header />
          </div>
          <a className="site-header-call rounded-full border border-black/25 px-4 py-2 text-sm font-semibold hover:bg-black/5" href={consultationBookingUrl} target="_blank" rel="noopener noreferrer">Talk with Trung <span aria-hidden="true">↗</span></a>
        </div>
      </header>

      <section aria-labelledby="vietnam-title">
        <div className="destination-hero relative isolate flex min-h-[480px] items-center justify-center overflow-hidden px-5 py-20 text-center text-white sm:min-h-[560px]">
          <img src="/travel/hue-citadel-1800.webp" srcSet="/travel/hue-citadel-640.webp 640w, /travel/hue-citadel-1280.webp 1280w, /travel/hue-citadel-1800.webp 1800w" sizes="100vw" width={1800} height={1200} alt="The Imperial Citadel in Hue beneath a blue sky" fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,.06),rgba(0,0,0,.26)_55%,rgba(0,0,0,.16))]" />
          <div className="hero-essential-copy">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[.14em] [text-shadow:0_2px_8px_rgba(0,0,0,.9)]">Small-group Vietnam tour</p>
            <h1 id="vietnam-title" className="max-w-4xl font-serif text-[clamp(2.8rem,7vw,6rem)] font-normal leading-[1.08] tracking-[-.025em] [text-shadow:0_2px_16px_rgba(0,0,0,.65)]">Discover<br />Southern Vietnam</h1>
            <p className="mt-6 text-base font-semibold leading-7 sm:text-xl [text-shadow:0_2px_8px_rgba(0,0,0,.9)]">June 1–8, 2027 or December 27, 2027–January 3, 2028 · 8 days · 4–8 guests</p>
            <a href="#get-guide" className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--gold)] px-7 py-3 text-base font-bold text-[#171717] shadow-lg hover:bg-[#ffd078]">Get the itinerary & pricing <ArrowRight aria-hidden="true" size={18} /></a>
          </div>
          <a href="https://unsplash.com/photos/lzjlYsMGYXg" target="_blank" rel="noopener noreferrer" className="absolute bottom-4 right-5 text-xs underline underline-offset-2 [text-shadow:0_1px_5px_black]">Photo: Nguyen Minh</a>
        </div>
        <div className="mx-auto max-w-3xl px-5 py-10 text-center sm:px-8 sm:py-12">
          <p className="text-lg leading-8">Taste Ho Chi Minh City (Saigon), drift through the Mekong Delta, explore imperial Hue and wander lantern-lit Hoi An—with your hotels, local guides and daily experiences arranged.</p>
          <p className="mt-5 text-base leading-7"><strong className="text-2xl">$2,875 per traveler</strong> · fixed price<br /><span className="text-sm">Shared room · International airfare extra</span></p>
        </div>
      </section>

      <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-6 bg-[#f4f0e8] py-12 sm:py-16">
        <div className="mx-auto grid max-w-7xl items-start gap-8 px-5 sm:px-8 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.12em] text-[#805018]">Price & payment</p>
            <h2 id="pricing-title" className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">Plan your trip with the full picture.</h2>
            <p className="mt-5 max-w-xl text-lg leading-8"><strong>$500 nonrefundable deposit per traveler.</strong> Pay the balance in monthly installments, with the final payment due two months before departure: April 1 for the June trip or October 27 for the December trip.</p>
            <div className="availability-light grid gap-4">{vietnamDepartures.map((item, index) => <div key={item.departure}><TripAvailability availability={availabilities[index]} label={item.dateRange} /><BookingDialog triggerLabel={`Request ${index === 0 ? "June" : "December"} departure`} compact initialTrip={{ departure: item.departure, room: "shared", partySize: 1 }} /></div>)}</div>
            <div className="mt-6 flex flex-wrap items-center gap-5"><a href="/#faq" className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">Cancellation & booking terms</a></div>
          </div>
          <div className="rounded-[2rem] border border-black/15 bg-white p-6 sm:p-8">
            <h3 className="font-serif text-2xl">Tour price per person</h3>
            <p className="mt-2 text-base leading-7">Sharing a room · Same price for 4–8 guests</p>
            <dl className="mt-5 divide-y divide-black/10">{pricing.map(([group, price]) => <div key={group} className="flex items-baseline justify-between gap-4 py-4"><dt className="font-semibold">{group}</dt><dd className="font-serif text-3xl text-[#805018]">{price}</dd></div>)}</dl>
            <p className="mt-3 border-t border-black/15 pt-5 text-base leading-7">Private room: <strong>+$399</strong>, subject to availability.</p>
          </div>
        </div>
        <TripBudget />
      </section>

      <section aria-labelledby="included-title" className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid items-center gap-9 lg:grid-cols-2 lg:gap-14">
          <figure className="homepage-life-photo inclusions-life-photo">
            <img src="/travel/vietnam-market-duy-1280.webp" srcSet="/travel/vietnam-market-duy-640.webp 640w, /travel/vietnam-market-duy-1280.webp 1280w, /travel/vietnam-market-duy-1800.webp 1800w" sizes="(min-width: 1024px) 48vw, 100vw" width={1800} height={1013} alt="Vendors seated among baskets of fresh herbs and vegetables outside a neighborhood shop in Vietnam, with scooters lining the street" loading="lazy" decoding="async" />
            <figcaption><a href="https://www.pexels.com/photo/vibrant-vietnamese-street-market-scene-30372197/" target="_blank" rel="noopener noreferrer" aria-label="Photo by Duy Nguyen on Pexels (opens in a new tab)">Photo: Duy Nguyen</a></figcaption>
          </figure>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.12em] text-[#805018]">Included in your tour</p>
            <h2 id="included-title" className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">Get closer to everyday Vietnam.</h2>
            <div className="mt-7 divide-y divide-black/15">{inclusions.map(({ icon: Icon, title, description }) => <div key={title} className="flex gap-4 py-5 first:pt-0"><Icon aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-[#805018]" /><div><h3 className="font-serif text-2xl">{title}</h3><p className="mt-2 text-base leading-7">{description}</p></div></div>)}</div>
            <a className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-[#805018] underline underline-offset-4" href="/#daily-schedule">Explore the day-by-day itinerary <ArrowRight aria-hidden="true" size={17} /></a>
          </div>
        </div>
      </section>

      <section aria-label="Get the itinerary and meet your trip planner" className="border-y border-black/10 bg-white py-12 sm:py-16">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-16">
          <div>
            <img src="/about-trung.jpg" alt="Trung Le seated in front of the yellow Cookie Paradise bakery trailer" width={960} height={1280} loading="lazy" className="mb-6 aspect-square w-40 rounded-full object-cover object-center sm:w-48" />
            <p className="text-sm font-semibold uppercase tracking-[.12em] text-[#805018]">A local connection to Vietnam</p>
            <h2 className="mt-3 font-serif text-4xl leading-tight">Meet Trung, your trip planner.</h2>
            <p className="mt-5 max-w-lg text-lg leading-8">Born in Vietnam and based in Columbus, Indiana, Trung Le spent seven years living in Ho Chi Minh City. He created this trip to share its food, everyday life and places he knows.</p>
            <p className="mt-4 max-w-lg text-base leading-7">Start with the free itinerary, or talk through your questions in a 30-minute Google Meet. No obligation to book.</p>
            <a href={consultationBookingUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/30 px-6 py-3 text-center font-semibold hover:bg-black/5">Book a free call with Trung <ArrowRight aria-hidden="true" size={18} /></a>
          </div>
          <TripGuideForm showCity />
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-4xl scroll-mt-6 px-5 py-12 sm:px-8 sm:py-16">
        <h2 id="faq-title" className="font-serif text-4xl">A few practical questions</h2>
        <div className="mt-7 divide-y divide-black/15 border-y border-black/15">{questions.map(([question, answer]) => <details key={question} className="group py-5"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">{question}<ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" /></summary><p className="mt-3 pr-4 text-base leading-8">{answer}</p></details>)}</div>
        <p className="mt-6 text-base leading-7">Looking for different dates or your own itinerary? <a href="/fit" className="font-semibold underline underline-offset-4">Explore private Vietnam trips.</a></p>
      </section>

      <footer className="border-t border-black/15 px-5 py-8 text-center text-sm leading-7">Cookie Paradise Travel Company LLC · Columbus, Indiana<br /><a className="underline" href="/">Full Vietnam tour itinerary</a><span className="mx-3">·</span><a className="underline" href="/vietnam-trip-planning">Vietnam planning guide</a><span className="mx-3">·</span><a className="underline" href="/privacy">Privacy</a><span className="mx-3">·</span><a className="underline" href="mailto:trung@cookieparadise.co">Email Trung</a></footer>
    </main>
  </ReferralProvider>;
}
