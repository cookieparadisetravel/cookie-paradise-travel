import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { bookingRequests, travelers, salonReferralCompletions, salonReferralPilots } from "@/db/schema";
import { requireOwner } from "@/lib/owner-auth";
import { dateInPilot, pilotLastDay, referralEarnings, salonPartners } from "@/lib/salon-referrals";
import { todayInIndiana } from "@/lib/payment-schedule";
import { ReferralControl } from "./referral-controls";
export const dynamic = "force-dynamic";
export const metadata = { title: "Salon referral pilot | Owner dashboard", robots: { index: false, follow: false } };
const dollars = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
export default async function ReferralDashboard() {
  const owner = await requireOwner("/admin/referrals");
  if (!owner) notFound();
  const db = getDb();
  const [pilots, inquiries, rows] = await Promise.all([
    db.select().from(salonReferralPilots),
    db.select({ id: bookingRequests.id, referralCode: bookingRequests.referralCode, fullName: bookingRequests.fullName, createdAt: bookingRequests.createdAt }).from(bookingRequests).where(isNotNull(bookingRequests.referralCode)),
    db.select({ traveler: travelers, inquiry: { id: bookingRequests.id, referralCode: bookingRequests.referralCode, invoiceStatus: bookingRequests.squareDepositInvoiceStatus, environment: bookingRequests.squareEnvironment }, completion: salonReferralCompletions }).from(travelers)
      .innerJoin(bookingRequests, eq(bookingRequests.id, travelers.bookingRequestId))
      .leftJoin(salonReferralCompletions, eq(salonReferralCompletions.travelerId, travelers.id)).where(isNotNull(bookingRequests.referralCode)),
  ]);
  const today = todayInIndiana();
  return <main className="min-h-screen bg-[var(--sand)] px-5 py-8 text-[var(--ink)] sm:px-8"><div className="mx-auto max-w-6xl">
    <Link href="/admin/inquiries" className="text-sm font-bold underline">← Inquiries</Link>
    <h1 className="mt-5 font-serif text-4xl">Salon referral pilot</h1>
    <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted-ink)]">Each salon earns $100 per successful traveler, plus $100 for every five successful travelers, with no cap. Start each 90-day pilot when its promotional materials are received. Review commissions after full payment and trip completion. Totals below show calculated earnings; payments to salon owners are recorded separately in your accounting.</p>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">{salonPartners.map((partner) => {
      const pilot = pilots.find((p) => p.code === partner.code);
      const referred = inquiries.filter((i) => i.referralCode === partner.code);
      const travelerRows = rows.filter((r) => r.inquiry.referralCode === partner.code);
      const successful = travelerRows.filter((r) => r.completion?.successful && dateInPilot(pilot?.materialsReceivedOn ?? null, r.completion.qualifiedOn)).length;
      const earnings = referralEarnings(successful);
      return <section key={partner.code} className="rounded-2xl border border-[var(--line)] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-4"><div className={`flex h-20 w-28 items-center justify-center rounded-xl p-2 ${partner.creamSurface ? "bg-[var(--cream)]" : "bg-white"}`}><img alt={`${partner.name} logo`} src={partner.logo} className="max-h-full max-w-full object-contain" /></div><div><h2 className="font-serif text-2xl font-bold">{partner.name}</h2><p className="mt-1 text-xs font-semibold text-[var(--muted-ink)]">{pilot ? `${pilot.materialsReceivedOn} through ${pilotLastDay(pilot.materialsReceivedOn)}` : "Pilot has not started"}</p></div></div>
        <p className="mt-4 break-all text-sm"><a className="font-semibold underline" href={`/r/${partner.code}`}>https://cookieparadisetravel.com/r/{partner.code}</a></p>
        <div className="mt-4 flex items-center gap-4"><img alt={`${partner.name} travel referral QR code`} className="h-24 w-24" src={`/referrals/${partner.code}-qr.svg`} /><a download className="text-sm font-bold underline" href={`/referrals/${partner.code}-qr.svg`}>Download QR code</a></div>
        <div className="mt-5 rounded-xl bg-[var(--cream)] p-4"><ReferralControl code={partner.code} startDate={pilot?.materialsReceivedOn} today={today} /></div>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-[var(--muted-ink)]">Attributed inquiries</dt><dd className="mt-1 text-xl font-bold">{referred.length}</dd></div><div><dt className="text-[var(--muted-ink)]">Successful travelers</dt><dd className="mt-1 text-xl font-bold">{successful}</dd></div><div><dt className="text-[var(--muted-ink)]">Base commission</dt><dd className="mt-1 font-bold">{dollars(earnings.baseCents)}</dd></div><div><dt className="text-[var(--muted-ink)]">Volume bonus</dt><dd className="mt-1 font-bold">{dollars(earnings.bonusCents)}</dd></div><div className="col-span-2 border-t border-[var(--line)] pt-3"><dt>Calculated salon earnings</dt><dd className="mt-1 text-2xl font-bold">{dollars(earnings.totalCents)}</dd></div></dl>
        <h3 className="mt-6 text-lg font-bold">Referred inquiries</h3>
        {referred.length ? <ul className="mt-2 space-y-2 text-sm">{referred.map((i) => <li key={i.id}><a href={`/admin/inquiries/${i.id}`} className="font-semibold underline">#{i.id} · {i.fullName}</a></li>)}</ul> : <p className="mt-2 text-sm text-[var(--muted-ink)]">No attributed inquiries yet.</p>}
        <h3 className="mt-6 text-lg font-bold">Traveler commission reviews</h3>
        <div className="mt-3 space-y-4">{travelerRows.map((r) => <article key={r.traveler.id} className="rounded-xl border border-[var(--line)] p-4"><p className="font-bold">{r.traveler.firstName} {r.traveler.lastName}</p><p className="mb-3 mt-1 text-xs text-[var(--muted-ink)]">Inquiry #{r.inquiry.id} · Square {r.inquiry.environment} · Invoice {r.inquiry.invoiceStatus} · {r.completion?.successful ? "Confirmed successful" : "Not confirmed successful"}</p><ReferralControl travelerId={r.traveler.id} successful={r.completion?.successful ?? false} qualifiedOn={r.completion?.qualifiedOn} today={today} />{r.completion && <p className="mt-2 text-xs text-[var(--muted-ink)]">Last reviewed {r.completion.reviewedAt} by {r.completion.reviewedBy}</p>}</article>)}</div>
      </section>;
    })}</div>
  </div></main>;
}
