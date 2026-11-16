/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids the vinext client-router failure observed in production. */
import { publicPageMetadata } from "@/lib/public-page-metadata";
import { cookies } from "next/headers";
import { ArrowDown, ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import { ConsultationLink } from "../components/consultation-link";
import { BrandLogo } from "../components/brand-logo";
import { JourneyPhoto } from "../components/journey-photo";
import { ReferralBrand, ReferralProvider } from "../components/referral-brand";
import { getSalonPartner, REFERRAL_COOKIE } from "@/lib/salon-referrals";
import "./fit.css";

export const dynamic = "force-dynamic";

export const metadata = publicPageMetadata({
  title: "Private Vietnam Trips & Custom Tours | Cookie Paradise Travel",
  description: "Plan a private Vietnam trip around your dates, interests and budget with Trung Le. Get help with a complete custom tour, hotels, transfers or local experiences.",
  path: "/fit",
  image: "/travel/fit-mu-cang-chai-1800.webp",
  imageAlt: "Golden rice terraces in the morning mist in Mu Cang Chai, Vietnam",
});

const questions = [
  ["What if my dates or route are still undecided?", "Share your approximate travel window, the time you have available and the experiences you are drawn to. We can discuss the route and pace before you settle on the details."],
  ["Can you arrange a special request?", "Tell Trung about family visits, celebrations, a particular restaurant or a place you want to see. We will explore what is possible and confirm availability and cost before adding it to your plan."],
  ["What about flights, accessibility or dietary needs?", "Share your departure airport, walking comfort, dietary needs and any assistance you need during planning. Your proposal will identify what can be arranged, including any flights, visa help or insurance. Confirm your itinerary and booking details before purchasing flights."],
  ["How is this different from the June 2027 group trip?", "Your private trip has its own dates, itinerary and quote. The scheduled Discover Southern Vietnam tour's dates, group-size requirements and published prices do not apply to a custom trip."],
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
          <a href="/" className="site-header-home flex min-w-0 flex-col items-start gap-2" aria-label="Cookie Paradise Travel Company home">
            <BrandLogo surface="dark" tagline />
          </a>
          <ReferralBrand header />
        </div>
        <nav className="hidden items-center gap-6 text-sm font-semibold xl:flex" aria-label="Private travel navigation">
          <a href="#fit-approach">Services &amp; pricing</a><a href="#fit-process">How it works</a><a href="#fit-ideas">Trip ideas</a><a href="#fit-planner">Meet Trung</a>
        </nav>
        <a className="site-header-call fit-header-plan" href="#fit-plan">Start planning <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
    </header>

    <section id="fit-main" className="fit-hero fit-wrap" aria-labelledby="fit-title">
      <div className="fit-hero-copy">
        <p className="fit-kicker">Your dates. Your own travel companions.</p>
        <h1 id="fit-title">Private Vietnam trips,<br /><em>at your pace.</em></h1>
        <p className="fit-body">Plan a Vietnam journey for yourself, a couple, family or friends. Work directly with Trung on a complete itinerary or the arrangements you need, shaped around your interests and budget.</p>
        <a className="fit-button fit-button-dark" href="#fit-plan">Plan my Vietnam trip <ArrowRight size={18} aria-hidden="true" /></a>
        <p className="fit-small fit-hero-note">Free 30-minute consultation · A custom quote before you book.</p>
        <a className="fit-text-link fit-explore" href="#fit-approach">See the services and pricing <ArrowDown size={16} aria-hidden="true" /></a>
      </div>
      <div id="fit-hero-art" className="fit-hero-art">
        <JourneyPhoto photo="fitCafe" priority className="fit-hero-photo" sizes="(min-width: 1280px) 535px, (min-width: 768px) 45vw, 90vw" />
        <span className="fit-margin-note" aria-hidden="true">A different way to see Vietnam</span>
      </div>
    </section>

    <section id="fit-approach" className="fit-wrap fit-section fit-approach" aria-labelledby="fit-approach-title">
      <div>
        <p className="fit-kicker">Services &amp; pricing</p>
        <h2 id="fit-approach-title">Choose the help<br /><em>you need.</em></h2>
        <div className="fit-service"><h3>A complete journey</h3><p className="fit-body">A route, hotels, transport, local guides and experiences brought together for your party.</p></div>
        <div className="fit-service"><h3>The finishing touches</h3><p className="fit-body">Keep the plans you already have. Ask for a hotel, airport transfer, guide for a day or a special experience.</p></div>
      </div>
      <aside className="fit-quote" aria-labelledby="fit-quote-title">
        <p className="fit-kicker">Know what to expect</p>
        <h3 id="fit-quote-title">A quote built<br />around your trip.</h3>
        <p className="fit-body">Your dates, trip length, number of travelers, hotels and experiences determine the cost.</p>
        <p className="fit-body">The first consultation is free. Your proposal explains the price, any planning fees, inclusions, payment schedule and booking terms before you commit.</p>
        <p className="fit-small">Flights, visas and insurance are included only if your proposal specifically lists them.</p>
      </aside>
    </section>

    <section id="fit-process" className="fit-wrap fit-section fit-process-section" aria-labelledby="fit-process-title">
      <div className="fit-process-heading"><p className="fit-kicker">How it works</p><h2 id="fit-process-title">Turn your ideas<br /><em>into a plan.</em></h2></div>
      <ol className="fit-process">
        {[
          ["01", "Tell Trung your priorities.", "Share your travel window, travelers, budget and any arrangements you have already made."],
          ["02", "Refine your itinerary.", "Work through the route, pace, stays and experiences together."],
          ["03", "Review your proposal.", "Check the arrangements, quote and terms, then decide whether to book."],
        ].map(([number, title, text]) => <li key={number}><span className="fit-step-number" aria-hidden="true">{number}</span><h3>{title}</h3><p className="fit-body">{text}</p></li>)}
      </ol>
    </section>

    <section id="fit-ideas" className="fit-inspiration" aria-labelledby="fit-ideas-title">
      <div className="fit-wrap fit-section">
        <div className="fit-ideas-heading"><div><p className="fit-kicker">A few possibilities</p><h2 id="fit-ideas-title">Find your<br /><em>kind of Vietnam.</em></h2></div><p className="fit-body">Combine these ideas, stay longer, or explore another part of the country.</p></div>
        <div className="fit-editorial-grid">
          <article id="fit-bay" className="fit-bay-story">
            <JourneyPhoto photo="fitBay" className="fit-bay-photo" sizes="(min-width: 1280px) 530px, (min-width: 768px) 45vw, 90vw" />
            <div className="fit-story-copy"><p className="fit-kicker">01 / Slow down</p><h3>Drift into a different rhythm.</h3><p className="fit-body">Cruise between Ha Long Bay’s limestone islands, with mist over the water and time to slow down.</p></div>
          </article>
          <div className="fit-stories-right">
            <article id="fit-terraces" className="fit-terrace-story"><div className="fit-story-copy"><p className="fit-kicker">02 / Follow the landscape</p><h3>Take the scenic way.</h3><p className="fit-body">Follow Mu Cang Chai’s rice terraces into the mountains, with a route timed to the season.</p></div><JourneyPhoto photo="fitTerraces" className="fit-terrace-photo" sizes="(min-width: 1280px) 530px, (min-width: 768px) 45vw, 90vw" /></article>
            <article className="fit-city-story"><div className="fit-story-copy"><p className="fit-kicker">03 / Leave an evening open</p><h3>Make time for everyday Hanoi.</h3><p className="fit-body">Walk the Old Quarter, settle into a neighborhood café and leave an evening open to explore.</p></div></article>
          </div>
        </div>
        <p className="fit-small fit-ideas-note">Inspiration for your itinerary; experiences and availability are confirmed in your proposal.</p>
      </div>
    </section>

    <section id="fit-planner" className="fit-planner" aria-labelledby="fit-planner-title">
      <div className="fit-wrap fit-section fit-planner-grid">
        <div className="fit-planner-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/about-trung.jpg" alt="Trung Le, founder of Cookie Paradise Travel Company, at his Columbus bakery trailer" width={960} height={1280} loading="lazy" />
          <p className="fit-small">Trung Le · Founder &amp; Vietnam trip planner</p>
        </div>
        <div><p className="fit-kicker"><MapPin size={14} aria-hidden="true" /> Columbus, Indiana · Connected to Vietnam</p><h2 id="fit-planner-title">Meet the person<br /><em>behind your plan.</em></h2><p className="fit-body">Born in Vietnam, Trung Le spent seven years living in Ho Chi Minh City before returning to Columbus, Indiana. He founded Cookie Paradise Travel Company to share the country he knows through its food, stories and everyday life.</p><p className="fit-body">Trung plans with you personally. Any accompanying host, local guides and in-country support are specified in your proposal.</p></div>
      </div>
    </section>

    <section id="fit-faq" className="fit-wrap fit-section fit-faq" aria-labelledby="fit-faq-title">
      <div><p className="fit-kicker">Before you decide</p><h2 id="fit-faq-title">Your practical<br /><em>questions.</em></h2></div>
      <div className="fit-questions">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span className="fit-faq-sign" aria-hidden="true">+</span></summary><p className="fit-body">{answer}</p></details>)}</div>
    </section>

    <section id="fit-plan" className="fit-plan" aria-labelledby="fit-plan-title">
      <div className="fit-wrap fit-section fit-plan-grid">
        <div><p className="fit-kicker">Your Vietnam starts with a conversation</p><h2 id="fit-plan-title">Start planning<br /><em>your Vietnam trip.</em></h2><p className="fit-body">Book a free 30-minute Google Meet with Trung, or send your ideas by email. There is no obligation to book.</p><div className="fit-plan-actions"><ConsultationLink /><a className="fit-email-link" href={emailHref}>Email Trung your trip ideas <ArrowUpRight size={17} aria-hidden="true" /></a></div><p className="fit-small">The email link opens a few editable prompts in your email app.</p><a className="fit-contact-address" href="mailto:trung@cookieparadise.co">trung@cookieparadise.co</a></div>
        <aside className="fit-conversation-note"><p className="fit-kicker">If you know, bring along…</p><ul><li>Your travel window and number of travelers</li><li>A few places or experiences you have in mind</li><li>Your budget and any existing plans</li></ul><p className="fit-body">Still figuring it out? That&apos;s what the conversation is for.</p>{partner && <div className="fit-referral-disclosure"><ReferralBrand /></div>}</aside>
      </div>
    </section>

    <footer className="fit-wrap fit-footer"><div><p className="fit-footer-name">Cookie Paradise Travel Company</p><p>Small-group tours and private trips to Vietnam.</p></div><div><a href="/">Discover Southern Vietnam group trip <ArrowUpRight size={14} aria-hidden="true" /></a><a href="/vietnam-trip-planning#travel-style">Compare group and private trips</a><a href="/privacy">Privacy policy</a><p>© {new Date().getFullYear()} Cookie Paradise Travel Company LLC · Columbus, Indiana</p></div></footer>
  </main></ReferralProvider>;
}
