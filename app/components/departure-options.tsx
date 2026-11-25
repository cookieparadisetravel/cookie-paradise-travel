import { formatUsd, summerMealSummary, vietnamDepartures } from "@/lib/trip-availability";
import { getFinalPaymentDeadline } from "@/lib/payment-schedule";
import { BookingDialog } from "./booking-dialog";
import type { TripAvailabilityValue } from "./trip-availability";

const dateLabel = (value: string) => new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
  month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
});

export function DepartureOptions({ availabilities }: { availabilities: TripAvailabilityValue[] }) {
  return <section aria-labelledby="departure-options-title" className="mx-auto mt-12 max-w-7xl px-5 sm:px-8">
    <h3 id="departure-options-title" className="font-serif text-3xl sm:text-4xl">Choose your departure.</h3>
    <p className="mt-3 max-w-3xl text-base leading-7">Choose from six summer departures or our year-end trip.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {vietnamDepartures.map((item, index) => {
        const availability = availabilities[index];
        // A fixed date before bookings opened keeps this display independent of today.
        const deadline = getFinalPaymentDeadline(item.departure, "2026-11-24");
        return <article key={item.departure} className="flex flex-col rounded-2xl border border-black/15 bg-white p-5 sm:p-6">
          <h4 className="text-lg font-bold leading-7">{item.dateRange}</h4>
          <p className="mt-3 text-base font-semibold">{formatUsd(item.sharedRoomUsd)} per person</p>
          <p className="text-sm leading-6">{item.allMealsIncluded ? "Every meal included" : summerMealSummary}</p>
          <p className="mt-3 text-base font-semibold text-[#805018]">{availability
            ? availability.full ? "Fully booked" : `${availability.remaining} ${availability.remaining === 1 ? "seat" : "seats"} available`
            : "Contact Trung for current availability"}</p>
          <div className="mt-3">
            <div
              role="progressbar"
              aria-label={`${item.dateRange}: guest seats booked`}
              aria-valuemin={0}
              aria-valuemax={item.capacity}
              aria-valuenow={availability ? Math.min(availability.booked, item.capacity) : undefined}
              aria-valuetext={availability ? `${availability.booked} of ${item.capacity} seats booked` : "Current availability unavailable"}
              className="h-2.5 overflow-hidden rounded-full bg-[#e9e3d8]"
            >
              {availability && <div className="h-full rounded-full bg-[#b47a26]" style={{ width: `${Math.min(100, availability.booked / item.capacity * 100)}%` }} />}
            </div>
          </div>
          <p className="mb-5 mt-2 text-sm leading-6">Final payment due {dateLabel(deadline)}.</p>
          <div className="mt-auto"><BookingDialog triggerLabel={availability?.full ? "Ask about the waitlist" : `Request ${item.label.replace(", 2027", "")}`} compact initialTrip={{ departure: item.departure, room: "shared", partySize: 1 }} /></div>
        </article>;
      })}
    </div>
  </section>;
}
