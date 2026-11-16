import { ArrowUpRight, BriefcaseBusiness, ClipboardList } from "lucide-react";

export const metadata = {
  title: "Travel advisor networks | Cookie Paradise Travel",
  robots: { index: false, follow: false },
};

type Network = { name: string; reach: string; action: string; note: string; href: string; link: string };

const startingNetworks: Network[] = [
  {
    name: "ABC·CCRA / TRUE",
    reach: "Independent travel advisors · U.S. and international",
    action: "Complete the Preferred Supplier inquiry. Introduce your hosted Vietnam tours and ask for the smallest supplier marketing package.",
    note: "Discuss directory placement, advisor emails and chapter speaking opportunities. Request full pricing before committing.",
    href: "https://www.ccra.com/true-preferred-supplier-network/",
    link: "Preferred Supplier inquiry",
  },
  {
    name: "TRAVELSAVERS",
    reach: "International travel agency network",
    action: "Submit the Supplier Inquiry and select Tour Operator. Prepare your destination specialty, years in business, passenger volume and existing agency relationships.",
    note: "Position Cookie Paradise as a U.S.-based specialist in personally hosted, small-group Vietnam journeys.",
    href: "https://sales.travelsavers.com/supplier-inquiry",
    link: "Supplier Inquiry",
  },
  {
    name: "Gifted Travel Network",
    reach: "U.S. host agency · Luxury-focused advisors",
    action: "Choose Apply Here on the Preferred Partner page. Submit the application before requesting an introductory meeting.",
    note: "Tour operators can apply. Ask about the annual marketing plan and whether your tours fit their advisors’ clients.",
    href: "https://giftedtravelnetwork.zoholandingpage.com/preferred-partner/",
    link: "Preferred Partner application",
  },
];

const otherNetworks: Network[] = [
  {
    name: "Travelmation",
    reach: "U.S. travel advisor network · Leisure and luxury travel",
    action: "Call Travelmation at (954) 247-4064 and ask who handles supplier partnerships. Introduce your hosted Vietnam tours and request the process for tour-operator consideration.",
    note: "Travelmation publishes a preferred-supplier list. A public supplier application was not found; confirm eligibility, commissions and any marketing fees directly with their team.",
    href: "https://www.travelmation.net/preferredsuppliers",
    link: "Preferred suppliers & contact",
  },
  {
    name: "Travel Leaders Network",
    reach: "U.S. and Canada · Leisure, groups, adventure and luxury",
    action: "Use the partnerships page to request the tour-operator supplier relations team.",
    note: "The public page provides a general contact route rather than a dedicated supplier application.",
    href: "https://www.travelleadersnetwork.com/powerful-partnerships/",
    link: "Partnerships page",
  },
  {
    name: "Signature Travel Network",
    reach: "U.S.-centered network with international members",
    action: "On its website, choose For Suppliers → Supplier Application.",
    note: "A later-stage target: published guidance looks for an established business, advisor support and existing sales with Signature agencies.",
    href: "https://www.signaturetravelnetwork.com/",
    link: "Find Supplier Application",
  },
  {
    name: "Ensemble",
    reach: "U.S. and Canadian travel agency consortium",
    action: "Use the contact page to request Partner Relations and tour-operator consideration.",
    note: "A partnership conversation is the starting point; a public supplier-specific application was not found in the initial research.",
    href: "https://www.ensembletravel.com/contact",
    link: "Contact Partner Relations",
  },
  {
    name: "Virtuoso",
    reach: "Global luxury and experiential travel network",
    action: "Request guidance on tour-operator preferred partnership through Virtuoso or help@virtuoso.com.",
    note: "A selective, longer-term target. Expect review of your product, trade relationships, commissions and insurance. The application route needs confirmation.",
    href: "https://www.virtuoso.com/",
    link: "Virtuoso website",
  },
];

const associations: Network[] = [
  {
    name: "ASTA",
    reach: "American Society of Travel Advisors",
    action: "Explore membership in the Travel Supplier / Tour Operator category for supplier exposure and advisor networking.",
    note: "Association membership is separate from becoming a preferred supplier in an advisor network.",
    href: "https://www.asta.org/content/Membership/Reserve/join-renew-reserve.aspx?WebsiteKey=c73c2ad4-f54c-487e-99b9-d05c1f5bc01e",
    link: "ASTA membership",
  },
  {
    name: "ATTA",
    reach: "Adventure Travel Trade Association · International",
    action: "Explore Tour Operator membership for connections among operators, advisors and destinations, with a focus on culturally immersive travel.",
    note: "Business membership pricing is based on annual revenue. Membership does not guarantee advisor bookings.",
    href: "https://membership.adventuretravel.biz/tour-operator",
    link: "Tour Operator membership",
  },
];

