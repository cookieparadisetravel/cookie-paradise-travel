import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, MapPin } from "lucide-react";
import { ConsultationLink } from "../components/consultation-link";
import { JourneyPhoto } from "../components/journey-photo";
import { ReferralBrand, ReferralProvider } from "../components/referral-brand";
import { getSalonPartner, REFERRAL_COOKIE } from "@/lib/salon-referrals";
import "./fit.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private Vietnam Travel & Custom Trips | Cookie Paradise Travel",
  description: "Plan a private Vietnam journey around your dates, interests and pace. Start with a free 30-minute conversation with Trung, your Columbus, Indiana-based Vietnam trip planner.",
  alternates: { canonical: "https://cookieparadisetravel.com/fit" },
  openGraph: {
    title: "Vietnam, at your pace. | Cookie Paradise Travel",
    description: "Private journeys, personally planned. Your dates, your people, your kind of Vietnam.",
    url: "https://cookieparadisetravel.com/fit",
    images: [{ url: "/travel/hue-citadel-1800.webp", width: 1800, height: 1200, alt: "The Imperial Citadel in Hue, Vietnam" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vietnam, at your pace. | Cookie Paradise Travel",
    description: "Private Vietnam journeys shaped around your dates, interests and pace.",
    images: ["/travel/hue-citadel-1800.webp"],
  },
};

const questions = [
  ["What is FIT travel?", "Here, FIT means a custom, independent journey for you and your travel companions. You work with Trung on the route and arrangements, rather than joining a scheduled group departure. Independent travel can still include prearranged hotels, transfers, experiences and local guides, as agreed in your proposal."],
  ["Is this the June 2027 group trip?", "This is a separate service. Your private journey is planned around your preferred dates, party and interests, subject to availability. The dates, group-size requirements and published prices for Discover Southern Vietnam do not automatically apply to a custom trip."],
  ["Can I travel solo, as a couple, or with family and friends?", "Yes. Tell Trung who is traveling, including the ages of any children, and how you like to spend your days. Room arrangements, transport and activities are considered for your own party and reflected in your proposal."],
  ["How much does a private trip cost?", "The price depends on your dates, trip length, number of travelers, rooms, hotels, transport and experiences. The initial 30-minute consultation is free. Any planning fees, included services, payment schedule and booking terms will be explained before you decide to proceed."],
  ["Will Trung travel with us?", "A private trip is not automatically a trip hosted by Trung. He helps you plan the journey; any hosting, local guiding and in-country support arrangements will be specified in your proposal."],
  ["What if my dates or route are still undecided?", "That is a good place to start a conversation. Share your approximate travel window, the time you have available and the experiences you are drawn to. We can discuss the route and pace before you settle on the details."],
  ["What about flights, accessibility or dietary needs?", "Discuss your departure airport, walking comfort, dietary needs and other practical considerations with Trung during planning. Flights, visas, insurance and any specific assistance should be discussed explicitly; your proposal will identify the arrangements included. Confirm the itinerary and booking details before purchasing flights."],
];

export default async function FitTravelPage() {
  const partner = getSalonPartner((await cookies()).get(REFERRAL_COOKIE)?.value);
  const emailBody = [
    "Hi Trung, I'd like to discuss a private Vietnam trip.", "",
    "Approximate dates or travel window:", "How many travelers:", "Places or experiences I am interested in:",
    "Approximate trip length:", "Comfort preferences and budget (if known):", "",
    ...(partner ? [`Referred by: ${partner.name} (${partner.code})`, ""] : []),
    "Sent from the private Vietnam travel page: https://cookieparadisetravel.com/fit",
  ].join("\r\n");
  const emailHref = `mailto:trung@cookieparadise.co?subject=${encodeURIComponent("Let's plan a private Vietnam trip")}&body=${encodeURIComponent(emailBody)}`;

  return <ReferralProvider partner={partner}><main id="fit-top" className="fit-page">
    <a className="fit-skip-link" href="#fit-main">Skip to content</a>
    <header className="fit-header text-white">
      <div className="site-header-bar mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-5 sm:px-8">
        <div className="site-header-brand flex min-w-0 items-center gap-4">
          <Link href="/" className="site-header-home flex shrink-0 items-center gap-3" aria-label="Cookie Paradise Travel Company home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cookie-paradise-logo.png" alt="Cookie Paradise" width={1878} height={268} className="site-header-logo object-contain" />
            <span className="site-header-descriptor border-l border-white/30 pl-3 text-[10px] font-semibold uppercase leading-4 tracking-[.18em] text-white/85">Travel<br className="hidden sm:block" /> Company</span>
          </Link>
          <ReferralBrand header />
        </div>
        <nav className="hidden items-center gap-6 text-sm font-semibold xl:flex" aria-label="Private travel navigation">
          <a href="#fit-approach">Our approach</a><a href="#fit-ideas">Trip ideas</a><a href="#fit-planner">Meet Trung</a>
        </nav>
        <a className="site-header-call fit-header-plan" href="#fit-plan">Start planning <ArrowRight size={16} aria-hidden="true" /></a>
      </div>
    </header>

    <section id="fit-main" className="fit-hero fit-wrap" aria-labelledby="fit-title">
      <div className="fit-hero-copy">
        <p className="fit-kicker">Private Vietnam journeys</p>
        <h1 id="fit-title">Vietnam,<br /><em>at your pace.</em></h1>
        <p className="fit-hero-intro">Your dates. Your people. Your kind of adventure.</p>
        <p className="fit-body">A private journey shaped around what you love, with time for the moments you didn&apos;t plan. Thoughtfully planned with Trung, your Vietnam trip planner in Columbus, Indiana.</p>
        <a className="fit-button fit-button-dark" href="#fit-plan">Plan my Vietnam trip <ArrowRight size={18} aria-hidden="true" /></a>
        <p className="fit-small fit-hero-note">Start with a free 30-minute conversation.</p>
        <a className="fit-text-link fit-explore" href="#fit-ideas">Find a little inspiration <ArrowDown size={16} aria-hidden="true" /></a>
      </div>
      <div className="fit-hero-art">
        <JourneyPhoto photo="street" priority className="fit-hero-photo" sizes="(min-width: 1280px) 535px, (min-width: 768px) 45vw, 90vw" />
        <span className="fit-margin-note" aria-hidden="true">A different way to see Vietnam</span>
      </div>
    </section>

    <div className="fit-wrap">
      <dl className="fit-promises">
        <div><dt>Your dates</dt><dd>A travel window that works for you.</dd></div>
        <div><dt>Your company</dt><dd>Solo, together, or with your favorite people.</dd></div>
        <div><dt>Your rhythm</dt><dd>More time for what matters to you.</dd></div>
      </dl>
    </div>

    <section id="fit-approach" className="fit-wrap fit-section fit-approach" aria-labelledby="fit-approach-title">
      <div><p className="fit-kicker">Independent travel. Personally planned.</p><h2 id="fit-approach-title">The freedom to explore.<br /><em>A plan that feels like you.</em></h2></div>
      <div className="fit-approach-details">
        <p className="fit-body">Perhaps you want to linger in Hoi An, follow the food through Ho Chi Minh City (Saigon), or leave a little space for family connections. Your itinerary begins with the way you want to travel.</p>
        <p className="fit-body">We&apos;ll talk through the route, stays, transport and experiences that suit your party. You choose the balance of guided discovery and time on your own; the agreed arrangements are set out in your proposal.</p>
        <ul className="fit-options">
          {["Dates and trip length", "Hotel and room preferences", "Food, culture and local experiences", "Guiding, transport and downtime"].map(item => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}
        </ul>
      </div>
    </section>

    <section id="fit-ideas" className="fit-inspiration" aria-labelledby="fit-ideas-title">
      <div className="fit-wrap fit-section">
        <div className="fit-ideas-heading"><div><p className="fit-kicker">A few possibilities</p><h2 id="fit-ideas-title">Start with a moment.<br /><em>Make the journey yours.</em></h2></div><p className="fit-body">These are starting points for a conversation. Combine places, stay longer, or ask about a different corner of Vietnam.</p></div>
        <div className="fit-editorial-grid">
          <article className="fit-mekong-story">
            <JourneyPhoto photo="mekong" className="fit-mekong-photo" sizes="(min-width: 1280px) 530px, (min-width: 768px) 45vw, 90vw" />
            <div className="fit-story-copy"><p className="fit-kicker">01 / Slow down</p><h3>Follow the waterways.</h3><p className="fit-body">Palm-lined canals, village paths and a lunch worth lingering over. Explore the Mekong Delta with room for the quieter moments.</p></div>
          </article>
          <div className="fit-stories-right">
            <article className="fit-hue-story"><div className="fit-story-copy"><p className="fit-kicker">02 / Look a little closer</p><h3>Let history set the scene.</h3><p className="fit-body">Imperial Hue, garden houses and the Perfume River. Make space for the stories behind the places you see.</p></div><JourneyPhoto photo="hue" className="fit-hue-photo" sizes="(min-width: 1280px) 530px, (min-width: 768px) 45vw, 90vw" /></article>
            <article className="fit-lantern-story"><JourneyPhoto photo="lanterns" className="fit-lantern-photo" sizes="(min-width: 768px) 230px, 42vw" /><div className="fit-story-copy"><p className="fit-kicker">03 / Stay for the evening</p><h3>A little lantern magic.</h3><p className="fit-body">Old houses, good food and Hoi An after dark. A reason to leave an evening open.</p></div></article>
          </div>
        </div>
        <p className="fit-small fit-ideas-note">Experiences, routing and availability are confirmed during planning. These ideas are not fixed packages or quoted inclusions.</p>
      </div>
    </section>

    <section className="fit-wrap fit-section" aria-labelledby="fit-process-title">
      <div className="fit-process-heading"><p className="fit-kicker">From an idea to an itinerary</p><h2 id="fit-process-title">A personal trip.<br /><em>A clear way forward.</em></h2></div>
      <ol className="fit-process">
        {[
          ["01", "Start with a conversation.", "Tell Trung about your travel window, your people, your interests and your budget. You don't need every answer before we talk."],
          ["02", "Shape the details together.", "Discuss a route, the right pace, stays and experiences. Refine the plan around what matters most to you."],
          ["03", "Review, then decide.", "Your proposal sets out the arrangements, price and booking terms. Review the details before making a commitment."],
        ].map(([number, title, text]) => <li key={number}><span className="fit-step-number" aria-hidden="true">{number}</span><h3>{title}</h3><p className="fit-body">{text}</p></li>)}
      </ol>
    </section>

    <section id="fit-planner" className="fit-planner" aria-labelledby="fit-planner-title">
      <div className="fit-wrap fit-section fit-planner-grid">
        <div className="fit-planner-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/about-trung.jpg" alt="Trung Le, founder of Cookie Paradise Travel Company, at his Columbus bakery trailer" width={960} height={1280} loading="lazy" />
          <p className="fit-small">Trung Le · Founder &amp; Vietnam trip planner</p>
        </div>
        <div><p className="fit-kicker"><MapPin size={14} aria-hidden="true" /> Columbus, Indiana · Connected to Vietnam</p><h2 id="fit-planner-title">Meet the person<br /><em>behind your plan.</em></h2><p className="fit-body">Born in Vietnam, Trung Le spent seven years living in Ho Chi Minh City before returning to Columbus, Indiana. He founded Cookie Paradise Travel Company to share the country he knows through its food, stories and everyday life.</p><p className="fit-body">Your first conversation is with Trung. Talk through what you hope to experience, what feels uncertain, and the kind of help you want along the way.</p><a className="fit-text-link" href="#fit-plan">Let&apos;s talk about your trip <ArrowRight size={17} aria-hidden="true" /></a></div>
      </div>
    </section>

    <section className="fit-wrap fit-section fit-faq" aria-labelledby="fit-faq-title">
      <div><p className="fit-kicker">Good things to know</p><h2 id="fit-faq-title">A few questions,<br /><em>before you go.</em></h2></div>
      <div className="fit-questions">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span className="fit-faq-sign" aria-hidden="true">+</span></summary><p className="fit-body">{answer}</p></details>)}</div>
    </section>

    <section id="fit-plan" className="fit-plan" aria-labelledby="fit-plan-title">
      <div className="fit-wrap fit-section fit-plan-grid">
        <div><p className="fit-kicker">Your Vietnam starts with a conversation</p><h2 id="fit-plan-title">Tell us what<br /><em>you&apos;re dreaming of.</em></h2><p className="fit-body">A free 30-minute Google Meet with Trung. Bring an idea, a few questions, or simply the wish to go.</p><div className="fit-plan-actions"><ConsultationLink /><a className="fit-email-link" href={emailHref}>Email Trung your trip ideas <ArrowUpRight size={17} aria-hidden="true" /></a></div><p className="fit-small">No obligation to book. The email link opens your email app with a few planning prompts; you can edit them before sending.</p><a className="fit-contact-address" href="mailto:trung@cookieparadise.co">trung@cookieparadise.co</a></div>
        <aside className="fit-conversation-note"><p className="fit-kicker">If you know, bring along…</p><ul><li>Your approximate dates and trip length</li><li>Who is traveling with you</li><li>Places and experiences you&apos;re drawn to</li><li>Your preferred comfort level and budget</li></ul><p className="fit-body">Still figuring it out? That&apos;s what the conversation is for.</p>{partner && <div className="fit-referral-disclosure"><ReferralBrand /></div>}</aside>
      </div>
    </section>

    <footer className="fit-wrap fit-footer"><div><p className="fit-footer-name">Cookie Paradise Travel Company</p><p>Private journeys. Personal connections.</p></div><div><Link href="/">Discover Southern Vietnam group trip <ArrowUpRight size={14} aria-hidden="true" /></Link><Link href="/privacy">Privacy policy</Link><p>© {new Date().getFullYear()} Cookie Paradise Travel Company LLC · Columbus, Indiana</p></div></footer>
  </main></ReferralProvider>;
}
