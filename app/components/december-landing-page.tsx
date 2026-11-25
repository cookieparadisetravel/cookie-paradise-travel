/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- Local responsive images and native navigation match this site's production routing. */
import { CalendarDays, Users, HeartHandshake, Check, ChevronDown } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { TripGuideForm } from "./trip-guide-form";
import { consultationBookingUrl } from "@/lib/consultation";
import type { DecemberCampaign } from "@/lib/december-campaign";
import "./december-landing-page.css";

const route = [
  { place: "Ho Chi Minh City", days: "Days 1–2", image: "ho-chi-minh-city", alt: "Ho Chi Minh City skyline", text: "Settle in, discover neighborhood life, then taste the city on a vintage-Jeep food adventure." },
  { place: "The Mekong Delta", days: "Day 3", image: "mekong-delta", alt: "The lush waterways of the Mekong Delta", text: "Explore waterways and village paths, meet local producers and share a home-hosted lunch." },
  { place: "Imperial Hue", days: "Days 4–5", image: "hue-citadel", alt: "Historic architecture at the Imperial Citadel in Hue", text: "Fly to Hue for royal history, garden-house tea, a river cruise and dinner with traditional music." },
  { place: "Lantern-lit Hoi An", days: "Days 6–8", image: "hoi-an-night", alt: "Hoi An old town illuminated at night", text: "Make a lantern, try your hand at Vietnamese cooking and enjoy a free afternoon before the farewell dinner." },
];

const inclusions = [
  "Seven hotel nights in a shared double or twin room",
  "Seven breakfasts, five lunches and three dinners",
  "The domestic flight from Ho Chi Minh City to Hue",
  "Private ground transportation and scheduled airport transfers",
  "An experienced tour leader and English-speaking local guides",
  "Scheduled activities, admission fees, private boats and Vietnam e-visa",
];