function NetworkCard({ network, priority }: { network: Network; priority?: number }) {
  return <article className="ws-network-card">
    <div className="ws-network-card-heading">
      {priority && <span className="ws-network-number" aria-label={`Starting option ${priority}`}>{priority}</span>}
      <div><h3>{network.name}</h3><p className="ws-network-reach">{network.reach}</p></div>
    </div>
    <p>{network.action}</p>
    <p className="ws-network-note">{network.note}</p>
    <a className="ws-button" href={network.href} target="_blank" rel="noopener noreferrer">
      {network.link}<ArrowUpRight size={16} aria-hidden="true"/><span className="sr-only"> (opens in a new tab)</span>
    </a>
  </article>;
}

export default function AdvisorNetworksPage() {
  return <main className="ws-page ws-networks-page">
    <div className="ws-heading"><div>
      <p className="ws-eyebrow">GROW YOUR ADVISOR PARTNERSHIPS</p>
      <h1>Travel advisor networks.</h1>
      <p className="ws-muted">Where to apply as a tour operator or travel supplier so advisors can sell your Vietnam trips.</p>
    </div></div>

    <div className="ws-network-intro">
      <BriefcaseBusiness size={24} aria-hidden="true"/>
      <div><h2>Start with one network.</h2><p>Begin with CCRA, TRAVELSAVERS or Gifted Travel Network. Compare the cost and advisor access, then test one partnership and measure bookings before adding more. These starting options reflect clear inquiry routes, not guaranteed acceptance.</p></div>
    </div>
    <nav className="ws-network-jumps" aria-label="On this page">
      <a href="#start-here">Start here</a><a href="#more-networks">More networks</a><a href="#associations">Trade associations</a><a href="#application-kit">Application checklist</a>
    </nav>

    <section className="ws-network-section" aria-labelledby="start-here">
      <div className="ws-section-heading"><h2 id="start-here">Start here</h2><span>3 starting options</span></div>
      <div className="ws-network-grid ws-network-priority">{startingNetworks.map((network, index) => <NetworkCard key={network.name} network={network} priority={index + 1}/>)}</div>
    </section>

    <section className="ws-network-section" aria-labelledby="more-networks">
      <div className="ws-section-heading"><h2 id="more-networks">More advisor networks</h2><span>Partnership review required</span></div>
      <div className="ws-network-grid">{otherNetworks.map(network => <NetworkCard key={network.name} network={network}/>)}</div>
    </section>

    <section className="ws-network-section" aria-labelledby="associations">
      <div className="ws-section-heading"><h2 id="associations">Trade associations</h2></div>
      <p className="ws-muted ws-network-section-intro">Useful for meeting advisors and building industry relationships. Membership is different from a preferred-supplier agreement.</p>
      <div className="ws-network-grid">{associations.map(network => <NetworkCard key={network.name} network={network}/>)}</div>
    </section>

    <section className="ws-network-section" aria-labelledby="application-kit">
      <div className="ws-section-heading"><h2 id="application-kit">Prepare your application</h2><ClipboardList size={20} aria-hidden="true"/></div>
      <div className="ws-network-grid">
        <div className="ws-network-panel"><h3>Travel advisor sales kit</h3><ul>
          <li>Vietnam itinerary, departure dates, prices, inclusions and group size.</li>
          <li>Advisor commission or net rates, payment timing and cancellation treatment.</li>
          <li>A clear booking process and dedicated advisor contact.</li>
          <li>Company registration, insurance documents and available references.</li>
          <li>Photos and a one-page brochure advisors can share with clients.</li>
        </ul></div>
        <div className="ws-network-panel"><h3>Ask before buying a package</h3><ul>
          <li>What is the full annual cost, including marketing fees?</li>
          <li>What commissions are required, and when are they paid?</li>
          <li>Are there minimum sales or passenger expectations?</li>
          <li>How will advisors discover and book our tours?</li>
          <li>What training, introductions and reporting are included?</li>
        </ul></div>
      </div>
      <div className="ws-network-pitch"><p className="ws-eyebrow">YOUR INTRODUCTION</p><blockquote>Cookie Paradise Travel Company LLC is a U.S.-based tour company specializing in personally hosted, small-group cultural journeys through Vietnam. We are seeking travel advisor distribution partners.</blockquote></div>
    </section>
    <p className="ws-muted">Research notes from November 16, 2026. Confirm current pricing, eligibility and application requirements directly with each organization.</p>
  </main>;
}
