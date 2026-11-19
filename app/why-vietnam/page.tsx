/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation matches the public website. */
import { publicPageMetadata } from "@/lib/public-page-metadata";
import { BrandLogo } from "../components/brand-logo";
import { JourneyPhoto } from "../components/journey-photo";
import "./why-vietnam.css";

export const metadata = publicPageMetadata({ title: "Why Visit Vietnam? Food, Culture, Scenery & Value", description: "Discover six compelling reasons to travel to Vietnam, backed by UNESCO, MICHELIN and independent research. Explore small-group and private trips with Trung Le.", path: "/why-vietnam", image: "/travel/fit-ha-long-bay-1800.webp", imageAlt: "Limestone islands and boats in Ha Long Bay, Vietnam" });

const sources = {
  michelin: "https://guide.michelin.com/en/article/michelin-guide-ceremony/michelin-guide-vietnam-2026",
  food: "https://vietnam.travel/things-to-do/vietnam-foodie-guide-region/",
  nature: "https://whc.unesco.org/en/list/1438/",
  hoiAn: "https://whc.unesco.org/en/list/948/",
  hue: "https://whc.unesco.org/en/list/678/",
  value: "https://www.numbeo.com/cost-of-living/rankings_by_country.jsp?title=2026-mid",
  valueMethodology: "https://www.numbeo.com/common/motivation_and_methodology.jsp",
  coast: "https://vietnam.travel/place-to-go/south-central-coast-central-highlands/da-nang/",
  coffee: "https://vietnam.travel/things-to-do/taste-vietnam-story-behind-its-beloved-coffee-culture/",
  forbes: "https://www.forbes.com/sites/williampbarrett/2026/07/31/the-best-places-to-retire-abroad-in-2026/",
  visa: "https://evisa.xuatnhapcanh.gov.vn/trang-chu-ttdt/",
};
function Source({ href, children }: { href: string; children: React.ReactNode }) { return <a className="why-source" href={href} target="_blank" rel="noopener noreferrer">{children}<span className="sr-only"> (opens in a new tab)</span></a>; }

