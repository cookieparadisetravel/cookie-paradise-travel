import {
  ArrowRight, ChevronDown, Plane, Users, Utensils,
} from "lucide-react";
import { BookingDialog } from "./components/booking-dialog";
import { MobileBookBar } from "./components/mobile-book-bar";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSalonPartner, REFERRAL_COOKIE } from "@/lib/salon-referrals";
import { ReferralBrand, ReferralProvider } from "./components/referral-brand";
import { getPublicTripAvailability } from "@/lib/public-trip-availability";
import { vietnamDeparture } from "@/lib/trip-availability";
import { TripAvailability } from "./components/trip-availability";
import { TripBudget } from "./components/trip-budget";
import { JourneyPhoto } from "./components/journey-photo";
import { DestinationSlideshow } from "./components/destination-slideshow";
import { LegacyJourneyCleanup, TripSectionLink } from "./components/trip-section-link";
import { ConsultationLink } from "./components/consultation-link";
import { BrandLogo } from "./components/brand-logo";
import { TripGuideForm } from "./components/trip-guide-form";
import { tripGuideUrl } from "@/lib/trip-guide";
import travelerAgreementSummary from "@/lib/traveler-agreement-summary.json";
import { publicPageMetadata } from "@/lib/public-page-metadata";
export const dynamic = "force-dynamic";

export const metadata = publicPageMetadata({
  title: "Vietnam Small-Group Tours | Cookie Paradise Travel",
  description: "Explore Vietnam on a hosted small-group tour or plan a private trip with Trung Le. Discover Ho Chi Minh City, the Mekong Delta, Hue and Hoi An.",
  path: "/",
});

const itinerary = [
  ["01", "Arrive in Ho Chi Minh City", "A private airport welcome, hotel transfer and an easy first evening to settle in."],
  ["02", "The many sides of Ho Chi Minh City", "Morning life in Tao Dan Park, city icons, markets and a vintage-Jeep food adventure after dark."],
  ["03", "Mekong Delta life", "Floating communities, sampan waterways, village paths, family workshops and a home-hosted lunch."],
  ["04", "Fly to Hue", "Imperial Citadel, Thien Mu Pagoda and a private sunset cruise on the Perfume River."],
  ["05", "Gardens, tombs & royal dinner", "Tha Om Garden House, the royal tombs of Tu Duc and Khai Dinh, then dinner with traditional music."],
  ["06", "Hue to Hoi An", "The Hai Van Pass, lantern making, old-town heritage and basket boats."],
  ["07", "Hoi An culinary challenge", "Herb-farm games, hands-on cooking, a free afternoon, an optional massage and a celebratory farewell dinner."],
  ["08", "Depart Hoi An via Da Nang", "Breakfast and a private transfer to Da Nang International Airport (DAD) for your onward flight."],
];

const pricing = [["4–8 guests", "$2,875"]];

