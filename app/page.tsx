import {
  ArrowRight, Calendar, Check, ChevronDown, Clock3, Compass, MapPin, Plane,
  ShieldCheck, Sparkles, Tag, Users, Utensils,
} from "lucide-react";
import { BookingDialog } from "./components/booking-dialog";
import { MobileBookBar } from "./components/mobile-book-bar";

const itinerary = [
  ["01", "Arrive in Ho Chi Minh City", "A private airport welcome, hotel transfer and an easy first evening to settle in."],
  ["02", "The many sides of Saigon", "Morning life in Tao Dan Park, city icons, markets and a vintage-Jeep food adventure after dark."],
  ["03", "Mekong Delta life", "Floating communities, sampan waterways, village paths, family workshops and a home-hosted lunch."],
  ["04", "Fly to Huế", "Imperial Citadel, Thiên Mụ Pagoda and a private sunset cruise on the Perfume River."],
  ["05", "Gardens, tombs & royal dinner", "Thả Om Garden House, the royal tombs of Tự Đức and Khải Định, then dinner with traditional music."],
  ["06", "Huế to Hội An", "The Hải Vân Pass, lantern making, old-town heritage and basket boats."],
  ["07", "Hội An culinary challenge", "Herb-farm games, hands-on cooking, a free afternoon, an optional massage and a celebratory farewell dinner."],
  ["08", "Depart Hội An", "Breakfast and a private transfer to Đà Nẵng International Airport for your onward flight."],
];

const pricing = [
  ["8 travelers", "$2,875"],
  ["10 travelers", "$2,675"],
  ["12 travelers", "$2,605"],
  ["15 travelers", "$2,500"],
];

