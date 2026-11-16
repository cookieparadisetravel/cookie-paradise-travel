import { travelDisclosures as d } from "@/lib/travel-disclosures";

export function TravelDisclosures({ includeRefund = true }: { includeRefund?: boolean }) {
  return <section aria-label="Travel booking disclosures" className="mt-6 rounded-2xl border border-black/20 bg-white p-5 text-black sm:p-6">
    <h2 className="text-xl font-bold">Before you pay</h2>
    <p className="mt-3 leading-7"><strong>{d.company}</strong><br />{d.address}<br /><a className="underline" href="tel:+18125089675">{d.phone}</a> · <a className="break-words underline" href={`mailto:${d.email}`}>{d.email}</a></p>
    <p className="mt-4 leading-7">California Seller of Travel Registration number <strong>{d.registration}</strong> · {d.validity.replace("Registration valid", "Valid")}</p>
    <p className="mt-2 leading-7">{d.approval}</p>
    <p className="mt-4 leading-7"><strong>Protection of your payments.</strong> {d.trust}</p>
    <p className="mt-4 font-semibold leading-7">{d.restitution}</p>
    {includeRefund && <p className="mt-4 leading-7"><strong>Your refund rights.</strong> {d.refund}</p>}
    <p className="mt-4 leading-7">Review your personalized itinerary, signed Traveler Agreement and itemized Square invoice for the trip price, payment dates, inclusions and exclusions, and cancellation conditions. <a className="font-semibold underline" href="/travel-disclosures" target="_blank" rel="noreferrer">Read travel disclosures and booking information</a>.</p>
  </section>;
}
