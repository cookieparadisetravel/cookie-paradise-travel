import Link from "next/link";
import {
  ArrowRight, Check, ChevronDown, Clock3, Compass, MapPin, Plane,
  ShieldCheck, Sparkles, Users, Utensils,
} from "lucide-react";
import { BookingDialog } from "./components/booking-dialog";
import { MobileBookBar } from "./components/mobile-book-bar";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSalonPartner, REFERRAL_COOKIE } from "@/lib/salon-referrals";
import { ReferralBrand, ReferralProvider } from "./components/referral-brand";
import { getPublicTripAvailability } from "@/lib/public-trip-availability";
import { vietnamDeparture } from "@/lib/trip-availability";
import { TripAvailability } from "./components/trip-availability";
import { HeroVideo } from "./components/hero-video";
import { JourneyPhoto } from "./components/journey-photo";
import { ConsultationLink } from "./components/consultation-link";
import { BrandLogo } from "./components/brand-logo";
import { TripGuideForm } from "./components/trip-guide-form";
import { tripGuideUrl } from "@/lib/trip-guide";
import travelerAgreementSummary from "@/lib/traveler-agreement-summary.json";
export const dynamic = "force-dynamic";

const itinerary = [
  ["01", "Arrive in Ho Chi Minh City", "A private airport welcome, hotel transfer and an easy first evening to settle in."],
  ["02", "The many sides of Ho Chi Minh City", "Morning life in Tao Dan Park, city icons, markets and a vintage-Jeep food adventure after dark."],
  ["03", "Mekong Delta life", "Floating communities, sampan waterways, village paths, family workshops and a home-hosted lunch."],
  ["04", "Fly to Hue", "Imperial Citadel, Thien Mu Pagoda and a private sunset cruise on the Perfume River."],
  ["05", "Gardens, tombs & royal dinner", "Tha Om Garden House, the royal tombs of Tu Duc and Khai Dinh, then dinner with traditional music."],
  ["06", "Hue to Hoi An", "The Hai Van Pass, lantern making, old-town heritage and basket boats."],
  ["07", "Hoi An culinary challenge", "Herb-farm games, hands-on cooking, a free afternoon, an optional massage and a celebratory farewell dinner."],
  ["08", "Depart Hoi An via Da Nang", "Breakfast and a private transfer to Da Nang International Airport (DAD) for your onward flight."],
];

const pricing = [
  ["8 travelers", "$2,875"],
  ["10 travelers", "$2,675"],
  ["12 travelers", "$2,605"],
  ["15 travelers", "$2,500"],
];

