// Planning allowances, not supplier quotes. See docs/trip-budget-2026-11-16.md.
export const tripBudget = [
  { label: "Eight-day tour", low: 2875, high: 2875, note: "Per person sharing a room, at eight travelers. Includes seven hotel nights, scheduled transport, activities, the flight to Hue and listed meals." },
  { label: "Round-trip economy flights", low: 1500, high: 2000, note: "Indianapolis (IND)–Ho Chi Minh City (SGN), including an allowance for airfare taxes. Exact travel-date fares have not been quoted." },
  { label: "Da Nang → Ho Chi Minh City flight", low: 100, high: 180, note: "One-way return connection after the tour, with taxes and a checked-bag allowance. The tour ends near Da Nang." },
  { label: "One extra night & airport transfers", low: 100, high: 180, note: "Allowance for an overnight in Ho Chi Minh City before flying home, plus transfers outside the tour." },
  { label: "Travel insurance", low: 200, high: 500, note: "Allowance for trip protection with medical and evacuation benefits. Your age, insured cost and coverage determine the premium; some quotes will be higher." },
  { label: "Vietnam single-entry e-visa", low: 25, high: 25, note: "Government application fee for an eligible traveler applying directly. Multiple-entry visas cost $50." },
  { label: "Extra meals, drinks & travel-day food", low: 150, high: 200, note: "For meals outside the itinerary, snacks and modest drinks, including international travel days." },
  { label: "Tips", low: 40, high: 60, note: "Shared guides and drivers, boats, porters and included meals. Tips are optional and based on service." },
  { label: "International baggage & seat fees", low: 0, high: 150, note: "An allowance if your chosen fare charges extra. Standard economy seats only; no cabin upgrades." },
  { label: "Getting to IND & parking", low: 120, high: 160, note: "Self-drive allowance for fuel and economy parking. Sharing a car or getting a ride may reduce this; private car services may cost more." },
  { label: "Mobile data", low: 10, high: 25, note: "A local SIM or eSIM allowance for a compatible, unlocked phone." },
  { label: "Personal spending & small extras", low: 100, high: 200, note: "A modest allowance for souvenirs, laundry, local rides or an optional activity, including incidental card or ATM fees." },
] as const;

export const tripBudgetTotal = tripBudget.reduce(
  (total, item) => ({ low: total.low + item.low, high: total.high + item.high }),
  { low: 0, high: 0 },
);

export const budgetDollars = (amount: number) => "$" + amount.toLocaleString("en-US");
export const budgetRange = (low: number, high: number) => low === high
  ? budgetDollars(low)
  : `${budgetDollars(low)}–${budgetDollars(high)}`;

export const roundedTripBudget = budgetRange(
  Math.floor(tripBudgetTotal.low / 100) * 100,
  Math.ceil(tripBudgetTotal.high / 100) * 100,
);
