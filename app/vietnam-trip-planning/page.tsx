/* eslint-disable @next/next/no-html-link-for-pages -- Use native navigation consistently with the public trip pages. */
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "../components/brand-logo";
import { ConsultationLink } from "../components/consultation-link";
import { JourneyPhoto } from "../components/journey-photo";
import { publicPageMetadata } from "@/lib/public-page-metadata";

export const metadata = publicPageMetadata({
  title: "Vietnam Trip Planning: Group or Private? | Cookie Paradise Travel",
  description: "Compare Vietnam small-group tours and private trips. Plan your route, arrival and departure, budget and daily pace with guidance from Cookie Paradise Travel.",
  path: "/vietnam-trip-planning",
});

export default function VietnamTripPlanningPage() {
  return (
    <div className="min-h-screen bg-[var(--sand)] text-black">
      <a href="#planning-content" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4 focus:text-black">Skip to content</a>
      <header className="bg-[var(--navy)] px-5 py-6 text-white sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6">
          <a href="/" className="flex flex-col items-start gap-3" aria-label="Cookie Paradise Travel Company home">
            <BrandLogo surface="dark" />
            <span className="max-w-64 text-sm leading-6">Small-group tours and private trips to Vietnam</span>
          </a>
          <nav aria-label="Travel services" className="flex flex-wrap gap-x-6 gap-y-3 text-base font-semibold">
            <a className="underline" href="/">Small-group tours</a>
            <a className="underline" href="/fit">Private trips</a>
          </nav>
        </div>
      </header>

      <main id="planning-content" className="mx-auto max-w-5xl px-5 py-12 text-lg leading-8 sm:px-8 sm:py-16">
        <p className="text-base font-semibold">A practical starting point</p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-tight sm:text-6xl">Planning your Vietnam trip</h1>
        <p className="mt-6 max-w-3xl">Start with how you want to travel, then choose the route. A shared group itinerary and a private journey offer different kinds of flexibility. Here is how to compare them and prepare for a conversation with Trung.</p>
        <p className="mt-5 text-base leading-7">Your planner, <a className="font-semibold underline" href="/#about">Trung Le</a>, was born in Vietnam and spent seven years living in Ho Chi Minh City. Now based in Columbus, Indiana, he brings that connection to the trips he plans.</p>

        <nav aria-label="On this page" className="my-10 flex flex-wrap gap-x-6 gap-y-3 border-y border-[var(--line)] py-5 text-base font-semibold">
          <a className="underline" href="#travel-style">Group or private?</a>
          <a className="underline" href="#route">Choose a route</a>
          <a className="underline" href="#practical-details">Budget and practical details</a>
          <a className="underline" href="#before-your-call">Before your call</a>
        </nav>

        <section id="travel-style" className="scroll-mt-6" aria-labelledby="travel-style-title">
          <h2 id="travel-style-title" className="font-serif text-3xl leading-tight sm:text-4xl">Small-group tour or private Vietnam trip?</h2>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-xl font-bold">Join a hosted small-group tour</h3>
              <p className="mt-3">Choose this if you like a planned route, shared experiences and the company of fellow travelers. Discover Southern Vietnam is an eight-day journey for 8–15 travelers, with a company host and local guides.</p>
              <p className="mt-3">The scheduled departure has set dates and a shared itinerary. Check the daily activities and free time to see whether the pace suits you.</p>
              <a href="/" className="mt-4 inline-flex items-center gap-2 font-semibold underline">Explore the small-group tour <ArrowRight size={18} aria-hidden="true" /></a>
            </div>
            <div>
              <h3 className="text-xl font-bold">Plan a private trip</h3>
              <p className="mt-3">Choose this if your dates, travel companions or particular interests come first. Plan a custom Vietnam tour for yourself, a couple, family or friends, or ask for help with one hotel, transfer, guide or experience.</p>
              <p className="mt-3">Private travel does not automatically include Trung as your host. Your proposal explains the arrangements, guiding, support and price.</p>
              <a href="/fit" className="mt-4 inline-flex items-center gap-2 font-semibold underline">Explore private Vietnam trips <ArrowRight size={18} aria-hidden="true" /></a>
            </div>
          </div>
        </section>

        <section id="route" className="mt-14 scroll-mt-6" aria-labelledby="route-title">
          <h2 id="route-title" className="font-serif text-3xl leading-tight sm:text-4xl">Choose a route you have time to enjoy</h2>
          <p className="mt-5">Count the days you will actually have in Vietnam separately from your international travel days. Then decide which experiences matter most. Our group route pairs Southern Vietnam with the central coast:</p>
          <ol className="mt-6 space-y-5">
            <li><strong>1. Ho Chi Minh City (Saigon) and the Mekong Delta.</strong> Begin with city neighborhoods, food and landmarks, then spend a day exploring delta waterways and village life before returning to Ho Chi Minh City.</li>
            <li><strong>2. Hue.</strong> Continue to the former imperial capital for the Citadel, royal tombs, garden-house traditions and time on the Perfume River.</li>
            <li><strong>3. Hoi An.</strong> Travel via the Hai Van Pass toward lantern-lit streets, local food and hands-on experiences, finishing with departure through nearby Da Nang.</li>
          </ol>
          <p className="mt-5">For a private trip, discuss how many hotel changes you want, whether to leave afternoons open, and any family visits or specific places you want to include. Your route can be planned around those priorities.</p>
          <JourneyPhoto photo="hue" className="story-hue" sizes="(min-width: 640px) 528px, 90vw" />
        </section>

        <section id="practical-details" className="mt-14 scroll-mt-6" aria-labelledby="practical-title">
          <h2 id="practical-title" className="font-serif text-3xl leading-tight sm:text-4xl">Work through the practical details</h2>
          <div className="mt-6 space-y-7">
            <div><h3 className="text-xl font-bold">Match flights to the route</h3><p className="mt-2">Our group itinerary begins in Ho Chi Minh City (SGN) and ends near Da Nang (DAD). The listed domestic flight to Hue is included; international flights are separate. Review arrival and departure plans with Trung before buying tickets. Private-trip flight arrangements depend on your proposal.</p></div>
            <div><h3 className="text-xl font-bold">Compare the full travel budget</h3><p className="mt-2">Read the <a className="underline" href="/#pricing">group tour pricing</a> and <a className="underline" href="/#included">inclusions</a> together. Allow separately for international airfare, travel insurance, visas, personal expenses, gratuities and anything the itinerary excludes. Ask about room arrangements and any supplement before choosing a room.</p></div>
            <div><h3 className="text-xl font-bold">Discuss the daily pace</h3><p className="mt-2">The group itinerary includes walking, boat boarding, some early starts and full activity days. Tell Trung about your walking comfort, dietary preferences and any assistance you would like checked. For a private journey, discuss the balance of planned activities and time on your own.</p></div>
          </div>
        </section>

        <section id="before-your-call" className="mt-14 scroll-mt-6 border-t border-[var(--line)] pt-10" aria-labelledby="call-title">
          <h2 id="call-title" className="font-serif text-3xl leading-tight sm:text-4xl">Bring these details to your first call</h2>
          <ul className="mt-6 list-disc space-y-2 pl-6">
            <li>Your approximate dates and number of days in Vietnam.</li>
            <li>Who is traveling and your room preferences.</li>
            <li>The places, food or experiences you most want to enjoy.</li>
            <li>Your budget, departure airport and any arrangements already booked.</li>
            <li>Whether you want a hosted group, a private trip or help with one part.</li>
          </ul>
          <p className="my-6">You do not need every answer before speaking with Trung. The free 30-minute Google Meet is a chance to work through your options, with no obligation to book.</p>
          <ConsultationLink />
          <p className="mt-5 text-base">Prefer to read the group itinerary first? <a className="font-semibold underline" href="/vietnam">Get the free Vietnam trip guide and pricing</a>.</p>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] px-5 py-8 text-base leading-7 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="font-semibold">Cookie Paradise Travel Company LLC · Columbus, Indiana</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2"><a className="underline" href="/">Vietnam small-group tours</a><a className="underline" href="/fit">Private Vietnam trips</a><a className="underline" href="mailto:trung@cookieparadise.co">Email Trung</a><a className="underline" href="/privacy">Privacy policy</a></div>
        </div>
      </footer>
    </div>
  );
}
