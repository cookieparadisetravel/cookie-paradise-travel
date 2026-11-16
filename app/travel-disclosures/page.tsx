import type { Metadata } from "next";
import Link from "next/link";
import { TravelDisclosures } from "@/app/components/travel-disclosures";
import { travelDisclosures as d } from "@/lib/travel-disclosures";

export const metadata: Metadata = { title: "Travel disclosures & booking information | Cookie Paradise Travel" };

export default function TravelDisclosuresPage() {
  return <main className="bg-[#faf8f3] px-5 py-12 text-black sm:py-16">
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="font-semibold underline underline-offset-4">← Cookie Paradise Travel Company</Link>
      <h1 className="mt-8 font-serif text-4xl leading-tight sm:text-5xl">Travel disclosures &amp; booking information</h1>
      <p className="mt-5 text-lg leading-8">Keep these notices with your personalized itinerary, Traveler Agreement and payment schedule. Your booking documents contain the terms for your particular trip.</p>
      <TravelDisclosures />
      <section className="mt-8 space-y-4 leading-7">
        <h2 className="text-2xl font-bold">Your price and payment schedule</h2>
        <p>Your personalized booking documents state the confirmed price for each traveler. Before you pay, your Square invoice shows the total, payments received, amount currently due, remaining balance, and exact future installment amounts and due dates.</p>
        <p>For Discover Southern Vietnam, the standard plan is a $500 nonrefundable reservation deposit per traveler, applied toward the trip price, followed by monthly installments. Final payment is due two calendar months before departure. Bookings accepted on or after that deadline require full payment. The deposit is subject to the refund exceptions in your Traveler Agreement and applicable law.</p>
        <h2 className="pt-4 text-2xl font-bold">Your itinerary</h2>
        <p>{d.departure}</p>
        <h2 className="pt-4 text-2xl font-bold">Cancellation conditions</h2>
        <p>Your Traveler Agreement supplies the complete cancellation schedule, company-cancellation provisions and refund conditions. Each adult traveler receives and accepts their agreement before a new payment invoice is issued. Keep the signed copy emailed to you; contact us if you need another copy. This page does not replace your agreement or waive rights provided by applicable law.</p>
        <h2 className="pt-4 text-2xl font-bold">Registration certificate</h2>
        <p><a className="font-semibold underline" href="/california-seller-of-travel-certificate.pdf" target="_blank" rel="noreferrer">View or print the California Seller of Travel certificate</a>. {d.validity}</p>
      </section>
    </div>
  </main>;
}