export function DecemberLandingPage({ campaign }: { campaign: DecemberCampaign }) {
  const gift = campaign === "gift_for_parents";
  const hero = gift ? "gift-hoi-an" : "winter-coffee";
  const callLabel = gift ? "Talk through a gift trip" : "Talk with Trung";
  const emailHref = `mailto:trung@cookieparadise.co?subject=${encodeURIComponent(gift ? "A Vietnam trip for my parents — December 27, 2027" : "Winter Vietnam trip — December 27, 2027")}`;
  const questions = [
    ...(gift ? [["Can I help plan or pay for my parents’ trip?", "Yes. Share the itinerary with your parents, then talk with Trung together about the trip you would like to arrange. He will guide your family through room choices, payment options and the booking steps."]] : []),
    ["Who will host this departure?", "Your December journey will be personally hosted by an experienced tour leader, supported by English-speaking local guides. Trung Le, founder of Cookie Paradise Travel Company and based in Columbus, Indiana, will help you plan and prepare for your trip."],
    ["What is the pace of the trip?", "Enjoy full days of sightseeing alongside time to explore on your own. Activities include walking through cities and heritage sites, steps and uneven surfaces, boat rides and some early starts. In the Mekong village, choose a bicycle or buggy. Trung can walk you through the daily itinerary and your travel preferences."],
    ["What about international flights?", "Arrive in Ho Chi Minh City at Tan Son Nhat Airport (SGN) on December 27, 2027, and depart from Da Nang Airport (DAD), near Hoi An, on January 3, 2028. Your flight from the United States may leave earlier because of travel time and time zones. International airfare is extra; review flight plans with Trung before buying tickets."],
    ["Can I travel solo, with a friend or as a couple?", "Yes. Come on your own, bring a friend or travel as a couple. The $2,875 price is per person sharing a double or twin room, and friends can request separate beds. A private room adds $399 per person, subject to availability. Trung will help you choose your room arrangement."],
    ["How do payments work?", "The reservation deposit is $500 per traveler and is nonrefundable under the booking terms. The remaining balance can be paid in monthly installments, with final payment due October 27, 2027. ACH payments have no processing fee; credit-card payments have a 3% surcharge. Review the full booking terms before paying."],
    ["Who is this trip for?", "Adults who enjoy food, culture and the company of a small group. Whether you are celebrating retirement or simply making time for a memorable journey, you will travel with just 4–8 guests and a personal tour leader."],
    ["How do I book?", "Book a free conversation with Trung to choose your room arrangement and go over your trip. He will guide you through the Traveler Agreement and your $500 nonrefundable deposit, with monthly installments available for the remaining balance."],
  ];
  return <main className={`december-landing ${gift ? "december-gift" : "december-winter"}`}>
    <a className="december-skip" href="#trip-details">Skip to trip details</a>
    <header className="december-header">
      <BrandLogo surface="light" homeHref="/" />
      <nav aria-label="Trip navigation"><a href="#journey">The experience</a><a href="#price">Price &amp; inclusions</a><a className="december-button december-outline" href="#meet-trung">{callLabel}</a></nav>
    </header>

    <section className="december-hero" aria-labelledby="campaign-title">
      <div className="december-hero-copy">
        <p className="december-eyebrow">{gift ? "For the parents with more places to see" : "Make next winter one to remember"}</p>
        <h1 id="campaign-title">{gift ? <>Give them<br /><em>Vietnam.</em></> : <>Trade winter coats<br />for <em>Vietnam.</em></>}</h1>
        <p className="december-lede">{gift ? "Vietnamese coffee. Lantern-lit evenings. Stories they’ll still be telling years from now." : "You’ve made time for travel. Make room for Vietnamese coffee, shared tables and somewhere wonderfully new."}</p>
        <p className="december-support">An 8-day journey with just 4–8 guests, personally hosted by an experienced tour leader.</p>
        <a className="december-button" href="#get-guide">{gift ? "Get the itinerary for your family" : "Get the itinerary & pricing"}</a>
        <p className="december-note">Free itinerary · No obligation to book</p>
      </div>
      <figure className="december-hero-image">
        <img src={`/campaigns/${hero}-1536.webp`} srcSet={`/campaigns/${hero}-640.webp 640w, /campaigns/${hero}-1280.webp 1280w, /campaigns/${hero}-1536.webp 1536w`} sizes="(min-width: 1000px) 54vw, 100vw" width={1536} height={1024} fetchPriority="high" alt={gift ? "Illustrative scene of a couple sharing a joyful evening beside the lanterns of Hoi An" : "Illustrative scene of travelers enjoying iced coffee and conversation at a Vietnamese café"} />
        <figcaption>Illustrative travel imagery</figcaption>
      </figure>
    </section>

    <section id="trip-details" className="december-facts" aria-label="Trip at a glance">
      <div><CalendarDays aria-hidden="true" /><p><strong>December 27, 2027</strong><span>Through January 3, 2028 · 8 days / 7 nights</span></p></div>
      <div><Users aria-hidden="true" /><p><strong>4–8 guests</strong><span>A small group, with a personal host</span></p></div>
      <div><p><strong>$2,875 per person</strong><span>Shared room · International airfare extra</span></p></div>
    </section>

    <section className="december-local-strip" aria-label="Your local connection"><img src="/about-trung.jpg" width={80} height={80} alt="Trung Le, founder of Cookie Paradise Travel Company" /><p><strong>A local connection, before you go.</strong><span>Trung Le, founder of Cookie Paradise Travel Company, is based in <strong>Columbus, Indiana.</strong></span></p><a href="#meet-trung">Meet Trung</a></section>

    <section className="december-section december-story" aria-labelledby="story-title">
      <div><p className="december-eyebrow">{gift ? "A gift that becomes their story" : "Travel with people, not a crowd"}</p><h2 id="story-title">{gift ? <>They have enough things.<br /><em>Give them something to look forward to.</em></> : <>More connection.<br /><em>Less to figure out on your own.</em></>}</h2></div>
      <div className="december-story-body"><p>{gift ? "Perhaps they’ve talked about taking a bigger trip now that they have more time. This is a way to help make it happen—with a real person to talk to before they go and a tour leader alongside them in Vietnam." : "Retirement can mean more freedom to explore. If Vietnam has been on your list, you don’t have to work out every hotel, transfer and activity yourself. Join a small group and enjoy the experience together."}</p><p>{gift ? "Start by sharing the itinerary or arranging a conversation together. Trung will help your family plan the flights, choose room arrangements and get ready for the journey." : "From a home-hosted lunch in the Mekong Delta to making a lantern in Hoi An, the itinerary brings you into the food, history and everyday life of Vietnam."}</p></div>
    </section>

    {gift && <section className="december-gift-plan december-section" aria-label="How to plan a gift trip"><h2>Make it personal from the start.</h2><div className="december-three"><article><h3>Share the possibility</h3><p>Read the itinerary together. Choose the experiences they’re most excited about.</p></article><article><h3>Talk it through</h3><p>Bring your questions to Trung, including their preferred pace and international flights.</p></article><article><h3>Plan with them</h3><p>Choose their room arrangement together, then let Trung guide your family through booking.</p></article></div></section>}

    <section id="journey" className="december-section" aria-labelledby="journey-title">
      <div className="december-section-heading"><div><p className="december-eyebrow">Discover Southern Vietnam</p><h2 id="journey-title">Eight days. So much to bring home.</h2></div><a href="/#daily-schedule">Read the full daily schedule</a></div>
      <div className="december-route">{route.map(stop => <article key={stop.place}><img src={`/travel/${stop.image}-640.webp`} width={640} height={427} loading="lazy" alt={stop.alt} /><div><p className="december-eyebrow">{stop.days}</p><h3>{stop.place}</h3><p>{stop.text}</p></div></article>)}</div>
    </section>

    <section className="december-care" aria-labelledby="care-title"><div className="december-section december-care-grid"><div><HeartHandshake aria-hidden="true" size={36} /><h2 id="care-title">Support you can put a name to.</h2><p>Your experienced tour leader will host the December journey, with English-speaking local guides bringing each place to life.</p><p>Trung Le is your planning contact in Columbus, Indiana, helping you prepare for the journey with personal guidance before you leave.</p></div><div className="december-pace"><h3>Discover more, with guidance along the way.</h3><p>Explore historic streets, cruise the waterways and enjoy time to make your own discoveries. Your tour leader and local guides accompany you through the planned experiences.</p><p>The Mekong village visit offers a choice of bicycle or buggy, and Hoi An includes a free afternoon to enjoy at your own pace.</p><a href={consultationBookingUrl} target="_blank" rel="noopener noreferrer">Discuss the itinerary with Trung</a></div></div></section>

    <section id="price" className="december-section december-price" aria-labelledby="price-title"><div className="december-price-intro"><p className="december-eyebrow">Know what you’re planning for</p><h2 id="price-title">A clear price.<br /><em>A thoughtful trip.</em></h2><p className="december-big-price">$2,875 <span>per person</span></p><p>Sharing a double or twin room.<br />A group of 4–8 guests.</p><p><strong>$500 nonrefundable deposit</strong> per traveler, then monthly installments. Final payment is due <strong>October 27, 2027.</strong></p><p className="december-note">Private room: +$399, subject to availability. ACH payments have no processing fee; credit-card payments have a 3% surcharge.</p><a href="/#faq">Read cancellation &amp; booking terms</a></div><div><h3>Included in your journey</h3><ul className="december-inclusions">{inclusions.map(item => <li key={item}><Check aria-hidden="true" size={22} /><span>{item}</span></li>)}</ul><div className="december-extra"><h3>Plan separately for</h3><p>International airfare, travel insurance, gratuities, personal expenses, and meals or activities outside the included itinerary.</p></div></div></section>

    <section id="meet-trung" className="december-founder"><div className="december-section december-founder-grid"><img src="/about-trung.jpg" width={960} height={1280} alt="Trung Le in front of his Cookie Paradise bakery trailer" loading="lazy" /><div><p className="december-eyebrow">From Columbus, Indiana, to Vietnam</p><h2>Meet Trung Le.<br /><em>Your trip starts with a conversation.</em></h2><p>Trung is the founder of Cookie Paradise Travel Company, based in Columbus, Indiana. Born in Vietnam, he also spent seven years living in Ho Chi Minh City.</p><p>Whether you’re in Indianapolis, Carmel, Westfield or closer to Columbus, you can start with someone nearby who knows the places you’re hoping to see.</p><p><strong>The winter trip is personally hosted by an experienced tour leader.</strong> Trung helps you plan and prepare, so you can look forward to the journey.</p><div className="december-actions"><a className="december-button" href={consultationBookingUrl} target="_blank" rel="noopener noreferrer">Book a free conversation</a><a href={emailHref}>Email Trung</a></div><p className="december-note">30 minutes by Google Meet · No obligation to book</p></div></div></section>

    <section className="december-section december-faq" aria-labelledby="faq-title"><p className="december-eyebrow">Planning made simple</p><h2 id="faq-title">Your trip questions, answered.</h2><div>{questions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown aria-hidden="true" size={22} /></summary><p>{answer}</p></details>)}</div><p>For the full terms, see our <a href="/#faq">booking information</a> and <a href="/travel-disclosures">travel disclosures</a>.</p></section>

    <section className="december-final"><div className="december-section december-final-grid"><div><p className="december-eyebrow">{gift ? "A lovely place to start" : "Your next chapter awaits"}</p><h2>{gift ? <>Give them a journey<br /><em>to look forward to.</em></> : <>Picture yourself<br /><em>here next winter.</em></>}</h2><p>{gift ? "Get the itinerary to share with your parents—or explore a trip you’d love to take yourself. Trung will help you take the next step." : "Start with the itinerary. Read it over, share it with a travel companion and bring Trung your questions."}</p><p><strong>December 27, 2027–January 3, 2028</strong><br />$2,875 per person · Shared room<br />International airfare extra</p><p>Prefer a conversation first?<br /><a href={consultationBookingUrl} target="_blank" rel="noopener noreferrer">Book a free call with Trung</a> or <a href={emailHref}>send an email</a>.</p></div><TripGuideForm showCity campaign={campaign} /></div></section>

    <footer className="december-footer"><BrandLogo homeHref="/" /><p>Cookie Paradise Travel Company LLC<br />Columbus, Indiana</p><nav aria-label="Footer navigation"><a href="/">Full website</a><a href="/privacy">Privacy</a><a href="/travel-disclosures">Travel disclosures</a><a href={emailHref}>Email Trung</a></nav><p className="december-note">Hero imagery is AI-generated to illustrate the travel experience.</p></footer>
  </main>;
}