const detailedItinerary = [
  {
    day: "01", title: "Arrive in Ho Chi Minh City", meals: "Meals: none",
    events: [
      ["On arrival", "Airport welcome", "Meet your local representative at Tan Son Nhat International Airport (SGN) in Ho Chi Minh City and transfer privately to the hotel, approximately 30 minutes."],
      ["From 2:00 PM", "Hotel check-in", "Settle into the Paragon Saigon Hotel, Premier Sakura room, or a comparable property."],
      ["Rest of day", "At leisure", "Unpack, rest and explore nearby at your own pace."],
    ],
  },
  {
    day: "02", title: "The many sides of Ho Chi Minh City", meals: "Meals: Breakfast, Dinner",
    events: [
      ["6:30–9:30 AM", "Morning in Ho Chi Minh City", "Tao Dan Park and its bird café, a century-old private house and temple, a local breakfast and a neighborhood wet market."],
      ["1:00–5:00 PM", "Central Ho Chi Minh City", "City Hall, Dong Khoi Street, the Continental Hotel, Opera House, Central Post Office, the former CIA building, 30 April Park, Reunification Palace and Ben Thanh Market."],
      ["6:30–10:30 PM", "Ho Chi Minh City after dark", "Travel by vintage Jeep for local food stops, the flower market and street snacks, finishing with a rooftop drink."],
    ],
  },
  {
    day: "03", title: "Mekong Delta life", meals: "Meals: Breakfast, Lunch",
    events: [
      ["8:00 AM–5:00 PM", "Waterways, farms and a shared table", "Travel about two hours to the delta. Visit the Tan My floating community and a working fish farm, continue by sampan, explore village paths by bicycle or buggy, meet local producers and share a home-hosted lunch before returning to Ho Chi Minh City."],
    ],
  },
  {
    day: "04", title: "Fly to Hue", meals: "Meals: Breakfast, Lunch",
    events: [
      ["Morning", "Airport transfer", "Transfer from the hotel to Tan Son Nhat International Airport (SGN)."],
      ["11:05 AM–12:25 PM", "Flight to Hue", "Planned Vietnam Airlines flight VN1370 from Ho Chi Minh City (SGN) to Phu Bai International Airport (HUI), serving Hue. The airline may change the schedule."],
      ["2:30–6:00 PM", "Imperial Hue", "Explore the Imperial Citadel and restored Kien Trung Palace, followed by Thien Mu Pagoda."],
      ["About 5:00 PM", "Perfume River sunset", "Board a private river cruise with a cocktail and canapés."],
    ],
  },
  {
    day: "05", title: "Gardens, royal tombs and royal dinner", meals: "Meals: Breakfast, Lunch, Dinner",
    events: [
      ["10:30 AM–1:00 PM", "Tha Om Garden House", "Enjoy Hue cakes and tea in the garden house, followed by lunch."],
      ["1:00–5:00 PM", "Tombs of the emperors", "Explore the contrasting royal tombs of Tu Duc and Khai Dinh."],
      ["Evening", "Royal dinner", "Enjoy a multi-course dinner with live traditional music and the opportunity to wear royal-style robes."],
    ],
  },
  {
    day: "06", title: "Hue to Hoi An", meals: "Meals: Breakfast, Lunch",
    events: [
      ["9:00 AM", "Cross the Hai Van Pass", "Depart Hue for the scenic drive toward Da Nang and Hoi An, with lunch en route."],
      ["1:00–5:00 PM", "Lanterns, lanes and basket boats", "Make a traditional lantern, explore Hoi An old town and continue to Cam Thanh coconut village for a basket-boat experience."],
      ["Evening", "Check in at Almanity", "Deluxe Pool View room at Almanity Hoi An Resort & Spa, or a comparable property."],
    ],
  },
  {
    day: "07", title: "Hoi An culinary challenge", meals: "Meals: Breakfast, Lunch, Dinner",
    events: [
      ["8:30 AM–1:00 PM", "Farm-to-table challenge", "Take on a herb hunt, spring-roll showdown, Vietnamese rice-pancake challenge and mystery-box juice creation, followed by lunch."],
      ["Afternoon", "Free time", "Relax at the resort or explore Hoi An independently."],
      ["During free time", "Optional 60-minute massage", "A body massage at Almanity is available as an optional add-on. Participation is not required, and timing is arranged separately."],
      ["7:00 PM", "Farewell dinner", "Gather for a celebratory dinner with one glass of house wine."],
    ],
  },
  {
    day: "08", title: "Depart Hoi An via Da Nang", meals: "Meals: Breakfast",
    events: [
      ["Morning", "Breakfast", "Enjoy breakfast at the hotel and prepare for departure."],
      ["Before 12:00 PM", "Check out and airport transfer", "Transfer privately to Da Nang International Airport (DAD) according to your onward flight schedule."],
    ],
  },
];


