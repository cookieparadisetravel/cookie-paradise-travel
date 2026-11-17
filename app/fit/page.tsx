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
  description: "Plan your first Vietnam trip with Trung Le, a Vietnam-born advisor based in Indiana. Get a private itinerary, handpicked hotel options and coordinated bookings.",
  path: "/fit",
  image: "/travel/fit-mu-cang-chai-1800.webp",
  imageAlt: "Golden rice terraces in the morning mist in Mu Cang Chai, Vietnam",
});

const questions = [
  ["What if my dates or route are still undecided?", "A season and a rough idea of how long you can travel are enough for our first call. We’ll talk through which places fit comfortably in that time."],
  ["Can you arrange a special request?", "Tell me about the anniversary dinner, particular hotel or interest you’d like to build a day around. I’ll check availability and cost with you before adding it to the plan."],
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
        <p className="fit-kicker">Private travel with Trung Le</p>
        <h1 id="fit-title">Your first trip to Vietnam,<br /><em>personally planned.</em></h1>
        <p className="fit-body">You can picture waking up on Ha Long Bay. Getting there means choosing a boat, a cabin and a night that fits the rest of your trip. Leave that research to me. I’m Trung Le, a Vietnam-born travel planner based in Indiana. I’ll show you where an extra night is worth more than another stop, then arrange the hotels, guides and transfers you choose.</p>
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
        <h2 id="fit-approach-title">Leave the research<br /><em>and reservations to me.</em></h2>
        <div className="fit-service"><h3>Plan my whole trip</h3><p className="fit-body">Tell me how many days you can take away and what you’d cross the Pacific to experience. I’ll work out the route, narrow the hotels to a few that suit you and recommend which days to spend with a private guide. Once you book, I coordinate the stays, drivers and experiences in your proposal. You have one person to call about how the pieces fit.</p></div>
        <div className="fit-service"><h3>Help with part of my trip</h3><p className="fit-body">Already have flights or a favorite hotel booked? I can plan the days around them. That might mean a driver waiting when you land after the flight from the U.S., or a private guide who can walk you through Hue’s Imperial City and explain how the emperors lived.</p></div>
      </div>
      <aside className="fit-quote" aria-labelledby="fit-quote-title">
        <p className="fit-kicker">Know what to expect</p>
        <h3 id="fit-quote-title">What will my<br />trip cost?</h3>
        <p className="fit-body">Your quote reflects your dates, hotels, experiences and the number of people traveling. If you’re deciding between a suite in Hanoi and a balcony cabin on the bay, I can price both and explain what each adds to your trip.</p>
        <p className="fit-body">The first call is free. Before you decide, you’ll see exactly what the price covers, any planning fees, when payments are due and the booking terms.</p>
        <p className="fit-small">Flights, visas and insurance are included only if your proposal specifically lists them.</p>
      </aside>
    </section>

    <section id="fit-process" className="fit-wrap fit-section fit-process-section" aria-labelledby="fit-process-title">
      <div className="fit-process-heading"><p className="fit-kicker">How it works</p><h2 id="fit-process-title">From our first call<br /><em>to booking.</em></h2></div>
      <ol className="fit-process">
        {[
          ["01", "Tell me about your trip.", "Bring your travel window, budget and a sense of what you enjoy on vacation. If all you know is that you love food, history or time on the water, we can start there."],
          ["02", "Shape the route together.", "I’ll bring you a proposed itinerary and walk you through the trade-offs. You can see what adding a stop costs in travel time and what another night in one place would give you."],
          ["03", "Approve your trip.", "Review the price, inclusions and terms in writing. Once you approve the proposal and meet the booking terms, I coordinate the reservations with the team in Vietnam."],
        ].map(([number, title, text]) => <li key={number}><span className="fit-step-number" aria-hidden="true">{number}</span><h3>{title}</h3><p className="fit-body">{text}</p></li>)}
      </ol>
    </section>

    <section id="fit-ideas" className="fit-inspiration" aria-labelledby="fit-ideas-title">
      <div className="fit-wrap fit-section">
        <div className="fit-ideas-heading"><div><p className="fit-kicker">How local knowledge shapes your trip</p><h2 id="fit-ideas-title">Make the most of<br /><em>your days in Vietnam.</em></h2></div><p className="fit-body">A hotel address or a cruise departure time can shape an entire day. Here’s how I’d think through three choices for a first visit to northern Vietnam.</p></div>
        <div className="fit-editorial-grid">
          <article id="fit-bay" className="fit-bay-story">
            <JourneyPhoto photo="fitBay" className="fit-bay-photo" sizes="(min-width: 1280px) 530px, (min-width: 768px) 45vw, 90vw" />
            <div className="fit-story-copy"><p className="fit-kicker">Ha Long Bay</p><h3>Wake up on the bay.</h3><p className="fit-body">For an overnight cruise, I start with the boat’s boarding time and work backward to your Hanoi pickup. I also look at where you’ll go after you disembark. That’s how we leave room for breakfast on deck before the next leg of your trip.</p></div>
          </article>
          <div className="fit-stories-right">
            <article id="fit-terraces" className="fit-terrace-story"><div className="fit-story-copy"><p className="fit-kicker">Mu Cang Chai</p><h3>Walk the rice terraces.</h3><p className="fit-body">If photographing the rice terraces is the reason you want to go, I’ll help you choose dates for the landscape you hope to see. Then we’ll weigh the mountain drive against your time in Hanoi before making room for it in the itinerary.</p></div><JourneyPhoto photo="fitTerraces" className="fit-terrace-photo" sizes="(min-width: 1280px) 530px, (min-width: 768px) 45vw, 90vw" /></article>
            <article className="fit-city-story"><div className="fit-story-copy"><p className="fit-kicker">Hanoi</p><h3>Find your breakfast in the Old Quarter.</h3><p className="fit-body">If you’d like to step outside for phở and egg coffee, I’ll look for a Hanoi hotel with that morning walk in mind. If a quiet night matters more, I’ll suggest a calmer base and arrange a guide to introduce you to the Old Quarter.</p></div></article>
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
        <div><p className="fit-kicker"><MapPin size={14} aria-hidden="true" /> Columbus, Indiana</p><h2 id="fit-planner-title">Plan directly<br /><em>with Trung.</em></h2><p className="fit-body">I was born in Vietnam and lived in Ho Chi Minh City for seven years. These days I call Columbus, Indiana, home. If you’re coming from the U.S. for the first time, you can ask me the small questions, too. What should you order at a breakfast stall? What should you wear to visit a pagoda? Those conversations are part of planning with me.</p><p className="fit-body">I’m the person you talk to here and the person who coordinates your arrangements in Vietnam. Your proposal spells out any local guides, accompanying host and in-country support, so you know who to expect when you arrive.</p></div>
      </div>
    </section>

    <section id="fit-faq" className="fit-wrap fit-section fit-faq" aria-labelledby="fit-faq-title">
      <div><p className="fit-kicker">Before you decide</p><h2 id="fit-faq-title">Your practical<br /><em>questions.</em></h2></div>
      <div className="fit-questions">{questions.map(([question, answer]) => <details key={question}><summary>{question}<span className="fit-faq-sign" aria-hidden="true">+</span></summary><p className="fit-body">{answer}</p></details>)}</div>
    </section>

    <section id="fit-plan" className="fit-plan" aria-labelledby="fit-plan-title">
      <div className="fit-wrap fit-section fit-plan-grid">
        <div><p className="fit-kicker">Free 30-minute consultation</p><h2 id="fit-plan-title">Let’s plan your<br /><em>first Vietnam trip.</em></h2><p className="fit-body">You can come to our first call with a single idea and a week on the calendar. We’ll talk through what fits, where I’d spend an extra night and what you’d like me to handle. Book a video call or send me a note. There’s no obligation to book.</p><div className="fit-plan-actions"><ConsultationLink /><a className="fit-email-link" href={emailHref}>Email Trung your trip ideas <ArrowUpRight size={17} aria-hidden="true" /></a></div><p className="fit-small">The email link opens a few editable prompts in your email app.</p><a className="fit-contact-address" href="mailto:trung@cookieparadise.co">trung@cookieparadise.co</a></div>
        <aside className="fit-conversation-note"><p className="fit-kicker">If you know, bring along…</p><ul><li>Your travel window and number of travelers</li><li>A few places or experiences you have in mind</li><li>Your budget and any existing plans</li></ul><p className="fit-body">Still figuring it out? That&apos;s what the conversation is for.</p>{partner && <div className="fit-referral-disclosure"><ReferralBrand /></div>}</aside>
      </div>
    </section>

    <footer className="fit-wrap fit-footer"><div><p className="fit-footer-name">Cookie Paradise Travel Company</p><p>Small-group tours and private trips to Vietnam.</p></div><div><a href="/">Discover Southern Vietnam group trip <ArrowUpRight size={14} aria-hidden="true" /></a><a href="/vietnam-trip-planning#travel-style">Compare group and private trips</a><a href="/privacy">Privacy policy</a><p>© {new Date().getFullYear()} Cookie Paradise Travel Company LLC · Columbus, Indiana</p></div></footer>
  </main></ReferralProvider>;
}