export default function WhyVietnamPage() {
  return <main className="why-page">
    <a href="#why-content" className="why-skip">Skip to content</a>
    <header className="why-header"><div className="why-wrap why-header-inner">
      <a href="/" aria-label="Cookie Paradise Travel Company home"><BrandLogo surface="light" tagline /></a>
      <nav aria-label="Main navigation"><a href="/">Small-group tour</a><a href="/why-vietnam" aria-current="page">Why Vietnam?</a><a href="/fit">Private trips</a></nav>
    </div></header>
    <section id="why-content" className="why-wrap why-hero">
      <div><p className="why-kicker">Why Vietnam?</p><h1>Make the journey.<br /><em>Come home with more.</em></h1>
      <p className="why-lead">Go for the food. Stay for the scenery, the history, and the pleasure of discovering a different way to spend your day.</p>
      <p>Vietnam combines world-renowned food, UNESCO-listed sites, dramatic landscapes, beautiful beaches, and a proud and complex history into one country. You can build a trip around curiosity and comfort, with room for both exploration and relaxation.</p>
      <div className="why-actions"><a className="why-button" href="/">Explore our small-group trip</a><a className="why-link" href="/fit">Plan a private trip</a></div></div>
      <JourneyPhoto photo="fitBay" priority sizes="(min-width: 900px) 50vw, 100vw" />
    </section>
    <section className="why-wrap why-reasons" aria-labelledby="why-reasons-title">
      <div className="why-section-heading"><p className="why-kicker">The reasons to go</p><h2 id="why-reasons-title">A destination worth<br /><em>getting to know.</em></h2><p>Here’s what makes Vietnam compelling—and the evidence behind it.</p></div>
      <div className="why-grid">
        <article className="why-food-reason"><figure className="why-reason-photo why-food-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.pexels.com/photos/2318966/pexels-photo-2318966.jpeg?auto=compress&amp;w=1200"
            srcSet="https://images.pexels.com/photos/2318966/pexels-photo-2318966.jpeg?auto=compress&amp;w=640 640w, https://images.pexels.com/photos/2318966/pexels-photo-2318966.jpeg?auto=compress&amp;w=1200 1200w"
            sizes="(min-width: 900px) 40vw, 90vw" width={6928} height={4621}
            alt="Vietnamese meal with rice noodles, fresh herbs, dipping sauce and a golden fish dish" loading="lazy" decoding="async" />
          <figcaption><a href="https://www.pexels.com/photo/vegetables-and-noodles-in-plates-on-table-2318966/" target="_blank" rel="noopener noreferrer">Photo: Quang Nguyen Vinh / Pexels</a></figcaption>
        </figure><p className="why-kicker">Food worth traveling for</p><h3>Taste a different Vietnam in every region.</h3><p>Vietnamese food reaches far beyond phở and bánh mì. Regional ingredients and traditions make eating your way through the country part of the discovery. Leave space for a street-side breakfast as well as a special dinner.</p><p className="why-evidence">MICHELIN’s 2026 selection for Hanoi, Ho Chi Minh City and Da Nang included 11 one-star restaurants and 72 Bib Gourmand establishments, recognized for good cooking at good value.</p><Source href={sources.michelin}>MICHELIN Guide · 2026 selection</Source><Source href={sources.food}>Vietnam Tourism · Regional cuisine</Source></article>
        <article><p className="why-kicker">Landscapes that change the pace</p><h3>Trade your everyday view for something extraordinary.</h3><p>In northern Vietnam’s Trang An, boats travel through a landscape of limestone towers, waterways and caves. Temples, villages and rice fields share the setting. It’s a reason to leave time outdoors, beyond the cities.</p><p className="why-evidence">UNESCO recognizes Trang An for both its natural landscape and its cultural history, including evidence of human activity spanning more than 30,000 years.</p><Source href={sources.nature}>UNESCO · Trang An Landscape Complex</Source><figure className="why-reason-photo why-landscape-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.unsplash.com/photo-1557750255-c76072a7aad1?auto=format&amp;fit=max&amp;w=1400&amp;q=85"
            srcSet="https://images.unsplash.com/photo-1557750255-c76072a7aad1?auto=format&amp;fit=max&amp;w=640&amp;q=85 640w, https://images.unsplash.com/photo-1557750255-c76072a7aad1?auto=format&amp;fit=max&amp;w=1400&amp;q=85 1400w"
            sizes="(min-width: 900px) 45vw, 90vw" width={3} height={2}
            alt="A pavilion on still water framed by lush limestone cliffs in Tràng An, Vietnam" loading="lazy" decoding="async" />
          <figcaption><span>Tràng An</span><a href="https://unsplash.com/photos/PgSxHidgJHQ" target="_blank" rel="noopener noreferrer">Photo: Rowan Heuvel / Unsplash</a></figcaption>
        </figure></article>
        <article><p className="why-kicker">History you can walk through</p><h3>Explore imperial cities and centuries-old streets.</h3><p>Vietnam’s story stretches well beyond its twentieth-century wars. Walk through Hue’s imperial heritage and Hoi An’s trading-town streets to discover the dynasties and international connections that shaped the country.</p><p className="why-evidence">UNESCO lists both places: Hue served as the Nguyen dynasty’s capital from 1802 to 1945; Hoi An preserves the character of a trading port active from the 15th to the 19th century.</p><Source href={sources.hue}>UNESCO · Complex of Hue Monuments</Source><Source href={sources.hoiAn}>UNESCO · Hoi An Ancient Town</Source></article>
        <article><p className="why-kicker">Value in the everyday pleasures</p><h3>Enjoy the little extras along the way.</h3><p>A coffee break, a leisurely lunch, another local dish to try: cost of living matters when you want to enjoy a destination fully. Fortunately, the cost of living in Vietnam is low, so your money goes farther here.</p><p className="why-evidence">Numbeo’s mid-2026 cost-of-living index places Vietnam about 61% below the United States, excluding rent. This estimate draws on crowdsourced and researched prices for everyday goods and services, including groceries, dining, transportation and utilities. Actual costs vary by location and lifestyle.</p><Source href={sources.value}>Numbeo · Mid-2026 cost-of-living comparison</Source><Source href={sources.valueMethodology}>Numbeo · Data and methodology</Source></article>
        <article><p className="why-kicker">Room to relax</p><h3>Pair discovery with a beach break.</h3><p>You don’t have to choose between a cultural trip and time by the sea. Da Nang combines My Khe Beach, coastal resorts and access to the Hai Van Pass. A few slower coastal days can give a longer journey a different rhythm.</p><p className="why-evidence">Vietnam’s official tourism guide highlights Da Nang’s beaches, resorts and mountain pass. Choose your coast and travel month together; beach weather varies by region.</p><Source href={sources.coast}>Vietnam Tourism · Da Nang</Source></article>
        <article><p className="why-kicker">Culture in the small moments</p><h3>Make time for a coffee and a closer look.</h3><div className="why-coffee-intro"><figure className="why-reason-photo why-coffee-photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://images.pexels.com/photos/32871412/pexels-photo-32871412/free-photo-of-close-up-of-vietnamese-egg-coffee-on-a-wooden-table.jpeg?auto=compress&amp;w=900"
              srcSet="https://images.pexels.com/photos/32871412/pexels-photo-32871412/free-photo-of-close-up-of-vietnamese-egg-coffee-on-a-wooden-table.jpeg?auto=compress&amp;w=480 480w, https://images.pexels.com/photos/32871412/pexels-photo-32871412/free-photo-of-close-up-of-vietnamese-egg-coffee-on-a-wooden-table.jpeg?auto=compress&amp;w=900 900w"
              sizes="(min-width: 900px) 224px, (min-width: 540px) 35vw, 40vw" width={2400} height={3600}
              alt="Close-up of Vietnamese egg coffee with a creamy golden topping, dark coffee and condensed milk in a glass on a wooden table"
              loading="lazy" decoding="async" />
            <figcaption><span>Vietnamese egg coffee</span><a href="https://www.pexels.com/photo/close-up-of-vietnamese-egg-coffee-on-a-wooden-table-32871412/" target="_blank" rel="noopener noreferrer">Photo: Sóc Năng Động / Pexels</a></figcaption>
          </figure><p>Some discoveries fit into an unhurried hour. Watch a phin filter drip, try iced coffee with condensed milk, or seek out Hanoi’s egg coffee. Café stops offer a simple way to experience local tastes between the larger sights.</p></div><p className="why-evidence">Vietnam Tourism traces these distinct drinks and brewing traditions in its guide to the country’s coffee culture.</p><Source href={sources.coffee}>Vietnam Tourism · Coffee culture</Source>
          
        </article>
      </div>
    </section>
    <section className="why-photo-band why-wrap" aria-label="Scenes from Vietnam"><JourneyPhoto photo="hue" /><JourneyPhoto photo="fitCafe" /></section>
    <section className="why-longstay"><div className="why-wrap why-two-column"><div><p className="why-kicker">Thinking beyond a vacation?</p><h2>Visit first.<br /><em>Imagine the possibilities.</em></h2></div><div><p>If Vietnam is on your retirement shortlist, a first trip can help you understand how it feels to be there: the food, the climate, the neighborhoods and the daily rhythm.</p><p>Forbes included Vietnam in its 2026 list of places to retire abroad, naming Hanoi, Da Nang, Ho Chi Minh City and Hoi An. That makes it worth exploring in person.</p><p>Vietnam’s Immigration Department states that e-visas can be valid for up to 90 days, with single or multiple entries. A visitor visa does not establish permanent residency.</p><Source href={sources.forbes}>Forbes · Best Places to Retire Abroad, 2026</Source><Source href={sources.visa}>Vietnam Immigration Department · E-visa information</Source></div></div></section>
    <section className="why-wrap why-plan"><p className="why-kicker">Experience it with Trung</p><h2>Turn “Why Vietnam?”<br /><em>into “When can I go?”</em></h2><p>I was born in Vietnam, spent my first sixteen years in Yên Bái and Bình Dương, and later lived in Ho Chi Minh City for seven years. I’ll help you connect with the unique places and experiences in Vietnam that only a local can know.</p><div className="why-options"><article><h3>Join Discover Southern Vietnam</h3><p>Travel with me through Ho Chi Minh City (Saigon), the Mekong Delta, Hue and Hoi An in a group of 4–8 guests.</p><a className="why-button" href="/">See the itinerary and pricing</a></article><article><h3>Make the trip your own</h3><p>Want to include the north, add beach time or explore a possible longer stay? I can plan your route and handle as much of the booking as you need, including flights.</p><a className="why-button" href="/fit">Explore private trip planning</a></article></div></section>
    <footer className="why-wrap why-footer"><p>Sources checked November 18–19, 2026. Dated rankings describe their published editions.</p><nav aria-label="Footer navigation"><a href="/">Small-group tour</a><a href="/fit">Private trips</a><a href="/vietnam-trip-planning">Travel planning guide</a><a href="/privacy">Privacy policy</a></nav><p>© 2026 Cookie Paradise Travel Company LLC</p></footer>
  </main>;
}