const detailedItinerary = [
  {
    day: "01", title: "Arrive in Ho Chi Minh City", meals: "Meals: none",
    events: [
      ["On arrival", "Airport welcome", "Meet your local representative at Tan Son Nhat International Airport (SGN) in Ho Chi Minh City and transfer privately to the hotel, approximately 30 minutes."],
      ["From 2:00 PM", "Hotel check-in", "Settle into the Paragon Saigon Hotel, Premier Sakura room, or a comparable property."],
      ["Rest of day", "At leisure", "Unpack, rest and explore nearby at your own pace."],
    ],
  },
  {
    day: "02", title: "The many sides of Ho Chi Minh City", meals: "Meals: Breakfast, Dinner",
    events: [
      ["6:30–9:30 AM", "Morning in Ho Chi Minh City", "Tao Dan Park and its bird café, a century-old private house and temple, a local breakfast and a neighborhood wet market."],
      ["1:00–5:00 PM", "Central Ho Chi Minh City", "City Hall, Dong Khoi Street, the Continental Hotel, Opera House, Central Post Office, the former CIA building, 30 April Park, Reunification Palace and Ben Thanh Market."],
      ["6:30–10:30 PM", "Ho Chi Minh City after dark", "Travel by vintage Jeep for local food stops, the flower market and street snacks, finishing with a rooftop drink."],
    ],
  },
  {
    day: "03", title: "Mekong Delta life", meals: "Meals: Breakfast, Lunch",
    events: [
      ["8:00 AM–5:00 PM", "Waterways, farms and a shared table", "Travel about two hours to the delta. Visit the Tan My floating community and a working fish farm, continue by sampan, explore village paths by bicycle or buggy, meet local producers and share a home-hosted lunch before returning to Ho Chi Minh City."],
    ],
  },
  {
    day: "04", title: "Fly to Hue", meals: "Meals: Breakfast, Lunch",
    events: [
      ["Morning", "Airport transfer", "Transfer from the hotel to Tan Son Nhat International Airport (SGN)."],
      ["Late morning", "Flight to Hue", "Fly from Ho Chi Minh City (SGN) to Phu Bai International Airport (HUI), serving Hue. This domestic flight is included in your tour."],
      ["2:30–6:00 PM", "Imperial Hue", "Explore the Imperial Citadel and restored Kien Trung Palace, followed by Thien Mu Pagoda."],
      ["About 5:00 PM", "Perfume River sunset", "Board a private river cruise with a cocktail and canapés."],
    ],
  },
  {
    day: "05", title: "Gardens, royal tombs and royal dinner", meals: "Meals: Breakfast, Lunch, Dinner",
    events: [
      ["10:30 AM–1:00 PM", "Tha Om Garden House", "Enjoy Hue cakes and tea in the garden house, followed by lunch."],
      ["1:00–5:00 PM", "Tombs of the emperors", "Explore the contrasting royal tombs of Tu Duc and Khai Dinh."],
      ["Evening", "Royal dinner", "Enjoy a multi-course dinner with live traditional music and the opportunity to wear royal-style robes."],
    ],
  },
  {
    day: "06", title: "Hue to Hoi An", meals: "Meals: Breakfast, Lunch",
    events: [
      ["9:00 AM", "Cross the Hai Van Pass", "Depart Hue for the scenic drive toward Da Nang and Hoi An, with lunch en route."],
      ["1:00–5:00 PM", "Lanterns, lanes and basket boats", "Make a traditional lantern, explore Hoi An old town and continue to Cam Thanh coconut village for a basket-boat experience."],
      ["Evening", "Check in at Almanity", "Deluxe Pool View room at Almanity Hoi An Resort & Spa, or a comparable property."],
    ],
  },
  {
    day: "07", title: "Hoi An culinary challenge", meals: "Meals: Breakfast, Lunch, Dinner",
    events: [
      ["8:30 AM–1:00 PM", "Farm-to-table challenge", "Take on a herb hunt, spring-roll showdown, Vietnamese rice-pancake challenge and mystery-box juice creation, followed by lunch."],
      ["Afternoon", "Free time", "Relax at the resort or explore Hoi An independently."],
      ["During free time", "Optional 60-minute massage", "Enjoy an optional 60-minute body massage at Almanity during your free time."],
      ["7:00 PM", "Farewell dinner", "Gather for a celebratory dinner with one glass of house wine."],
    ],
  },
  {
    day: "08", title: "Depart Hoi An via Da Nang", meals: "Meals: Breakfast",
    events: [
      ["Morning", "Breakfast", "Enjoy breakfast at the hotel and prepare for departure."],
      ["Before 12:00 PM", "Check out and airport transfer", "Transfer privately to Da Nang International Airport (DAD) according to your onward flight schedule."],
    ],
  },
];


