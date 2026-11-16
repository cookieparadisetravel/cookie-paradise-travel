import { ChevronDown } from "lucide-react";
import { budgetDollars, budgetRange, roundedTripBudget, tripBudget, tripBudgetTotal } from "@/lib/trip-budget";

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
            <p className="mt-2 text-base leading-7">Estimated per person · Shared room · Eight travelers</p>
            <p className="mt-4 text-base leading-7">About <strong>$6,000 per person</strong> is a useful starting budget for the tour, economy flights and everyday travel expenses.</p>
          </div>
          <div>
            <dl className="divide-y divide-black/15 text-base">
              {[
                ["Tour package", budgetDollars(tour.low)],
                ["Round-trip economy airfare", budgetRange(flights.low, flights.high)],
                ["Other travel costs & allowances", budgetRange(extras.low, extras.high)],
              ].map(([label, value]) => <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 py-4"><dt>{label}</dt><dd className="font-bold tabular-nums">{value}</dd></div>)}
            </dl>
            <p className="mt-4 text-base leading-7"><strong>The tour ends near Da Nang.</strong> This budget includes a flight back to Ho Chi Minh City and one extra night before your international flight home.</p>
            <p className="mt-3 text-base leading-7">We can also compare flying into Ho Chi Minh City and home from Da Nang, which may avoid that extra flight and overnight.</p>
          </div>
        </div>

        <details className="group mt-7 border-t border-black/15 pt-5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-base font-bold [&::-webkit-details-marker]:hidden">See the full budget breakdown<ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" /></summary>
          <dl className="mt-4 divide-y divide-black/10">
            {tripBudget.map(item => <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 py-4"><dt className="text-base font-semibold">{item.label}</dt><dd className="text-base font-bold tabular-nums">{budgetRange(item.low, item.high)}</dd><dd className="col-span-2 max-w-3xl text-sm leading-6">{item.note}</dd></div>)}
            <div className="flex flex-wrap items-baseline justify-between gap-3 pt-5 text-lg font-bold"><dt>Estimated total before rounding</dt><dd className="tabular-nums">{budgetRange(tripBudgetTotal.low, tripBudgetTotal.high)}</dd></div>
          </dl>
          <p className="mt-5 text-sm leading-6">The tour already covers seven hotel nights, seven breakfasts, five lunches, three dinners, scheduled transfers, activities and the Ho Chi Minh City–Hue flight. These are not charged again in the extras.</p>
          <p className="mt-3 text-sm leading-6">A private room adds $399 to the tour price, subject to availability. The tour component can fall by $375 if the 15-traveler price tier is reached. Personal shopping, premium upgrades, airport fast-track service, passport fees and any individual medical costs beyond these allowances require an additional budget.</p>
        </details>

        <details className="group mt-5 border-t border-black/15 pt-5">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold [&::-webkit-details-marker]:hidden">How we estimated it<ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" /></summary>
          <div className="mt-3 space-y-3 text-sm leading-6">
            <p>Researched November 16, 2026 for the June 1–8, 2027 tour. Plan to arrive in Ho Chi Minh City on June 1; this round-trip example allows an overnight there on June 8 and an international departure on June 9. Your U.S. departure date depends on the flight schedule.</p>
            <p><a href="https://www.kayak.com/flight-routes/Indianapolis-IND/Ho-Chi-Minh-City-SGN" target="_blank" rel="noopener noreferrer" className="font-semibold underline">KAYAK’s route data</a> showed a historical June round-trip benchmark of $1,461. We allow $1,500–$2,000 for economy flights. This is a planning range, not a verified fare for our exact dates. Compare the final price, baggage and connections before purchasing.</p>
            <p>We checked <a href="https://www.vietnamairlines.com/en-vn/flights-from-da-nang-to-ho-chi-minh-city" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Vietnam Airlines’ Da Nang route</a>, <a href="https://www.sevencorners.com/blog/travel-insurance-advice/what-is-travel-insurance" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Seven Corners’ insurance guidance</a>, <a href="https://evisa.gov.vn/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">official visa fees</a>, <a href="https://vietnam.travel/things-to-do/currency-and-payments-vietnam/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Vietnam Tourism’s local prices</a> and <a href="https://www.ind.com/parking/economy-lot" target="_blank" rel="noopener noreferrer" className="font-semibold underline">IND economy parking</a>. Hotel, meals, phone and personal-spending amounts are planning allowances, not supplier quotes.</p>
            <p>Insurance commonly costs about 4–10% of insured trip costs, with age and coverage affecting the quote. Parking is currently $9 per day per car; our allowance also includes fuel. Actual expenses may fall outside these ranges.</p>
          </div>
        </details>
        <p className="mt-5 text-sm leading-6">USD planning estimate, not an all-inclusive package price. Flights and other extras are paid separately. Review flight plans with Trung before booking.</p>
      </div>
    </div>
  );
}
