import type { availabilitySummary } from "@/lib/trip-availability";

export type TripAvailabilityValue = ReturnType<typeof availabilitySummary> | null;

export function TripAvailability({ availability, label }: { availability: TripAvailabilityValue; label: string }) {
  return (
    <div className="mt-7 max-w-lg rounded-2xl border border-white/20 bg-black/20 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--gold)]">{label} departure</p>
      {availability ? <>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-bold text-white">{availability.booked} of {availability.tierTarget} spots booked</p>
          <p className="text-sm font-semibold text-[var(--gold)]">{availability.full ? "Fully booked" : "Group pricing milestone"}</p>
        </div>
        <div role="progressbar" aria-label="Bookings toward the next group pricing tier" aria-valuemin={0} aria-valuemax={availability.tierTarget} aria-valuenow={Math.min(availability.booked, availability.tierTarget)} className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${Math.min(100, availability.booked / availability.tierTarget * 100)}%` }} />
        </div>
      </> : <p className="mt-2 text-sm text-white/80">Contact us for current availability.</p>}
    </div>
  );
}
