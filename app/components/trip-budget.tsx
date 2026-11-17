import { ChevronDown } from "lucide-react";
import { budgetDollars, budgetRange, roundedTripBudget, suggestedTripBudget, tripBudget, tripBudgetTotal } from "@/lib/trip-budget";

export function TripBudget() {
  const tour = tripBudget[0];
  const flights = tripBudget[1];
  const extras = {
    low: tripBudgetTotal.low - tour.low - flights.low,
    high: tripBudgetTotal.high - tour.high - flights.high,
  };

  return (
    <div className="trip-budget mx-auto mt-12 max-w-7xl px-5 sm:px-8">
      <div className="rounded-[2rem] border border-black/15 bg-white p-6 sm:p-9">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.1em]">Plan for the whole trip</p>
            <h3 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">Your total budget from Indianapolis</h3>
            <p className="mt-5 text-[clamp(2rem,5vw,3rem)] font-bold leading-tight">{roundedTripBudget}</p>
            <p className="mt-2 text-base leading-7">Estimated per person · Shared room · 4–8 guests</p>
            <p className="mt-4 text-base leading-7">About <strong>{suggestedTripBudget} per person</strong> is a useful starting budget for the tour, economy flights and everyday travel expenses.</p>
          </div>
          <div>
            <dl className="divide-y divide-black/15 text-base">
              {[
                ["Tour package · rounded", budgetDollars(tour.low)],
                ["Multi-city economy airfare", budgetRange(flights.low, flights.high)],
                ["Other travel costs & allowances", budgetRange(extras.low, extras.high)],
              ].map(([label, value]) => <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 py-4"><dt>{label}</dt><dd className="font-bold tabular-nums">{value}</dd></div>)}
            </dl>
            <p className="mt-4 text-base leading-7"><strong>Fly into Ho Chi Minh City. Fly home from Da Nang.</strong> The flight allowance covers both international journeys, with airline connections along the way.</p>
            <p className="mt-3 text-base leading-7">Your transfer from Hoi An to Da Nang airport is included in the tour. This budget assumes no separate return trip to Ho Chi Minh City or extra hotel night.</p>
          </div>
        </div>

        <details className="group mt-7 border-t border-black/15 pt-5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-base font-bold [&::-webkit-details-marker]:hidden">See the full budget breakdown<ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" /></summary>
          <dl className="mt-4 divide-y divide-black/10">
            {tripBudget.map(item => <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-4"><dt className="text-base font-semibold">{item.label}</dt><dd className="text-base font-bold tabular-nums">{budgetRange(item.low, item.high)}</dd><dd className="col-span-2 max-w-3xl text-sm leading-6">{item.note}</dd></div>)}
            <div className="flex flex-wrap items-baseline justify-between gap-3 pt-5 text-lg font-bold"><dt>Estimated total · rounded</dt><dd className="tabular-nums">{roundedTripBudget}</dd></div>
          </dl>
          <p className="mt-3 text-sm leading-6">Budget about $400 more for a private room, subject to availability. The shared-room tour price stays $2,875 per person for groups of 4–8 guests. Premium upgrades, airport fast-track service, passport fees, individual medical costs and spending beyond these allowances require an additional budget.</p>
        </details>

        <details className="group mt-5 border-t border-black/15 pt-5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold [&::-webkit-details-marker]:hidden">How we estimated it<ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" /></summary>
          <div className="mt-3 space-y-3 text-sm leading-6">
            <p>Researched November 16, 2026 for the June 1–8, 2027 tour. The flight plan is arrival in Ho Chi Minh City on June 1 and departure from Da Nang on June 8. Your U.S. departure and arrival dates depend on the airline schedule.</p>
            <p><a href="https://www.travelocity.com/lp/flights/ind/dad/indianapolis-intl-to-da-nang-intl-airport" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Public Indianapolis–Da Nang fare listings</a> included June economy round trips around $1,400 on other dates. <a href="https://www.kayak.com/flight-routes/Indianapolis-IND/Ho-Chi-Minh-City-SGN" target="_blank" rel="noopener noreferrer" className="font-semibold underline">KAYAK’s Ho Chi Minh City route data</a> showed a historical June round-trip benchmark around $1,500. These are reference points, not quotes for our mixed-airport itinerary.</p>
            <p>Our $1,500–$2,200 multi-city flight allowance leaves room for different dates and routing. No bookable fare for the exact itinerary has been verified. Compare the complete fare, baggage, arrival time and connections before purchasing; a schedule requiring extra nights needs an additional allowance.</p>
            <p>Other allowances draw on <a href="https://www.sevencorners.com/blog/travel-insurance-advice/what-is-travel-insurance" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Seven Corners’ insurance guidance</a>, <a href="https://evisa.gov.vn/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">official visa fees</a>, <a href="https://vietnam.travel/things-to-do/currency-and-payments-vietnam/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Vietnam Tourism’s local prices</a> and <a href="https://www.ind.com/parking/economy-lot" target="_blank" rel="noopener noreferrer" className="font-semibold underline">IND economy parking</a>. Insurance depends on age and coverage. Actual expenses may fall outside these ranges.</p>
          </div>
        </details>
        <p className="mt-5 text-sm leading-6">USD planning estimates rounded to hundreds, including the tour allowance. Exact tour prices are listed above. Flights and extras are paid separately; this is not an all-inclusive package price. Review flight plans with Trung before booking.</p>
      </div>
    </div>
  );
}