const approvedSummary = (label: string) => {
  const text = travelerAgreementSummary.items.find(item => item.label === label)?.text
    ?? "Please ask Trung for the current terms and review your personalized Traveler Agreement before booking.";
  // Homepage visitors need standalone explanations; agreement documents retain their references.
  return text
    .replace("Itineraries and suppliers may change. ", "")
    .replace(", subject to Sections 4, 12 and 14", ", with exceptions for company cancellation and events beyond our control")
    .replace("For a force majeure cancellation", "For a cancellation caused by events beyond our control")
    .replace(/\s*\(Sections? [^)]+\)/g, "");
};
const homepageFaqs = [
  { question: "How do I reserve a place?", answer: "Choose ‘Request a spot’ in the pricing section. Trung will review your plans and send a personalized Traveler Agreement and secure Square invoice. Your booking is confirmed only after our written acceptance, the required signatures and cleared deposit or required full payment. Submitting the form does not take a payment or confirm a reservation." },
  { question: "Where do I fly into and out of?", answer: "Arrive at Tan Son Nhat International Airport (SGN) in Ho Chi Minh City for June 1, 2027. Depart from Da Nang International Airport (DAD), near Hoi An, on June 8. The listed domestic flight from Ho Chi Minh City to Hue (HUI) is included; international flights are extra. Discuss flight plans with Trung before purchasing." },
  { question: "What are the room options for solo travelers, friends and couples?", answer: "The listed price is per person sharing a double or twin room. Friends can request separate beds; couples can request a queen bed or separate beds. If you are traveling solo, ask Trung about room arrangements. A room to yourself adds $399, subject to availability; a roommate match is not guaranteed." },
  { question: "What is the daily pace like?", answer: "The itinerary includes city and heritage-site walking, getting on and off boats, some early starts and full activity days, alongside free time. The Mekong village routes offer bicycle or buggy options. Talk with Trung about your preferred pace and any arrangements that need to be checked before booking." },
  { question: "What are the deposit and payment terms?", answer: approvedSummary("Deposit and payments") },
  { question: "What happens if the minimum group is not reached?", answer: approvedSummary("Minimum group and company cancellation") + " Independently purchased international flights and other arrangements are not covered by this refund." },
  { question: "What if a major disruption affects the trip?", answer: approvedSummary("Changes and major disruptions") },
  { question: "What if I need to cancel?", answer: approvedSummary("If you cancel") },
  { question: "What if June 2027 does not work for me?", answer: "June 1–8, 2027 is the currently open departure. Future dates have not been announced. You can still request the itinerary and pricing PDF, choose a future departure as your interest, or book a call to discuss your plans." },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const linkedPartner = getSalonPartner((await searchParams).ref);
  if (linkedPartner) redirect("/r/" + linkedPartner.code);
  const partner = getSalonPartner((await cookies()).get(REFERRAL_COOKIE)?.value);
  const availability = await getPublicTripAvailability(vietnamDeparture.tripSlug, vietnamDeparture.departure, vietnamDeparture.capacity);
  return (
    <ReferralProvider partner={partner}>
    <LegacyJourneyCleanup />
    <main className="bright-home min-h-screen overflow-x-hidden bg-[var(--sand)] text-[var(--ink)]">
      <section id="top" className="overflow-hidden bg-[#faf8f3] text-[var(--ink)]">
      <header className="relative z-20 border-b border-black/10 bg-[#faf8f3] text-[var(--ink)]">
        <div className="site-header-bar mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="site-header-brand flex items-center gap-3">
            <a href="#top" className="site-header-home flex min-w-0 flex-col items-start gap-2" aria-label="Cookie Paradise Travel Company home">
              <BrandLogo surface="light" tagline />
            </a>
            <ReferralBrand header />
          </div>
          <nav className="hidden flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-semibold xl:flex" aria-label="Main navigation">
            <a className="hover:text-[var(--gold)]" href="#pricing">Pricing &amp; budget</a>
            <a className="hover:text-[var(--gold)]" href="#included">What’s included</a>
            <TripSectionLink className="hover:text-[var(--gold)]">Itinerary</TripSectionLink>
            <a className="hover:text-[var(--gold)]" href="#about">Meet Trung</a>
            <a className="hover:text-[var(--gold)]" href="/why-vietnam">Why Vietnam?</a>
            <a className="hover:text-[var(--gold)]" href="/fit">Private trips</a>
            <a className="hover:text-[var(--gold)]" href="/khao-sat-thi-truong-my" lang="vi">Khảo sát thị trường Mỹ</a>
          </nav>
          <ConsultationLink compact className="site-header-call" />
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-5 border-t border-black/10 bg-[#faf8f3] px-4 py-3 text-sm font-semibold xl:hidden" aria-label="Travel options">
          <a className="hover:underline" href="#pricing">Pricing</a>
          <TripSectionLink className="hover:underline">Itinerary</TripSectionLink>
          <a className="hover:underline" href="/why-vietnam">Why Vietnam?</a>
          <a className="hover:underline" href="/fit">Private trips</a>
          <a className="hover:underline" href="/khao-sat-thi-truong-my" lang="vi">Khảo sát thị trường Mỹ</a>
        </nav>
      </header>

        <div className="destination-hero relative isolate flex min-h-[520px] items-center justify-center overflow-hidden px-5 py-24 text-center text-white sm:min-h-[660px]">
          <img src="/travel/hue-citadel-1800.webp" srcSet="/travel/hue-citadel-640.webp 640w, /travel/hue-citadel-1280.webp 1280w, /travel/hue-citadel-1800.webp 1800w" sizes="100vw" width={1800} height={1200} alt="The Imperial Citadel in Hue beneath a blue sky" fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,.04),rgba(0,0,0,.22)_55%,rgba(0,0,0,.12))]" />
          <div className="hero-essential-copy">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[.14em] [text-shadow:0_2px_8px_rgba(0,0,0,.9)]">Small-group Vietnam tour</p>
          <h1 className="max-w-4xl font-serif text-[clamp(2.8rem,7vw,6.5rem)] font-normal leading-[1.08] tracking-[-.025em] [text-shadow:0_2px_16px_rgba(0,0,0,.65)]">Discover<br />Southern Vietnam</h1>
            <p className="mt-6 text-base font-semibold leading-7 sm:text-xl [text-shadow:0_2px_8px_rgba(0,0,0,.9)]">June 1–8, 2027 · 8 days · 4–8 guests</p>
          </div>
          <span className="absolute bottom-5 right-6 text-xs text-white [text-shadow:0_1px_5px_black]">Imperial Hue, Vietnam</span>
        </div>
        <div className="mx-auto max-w-4xl px-5 py-12 text-center sm:px-8 sm:py-16">
          <div className="hero-trip-details">
            <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--ink)] sm:text-xl sm:leading-8">Taste Ho Chi Minh City (Saigon), drift through the Mekong Delta, explore imperial Hue and wander lantern-lit Hoi An—with your hotels, local guides and daily experiences arranged.</p>
            <p className="mt-7 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-4xl font-bold text-[#805018]">$2,875</span><span className="text-base text-[var(--ink)]">per traveler · fixed price</span></p>
            <p className="mt-2 text-sm leading-6 text-[var(--ink)]">Shared room · International airfare extra</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ConsultationLink />
              <a href="#guide" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/25 px-6 py-3 text-center text-sm font-bold hover:bg-black/5">Get the itinerary and pricing <ArrowRight className="h-4 w-4 shrink-0" /></a>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--ink)]">Free 30-minute Google Meet with Trung · No obligation to book.</p>
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-[#f4f0e8] py-14 text-[var(--ink)] sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow" style={{ color: "#805018" }}>Small group, shared value</p>
            <h2 className="section-title text-[var(--ink)]">Your Vietnam trip, clearly priced.</h2>
            <p className="mt-5 text-base leading-7">Minimum 4, maximum 8 guests, plus your host. The fixed price is $2,875 per person sharing a room.</p>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--ink)]"><strong>$500 nonrefundable deposit per traveler.</strong> Pay the balance monthly, with the final payment due April 1, 2027.</p>
            <div className="availability-light"><TripAvailability availability={availability} label={vietnamDeparture.label} /></div>
            <div className="mt-7 flex flex-wrap gap-3"><BookingDialog triggerLabel="Request a spot" compact /><a href="#faq" className="inline-flex min-h-12 items-center px-2 text-sm font-semibold underline">Booking questions</a></div>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white">
            {pricing.map(([group, price], index) => (
              <div key={group} className={"flex items-end justify-between gap-4 px-6 py-6 sm:px-9 " + (index ? "border-t border-black/10" : "")}>
                <p className="font-semibold">{group}</p>
                <p className="font-serif text-3xl text-[#805018] sm:text-4xl">{price}<span className="ml-1 font-sans text-xs text-[var(--ink)]">/ person</span></p>
              </div>
            ))}
            <div className="border-t border-black/10 bg-white px-6 py-5 text-sm text-[var(--ink)] sm:px-9">
              <details className="mb-5 border-b border-[var(--line)] pb-5"><summary className="cursor-pointer font-semibold">One fixed tour price</summary><p className="mt-3 leading-7">{approvedSummary("Price and room arrangements").split(" The $399")[0]}</p></details>
              Private room: <strong className="text-[var(--ink)]">+$399</strong>, subject to availability. <a href="#faq" className="font-semibold underline">See room options and booking terms.</a>
            </div>
          </div>
        </div>
        <TripBudget />
      </section>

      <section id="included" className="mx-auto max-w-7xl scroll-mt-6 px-5 py-14 sm:px-8 sm:py-20">
        <p className="eyebrow">Included in the tour price</p>
        <h2 className="section-title">The details, handled.</h2>
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <figure className="homepage-life-photo inclusions-life-photo">
        <img
          src="/travel/vietnam-market-duy-1280.webp"
          srcSet="/travel/vietnam-market-duy-640.webp 640w, /travel/vietnam-market-duy-1280.webp 1280w, /travel/vietnam-market-duy-1800.webp 1800w"
          sizes="(min-width: 1024px) 48vw, 100vw"
          width={1800}
          height={1013}
          alt="Vendors seated among baskets of fresh herbs and vegetables outside a neighborhood shop in Vietnam, with scooters lining the street"
          loading="lazy"
          decoding="async"
        />
        <figcaption>
          <a href="https://www.pexels.com/photo/vibrant-vietnamese-street-market-scene-30372197/" target="_blank" rel="noopener noreferrer" aria-label="Photo by Duy Nguyen on Pexels (opens in a new tab)">Photo: Duy Nguyen</a>
        </figcaption>
      </figure>
          <div className="divide-y divide-[var(--line)]">
            {[
              [Utensils, "Hotels & meals", "Seven hotel nights, seven breakfasts, five lunches and three dinners, including a home-hosted Mekong lunch and Hue royal dinner."],
              [Plane, "Flights, transfers & Vietnam visa", "The Ho Chi Minh City–Hue flight, private ground transportation, scheduled airport transfers, private boats and your Vietnam visa."],
              [Users, "Guides & experiences", "English-speaking local guides, admission fees and all scheduled activities, from the Jeep food tour to Hoi An’s culinary challenge."],
            ].map(([Icon, title, text]) => {
              const ItemIcon = Icon as typeof Plane;
              return <div key={title as string} className="flex gap-4 py-5 first:pt-0"><ItemIcon aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-[var(--orange)]" /><div><h3 className="font-serif text-2xl">{title as string}</h3><p className="mt-2 text-base leading-7 text-[var(--muted-ink)]">{text as string}</p></div></div>;
            })}
            <p className="pt-5 text-sm leading-6 text-[var(--muted-ink)]">Drinking water and a refillable bottle are provided. International flights and other extras are covered in the budget estimate above.</p>
          </div>
        </div>
      </section>

      <section id="itinerary" tabIndex={-1} aria-labelledby="itinerary-title" className="mx-auto max-w-7xl scroll-mt-6 px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:gap-20">
          <div className="lg:self-start">
            <p className="eyebrow">The daily itinerary</p>
            <h2 id="itinerary-title" className="section-title">Picture your eight days in Vietnam.</h2>
            <p className="mt-5 mb-7 text-lg leading-8 text-[var(--muted-ink)]">Sizzling street food, palm-lined waterways, royal gardens and lantern-lit lanes. Open any day for its schedule and meals.</p>
            <DestinationSlideshow />
          </div>
          <div id="daily-schedule" className="scroll-mt-6 space-y-4">
            {detailedItinerary.map((day, index) => (
              <details key={day.day} className="group overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--sand)]">
                <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-5 sm:px-7 [&::-webkit-details-marker]:hidden">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--gold)] text-sm font-extrabold text-[var(--orange)]">{day.day}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif text-xl sm:text-2xl">{day.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-[var(--muted-ink)]">{itinerary[index][2]}</span>
                    <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--orange)]">{day.meals}</span>
                  </span>
                  <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-[var(--orange)] transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-[var(--line)] bg-white px-5 py-6 sm:px-7">
                  <ol className="space-y-6">
                    {day.events.map(([time, title, description]) => (
                      <li key={`${day.day}-${time}`} className="grid gap-2 sm:grid-cols-[10rem_1fr] sm:gap-6">
                        <p className="schedule-time text-sm text-[var(--orange)]">{time}</p>
                        <div>
                          <h3 className="font-bold text-[var(--ink)]">{title}</h3>
                          <p className="mt-1 leading-7 text-[var(--muted-ink)]">{description}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="scroll-mt-6 border-b border-[var(--line)] bg-white py-14 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[.65fr_1.35fr] lg:gap-16">
          <div className="relative mx-auto w-full max-w-sm pr-4">
            <div className="absolute bottom-0 right-0 top-4 w-[92%] rounded-[2rem] bg-[var(--gold)]" aria-hidden="true" />
            <img src="/about-trung.jpg" alt="Trung Le seated in front of the yellow Cookie Paradise bakery trailer" className="relative aspect-[4/5] w-full rounded-[2rem] object-cover object-center shadow-lg" width={960} height={1280} loading="lazy" />
          </div>
          <div>
            <p className="eyebrow">A local connection to Vietnam</p>
            <h2 className="section-title">Meet Trung, your Vietnam trip planner.</h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted-ink)]">Born in Vietnam and now based in Columbus, Indiana, Trung Le spent seven years living in Ho Chi Minh City. He is the founder of Cookie Paradise Travel Company and co-owner of the local Cookie Paradise bakery.</p>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted-ink)]">Trung created this itinerary to share the food, everyday life and places he knows. Your departure will be hosted by Trung or another carefully selected Cookie Paradise Travel Company host; ask who is planned for your trip.</p>
            <details className="mt-6 max-w-2xl rounded-2xl border border-[var(--line)] px-5 py-4">
              <summary className="cursor-pointer font-semibold">More about Trung</summary>
              <div className="mt-7 space-y-5 text-lg leading-8 text-[var(--muted-ink)]">
              <p>
                Born in 1989 in the mountains of Northern Vietnam’s Hoang Lien Son range, Trung came to French Lick, Indiana, as an exchange student in 2006. He attended Franklin College the following year, then moved to Columbus and worked for Cummins from 2011 to 2017.
              </p>
              <p>
                His family returned to Columbus after their years in Vietnam. Through food, stories and shared experiences, he continues to bring the two places he calls home together.
              </p>
            </div>

            </details>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-5xl scroll-mt-6 px-5 py-16 sm:px-8 sm:py-20">
        <p className="eyebrow">Before you book</p>
        <h2 className="section-title">Your practical questions, answered.</h2>
        <div className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {homepageFaqs.map(item => <details key={item.question} className="group py-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">{item.question}<ChevronDown aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 transition-transform group-open:rotate-180" /></summary>
            <p className="mt-4 max-w-4xl text-base leading-8 text-[var(--muted-ink)]">{item.answer}</p>
          </details>)}
        </div>
        <p className="mt-5 text-sm leading-6 text-[var(--muted-ink)]">Your personalized Traveler Agreement contains the complete booking terms.</p>
      </section>

      <section id="guide" className="border-y border-[var(--line)] bg-[var(--cream)] py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-start gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div><p className="eyebrow">Your next step</p><h2 className="section-title">Let’s plan your Vietnam trip.</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted-ink)]">Talk through your plans with Trung on a free 30-minute Google Meet, or take the itinerary with you and decide in your own time.</p>
            <div className="mt-6"><ConsultationLink /></div>
            <a href={tripGuideUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 items-center gap-2 font-semibold underline underline-offset-4">View the itinerary and pricing (PDF) <ArrowRight className="h-4 w-4" /></a>
            <p className="mt-6 text-base leading-7 text-[var(--muted-ink)]">Prefer to ask by email? Write to <a href="mailto:trung@cookieparadise.co" className="font-semibold underline">trung@cookieparadise.co</a>.</p>
            <JourneyPhoto photo="lanterns" className="story-guide-lanterns" sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 70vw" />
          </div>
          <TripGuideForm />
        </div>
      </section>

      <section aria-labelledby="private-travel-title" className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div><h2 id="private-travel-title" className="font-serif text-2xl">Prefer your own dates and itinerary?</h2><p className="mt-2 text-base leading-7 text-[var(--muted-ink)]">Plan a private Vietnam trip around your companions, pace and interests.</p></div>
          <a href="/fit" className="inline-flex min-h-12 shrink-0 items-center gap-2 font-semibold underline underline-offset-4">Explore private trips <ArrowRight className="h-4 w-4" /></a>
        </div>
      </section>

      <footer className="bg-[var(--navy)] px-5 pb-40 pt-10 text-white/65 sm:px-8 md:pb-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <BrandLogo footer surface="dark" />
            <p className="mt-3 text-sm">Small-group tours and private trips to Vietnam.</p>
          </div>
          <div className="text-sm sm:text-right"><p>cookieparadisetravel.com</p><p className="mt-2"><a className="underline hover:text-white" href="mailto:trung@cookieparadise.co">trung@cookieparadise.co</a></p><p className="mt-2"><a className="underline hover:text-white" href="/fit">Private Vietnam trips</a></p><p className="mt-2"><a className="underline hover:text-white" href="/vietnam-trip-planning">Vietnam trip planning guide</a></p><p className="mt-2"><a className="underline hover:text-white" href="/privacy">Privacy Policy</a></p><p className="mt-2">© 2026 Cookie Paradise Travel Company LLC</p></div>
        </div>
      </footer>
      <MobileBookBar availability={availability} />
    </main>
    </ReferralProvider>
  );
}
