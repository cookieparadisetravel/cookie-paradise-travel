/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids the vinext client-router failure observed in production. */
import { publicPageMetadata } from "@/lib/public-page-metadata";
import { cookies } from "next/headers";
import { ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import { ConsultationLink } from "../components/consultation-link";
import { BrandLogo } from "../components/brand-logo";
import { JourneyPhoto } from "../components/journey-photo";
import { ReferralBrand, ReferralProvider } from "../components/referral-brand";
import { getSalonPartner, REFERRAL_COOKIE } from "@/lib/salon-referrals";
import "./fit.css";

export const dynamic = "force-dynamic";

export const metadata = publicPageMetadata({
  title: "Private Vietnam Trips & Custom Tours | Cookie Paradise Travel",
  description: "Spend less time planning your private Vietnam trip. Trung Le can design your itinerary and book flights, hotels, private guides and transfers.",
  path: "/fit",
  image: "/travel/fit-mu-cang-chai-1800.webp",
  imageAlt: "Golden rice terraces in the morning mist in Mu Cang Chai, Vietnam",
});

const questions = [
  ["Can you arrange a special request?", "Tell me about the anniversary dinner, particular hotel or interest you’d like to build a day around. I’ll check availability and cost with you before adding it to the plan."],
  ["Can you accommodate accessibility or dietary needs?", "Tell me how far you’re comfortable walking and what dietary or accessibility arrangements you need. I’ll check what can be arranged and include it in your proposal."],
  ["How is this different from the hosted group trip?", "On Discover Southern Vietnam, you join a group on a scheduled departure. With a private trip, you choose the dates and travel solo or with your own companions."],
];

export default async function FitTravelPage() {
  const partner = getSalonPartner((await cookies()).get(REFERRAL_COOKIE)?.value);
  const emailBody = [
    "Hi Trung, I'd like to discuss a private Vietnam trip.", "",
    "Approximate dates or travel window:", "How many travelers:", "Places or experiences I am interested in:",
    "Approximate trip length:", "What I would like help with (one arrangement or the whole trip):", "Comfort preferences and budget (if known):", "",
    ...(partner ? [`Referred by: ${partner.name} (${partner.code})`, ""] : []),
    "Sent from the private Vietnam travel page: https://cookieparadisetravel.com/fit",
  ].join("\r\n");
  const emailHref = `mailto:trung@cookieparadise.co?subject=${encodeURIComponent("Let's plan a private Vietnam trip")}&body=${encodeURIComponent(emailBody)}`;

  return <ReferralProvider partner={partner}><main id="fit-top" className="fit-page">
    <a className="fit-skip-link" href="#fit-main">Skip to content</a>
    <header className="fit-header text-white">
      <div className="site-header-bar mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-5 sm:px-8">
        <div className="site-header-brand flex min-w-0 items-center gap-4">
          <span className="site-header-home flex min-w-0 flex-col items-start gap-2">
            <BrandLogo surface="dark" tagline homeHref="/" />
          </span>
          <ReferralBrand header />
        </div>
        <nav className="hidden items-center gap-6 text-sm font-semibold xl:flex" aria-label="Private travel navigation">
          <a href="/why-vietnam">Why Vietnam?</a><a href="#fit-approach">Services &amp; pricing</a><a href="#fit-process">How it works</a><a href="#fit-planner">Meet Trung</a><a href="#fit-ideas">Trip ideas</a>
        </nav>
        <a className="site-header-call fit-header-plan" href="#fit-plan">Start planning <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
    <nav className="flex flex-wrap justify-center gap-5 px-5 pb-4 text-sm font-semibold xl:hidden" aria-label="Travel options"><a href="/">Small-group tour</a><a href="/why-vietnam">Why Vietnam?</a><a href="/fit" aria-current="page">Private trips</a></nav>
    </header>

    <section id="fit-main" className="fit-hero fit-wrap" aria-labelledby="fit-title">
      <div className="fit-hero-copy">
        <p className="fit-kicker">Private Vietnam travel</p>
        <h1 id="fit-title">Let me do the planning,<br /><em>so you can spend time experiencing Vietnam.</em></h1>
        <p className="fit-body">I’m Trung Le, a Vietnam-born trip planner based in Indiana. I’ll use my firsthand knowledge and local contacts to design a private itinerary at your pace. Hand off as much of the research and booking as you’d like, including flights.</p>
        <ConsultationLink inverse className="mt-8" />
        <p className="fit-small fit-hero-note">30 minutes with Trung</p>
      </div>
      <div id="fit-hero-art" className="fit-hero-art">
        <JourneyPhoto photo="fitCafe" priority className="fit-hero-photo" sizes="(min-width: 1280px) 535px, (min-width: 768px) 45vw, 90vw" />
      </div>
    </section>

    <section id="fit-approach" className="fit-wrap fit-section fit-approach fit-process-section" aria-labelledby="fit-approach-title">
      <div id="fit-value">
        <h2 id="fit-approach-title">Choose your level<br /><em>of planning help.</em></h2>
        <div className="fit-service"><h3>Plan my whole trip</h3><p className="fit-body">I’ll plan your route and can book international and domestic flights, hotels, transfers, private guides and experiences.</p></div>
        <div className="fit-service"><h3>Help with part of my trip</h3><p className="fit-body">I can arrange a single airport pickup, find a guide for a day or plan a few days around flights and hotels you’ve already booked.</p></div>
      </div>
      <aside className="fit-quote" aria-labelledby="fit-quote-title">
        <h3 id="fit-quote-title">What will my trip cost?</h3>
        <p className="fit-body">You’ll get a custom quote based on your dates, group size and preferences. Your proposal lists what the price covers, including any airfare, visa assistance or travel insurance, along with any planning fees, payment dates and booking terms.</p>
      </aside>
    </section>

    <section id="fit-process" className="fit-wrap fit-section fit-process-section" aria-labelledby="fit-process-title">
      <div className="fit-process-heading"><h2 id="fit-process-title">How planning works</h2></div>
      <ol className="fit-process">
        {[
          ["Tell me about your trip", "Share who’s coming, your budget and what you’d like to experience. A rough travel window is enough to start."],
          ["Review your itinerary", "I’ll compare routes and travel times, then recommend where to stay longer so you have time to enjoy each stop."],
          ["Approve your bookings", "Once you approve the proposal and meet the booking terms, I’ll coordinate your reservations and share your schedule and contacts for the trip."],
        ].map(([title, text]) => <li key={title}><h3>{title}</h3><p className="fit-body">{text}</p></li>)}
      </ol>
    </section>

    <section id="fit-planner" className="fit-planner" aria-labelledby="fit-planner-title">
      <div className="fit-wrap fit-section fit-planner-grid">
        <div className="fit-planner-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/about-trung.jpg" alt="Trung Le, founder of Cookie Paradise Travel Company, at his Columbus bakery trailer" width={960} height={1280} loading="lazy" />
          <p className="fit-small">Trung Le · Founder &amp; Vietnam trip planner</p>
        </div>
        <div><p className="fit-kicker"><MapPin size={14} aria-hidden="true" /> Columbus, Indiana</p><h2 id="fit-planner-title">Meet Trung</h2><p className="fit-body">I spent the first 16 years of my life in Vietnam, growing up in Yên Bái in the north and Bình Dương in the south. I later lived in Ho Chi Minh City for seven years. If this is your first visit, you can ask me the small questions too, like what to order at a breakfast stall or what to wear to a pagoda.</p></div>
      </div>
    </section>

    <section id="fit-faq" className="fit-wrap fit-section fit-faq" aria-labelledby="fit-faq-title">
      <h2 id="fit-faq-title">Frequently asked questions</h2>
      <div className="fit-questions">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span className="fit-faq-sign" aria-hidden="true">+</span></summary><p className="fit-body">{answer}</p></details>)}</div>
    </section>

    <section id="fit-ideas" className="fit-inspiration" aria-labelledby="fit-ideas-title">
      <div className="fit-wrap fit-section">
        <h2 id="fit-ideas-title">Trip ideas for northern Vietnam</h2>
        <div className="fit-editorial-grid">
          <article id="fit-bay" className="fit-bay-story">
            <JourneyPhoto photo="fitBay" className="fit-bay-photo" sizes="(min-width: 1280px) 530px, (min-width: 768px) 45vw, 90vw" />
            <div className="fit-story-copy"><p className="fit-kicker">Ha Long Bay</p><h3>Wake up on the bay.</h3><p className="fit-body">I can time your Hanoi pickup to the cruise’s boarding time and plan the onward transfer so you have time for breakfast on deck.</p></div>
          </article>
          <div className="fit-stories-right">
            <article id="fit-terraces" className="fit-terrace-story"><div className="fit-story-copy"><p className="fit-kicker">Mu Cang Chai</p><h3>Walk the rice terraces.</h3><p className="fit-body">I’ll help you pick dates for the landscape you want to see and work out whether the mountain drive fits your trip.</p></div><JourneyPhoto photo="fitTerraces" className="fit-terrace-photo" sizes="(min-width: 1280px) 530px, (min-width: 768px) 45vw, 90vw" /></article>
            <article className="fit-city-story"><div className="fit-story-copy"><p className="fit-kicker">Hanoi</p><h3>Find your breakfast in the Old Quarter.</h3><p className="fit-body">I can find you a hotel within a morning walk of phở and egg coffee, or a quieter base with a guide to show you the Old Quarter.</p></div></article>
          </div>
        </div>
          <article aria-labelledby="fit-sapa-title" className="fit-planner-grid" style={{ marginTop: "4rem" }}>
            <figure style={{ margin: 0, width: "100%", maxWidth: "24rem" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.pexels.com/photos/33925058/pexels-photo-33925058.jpeg?auto=compress&cs=tinysrgb&w=1280"
                srcSet="https://images.pexels.com/photos/33925058/pexels-photo-33925058.jpeg?auto=compress&cs=tinysrgb&w=640 640w, https://images.pexels.com/photos/33925058/pexels-photo-33925058.jpeg?auto=compress&cs=tinysrgb&w=1280 1280w"
                sizes="(min-width: 1024px) 384px, (min-width: 768px) 40vw, 80vw"
                alt="Two women in traditional clothing sharing a laugh beside a village gate in Sapa, Vietnam"
                width={2071} height={3100} loading="lazy" decoding="async"
                style={{ display: "block", width: "100%", height: "auto" }}
              />
              <figcaption className="fit-small">Sapa, Vietnam · Photo by <a href="https://www.pexels.com/photo/ethnic-women-in-traditional-attire-lao-cai-33925058/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>Son Hoa Nguyen / Pexels</a></figcaption>
            </figure>
            <div className="fit-story-copy"><p className="fit-kicker">Sapa</p><h3 id="fit-sapa-title">Make room for local life.</h3><p className="fit-body">Tell me what interests you, and I’ll help you make time for village visits and the people you meet along the way.</p></div>
          </article>
      </div>
    </section>

    <section id="fit-plan" className="fit-plan" aria-labelledby="fit-plan-title">
      <div className="fit-wrap fit-section">
        <h2 id="fit-plan-title">Let’s plan your Vietnam trip</h2>
        <div className="fit-plan-actions">
          <ConsultationLink />
          <a className="fit-email-link" href={emailHref}>Email Trung your trip ideas <ArrowUpRight size={17} aria-hidden="true" /></a>
        </div>
        {partner && <div className="fit-referral-disclosure"><ReferralBrand /></div>}
      </div>
    </section>

    <footer className="fit-wrap fit-footer"><div><p className="fit-footer-name">Cookie Paradise Travel Company</p><p>Small-group tours and private trips to Vietnam.</p></div><div><a href="/">Discover Southern Vietnam group trip <ArrowUpRight size={14} aria-hidden="true" /></a><a href="/vietnam-trip-planning#travel-style">Compare group and private trips</a><a href="/privacy">Privacy policy</a><p>© {new Date().getFullYear()} Cookie Paradise Travel Company LLC · Columbus, Indiana</p></div></footer>
  </main></ReferralProvider>;
}
