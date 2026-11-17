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
  description: "Plan a private Vietnam trip with Trung Le. Get a route that fits your dates, help with hotels, guides and transfers, and a custom quote before you book.",
  path: "/fit",
  image: "/travel/fit-mu-cang-chai-1800.webp",
  imageAlt: "Golden rice terraces in the morning mist in Mu Cang Chai, Vietnam",
});

const questions = [
  ["What if my dates or route are still undecided?", "A season and a rough idea of how long you can travel are enough for our first call. We’ll talk through which places fit comfortably in that time."],
  ["Can you arrange a special request?", "Tell me about the family visit, anniversary dinner or hometown stop you have in mind. I’ll check availability and cost with you before adding it to the plan."],
  ["What about flights, accessibility or dietary needs?", "Tell me which airport you’ll leave from, how far you’re comfortable walking and any food or accessibility needs. I’ll check what can be arranged and list it in your proposal, including any help with flights, visas or insurance. Please confirm your itinerary and bookings before buying airfare."],
  ["How is this different from the June 2027 group trip?", "On Discover Southern Vietnam, you join a hosted group on a scheduled departure. On a private trip, you choose your dates and travel solo or with your own companions. I’ll quote the itinerary for your party."],
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
        <p className="fit-kicker">Private Vietnam trip planning</p>
        <h1 id="fit-title">See Vietnam<br /><em>at your own pace.</em></h1>
        <p className="fit-body">Want to visit family in Ho Chi Minh City and still have a week to explore? I’m Trung Le. Tell me who’s coming and what you’d love to do. I’ll help you decide which stops deserve another night, then arrange the stays, rides and guides you need.</p>
        <a className="fit-button fit-button-dark" href="#fit-plan">Talk with Trung <ArrowRight size={18} aria-hidden="true" /></a>
        <p className="fit-small fit-hero-note">Free 30-minute consultation · A custom quote before you book.</p>
        <a className="fit-text-link fit-explore" href="#fit-approach">See the services and pricing <ArrowDown size={16} aria-hidden="true" /></a>
      </div>
      <div id="fit-hero-art" className="fit-hero-art">
        <JourneyPhoto photo="fitCafe" priority className="fit-hero-photo" sizes="(min-width: 1280px) 535px, (min-width: 768px) 45vw, 90vw" />

      </div>
    </section>

    <section id="fit-approach" className="fit-wrap fit-section fit-approach" aria-labelledby="fit-approach-title">
      <div>
        <p className="fit-kicker">Services &amp; pricing</p>
        <h2 id="fit-approach-title">What would you like<br /><em>me to plan?</em></h2>
        <div className="fit-service"><h3>Plan my whole trip</h3><p className="fit-body">I’ll map out the nights in each place and the travel time between them. Then I’ll bring the hotels, transfers and guided visits together around the things you want time for, whether that’s dinner with relatives or a morning in Hue’s Imperial City.</p></div>
        <div className="fit-service"><h3>Help with part of my trip</h3><p className="fit-body">Already booked your flights or staying with family? I can arrange a driver to meet you at the airport, a guide for a day in Hanoi or a few nights away between family visits. We’ll work around what you’ve booked.</p></div>
      </div>
      <aside className="fit-quote" aria-labelledby="fit-quote-title">
        <p className="fit-kicker">Know what to expect</p>
        <h3 id="fit-quote-title">What will my<br />trip cost?</h3>
        <p className="fit-body">I’ll quote your private trip for your dates and the people traveling with you. The number of nights, hotel choices and activities all shape the price.</p>
        <p className="fit-body">The first call is free. Before you decide, you’ll see exactly what the price covers, any planning fees, when payments are due and the booking terms.</p>
        <p className="fit-small">Flights, visas and insurance are included only if your proposal specifically lists them.</p>
      </aside>
    </section>

    <section id="fit-process" className="fit-wrap fit-section fit-process-section" aria-labelledby="fit-process-title">
      <div className="fit-process-heading"><p className="fit-kicker">How it works</p><h2 id="fit-process-title">From our first call<br /><em>to booking.</em></h2></div>
      <ol className="fit-process">
        {[
          ["01", "Tell me about your trip.", "On our free 30-minute call, we’ll talk about who’s coming, your dates and budget, and the one thing you’d most like to do in Vietnam."],
          ["02", "Shape the route together.", "I’ll suggest where to go and how long to stay. We can move a night, shorten a drive or leave an afternoon open while we work out what suits you."],
          ["03", "Choose what to book.", "You’ll receive a written proposal with the arrangements and price. Once you approve it and meet the booking terms, I’ll coordinate the reservations it covers."],
        ].map(([number, title, text]) => <li key={number}><span className="fit-step-number" aria-hidden="true">{number}</span><h3>{title}</h3><p className="fit-body">{text}</p></li>)}
      </ol>
    </section>

    <section id="fit-ideas" className="fit-inspiration" aria-labelledby="fit-ideas-title">
      <div className="fit-wrap fit-section">
        <div className="fit-ideas-heading"><div><p className="fit-kicker">A few possibilities</p><h2 id="fit-ideas-title">Where would you<br /><em>spend another day?</em></h2></div><p className="fit-body">Here are three ways we could spend part of a trip in northern Vietnam. Your route can also take you through central or southern Vietnam.</p></div>
        <div className="fit-editorial-grid">
          <article id="fit-bay" className="fit-bay-story">
            <JourneyPhoto photo="fitBay" className="fit-bay-photo" sizes="(min-width: 1280px) 530px, (min-width: 768px) 45vw, 90vw" />
            <div className="fit-story-copy"><p className="fit-kicker">Ha Long Bay</p><h3>Wake up on the bay.</h3><p className="fit-body">If you’d love to wake up among the limestone islands, we can plan an overnight cruise and time your transfer from Hanoi around boarding. Prefer to sleep in the city? We can look at a day cruise.</p></div>
          </article>
          <div className="fit-stories-right">
            <article id="fit-terraces" className="fit-terrace-story"><div className="fit-story-copy"><p className="fit-kicker">Mu Cang Chai</p><h3>Walk the rice terraces.</h3><p className="fit-body">Tell me whether you’d like to spend a morning walking the terraces or stop for photographs along the mountain roads. That choice helps us decide when to go and how many nights to stay.</p></div><JourneyPhoto photo="fitTerraces" className="fit-terrace-photo" sizes="(min-width: 1280px) 530px, (min-width: 768px) 45vw, 90vw" /></article>
            <article className="fit-city-story"><div className="fit-story-copy"><p className="fit-kicker">Hanoi</p><h3>Find your breakfast in the Old Quarter.</h3><p className="fit-body">If your idea of a good morning is a bowl of phở followed by egg coffee, we can choose a hotel within walking distance and start your guided visit after breakfast.</p></div></article>
          </div>
        </div>
        <p className="fit-small fit-ideas-note">Your proposal confirms which experiences are available for your dates.</p>
      </div>
    </section>

    <section id="fit-planner" className="fit-planner" aria-labelledby="fit-planner-title">
      <div className="fit-wrap fit-section fit-planner-grid">
        <div className="fit-planner-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/about-trung.jpg" alt="Trung Le, founder of Cookie Paradise Travel Company, at his Columbus bakery trailer" width={960} height={1280} loading="lazy" />
          <p className="fit-small">Trung Le · Founder &amp; Vietnam trip planner</p>
        </div>
        <div><p className="fit-kicker"><MapPin size={14} aria-hidden="true" /> Columbus, Indiana · Connected to Vietnam</p><h2 id="fit-planner-title">Plan directly<br /><em>with Trung.</em></h2><p className="fit-body">I was born in Vietnam and spent seven years living in Ho Chi Minh City. I now plan Vietnam trips from Columbus, Indiana. When we talk, tell me what draws you there. A dish you remember from childhood or a town where your grandparents lived gives us a place to start.</p><p className="fit-body">You’ll work with me on the plan. Your proposal will spell out who will meet you in Vietnam, including any local guides, accompanying host and in-country support.</p></div>
      </div>
    </section>

    <section id="fit-faq" className="fit-wrap fit-section fit-faq" aria-labelledby="fit-faq-title">
      <div><p className="fit-kicker">Before you decide</p><h2 id="fit-faq-title">Your practical<br /><em>questions.</em></h2></div>
      <div className="fit-questions">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span className="fit-faq-sign" aria-hidden="true">+</span></summary><p className="fit-body">{answer}</p></details>)}</div>
    </section>

    <section id="fit-plan" className="fit-plan" aria-labelledby="fit-plan-title">
      <div className="fit-wrap fit-section fit-plan-grid">
        <div><p className="fit-kicker">Free 30-minute consultation</p><h2 id="fit-plan-title">What brings you<br /><em>to Vietnam?</em></h2><p className="fit-body">Tell me what you’re looking forward to, even if you haven’t picked dates. We can talk it through on Google Meet, or you can email me your ideas. There’s no obligation to book.</p><div className="fit-plan-actions"><ConsultationLink /><a className="fit-email-link" href={emailHref}>Email Trung your trip ideas <ArrowUpRight size={17} aria-hidden="true" /></a></div><p className="fit-small">The email link opens a few editable prompts in your email app.</p><a className="fit-contact-address" href="mailto:trung@cookieparadise.co">trung@cookieparadise.co</a></div>
        <aside className="fit-conversation-note"><p className="fit-kicker">If you know, bring along…</p><ul><li>Your travel window and number of travelers</li><li>A few places or experiences you have in mind</li><li>Your budget and any existing plans</li></ul><p className="fit-body">Still figuring it out? That&apos;s what the conversation is for.</p>{partner && <div className="fit-referral-disclosure"><ReferralBrand /></div>}</aside>
      </div>
    </section>

    <footer className="fit-wrap fit-footer"><div><p className="fit-footer-name">Cookie Paradise Travel Company</p><p>Small-group tours and private trips to Vietnam.</p></div><div><a href="/">Discover Southern Vietnam group trip <ArrowUpRight size={14} aria-hidden="true" /></a><a href="/vietnam-trip-planning#travel-style">Compare group and private trips</a><a href="/privacy">Privacy policy</a><p>© {new Date().getFullYear()} Cookie Paradise Travel Company LLC · Columbus, Indiana</p></div></footer>
  </main></ReferralProvider>;
}
