// Rounded planning allowances, not supplier quotes or booking prices.
// See docs/trip-budget-multi-city-2026-11-16.md.
export const tripBudget = [
  { label: "Eight-day tour · rounded", low: 2900, high: 2900, note: "Rounded for planning. The actual tour price is $2,875 per person sharing a room, with a minimum of 4 and maximum of 8 guests. Includes seven hotel nights, scheduled transport, activities, the flight to Hue, listed meals and Vietnam visa." },
  { label: "Multi-city economy flights", low: 1500, high: 2200, note: "Both international journeys: Indianapolis (IND) to Ho Chi Minh City (SGN), then Da Nang (DAD) to Indianapolis, including an allowance for airfare taxes." },
  { label: "Travel insurance", low: 200, high: 500, note: "Allowance for trip protection with medical and evacuation benefits." },
  { label: "Extra meals, drinks & travel-day food", low: 200, high: 200, note: "Rounded allowance for meals outside the itinerary, snacks and modest drinks, including international travel days." },
  { label: "Tips & mobile data", low: 100, high: 100, note: "Combined, rounded allowance for discretionary guide/driver and service tips, and a local SIM or eSIM for a compatible phone." },
  { label: "Bags, seats & getting to IND", low: 100, high: 300, note: "Combined, rounded allowance for extra economy baggage/seat fees, fuel and airport economy parking." },
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

export const roundedTripBudget = budgetRange(tripBudgetTotal.low, tripBudgetTotal.high);
export const suggestedTripBudget = budgetDollars(Math.round((tripBudgetTotal.low + tripBudgetTotal.high) / 2 / 100) * 100);