const approvedSummary = (label: string) => {
  const text = travelerAgreementSummary.items.find(item => item.label === label)?.text
    ?? "Please ask Trung for the current terms and review your personalized Traveler Agreement before booking.";
  // Homepage visitors need standalone explanations; agreement documents retain their references.
  return text
    .replace(", subject to Sections 4, 12 and 14", ", with exceptions for company cancellation and events beyond our control")
    .replace("For a force majeure cancellation", "For a cancellation caused by events beyond our control")
    .replace(/\s*\(Sections? [^)]+\)/g, "");
};
const homepageFaqs = [
  { question: "Do I need to be ready to book before we talk?", answer: "No. The free 30-minute Google Meet is a chance to ask about the itinerary, flights, rooms and whether the trip fits your plans. There is no obligation to book. You can also get the guide first or email Trung at trung@cookieparadise.co." },
  { question: "Where do I fly into and out of?", answer: "Arrive at Tan Son Nhat International Airport (SGN) in Ho Chi Minh City for June 1, 2027. Depart from Da Nang International Airport (DAD), near Hoi An, on June 8. The listed domestic flight from Ho Chi Minh City to Hue (HUI) is included; international flights are extra. Discuss flight plans with Trung before purchasing." },
  { question: "Can I join on my own, or share a room with my partner?", answer: "Solo travelers and couples can inquire. The $399 private-room supplement applies only to a single traveler who wants a room to themselves, subject to availability. Couples sharing a room can request a queen bed or separate beds. Ask Trung about room arrangements before booking." },
  { question: "What is the daily pace like?", answer: "The itinerary includes city and heritage-site walking, getting on and off boats, some early starts and full activity days, alongside free time. The Mekong village routes offer bicycle or buggy options. Talk with Trung about your preferred pace and any arrangements that need to be checked before booking." },
  { question: "Who will host the trip?", answer: "The trip is created by Trung Le and hosted by Trung or another carefully selected Cookie Paradise Travel Company host, supported by experienced local guides. Ask who is planned to host your departure when you speak with Trung." },
  { question: "What are the deposit and payment terms?", answer: approvedSummary("Deposit and payments") },
  { question: "What happens if the minimum group is not reached?", answer: approvedSummary("Minimum group and company cancellation") + " Independently purchased international flights and other arrangements are not covered by this refund." },
  { question: "What if a major disruption affects the trip?", answer: approvedSummary("Changes and major disruptions") },
  { question: "What if I need to cancel?", answer: approvedSummary("If you cancel") },
  { question: "What if June 2027 does not work for me?", answer: "June 1–8, 2027 is the currently open departure. Future dates have not been announced. You can still request the guide, choose a future departure as your interest, or book a call to discuss your plans." },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const linkedPartner = getSalonPartner((await searchParams).ref);
  if (linkedPartner) redirect("/r/" + linkedPartner.code);
  const partner = getSalonPartner((await cookies()).get(REFERRAL_COOKIE)?.value);
  const availability = await getPublicTripAvailability(vietnamDeparture.tripSlug, vietnamDeparture.departure, vietnamDeparture.capacity);
  return (
    <ReferralProvider partner={partner}>
    <main className="min-h-screen overflow-x-hidden bg-[var(--sand)] text-[var(--ink)]">
      <header className="absolute inset-x-0 top-0 z-20 border-b border-white/20 text-white">
        <div className="site-header-bar mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="site-header-brand flex items-center gap-3">
            <a href="#top" className="site-header-home flex min-w-0 items-center gap-2 sm:gap-3" aria-label="Cookie Paradise Travel Company home">
              <BrandLogo />
            </a>
            <ReferralBrand header />
          </div>
          <nav className="hidden items-center gap-6 text-sm font-semibold xl:flex" aria-label="Main navigation">
            <a className="hover:text-[var(--gold)]" href="#about">Meet Trung</a>
            <a className="hover:text-[var(--gold)]" href="#journey">The trip</a>
            <a className="hover:text-[var(--gold)]" href="#pricing">Pricing</a>
            <a className="hover:text-[var(--gold)]" href="#faq">Questions</a>
          </nav>
          <ConsultationLink compact className="site-header-call" />
        </div>
      </header>

      <section id="top" className="relative isolate overflow-hidden bg-[var(--navy)] text-white">
        <HeroVideo />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(36,21,10,.94)_0%,rgba(45,29,16,.78)_55%,rgba(45,29,16,.3)_100%)]" />
        <div className="mx-auto flex min-h-[760px] max-w-7xl items-center px-5 pb-20 pt-40 sm:px-8 sm:pb-24">
          <div className="max-w-3xl">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)] sm:text-sm">Small-group Vietnam · June 1–8, 2027</p>
            <h1 className="font-serif text-[2.6rem] leading-[1.02] tracking-[-0.04em] sm:text-7xl lg:text-[5.3rem]">Discover Southern Vietnam</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/90 sm:text-xl sm:leading-8">Discover Ho Chi Minh City (Saigon), Mekong waterways, imperial Hue and lantern-lit Hoi An, with the details thoughtfully arranged.</p>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-white/90">
              <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[var(--gold)]" /> 8 days / 7 nights</span>
              <span className="flex items-center gap-2"><Users className="h-4 w-4 text-[var(--gold)]" /> 8–15 travelers</span>
            </div>
            <p className="mt-7 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-4xl font-bold text-[var(--gold)]">$2,875</span><span className="text-base text-white/90">per traveler at eight travelers</span></p>
            <p className="mt-2 text-sm leading-6 text-white/85">Shared room · International airfare extra · Lower group-price tiers available</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ConsultationLink />
              <a href="#guide" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/60 px-6 py-3 text-center text-sm font-bold hover:bg-white/10">Get the itinerary and pricing <ArrowRight className="h-4 w-4 shrink-0" /></a>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/90">Free 30-minute Google Meet with Trung, your Columbus-based trip planner. Ask about flights, rooms and whether this trip fits your plans. No obligation to book.</p>
            <a href="#journey" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--gold)] underline underline-offset-4">Explore the journey <ArrowRight className="h-4 w-4" /></a>
          </div>
        </div>
      </section>

      <section id="about" className="scroll-mt-6 border-b border-[var(--line)] bg-white py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[.65fr_1.35fr] lg:gap-16">
          <div className="relative mx-auto w-full max-w-sm pr-4">
            <div className="absolute bottom-0 right-0 top-4 w-[92%] rounded-[2rem] bg-[var(--gold)]" aria-hidden="true" />
            <img src="/about-trung.jpg" alt="Trung Le seated in front of the yellow Cookie Paradise bakery trailer" className="relative aspect-[4/5] w-full rounded-[2rem] object-cover object-center shadow-lg" width={960} height={1280} loading="lazy" />
          </div>
          <div>
            <p className="eyebrow">A local connection to Vietnam</p>
            <h2 className="section-title">Meet Trung, your Vietnam trip planner.</h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted-ink)]">Born in Vietnam and now based in Columbus, Indiana, Trung Le spent seven years living in Ho Chi Minh City. He is the founder of Cookie Paradise Travel Company and co-owner of the local Cookie Paradise bakery.</p>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted-ink)]">Get to know the person planning your trip before you decide. Your call is a chance to talk through the experience, ask practical questions and see whether the journey is right for you.</p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
              <span className="rounded-full bg-[var(--cream)] px-4 py-2">Born in Vietnam</span>
              <span className="rounded-full bg-[var(--cream)] px-4 py-2">Columbus, Indiana home</span>
              <span className="rounded-full bg-[var(--cream)] px-4 py-2">First-hand Vietnam experience</span>
            </div>
            <div className="mt-7"><ConsultationLink inverse /></div>
            <details className="mt-6 max-w-2xl rounded-2xl border border-[var(--line)] px-5 py-4">
              <summary className="cursor-pointer font-semibold">More about Trung</summary>
              <div className="mt-7 space-y-5 text-lg leading-8 text-[var(--muted-ink)]">
              <p>
                Trung Le is the founder of Cookie Paradise Travel Company and the co-owner of Cookie Paradise, the Columbus cottage bakery known for its generous cookies and warm hospitality. For him, travel is an extension of that same idea: bringing people together through food, stories and experiences that feel personal.
              </p>
              <p>
                Born in 1989 in the mountains of Northern Vietnam’s Hoang Lien Son range, Trung came to French Lick, Indiana, as an exchange student in 2006. He attended Franklin College the following year, then moved to Columbus and worked for Cummins from 2011 to 2017.
              </p>
              <p>
                In 2017, Trung returned to Vietnam and spent seven years living in Ho Chi Minh City before relocating his family back to Columbus. He loves both Vietnam and the United States and remains deeply connected to each country. These journeys are his way of sharing the Vietnam he knows—not simply as a destination, but as a place of family, flavor, resilience and welcome.
              </p>
            </div>

            </details>
          </div>
        </div>
      </section>

      <section id="journey" className="mx-auto max-w-7xl scroll-mt-6 px-5 py-16 sm:px-8 sm:py-20">
        <div className="story-intro">
        <div className="max-w-3xl"><p className="eyebrow">Four places. One memorable journey.</p><h2 className="section-title">Picture yourself here.</h2><p className="mt-5 text-lg leading-8 text-[var(--muted-ink)]">Food, local stories and shared experiences—from Southern Vietnam to the country&apos;s central coast. A personal group of no more than 15, hosted by Trung or a carefully selected Cookie Paradise Travel Company host with experienced local guides.</p></div>
        <JourneyPhoto photo="skyline" className="story-skyline" sizes="(min-width: 1280px) 580px, (min-width: 768px) 47vw, 92vw" />
        </div>
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["01", "Ho Chi Minh City", "Explore Ho Chi Minh City's neighborhoods and landmarks, then head out by vintage Jeep for a food adventure after dark."],
            ["02", "Mekong Delta", "Travel sampan waterways, meet local makers and share a home-hosted lunch, with village paths along the way."],
            ["03", "Hue", "Discover imperial heritage and royal tombs, savor garden-house traditions and cruise the Perfume River at sunset."],
            ["04", "Hoi An", "Cross the Hai Van Pass, make a lantern, explore old-town lanes and join a hands-on culinary challenge."],
          ].map(([number,title,description]) => <article key={number} className="rounded-3xl border border-[var(--line)] bg-white p-6"><p className="text-sm font-bold tracking-widest text-[var(--orange)]">{number}</p><h3 className="mt-5 font-serif text-2xl">{title}</h3><p className="mt-3 text-base leading-7 text-[var(--muted-ink)]">{description}</p></article>)}
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4">
          <a href="#daily-schedule" className="inline-flex items-center gap-2 font-semibold underline decoration-[var(--gold)] decoration-2 underline-offset-4">See the full daily itinerary <ArrowRight className="h-4 w-4" /></a>
          <a href="#pricing" className="font-semibold underline underline-offset-4">See pricing and what&apos;s included</a>
        </div>
      </section>

      <section id="pricing" className="bg-[var(--navy)] py-20 text-white sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow" style={{ color: "var(--gold)" }}>Small group, shared value</p>
            <h2 className="section-title text-white">Your Vietnam trip, clearly priced.</h2>
            <p className="mt-7 text-5xl font-bold text-[var(--gold)]">$2,875</p>
            <p className="mt-3 text-base leading-7 text-white/85">Per traveler, sharing a room, at eight travelers.<br />June 1–8, 2027 · International airfare extra.</p>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">
              {approvedSummary("Price and room arrangements")}
            </p>
            <TripAvailability availability={availability} label={vietnamDeparture.label} />
            <div className="mt-7 flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 p-5 text-sm leading-6 text-white/75">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />
              <span>Requesting a spot is free. No payment is collected until Trung confirms your departure.</span>
            </div>
            <div className="mt-7 flex flex-wrap gap-3"><ConsultationLink /><BookingDialog triggerLabel="I’m ready to request a spot" compact /></div>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-white/15 bg-white/5">
            {pricing.map(([group, price], index) => (
              <div key={group} className={"flex items-end justify-between gap-4 px-6 py-6 sm:px-9 " + (index ? "border-t border-white/10" : "")}>
                <div><p className="text-sm text-white/55">Confirmed group</p><p className="mt-1 font-semibold">{group}</p></div>
                <p className="font-serif text-3xl text-[var(--gold)] sm:text-4xl">{price}<span className="ml-1 font-sans text-xs text-white/50">/ person</span></p>
              </div>
            ))}
            <div className="border-t border-white/10 bg-white/5 px-6 py-5 text-sm text-white/70 sm:px-9">
              Private-room supplement: <strong className="text-white">$399</strong> for a single traveler who wants a room to themselves, subject to availability. Couples sharing a room can request a queen bed or separate beds. International airfare is not included.
            </div>
          </div>
        </div>
      </section>

      <section id="included" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="max-w-3xl">
          <p className="eyebrow">Included in your trip</p>
          <h2 className="section-title">The essentials—and the experiences you’ll remember.</h2>
        </div>
        <div className="story-inclusions">
        <JourneyPhoto photo="mekong" className="story-mekong" sizes="(min-width: 1280px) 450px, (min-width: 768px) 36vw, 92vw" />
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            [Plane, "Hotels & transport", "Seven hotel nights, daily breakfast, private ground transportation, scheduled airport transfers and the domestic flight to Hue."],
            [Utensils, "Meals & local flavor", "Meals marked in the itinerary, a home-hosted Mekong lunch, Hue royal dinner and Hoi An farewell dinner."],
            [Sparkles, "Signature experiences", "Ho Chi Minh City by vintage Jeep, Perfume River sunset cruise, lantern workshop, basket boat and culinary challenge."],
            [Users, "Guides & admissions", "English-speaking local guides, entrance fees and the scheduled activities described in the itinerary."],
            [Check, "Thoughtful details", "Refillable water bottle, purified drinking water, private boats and carefully paced days."],
            [MapPin, "Three distinct regions", "Ho Chi Minh City and the Mekong Delta, imperial Hue, and the living heritage of Hoi An."],
          ].map(([Icon, title, text]) => {
            const CardIcon = Icon as typeof Plane;
            return (
              <article key={title as string} className="rounded-3xl border border-[var(--line)] bg-white p-7">
                <CardIcon className="h-7 w-7 text-[var(--orange)]" />
                <h3 className="mt-6 font-serif text-2xl">{title as string}</h3>
                <p className="mt-3 leading-7 text-[var(--muted-ink)]">{text as string}</p>
              </article>
            );
          })}
        </div>
        </div>
        <div className="mt-10 grid gap-6 rounded-3xl border border-[var(--line)] bg-[var(--cream)] p-7 sm:grid-cols-2 sm:p-9">
          <div><h3 className="font-serif text-2xl">Not included</h3><p className="mt-3 leading-7 text-[var(--muted-ink)]">International flights, travel insurance, Vietnam visa, personal expenses, gratuities, airport fast-track assistance and anything not specifically listed.</p></div>
          <div><h3 className="font-serif text-2xl">A note about plans</h3><p className="mt-3 leading-7 text-[var(--muted-ink)]">Hotels, flight times, activities and routing may change because of local conditions or supplier requirements. Comparable arrangements will be used when practical.</p></div>
        </div>
      </section>


      <section id="faq" className="mx-auto max-w-5xl scroll-mt-6 px-5 py-16 sm:px-8 sm:py-20">
        <div className="story-faq-intro">
        <div><p className="eyebrow">Find your fit</p><h2 className="section-title">Your questions, answered.</h2>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted-ink)]">You should have the practical details before deciding. If something still needs a conversation, Trung is here to help.</p>
        </div>
        <JourneyPhoto photo="street" className="story-street" sizes="(min-width: 1024px) 340px, (min-width: 768px) 35vw, 80vw" />
        </div>
        <div className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {homepageFaqs.map(item => <details key={item.question} className="group py-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">{item.question}<ChevronDown aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 transition-transform group-open:rotate-180" /></summary>
            <p className="mt-4 max-w-4xl text-base leading-8 text-[var(--muted-ink)]">{item.answer}</p>
          </details>)}
        </div>
        <p className="mt-5 text-sm leading-6 text-[var(--muted-ink)]">These answers are a summary. Your personalized Traveler Agreement contains the complete booking terms.</p>
        <div className="mt-7"><ConsultationLink inverse /></div>
      </section>

      <section id="itinerary" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:gap-20">
          <div className="lg:self-start">
            <p className="eyebrow">The daily itinerary</p>
            <h2 className="section-title">Eight days, thoughtfully arranged</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted-ink)]">
              Each day balances memorable experiences with room to breathe. You’ll meet the country through its food, families, landscapes and layered history—not from a bus window.
            </p>
            <a href="#daily-schedule" className="mt-7 inline-flex items-center gap-2 font-bold text-[var(--orange)] underline decoration-[var(--gold)] decoration-2 underline-offset-4">
              Jump to the day-by-day schedule <ArrowRight className="h-4 w-4" />
            </a>
            <div className="mt-7"><ConsultationLink inverse /></div>
            <div className="mt-8 rounded-3xl bg-[var(--navy)] p-7 text-white">
              <Compass className="h-8 w-8 text-[var(--gold)]" />
              <p className="mt-5 font-serif text-2xl">Thoughtfully hosted</p>
              <p className="mt-3 leading-7 text-white/70">Each departure is hosted by Trung or another carefully selected Cookie Paradise Travel Company host, supported by experienced local guides.</p>
            </div>
            <JourneyPhoto photo="hue" className="story-hue" sizes="(min-width: 1280px) 400px, (min-width: 1024px) 32vw, 92vw" />
          </div>
          <div id="daily-schedule" className="scroll-mt-6 space-y-4">
            {detailedItinerary.map((day, index) => (
              <details key={day.day} open={index === 0} className="group overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--sand)]">
                <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-5 sm:px-7 [&::-webkit-details-marker]:hidden">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--gold)] text-sm font-extrabold text-[var(--orange)]">{day.day}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-xl sm:text-2xl">{day.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--muted-ink)]">{itinerary[index][2]}</span>
                    <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--orange)]">{day.meals}</span>
                  </span>
                  <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-[var(--orange)] transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-[var(--line)] bg-white px-5 py-6 sm:px-7">
                  <ol className="space-y-6">
                    {day.events.map(([time, title, description]) => (
                      <li key={`${day.day}-${time}`} className="grid gap-2 sm:grid-cols-[10rem_1fr] sm:gap-6">
                        <p className="schedule-time text-sm text-[var(--orange)]">{time}</p>
                        <div>
                          <h3 className="font-bold text-[var(--ink)]">{title}</h3>
                          <p className="mt-1 leading-7 text-[var(--muted-ink)]">{description}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>


      <section id="guide" className="border-y border-[var(--line)] bg-[var(--cream)] py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-start gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div><p className="eyebrow">Take the details with you</p><h2 className="section-title">Still exploring? Start with the guide.</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted-ink)]">Save the itinerary and pricing, share it with your travel companion and come back with your questions. Request an emailed copy here without starting a booking.</p>
            <a href={tripGuideUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 items-center gap-2 font-semibold underline underline-offset-4">View the guide now (PDF) <ArrowRight className="h-4 w-4" /></a>
            <p className="mt-6 text-base leading-7 text-[var(--muted-ink)]">Prefer to ask by email? Write to <a href="mailto:trung@cookieparadise.co" className="font-semibold underline">trung@cookieparadise.co</a>.</p>
            <JourneyPhoto photo="lanterns" className="story-guide-lanterns" sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 70vw" />
          </div>
          <TripGuideForm />
        </div>
      </section>

      <section id="how-booking-works" className="mx-auto max-w-7xl scroll-mt-6 px-5 py-16 sm:px-8 sm:py-20">
        <p className="eyebrow">When you are ready</p><h2 className="section-title">A clear next step, at your pace.</h2>
        <ol className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["01", "Talk or explore first", "Book a free 30-minute Google Meet, read the daily itinerary or get the guide. These steps do not create a reservation or payment obligation."],
            ["02", "Request your spot", "When ready, send your departure, traveler and room details. Your request is reviewed before the booking can be confirmed."],
            ["03", "Review and sign", "Review your personalized Traveler Agreement. Each adult signs separately; a parent or guardian signs for a minor."],
            ["04", "Confirm your booking", "Confirmation requires our written acceptance, your signature and cleared deposit or required full payment. Payments are handled through a secure Square invoice."],
          ].map(([number,title,description]) => <li key={number} className="rounded-2xl border border-[var(--line)] bg-white p-6"><p className="text-sm font-bold text-[var(--orange)]">{number}</p><h3 className="mt-4 font-serif text-2xl">{title}</h3><p className="mt-3 leading-7 text-[var(--muted-ink)]">{description}</p></li>)}
        </ol>
        <div className="mt-8 flex flex-wrap items-center gap-4"><BookingDialog triggerLabel="I’m ready to request a spot" /><p className="max-w-xl text-sm leading-6 text-[var(--muted-ink)]">No payment is collected by the inquiry form. A request is not a confirmed reservation.</p></div>
      </section>

      <section className="mx-4 mb-4 rounded-[2rem] bg-[var(--navy)] px-6 py-12 text-white sm:mx-6 sm:mb-6 sm:px-10 sm:py-16">
        <div className="mx-auto max-w-5xl text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Your Vietnam questions are welcome</p><h2 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">Let&apos;s see whether this journey is right for you.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/85">Talk through the itinerary, flight arrangements, rooms and anything you want to understand before deciding.</p><div className="mt-7"><ConsultationLink /></div><p className="mt-4 text-sm text-white/85">Free 30-minute Google Meet · No obligation to book</p><a href="#guide" className="mt-5 inline-block text-sm font-semibold text-[var(--gold)] underline underline-offset-4">I&apos;d like the itinerary and pricing first</a></div>
      </section>

      <footer className="bg-[var(--navy)] px-5 pb-40 pt-10 text-white/65 sm:px-8 md:pb-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandLogo footer />
            <p className="mt-3 text-sm">Hosted small-group journeys from Columbus, Indiana.</p>
          </div>
          <div className="text-sm sm:text-right"><p>cookieparadisetravel.com</p><p className="mt-2"><a className="underline hover:text-white" href="mailto:trung@cookieparadise.co">trung@cookieparadise.co</a></p><p className="mt-2"><Link className="underline hover:text-white" href="/fit">Private Vietnam trips</Link></p><p className="mt-2"><a className="underline hover:text-white" href="/privacy">Privacy Policy</a></p><p className="mt-2">© 2026 Cookie Paradise Travel Company LLC</p></div>
        </div>
      </footer>
      <MobileBookBar availability={availability} />
    </main>
    </ReferralProvider>
  );
}
