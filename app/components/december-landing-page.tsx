/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- Local responsive images and native navigation match this site's production routing. */
import { CalendarDays, Users, Check, ChevronDown } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { TripGuideForm } from "./trip-guide-form";
import { consultationBookingUrl } from "@/lib/consultation";
import type { DecemberCampaign } from "@/lib/december-campaign";
import "./december-landing-page.css";

const route = [
  { place: "Ho Chi Minh City", days: "Days 1-2", image: "ho-chi-minh-city", alt: "Ho Chi Minh City skyline", text: "Settle in after a private airport transfer. The next day, start in a neighborhood park and wet market, see the city center, then taste the city after dark on a vintage-Jeep food adventure." },
  { place: "The Mekong Delta", days: "Day 3", image: "mekong-delta", alt: "The lush waterways of the Mekong Delta", text: "Travel the waterways to the Tan My floating community and a working fish farm, continue by sampan, walk or ride village paths by bicycle or buggy, and share a home-hosted lunch before returning to the city." },
  { place: "Imperial Hue", days: "Days 4-5", image: "hue-citadel", alt: "Historic architecture at the Imperial Citadel in Hue", text: "Fly to Hue (domestic flight included). Walk the Imperial Citadel and Thien Mu Pagoda, then take a private sunset cruise on the Perfume River. The next day, garden-house tea and cakes, the royal tombs, and a multi-course dinner with traditional music." },
  { place: "Lantern-lit Hoi An", days: "Days 6-8", image: "hoi-an-night", alt: "Hoi An old town illuminated at night", text: "Drive the Hai Van Pass to Hoi An, make a lantern, and ride a basket boat in Cam Thanh coconut village. A hands-on cooking morning and a free afternoon come before the farewell dinner, then a private transfer to Da Nang Airport on day 8." },
];

const inclusions = [
  "Seven hotel nights in a shared double or twin room",
  "All meals during your eight-day Vietnam tour, including the home-hosted Mekong lunch and the Hue royal dinner",
  "Domestic flight from Ho Chi Minh City to Hue",
  "Private ground transportation and scheduled airport transfers, including the final transfer to Da Nang Airport",
  "A Cookie Paradise host and English-speaking local guides",
  "Scheduled activities and admission fees, private boats, and your Vietnam e-visa",
];

const groupComparison = "Many well-known small-group Vietnam tours cap at 12 to 16 guests. Coach tours often run closer to 28. We cap this trip at 8.";

const paceAnswer = "Full days of sightseeing with time to explore on your own. Expect walking through cities and heritage sites, steps and uneven ground, boarding boats, and some early starts. In the Mekong village you can choose a bicycle or a buggy. Trung can walk you through the daily itinerary.";

const flightAnswer = "Arrive at Tan Son Nhat Airport (SGN) in Ho Chi Minh City on December 27, 2027, and depart from Da Nang Airport (DAD) on January 3, 2028. Your US flight may need to leave earlier because of travel time. Airfare is extra. Review flight plans with Trung before buying tickets.";

const mealsAnswer = "Yes. On this December departure, every meal is included. That is one reason the December price is higher than the summer dates. You can enjoy the week without watching a meal budget or wondering where to eat after a full day. Summer departures (June through August 2027) are $2,875 per person and include 7 breakfasts, 5 lunches, and 3 dinners.";

const otherDatesAnswer = "Yes. The same Southern Vietnam itinerary also departs on six summer dates from June through August 2027, at $2,875 per person, with 7 breakfasts, 5 lunches, and 3 dinners included (not every meal).";

