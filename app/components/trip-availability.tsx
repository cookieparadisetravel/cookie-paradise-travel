import type { availabilitySummary } from "@/lib/trip-availability";

export type TripAvailabilityValue = ReturnType<typeof availabilitySummary> | null;

export function TripAvailability({ availability, label }: { availability: TripAvailabilityValue; label: string }) {
  return (
    <div className="mt-7 max-w-lg rounded-2xl border border-white/20 bg-black/20 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--gold)]">{label} departure</p>
      {availability ? <>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-bold text-white">{availability.booked} of {availability.capacity} spots booked</p>
          <p className="text-sm font-semibold text-[var(--gold)]">{availability.full ? "Fully booked" : `${availability.remaining} spots available`}</p>
        </div>
        <div role="progressbar" aria-label="Guest spots booked" aria-valuemin={0} aria-valuemax={availability.capacity} aria-valuenow={Math.min(availability.booked, availability.capacity)} className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${Math.min(100, availability.booked / availability.capacity * 100)}%` }} />
        </div>
        <p className="mt-3 text-sm text-white/80">Minimum 4, maximum 8 guests, plus your host.</p>
      </> : <p className="mt-2 text-sm text-white/80">Contact us for current availability.</p>}
    </div>
  );
}