const detailedItinerary = [
  {
    day: "01", title: "Arrive in Ho Chi Minh City", meals: "Meals: none",
    events: [
      ["On arrival", "Airport welcome", "Meet your local representative at Tân Sơn Nhất International Airport and transfer privately to the hotel, approximately 30 minutes."],
      ["From 2:00 PM", "Hotel check-in", "Settle into the Paragon Saigon Hotel, Premier Sakura room, or a comparable property."],
      ["Rest of day", "At leisure", "Unpack, rest and explore nearby at your own pace."],
    ],
  },
  {
    day: "02", title: "The many sides of Saigon", meals: "Meals: Breakfast, Dinner",
    events: [
      ["6:30–9:30 AM", "Good Morning Saigon", "Tao Đàn Park and its bird café, a century-old private house and temple, a local breakfast and a neighborhood wet market."],
      ["1:00–5:00 PM", "Central Saigon", "City Hall, Đồng Khởi Street, the Continental Hotel, Opera House, Central Post Office, the former CIA building, 30 April Park, Reunification Palace and Bến Thành Market."],
      ["6:30–10:30 PM", "Saigon after dark", "Travel by vintage Jeep for local food stops, the flower market and street snacks, finishing with a rooftop drink."],
    ],
  },
  {
    day: "03", title: "Mekong Delta life", meals: "Meals: Breakfast, Lunch",
    events: [
      ["8:00 AM–5:00 PM", "Waterways, farms and a shared table", "Travel about two hours to the delta. Visit the Tân Mỹ floating community and a working fish farm, continue by sampan, explore village paths by bicycle or buggy, meet local producers and share a home-hosted lunch before returning to Saigon."],
    ],
  },
  {
    day: "04", title: "Fly to Huế", meals: "Meals: Breakfast, Lunch",
    events: [
      ["Morning", "Airport transfer", "Transfer from the hotel to Tân Sơn Nhất Airport."],
      ["11:05 AM–12:25 PM", "Flight to Huế", "Planned Vietnam Airlines flight VN1370. The airline may change the schedule."],
      ["2:30–6:00 PM", "Imperial Huế", "Explore the Imperial Citadel and restored Kiến Trung Palace, followed by Thiên Mụ Pagoda."],
      ["About 5:00 PM", "Perfume River sunset", "Board a private river cruise with a cocktail and canapés."],
    ],
  },
  {
    day: "05", title: "Gardens, royal tombs and royal dinner", meals: "Meals: Breakfast, Lunch, Dinner",
    events: [
      ["10:30 AM–1:00 PM", "Thả Om Garden House", "Enjoy Huế cakes and tea in the garden house, followed by lunch."],
      ["1:00–5:00 PM", "Tombs of the emperors", "Explore the contrasting royal tombs of Tự Đức and Khải Định."],
      ["Evening", "Royal dinner", "Enjoy a multi-course dinner with live traditional music and the opportunity to wear royal-style robes."],
    ],
  },
  {
    day: "06", title: "Huế to Hội An", meals: "Meals: Breakfast, Lunch",
    events: [
      ["9:00 AM", "Cross the Hải Vân Pass", "Depart Huế for the scenic drive toward Đà Nẵng and Hội An, with lunch en route."],
      ["1:00–5:00 PM", "Lanterns, lanes and basket boats", "Make a traditional lantern, explore Hội An old town and continue to Cẩm Thanh coconut village for a basket-boat experience."],
      ["Evening", "Check in at Almanity", "Deluxe Pool View room at Almanity Hội An Resort & Spa, or a comparable property."],
    ],
  },
  {
    day: "07", title: "Hội An culinary challenge", meals: "Meals: Breakfast, Lunch, Dinner",
    events: [
      ["8:30 AM–1:00 PM", "Farm-to-table challenge", "Take on a herb hunt, spring-roll showdown, Vietnamese rice-pancake challenge and mystery-box juice creation, followed by lunch."],
      ["Afternoon", "Free time", "Relax at the resort or explore Hội An independently."],
      ["During free time", "Optional 60-minute massage", "A body massage at Almanity is available as an optional add-on. Participation is not required, and timing is arranged separately."],
      ["7:00 PM", "Farewell dinner", "Gather for a celebratory dinner with one glass of house wine."],
    ],
  },
  {
    day: "08", title: "Depart Hội An", meals: "Meals: Breakfast",
    events: [
      ["Morning", "Breakfast", "Enjoy breakfast at the hotel and prepare for departure."],
      ["Before 12:00 PM", "Check out and airport transfer", "Transfer privately to Đà Nẵng International Airport according to your onward flight schedule."],
    ],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--sand)] text-[var(--ink)]">
      <header className="absolute inset-x-0 top-0 z-20 border-b border-white/20 text-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-3 sm:px-8">
          <a href="#top" className="group flex min-w-0 items-center gap-2 sm:gap-3" aria-label="Cookie Paradise Travel Company home">
            <img
              src="/cookie-paradise-logo.png"
              alt="Cookie Paradise"
              className="h-5 w-auto max-w-[5.8rem] rounded-sm shadow-sm sm:h-7 sm:max-w-none lg:h-8"
            />
            <span className="block shrink-0 border-l border-white/30 pl-2 text-[0.625rem] font-bold uppercase leading-3 tracking-[0.12em] text-white/85 sm:pl-3 sm:text-[0.66rem] sm:leading-4 sm:tracking-[0.2em]">
              Travel<br />Company
            </span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-semibold md:flex" aria-label="Main navigation">
            <a className="hover:text-[var(--gold)]" href="#journey">Journey</a>
            <a className="hover:text-[var(--gold)]" href="#about">About Trung</a>
            <a className="hover:text-[var(--gold)]" href="#pricing">Pricing</a>
            <a className="hover:text-[var(--gold)]" href="#included">What’s included</a>
          </nav>
          <BookingDialog triggerLabel="Request a spot" compact />
        </div>
      </header>

      <section id="top" className="relative isolate min-h-[760px] overflow-hidden bg-[var(--navy)] text-white">
        <img
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-50"
          src="/hoi-an-hero.webp"
          alt="Historic yellow buildings and lanterns in Hội An Ancient Town"
          width={1536}
          height={1024}
          fetchPriority="high"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(36,21,10,.96)_0%,rgba(45,29,16,.76)_50%,rgba(45,29,16,.22)_100%)]" />
        <div className="mx-auto flex min-h-[760px] max-w-7xl items-end px-5 pb-16 pt-36 sm:px-8 sm:pb-24">
          <div className="max-w-3xl">
            <p className="mb-5 flex items-center gap-2 whitespace-nowrap text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--gold)] sm:gap-3 sm:text-sm sm:tracking-[0.28em]">
              <span className="h-px w-10 bg-[var(--gold)]" /> Small-group Vietnam • 2027
            </p>
            <h1 className="max-w-3xl font-serif text-5xl leading-[0.96] tracking-[-0.045em] sm:text-7xl lg:text-[5.8rem]">
              Discover Southern Vietnam
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/80 sm:text-xl">
              Eight thoughtfully paced days from Saigon and the Mekong to imperial Huế and lantern-lit Hội An, personally hosted by Trung Le.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <BookingDialog triggerLabel="Request your spot" />
              <a href="#journey" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/35 px-6 text-sm font-bold transition hover:bg-white/10">
                Explore the journey <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4 text-sm text-white/75">
              <span className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[var(--gold)]" /> 8 days / 7 nights</span>
              <span className="flex items-center gap-2"><Users className="h-4 w-4 text-[var(--gold)]" /> 8–15 travelers</span>
              <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[var(--gold)]" /> Saigon to Hội An</span>
              <span className="flex items-center gap-2 font-semibold text-white"><Tag className="h-4 w-4 text-[var(--gold)]" /> From $2,500–$2,875 per person</span>
              <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-[var(--gold)]" /> Departs June 1, 2027</span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-[var(--line)] md:grid-cols-4">
          {[
            ["Hosted, not herded", "A personal group of no more than 15"],
            ["Made for connection", "Local homes, markets and makers"],
            ["Comfort built in", "Private transport and boutique hotels"],
            ["More than sightseeing", "Food, crafts, stories and shared tables"],
          ].map(([title, text]) => (
            <div key={title} className="bg-white px-5 py-7 sm:px-8">
              <h2 className="font-serif text-xl">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="journey" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr] lg:gap-20">
          <div className="lg:sticky lg:top-10 lg:self-start">
            <p className="eyebrow">The journey</p>
            <h2 className="section-title">A story of Southern Vietnam</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--muted-ink)]">
              Each day balances memorable experiences with room to breathe. You’ll meet the country through its food, families, landscapes and layered history—not from a bus window.
            </p>
            <a href="#daily-schedule" className="mt-7 inline-flex items-center gap-2 font-bold text-[var(--orange)] underline decoration-[var(--gold)] decoration-2 underline-offset-4">
              See the detailed daily schedule <ArrowRight className="h-4 w-4" />
            </a>
            <div className="mt-8 rounded-3xl bg-[var(--navy)] p-7 text-white">
              <Compass className="h-8 w-8 text-[var(--gold)]" />
              <p className="mt-5 font-serif text-2xl">Thoughtfully hosted</p>
              <p className="mt-3 leading-7 text-white/70">Each departure is hosted by Trung or another carefully selected Cookie Paradise Travel Company host, supported by experienced local guides.</p>
            </div>
          </div>
          <div id="daily-schedule" className="scroll-mt-6 space-y-4">
            {detailedItinerary.map((day, index) => (
              <details key={day.day} open={index === 0} className="group overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--sand)]">
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

      <section id="about" className="border-y border-[var(--line)] bg-white py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-20">
          <div className="relative">
            <div className="absolute -bottom-4 -right-4 h-full w-full rounded-[2rem] bg-[var(--gold)] sm:-bottom-6 sm:-right-6" aria-hidden="true" />
            <img
              src="/about-trung.jpg"
              alt="Trung Le seated in front of the yellow Cookie Paradise bakery trailer"
              className="relative aspect-[4/5] w-full rounded-[2rem] object-cover object-center shadow-xl"
              width={960}
              height={1280}
              loading="lazy"
            />
          </div>
          <div>
            <p className="eyebrow">Meet the founder</p>
            <h2 className="section-title">About Trung</h2>
            <div className="mt-7 space-y-5 text-lg leading-8 text-[var(--muted-ink)]">
              <p>
                Trung Le is the founder of Cookie Paradise Travel Company and the co-owner of Cookie Paradise, the Columbus cottage bakery known for its generous cookies and warm hospitality. For him, travel is an extension of that same idea: bringing people together through food, stories and experiences that feel personal.
              </p>
              <p>
                Born in 1989 in the mountains of Northern Vietnam’s Hoàng Liên Sơn range, Trung came to French Lick, Indiana, as an exchange student in 2006. He attended Franklin College the following year, then moved to Columbus and worked for Cummins from 2011 to 2017.
              </p>
              <p>
                In 2017, Trung returned to Vietnam and spent seven years living in Ho Chi Minh City before relocating his family back to Columbus. He loves both Vietnam and the United States and remains deeply connected to each. These journeys are his way of sharing the Vietnam he knows—not simply as a destination, but as a place of family, flavor, resilience and welcome.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3" aria-label="Trung's connections to Vietnam and Indiana">
              <span className="rounded-full bg-[var(--cream)] px-4 py-2 text-sm font-bold text-[var(--ink)]">Born in Northern Vietnam</span>
              <span className="rounded-full bg-[var(--cream)] px-4 py-2 text-sm font-bold text-[var(--ink)]">Columbus, Indiana home</span>
              <span className="rounded-full bg-[var(--cream)] px-4 py-2 text-sm font-bold text-[var(--ink)]">Cookie Paradise co-founder</span>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-[var(--navy)] py-20 text-white sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="eyebrow" style={{ color: "var(--gold)" }}>Small group, shared value</p>
            <h2 className="section-title text-white">The price comes down as the group grows.</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">
              Your booking begins at the eight-traveler price. When the confirmed group reaches a lower-price tier, the difference is applied to your remaining balance or returned if you have already paid in full.
            </p>
            <div className="mt-7 flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 p-5 text-sm leading-6 text-white/75">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />
              <span>Requesting a spot is free. No payment is collected until Trung confirms your departure.</span>
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-white/15 bg-white/5">
            {pricing.map(([group, price], index) => (
              <div key={group} className={"flex items-end justify-between gap-4 px-6 py-6 sm:px-9 " + (index ? "border-t border-white/10" : "")}>
                <div><p className="text-sm text-white/55">Confirmed group</p><p className="mt-1 font-semibold">{group}</p></div>
                <p className="font-serif text-3xl text-[var(--gold)] sm:text-4xl">{price}<span className="ml-1 font-sans text-xs text-white/50">/ person</span></p>
              </div>
            ))}
            <div className="border-t border-white/10 bg-white/5 px-6 py-5 text-sm text-white/70 sm:px-9">
              Private-room supplement: <strong className="text-white">$399</strong> per traveler. International airfare is not included.
            </div>
          </div>
        </div>
      </section>

      <section id="included" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="max-w-3xl">
          <p className="eyebrow">Included in your trip</p>
          <h2 className="section-title">The essentials—and the experiences you’ll remember.</h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [Plane, "Hotels & transport", "Seven hotel nights, daily breakfast, private ground transportation, scheduled airport transfers and the domestic flight to Huế."],
            [Utensils, "Meals & local flavor", "Meals marked in the itinerary, a home-hosted Mekong lunch, Huế royal dinner and Hội An farewell dinner."],
            [Sparkles, "Signature experiences", "Saigon by vintage Jeep, Perfume River sunset cruise, lantern workshop, basket boat and culinary challenge."],
            [Users, "Guides & admissions", "English-speaking local guides, entrance fees and the scheduled activities described in the itinerary."],
            [Check, "Thoughtful details", "Refillable water bottle, purified drinking water, private boats and carefully paced days."],
            [MapPin, "Three distinct regions", "Ho Chi Minh City and the Mekong Delta, imperial Huế, and the living heritage of Hội An."],
          ].map(([Icon, title, text]) => {
            const CardIcon = Icon as typeof Plane;
            return (
              <article key={title as string} className="rounded-3xl border border-[var(--line)] bg-white p-7">
                <CardIcon className="h-7 w-7 text-[var(--orange)]" />
                <h3 className="mt-6 font-serif text-2xl">{title as string}</h3>
                <p className="mt-3 leading-7 text-[var(--muted-ink)]">{text as string}</p>
              </article>
            );
          })}
        </div>
        <div className="mt-10 grid gap-6 rounded-3xl border border-[var(--line)] bg-[var(--cream)] p-7 sm:grid-cols-2 sm:p-9">
          <div><h3 className="font-serif text-2xl">Not included</h3><p className="mt-3 leading-7 text-[var(--muted-ink)]">International flights, travel insurance, Vietnam visa, personal expenses, gratuities, airport fast-track assistance and anything not specifically listed.</p></div>
          <div><h3 className="font-serif text-2xl">A note about plans</h3><p className="mt-3 leading-7 text-[var(--muted-ink)]">Hotels, flight times, activities and routing may change because of local conditions or supplier requirements. Comparable arrangements will be used when practical.</p></div>
        </div>
      </section>

      <section className="mx-4 mb-4 overflow-hidden rounded-[2rem] bg-[var(--gold)] text-[var(--orange)] sm:mx-6 sm:mb-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-7 px-6 py-14 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--orange)]/70">Limited to 15 travelers</p><h2 className="mt-3 max-w-3xl font-serif text-4xl leading-tight sm:text-5xl">Come experience the Vietnam we can’t wait to share.</h2></div>
          <BookingDialog triggerLabel="Request your spot" inverse />
        </div>
      </section>

      <footer className="bg-[var(--navy)] px-5 pb-28 pt-10 text-white/65 sm:px-8 md:pb-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <img
              src="/cookie-paradise-logo.png"
              alt="Cookie Paradise"
              className="h-auto w-full max-w-[18rem] rounded-sm"
            />
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.22em] text-[var(--gold)]">Travel Company</p>
            <p className="mt-3 text-sm">Hosted small-group journeys from Columbus, Indiana.</p>
          </div>
          <div className="text-sm sm:text-right"><p>cookieparadisetravel.com</p><p className="mt-2"><a className="underline hover:text-white" href="/privacy">Privacy Policy</a></p><p className="mt-2">© 2026 Cookie Paradise Travel Company LLC</p></div>
        </div>
      </footer>
      <MobileBookBar />
    </main>
  );
}