export function DecemberLandingPage({ campaign }: { campaign: DecemberCampaign }) {
  const gift = campaign === "gift_for_parents";
  const hero = gift ? "gift-hoi-an" : "winter-coffee";
  const callLabel = gift ? "Talk through a gift trip" : "Talk with Trung";
  const emailHref = `mailto:trung@cookieparadise.co?subject=${encodeURIComponent(gift ? "A Vietnam trip for my parents, December 27, 2027" : "Winter Vietnam trip, December 27, 2027")}`;
  const questions = gift ? [
    ["Can I help plan or pay for my parents’ trip?", "Yes. Share the itinerary with them, then talk with Trung together, or start the call yourself and bring them in when they’re ready. You can pay the $500 deposit as the gift, split the remaining payments, or pay in full."],
    ["Why is a small group a better gift for my parents?", `A cap of 8 guests keeps the days more personal and less rushed than a large coach tour. ${groupComparison} There’s still walking, some early starts, and uneven ground, so review the pace with Trung and your parents before booking. Every meal is included, so they aren’t figuring out restaurants after a long day.`],
    ["Are all meals included?", "Yes, on this December departure every meal is included. Summer dates are $2,875 per person and include 7 breakfasts, 5 lunches, and 3 dinners."],
    ["What is the pace?", paceAnswer],
    ["What about international flights?", `${flightAnswer} Trung can help your parents choose flights before anyone buys tickets.`],
    ["Can they travel as a couple, or can one parent go with a friend?", "Yes. Couples can share a double, friends can request twin beds, and a private room is +$399, subject to availability."],
    ["Who hosts the trip?", "A carefully selected Cookie Paradise host travels with the group, plus English-speaking local guides. Trung plans the trip with your family and remains your contact before they go. He is not on this departure."],
    ["How do I book?", "Book a free conversation with Trung. After you agree on rooms and who’s paying, he’ll send the Traveler Agreement and the deposit invoice."],
    ["Other dates if December doesn’t work?", "Yes, six summer 2027 departures at $2,875 per person, with 7 breakfasts, 5 lunches, and 3 dinners included (not every meal)."],
  ] : [
    ["Why is the group capped at 8?", `So you can do things a large tour can’t do easily: a meal in a family home, vintage Jeeps, private boats, and a host who has time for each traveler. ${groupComparison} The trip runs with a minimum of 4 guests. We confirm the departure 75 days before it leaves. If we cancel because the minimum isn’t met, tour payments are refunded within 30 days. International flights you buy on your own aren’t covered by that refund.`],
    ["Are all meals included?", mealsAnswer],
    ["What is the pace?", paceAnswer],
    ["What about international flights?", flightAnswer],
    ["Can I travel solo, with a friend, or as a couple?", "Yes. Couples can share a double, friends can request twin beds, and solo travelers can ask about a private room for +$399, subject to availability. A roommate match isn’t guaranteed."],
    ["Who hosts the trip?", "This December departure is hosted by a carefully selected Cookie Paradise Travel Company host, plus English-speaking local guides. Trung plans the trip with you and remains your contact before you go. He is not on this departure."],
    ["How do I book?", "Book a free conversation with Trung. He’ll help you choose a room arrangement, complete the Traveler Agreement, and pay your $500 deposit."],
    ["Are there other dates?", otherDatesAnswer],
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
        <p className="december-lede">{gift
          ? "Not another thing to store. An 8-guest trip they can look forward to for a year: Vietnamese coffee, a home-hosted lunch in the Mekong, lantern-lit evenings in Hoi An, and a host who has time for them. Every meal is included, so they are not paying restaurant bills after the gift is arranged."
          : "Eight days in Ho Chi Minh City, the Mekong Delta, Hue, and Hoi An, with no more than 8 guests. That small a group is how you share a home-hosted lunch, ride a vintage Jeep for a night of street food, and travel by private boat instead of a coach. Every meal is included, so after you pay, you can just enjoy the week."}</p>
        <p className="december-support">{gift
          ? "Planned with Trung Le in Columbus, Indiana. A Cookie Paradise host and English-speaking local guides accompany the group. Trung is your family’s planning contact before they go."
          : "Planned with Trung Le, who was born in Vietnam and spent seven years living in Ho Chi Minh City. A Cookie Paradise host and English-speaking local guides accompany the group. Trung is your planning contact before you go."}</p>
        <a className="december-button" href="#get-guide">{gift ? "Get the itinerary for your family" : "Get the itinerary and pricing"}</a>
        <p className="december-note">Free itinerary. No obligation to book.</p>
      </div>
      <figure className="december-hero-image">
        <img src={`/campaigns/${hero}-1536.webp`} srcSet={`/campaigns/${hero}-640.webp 640w, /campaigns/${hero}-1280.webp 1280w, /campaigns/${hero}-1536.webp 1536w`} sizes="(min-width: 1000px) 54vw, 100vw" width={1536} height={1024} fetchPriority="high" alt={gift ? "Illustrative scene of a couple sharing a joyful evening beside the lanterns of Hoi An" : "Illustrative scene of travelers enjoying iced coffee and conversation at a Vietnamese café"} />
        <figcaption>Illustrative travel imagery</figcaption>
      </figure>
    </section>

    <section id="trip-details" className="december-facts" aria-label="Trip at a glance">
      <div><CalendarDays aria-hidden="true" /><p><strong>December 27, 2027</strong><span>Through January 3, 2028. 8 days / 7 nights.</span></p></div>
      <div><Users aria-hidden="true" /><p><strong>Capped at 8 guests</strong><span>A small group, so the host has time for you. (Minimum 4 to operate.)</span></p></div>
      <div><p><strong>$3,000 per person</strong><span>All meals included. Shared room. International airfare extra.</span></p></div>
    </section>

    <section className="december-local-strip" aria-labelledby="local-connection-title">
      <div className="december-local-inner">
        <img src="/about-trung.jpg" width={120} height={120} alt="Trung Le, founder of Cookie Paradise Travel Company" />
        <div className="december-local-copy">
          <p className="december-eyebrow">Your local connection</p>
          <h2 id="local-connection-title">{gift ? "You can plan this gift with someone local." : "Your Vietnam trip starts with someone nearby."}</h2>
          <p>{gift
            ? "Trung Le, founder of Cookie Paradise Travel Company, is based in Columbus, Indiana. Born in Vietnam, he lived in Ho Chi Minh City for seven years. Whether you’re in Indianapolis, Carmel, Westfield or closer to Columbus, you can start with someone nearby who knows the places you’re hoping to see. You and your parents can talk with him together about the itinerary, rooms, and how you’d like to handle payment, before anyone commits. Trung is not on this December departure. A carefully selected Cookie Paradise host will travel with the group."
            : "Trung Le, founder of Cookie Paradise Travel Company, is based in Columbus, Indiana. Born in Vietnam, he lived in Ho Chi Minh City for seven years and built this itinerary around the food, everyday life, and places he knows. Whether you’re in Indianapolis, Carmel, Westfield or closer to Columbus, you can start with someone nearby who knows the places you’re hoping to see. Trung is not on this December departure. A carefully selected Cookie Paradise host will travel with the group."}</p>
        </div>
        <a className="december-button" href="#meet-trung">Meet Trung</a>
      </div>
    </section>

    <section className="december-section december-story" aria-labelledby="story-title">
      <div>
        <p className="december-eyebrow">{gift ? "A gift that becomes their story" : "Travel with people, not a crowd"}</p>
        <h2 id="story-title">{gift
          ? <>They have enough things.<br /><em>Give them a trip that fits how they like to travel.</em></>
          : <>Eight guests,<br /><em>not a bus.</em></>}</h2>
      </div>
      <div className="december-story-body">
        {gift ? <>
          <p>Maybe they’ve talked about a bigger trip now that they have more time. A large group tour can make that idea feel tiring: early hotel lobbies, a full coach, and little say in the day. {groupComparison} Your parents can share a meal in a family home, travel by private boat, and ask questions without being one of 40 faces.</p>
          <p>Every meal is included, which is a quiet kindness in a gift like this. They are looked after at the table, and they are not adding restaurant costs once you have arranged the trip. You don’t have to build the itinerary yourself. Hotels, the domestic flight, guides, and daily plans are already in place.</p>
          <p>If you want this to be a Christmas gift this year, start with a conversation now. The trip is in late December 2027, so they’ll have a full year to look forward to it. A $500 deposit per traveler holds a seat, and the balance can be paid in monthly installments through October 27, 2027.</p>
        </> : <>
          <p>{groupComparison} A smaller group gets more of Vietnam and a more personal trip.</p>
          <p>With 8 people, you can sit down to a home-hosted lunch in the Mekong, split across vintage Jeeps for a night-time food tour, and take private boats on the delta and the Perfume River. Your host can answer a question without a loudspeaker, and the pace can flex when the group is ready for a pause.</p>
          <p>Every meal is included on this December departure, from the first evening through the last breakfast. You are looked after at the table, and you are not adding restaurant costs as you go. Hotels, the Ho Chi Minh City to Hue flight, daily guides, and transfers are already arranged, so you can spend the week on the trip, not on logistics.</p>
          <p>Retirement can mean you finally have the time. This is a way to use it well, with a group small enough that you are not herded through the day, and with meals already taken care of.</p>
        </>}
      </div>
    </section>

    <section id="journey" className="december-section" aria-labelledby="journey-title">
      <div className="december-section-heading">
        <div>
          <p className="december-eyebrow">Discover Southern Vietnam</p>
          <h2 id="journey-title">Eight days, paced so you can taste the place.</h2>
        </div>
        <a href="/#daily-schedule">Read the full daily schedule</a>
      </div>
      {gift && <p>Share this schedule with them. It’s a full week, with a free afternoon in Hoi An and choices (like a bicycle or buggy in the Mekong) when the walking might be a lot. Every meal is already included.</p>}
      <div className="december-route">{route.map(stop => <article key={stop.place}><img src={`/travel/${stop.image}-640.webp`} width={640} height={427} loading="lazy" alt={stop.alt} /><div><p className="december-eyebrow">{stop.days}</p><h3>{stop.place}</h3><p>{stop.text}</p></div></article>)}</div>
      <p className="december-note">Hotels include stays such as the Paragon Saigon and Almanity Hoi An Resort and Spa, or comparable properties.</p>
    </section>

    <section id="price" className="december-section december-price" aria-labelledby="price-title">
      <div className="december-price-intro">
        <p className="december-eyebrow">Know what you’re planning for</p>
        <h2 id="price-title">A clear price.<br /><em>A small-group trip.</em></h2>
        <p className="december-big-price">$3,000 <span>per person</span></p>
        <p>Land package, sharing a double or twin room. All meals included.</p>
        <p><strong>$500 nonrefundable deposit</strong> per traveler, then monthly installments. Final payment is due <strong>October 27, 2027.</strong></p>
        {gift && <p>If you’re giving this trip, you can pay the $500 deposit as the gift, contribute to the balance, or cover the trip in full. Trung will walk your family through the options on a call.</p>}
        <p className="december-note">Private room: +$399, subject to availability. There is no credit card surcharge. Pay by ACH or card at the same price.</p>
        <a href="/#faq">Read cancellation and booking terms</a>
      </div>
      <div>
        <h3>Included in your journey</h3>
        <ul className="december-inclusions">{inclusions.map(item => <li key={item}><Check aria-hidden="true" size={22} /><span>{item}</span></li>)}</ul>
        <div className="december-extra">
          <h3>Plan separately for</h3>
          <p>International airfare, travel insurance, gratuities, personal expenses, drinks not listed as included, and optional activities (such as a massage during free time in Hoi An).</p>
        </div>
      </div>
    </section>

    <section id="meet-trung" className="december-founder">
      <div className="december-section december-founder-grid">
        <img src="/about-trung.jpg" width={960} height={1280} alt="Trung Le in front of his Cookie Paradise bakery trailer" loading="lazy" />
        <div>
          <p className="december-eyebrow">From Columbus, Indiana, to Vietnam</p>
          <h2>{gift ? <>Meet Trung Le.<br /><em>Start with a conversation, together or on your own.</em></> : <>Meet Trung Le.<br /><em>Your trip starts with a conversation.</em></>}</h2>
          <p>Born in Vietnam, Trung spent seven years living in Ho Chi Minh City. He planned this itinerary so you can experience the food and everyday life he knows firsthand, in a group small enough for real conversation.</p>
          <p>{gift
            ? "From choosing flights to the week they depart, Trung is the planning contact for your family. He is not on this December departure. If your parents want to join the call, he can go through the daily pace, room choices, who will host the trip, and the payment plan with everyone on the line."
            : "From choosing flights to preparing for departure, Trung is your personal planning contact. He is not on this December departure. A carefully selected Cookie Paradise host will travel with the group."}</p>
          <div className="december-actions">
            <a className="december-button" href={consultationBookingUrl} target="_blank" rel="noopener noreferrer">Book a free conversation</a>
            <a href={emailHref}>Email Trung</a>
          </div>
          <p className="december-note">30 minutes by Google Meet. No obligation to book.</p>
        </div>
      </div>
    </section>

    <section className="december-section december-faq" aria-labelledby="faq-title">
      <p className="december-eyebrow">Planning made simple</p>
      <h2 id="faq-title">Your trip questions, answered.</h2>
      <div>{questions.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown aria-hidden="true" size={22} /></summary><p>{answer}</p></details>)}</div>
      <p>For the full terms, see our <a href="/#faq">booking information</a> and <a href="/travel-disclosures">travel disclosures</a>.</p>
    </section>

    <section className="december-final">
      <div className="december-section december-final-grid">
        <div>
          <p className="december-eyebrow">{gift ? "A lovely place to start" : "Your next chapter awaits"}</p>
          <h2>{gift ? <>Their next trip<br /><em>starts here.</em></> : <>Picture yourself<br /><em>here next winter.</em></>}</h2>
          <p>{gift
            ? "Download the itinerary and look it over together. If it feels right, book a call and we can work out how to give it."
            : "Get the daily itinerary and start picturing your days in Vietnam, with a group of no more than 8 and every meal included."}</p>
          <p>$3,000 per person. All meals included. Shared room. International airfare extra.</p>
          <p>Prefer a conversation first?<br /><a href={consultationBookingUrl} target="_blank" rel="noopener noreferrer">Book a free call with Trung</a> or <a href={emailHref}>send an email</a>.</p>
        </div>
        <TripGuideForm showCity campaign={campaign} />
      </div>
    </section>

    <footer className="december-footer"><BrandLogo homeHref="/" /><p>Cookie Paradise Travel Company LLC<br />Columbus, Indiana</p><nav aria-label="Footer navigation"><a href="/">Full website</a><a href="/privacy">Privacy</a><a href="/travel-disclosures">Travel disclosures</a><a href={emailHref}>Email Trung</a></nav><p className="december-note">Hero imagery is AI-generated to illustrate the travel experience.</p></footer>
  </main>;
}
