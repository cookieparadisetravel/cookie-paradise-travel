import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingRequests, travelers, referralRecipients, salonReferralCompletions, salonReferralPilots } from "@/db/schema";
import { requireOwner } from "@/lib/owner-auth";
import { dateInPilot, pilotLastDay, referralCommissionPlans, referralEarnings, salonPartners } from "@/lib/salon-referrals";
import { ensureReferralRecipientStorage } from "@/lib/referral-recipient-storage";
import { todayInIndiana } from "@/lib/payment-schedule";
import { ReferralControl } from "./referral-controls";
export const dynamic = "force-dynamic";
export const metadata = { title: "Partner referral pilot | Owner dashboard", robots: { index: false, follow: false } };
const dollars = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
export default async function ReferralDashboard() {
  const owner = await requireOwner("/admin/referrals");
  if (!owner) notFound();
  await ensureReferralRecipientStorage();
  const db = getDb();
  const [pilots, inquiries, rows] = await Promise.all([
    db.select().from(salonReferralPilots),
    db.select({ id: bookingRequests.id, referralCode: bookingRequests.referralCode, fullName: bookingRequests.fullName, createdAt: bookingRequests.createdAt }).from(bookingRequests).where(isNotNull(bookingRequests.referralCode)),
    db.select({ traveler: travelers, inquiry: { id: bookingRequests.id, referralCode: bookingRequests.referralCode, invoiceStatus: bookingRequests.squareDepositInvoiceStatus, environment: bookingRequests.squareEnvironment }, completion: salonReferralCompletions, recipient: referralRecipients }).from(travelers)
      .innerJoin(bookingRequests, eq(bookingRequests.id, travelers.bookingRequestId))
      .leftJoin(salonReferralCompletions, eq(salonReferralCompletions.travelerId, travelers.id))
      .leftJoin(referralRecipients, eq(referralRecipients.travelerId, travelers.id)).where(isNotNull(bookingRequests.referralCode)),
  ]);
  const today = todayInIndiana();
  return <main className="min-h-screen bg-[var(--sand)] px-5 py-8 text-[var(--ink)] sm:px-8"><div className="mx-auto max-w-6xl">
    <Link href="/admin/inquiries" className="text-sm font-bold underline">← Inquiries</Link>
    <h1 className="mt-5 font-serif text-4xl">Partner referral pilot</h1>
    <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted-ink)]">Commission recipients and bonuses depend on the partner’s program below. Start each 90-day pilot when its promotional materials are received. One successful referral means one qualifying traveler, reviewed after full payment and trip completion. Record the person who made each referral so earnings and nail-tech bonuses are calculated separately. Totals are calculated commissions; record actual payments separately in your accounting.</p>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">{salonPartners.map((partner) => {
      const pilot = pilots.find((p) => p.code === partner.code);
      const referred = inquiries.filter((i) => i.referralCode === partner.code);
      const travelerRows = rows.filter((r) => r.inquiry.referralCode === partner.code);
      const successfulRows = travelerRows.filter((r) => r.completion?.successful && dateInPilot(pilot?.materialsReceivedOn ?? null, r.completion.qualifiedOn));
      const successful = successfulRows.length;
      const plan = referralCommissionPlans[partner.commissionPlan];
      const earnings = referralEarnings(partner, successfulRows.map((r) => r.recipient?.referrerName ?? null));
      return <section key={partner.code} className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-4"><div className={`flex h-20 w-28 items-center justify-center rounded-xl p-2 ${partner.creamSurface ? "bg-[var(--cream)]" : "bg-white"}`}><img alt={`${partner.name} logo`} src={partner.logo} className="max-h-full max-w-full object-contain" /></div><div><h2 className="font-serif text-2xl font-bold">{partner.name}</h2><p className="mt-1 text-xs font-semibold text-[var(--muted-ink)]">{pilot ? `${pilot.materialsReceivedOn} through ${pilotLastDay(pilot.materialsReceivedOn)}` : "Pilot has not started"}</p></div></div>
        <p className="mt-4 rounded-xl bg-[var(--cream)] p-4 text-sm leading-6">{plan.terms}</p>
        <p className="mt-4 break-all text-sm"><a className="font-semibold underline" href={`/r/${partner.code}`}>https://cookieparadisetravel.com/r/{partner.code}</a></p>
        <div className="mt-4 flex items-center gap-4"><img alt={`${partner.name} travel referral QR code`} className="h-24 w-24" src={`/referrals/${partner.code}-qr.svg`} /><a download className="text-sm font-bold underline" href={`/referrals/${partner.code}-qr.svg`}>Download QR code</a></div>
        <div className="mt-5 rounded-xl bg-[var(--cream)] p-4"><ReferralControl code={partner.code} startDate={pilot?.materialsReceivedOn} today={today} /></div>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-[var(--muted-ink)]">Attributed inquiries</dt><dd className="mt-1 text-xl font-bold">{referred.length}</dd></div>
          <div><dt className="text-[var(--muted-ink)]">Successful travelers</dt><dd className="mt-1 text-xl font-bold">{successful}</dd></div>
          <div><dt className="text-[var(--muted-ink)]">{plan.referrerLabel} base commissions</dt><dd className="mt-1 font-bold">{dollars(earnings.referrerBaseCents)}</dd></div>
          {plan.shopOwnerCents > 0 && <div><dt className="text-[var(--muted-ink)]">Shop owner commissions</dt><dd className="mt-1 font-bold">{dollars(earnings.shopOwnerCents)}</dd></div>}
          {plan.bonusEvery > 0 && <div><dt className="text-[var(--muted-ink)]">Nail tech bonuses only</dt><dd className="mt-1 font-bold">{dollars(earnings.bonusCents)}</dd></div>}
          <div className="col-span-2 border-t border-[var(--line)] pt-3"><dt>Total calculated commissions</dt><dd className="mt-1 text-2xl font-bold">{dollars(earnings.totalCents)}</dd></div>
        </dl>
        {earnings.unassignedCount > 0 && <p role="status" className="mt-4 rounded-xl border border-[var(--gold)] bg-[var(--cream)] p-3 text-sm leading-6">{earnings.unassignedCount} successful referral(s) still need a referrer assigned below. Base commissions are included above, but individual payments{plan.bonusEvery > 0 ? " and any additional nail-tech bonuses" : ""} cannot be finalized until assigned.</p>}
        {earnings.referrers.length > 0 && <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm">
          <caption className="mb-2 text-left font-bold">Calculated earnings by {plan.referrerLabel.toLowerCase()}</caption>
          <thead><tr className="border-b border-[var(--line)]"><th scope="col" className="py-2 pr-3">Person</th><th scope="col" className="py-2 pr-3">Successful referrals</th><th scope="col" className="py-2 pr-3">Base</th>{plan.bonusEvery > 0 && <th scope="col" className="py-2 pr-3">Bonus</th>}<th scope="col" className="py-2">Total</th></tr></thead>
          <tbody>{earnings.referrers.map((person) => <tr key={person.name.toLowerCase()} className="border-b border-[var(--line)]"><th scope="row" className="py-2 pr-3 font-semibold">{person.name}</th><td className="py-2 pr-3">{person.successfulTravelers}</td><td className="py-2 pr-3">{dollars(person.baseCents)}</td>{plan.bonusEvery > 0 && <td className="py-2 pr-3">{dollars(person.bonusCents)}</td>}<td className="py-2 font-bold">{dollars(person.totalCents)}</td></tr>)}</tbody>
        </table></div>}
        <h3 className="mt-6 text-lg font-bold">Referred inquiries</h3>
        {referred.length ? <ul className="mt-2 space-y-2 text-sm">{referred.map((i) => <li key={i.id}><a href={`/admin/inquiries/${i.id}`} className="font-semibold underline">#{i.id} · {i.fullName}</a></li>)}</ul> : <p className="mt-2 text-sm text-[var(--muted-ink)]">No attributed inquiries yet.</p>}
        <h3 className="mt-6 text-lg font-bold">Traveler commission reviews</h3>
        <div className="mt-3 space-y-4">{travelerRows.map((r) => <article key={r.traveler.id} className="rounded-xl border border-[var(--line)] p-4"><p className="font-bold">{r.traveler.firstName} {r.traveler.lastName}</p><p className="mb-3 mt-1 text-xs text-[var(--muted-ink)]">Inquiry #{r.inquiry.id} · Square {r.inquiry.environment} · Invoice {r.inquiry.invoiceStatus} · {r.completion?.successful ? "Confirmed successful" : "Not confirmed successful"}</p><ReferralControl travelerId={r.traveler.id} successful={r.completion?.successful ?? false} qualifiedOn={r.completion?.qualifiedOn} referrerName={r.recipient?.referrerName} referrerLabel={plan.referrerLabel} today={today} />{r.recipient && <p className="mt-2 text-xs text-[var(--muted-ink)]">Referrer last updated {r.recipient.updatedAt} by {r.recipient.updatedBy}</p>}{r.completion && <p className="mt-2 text-xs text-[var(--muted-ink)]">Last reviewed {r.completion.reviewedAt} by {r.completion.reviewedBy}</p>}</article>)}</div>
      </section>;
    })}</div>
  </div></main>;
}
