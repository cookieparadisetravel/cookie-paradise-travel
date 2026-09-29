import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Cookie Paradise Travel Company",
  description: "How Cookie Paradise Travel Company collects, uses and protects information submitted through its website.",
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[var(--sand)] text-[var(--ink)]">
      <header className="bg-[var(--navy)] text-white">
        <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--gold)] hover:underline" href="/"><ArrowLeft className="h-4 w-4" /> Back to the trip</Link>
          <h1 className="mt-6 font-serif text-4xl sm:text-6xl">Privacy Policy</h1>
          <p className="mt-3 text-white/75">Effective September 28, 2026</p>
        </div>
      </header>

      <article className="mx-auto max-w-4xl space-y-9 px-5 py-12 text-base leading-8 sm:px-8 sm:py-16">
        <section><h2 className="font-serif text-3xl">Who we are</h2><p className="mt-3 text-[var(--muted-ink)]">Cookie Paradise Travel Company LLC is a Columbus, Indiana-based travel company offering hosted small-group journeys. This policy explains how we handle information submitted through cookieparadisetravel.com.</p></section>
        <section><h2 className="font-serif text-3xl">Information we collect</h2><p className="mt-3 text-[var(--muted-ink)]">When you request a spot, we collect your name, email address, optional telephone number, preferred departure, party size, room preference, contact consent and any notes you choose to provide. If you identify yourself as living in a state that may have seller-of-travel registration requirements, we also collect the state you select. Please do not submit passport numbers, payment-card information, medical information or other sensitive personal information through the inquiry form.</p></section>
        <section><h2 className="font-serif text-3xl">How we use it</h2><p className="mt-3 text-[var(--muted-ink)]">We use inquiry information to respond to you, discuss availability, evaluate seller-of-travel compliance before proceeding with a possible sale, plan group departures, maintain business records and improve our travel offerings. Submitting an inquiry does not create a reservation or payment obligation, and it does not guarantee that we can accept a booking.</p></section>
        <section><h2 className="font-serif text-3xl">Marketing choices</h2><p className="mt-3 text-[var(--muted-ink)]">We add your email address to our MailerLite marketing list only when you separately select the optional marketing checkbox. You may unsubscribe using the link in any marketing email. Declining marketing does not prevent us from responding to your specific trip inquiry.</p></section>
        <section><h2 className="font-serif text-3xl">Where information goes</h2><p className="mt-3 text-[var(--muted-ink)]">Inquiry records are stored in the Cloudflare D1 database supporting this website and are available through a Cloudflare Access-protected owner dashboard. Inquiry details are also sent to our configured owner-notification webhook service so the owner can receive and respond to new-inquiry alerts. When you separately consent to marketing, your name and email address are transmitted to MailerLite for email-list management.</p></section>
        <section><h2 className="font-serif text-3xl">Payments and Square</h2><p className="mt-3 text-[var(--muted-ink)]">If we accept your booking, we may send your name, email address, telephone number and booking-payment amount to Square so Square can create and email an invoice for either the required 50% initial payment or, when applicable, full payment. Square processes the payment through its systems. Cookie Paradise Travel Company does not receive or store your full payment-card or bank-account number on this website.</p></section>
        <section><h2 className="font-serif text-3xl">Sharing and service providers</h2><p className="mt-3 text-[var(--muted-ink)]">We do not sell your personal information. We use Cloudflare for website hosting, access control, database services and Cloudflare Turnstile (bot protection); MailerLite for consented email marketing; Square for invoices and payment processing; and an owner-notification webhook service for operational inquiry alerts. We may also disclose information when required by law. Service providers receive only the information reasonably necessary for their role.</p></section>
        <section><h2 className="font-serif text-3xl">Retention and security</h2><p className="mt-3 text-[var(--muted-ink)]">We retain information for as long as reasonably necessary to manage your inquiry, provide requested services, satisfy legal or accounting obligations and protect our business. We use reasonable administrative and technical safeguards, but no internet transmission or storage system is completely secure.</p></section>
        <section><h2 className="font-serif text-3xl">Your choices</h2><p className="mt-3 text-[var(--muted-ink)]">You may ask to review, correct or delete inquiry information, subject to legal recordkeeping requirements. You can also withdraw marketing consent at any time by unsubscribing or contacting us.</p></section>
        <section><h2 className="font-serif text-3xl">Contact us</h2><p className="mt-3 text-[var(--muted-ink)]">For privacy questions or data requests, email <a className="font-semibold underline" href="mailto:trung@cookieparadise.co">trung@cookieparadise.co</a>.</p></section>
      </article>
    </main>
  );
}
