import type { ReferralPartner } from "@/lib/referral-partners";

export function ReferralBanner({ partner, preview }: { partner: ReferralPartner; preview: boolean }) {
  return (
    <section aria-label={`${partner.name} referral`} className="border-b border-[var(--line)] bg-[var(--cream)] px-5 py-3 text-[var(--ink)] sm:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--orange)]">{preview ? `Pilot concept • ${partner.name} • Owner preview` : `Referred by ${partner.name}`}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--muted-ink)]">{preview
          ? "Participation is pending. This preview does not save inquiries, send emails, create bookings or collect payments."
          : "Your inquiry will record this referral source. No extra personal information is collected for attribution."}</p>
      </div>
    </section>
  );
}
