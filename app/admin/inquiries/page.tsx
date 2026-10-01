import { desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { LogOut, Mail, Phone, Users } from "lucide-react";
import { bookingRequests, travelers } from "@/db/schema";
import { getDb } from "@/db";
import { requireOwner } from "@/lib/owner-auth";
import { StatusSelect } from "./status-select";
import { DepositInvoiceAction } from "./deposit-invoice-action";
import { TravelerAgreementManager } from "./traveler-agreement-manager";
import { TravelerListInvitationAction } from "./traveler-list-invitation-action";
import { getAgreementReadiness } from "@/lib/agreement-readiness";
import { todayInIndiana } from "@/lib/payment-schedule";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

const departureLabels: Record<string, string> = {
  "2027-06-01": "June 1, 2027",
  "2027-06-29": "June 29, 2027",
  "2027-07-27": "July 27, 2027",
  flexible: "Flexible",
};

const stateLabels: Record<string, string> = {
  CA: "California",
  FL: "Florida",
  HI: "Hawaii",
  WA: "Washington",
};

const inquiryStatuses = ["new", "contacted", "qualified", "waitlist", "closed"] as const;

const statusLabels: Record<(typeof inquiryStatuses)[number], string> = {
  new: "New",
  contacted: "Follow-up sent",
  qualified: "Ready to book",
  waitlist: "Waitlist",
  closed: "Closed",
};

type DashboardSearchParams = {
  q?: string | string[];
  status?: string | string[];
};

export default async function InquiryDashboard({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  const owner = await requireOwner("/admin/inquiries");
  if (!owner) notFound();

  const params = await searchParams;
  const searchValue = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const normalizedSearch = searchValue.trim().toLowerCase();
  const requestedStatus = Array.isArray(params.status) ? params.status[0] ?? "all" : params.status ?? "all";
  const selectedStatus = inquiryStatuses.includes(requestedStatus as (typeof inquiryStatuses)[number]) ? requestedStatus : "all";

  const db = getDb();
  const inquiries = await db.select().from(bookingRequests).orderBy(desc(bookingRequests.createdAt));
  const travelerRecords = await db.select().from(travelers).orderBy(travelers.createdAt);
  const travelersByInquiry = new Map<number, typeof travelerRecords>();
  for (const traveler of travelerRecords) {
    const existing = travelersByInquiry.get(traveler.bookingRequestId) ?? [];
    existing.push(traveler);
    travelersByInquiry.set(traveler.bookingRequestId, existing);
  }
  const agreementReadinessEntries = await Promise.all(inquiries.map(async (inquiry) => [
    inquiry.id,
    await getAgreementReadiness(inquiry.id, inquiry.partySize),
  ] as const));
  const agreementReadinessByInquiry = new Map(agreementReadinessEntries);
  // This forced-dynamic server page intentionally snapshots time once per request.
  // eslint-disable-next-line react-hooks/purity
  const referenceTime = Date.now();
  const acceptanceDate = todayInIndiana(new Date(referenceTime));
  const statusCounts = Object.fromEntries(inquiryStatuses.map((status) => [status, inquiries.filter((item) => item.status === status).length])) as Record<(typeof inquiryStatuses)[number], number>;
  const consentCount = inquiries.filter((item) => item.marketingConsent).length;
  const visibleInquiries = inquiries.filter((item) => {
    if (selectedStatus !== "all" && item.status !== selectedStatus) return false;
    if (!normalizedSearch) return true;
    return [item.fullName, item.email, item.phone].some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  return (
    <main className="min-h-screen bg-[var(--sand)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-[var(--navy)] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-5 sm:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]">Owner dashboard</p>
            <h1 className="mt-1 font-serif text-2xl sm:text-3xl">Trip inquiries</h1>
          </div>
          <a className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10" href="/cdn-cgi/access/logout"><LogOut className="h-4 w-4" /> Sign out</a>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-sm text-[var(--muted-ink)]">All inquiries</p><p className="mt-1 font-serif text-3xl">{inquiries.length}</p></div>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-sm text-[var(--muted-ink)]">New</p><p className="mt-1 font-serif text-3xl">{statusCounts.new}</p></div>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-sm text-[var(--muted-ink)]">Follow-up sent</p><p className="mt-1 font-serif text-3xl">{statusCounts.contacted}</p></div>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-sm text-[var(--muted-ink)]">Ready to book</p><p className="mt-1 font-serif text-3xl">{statusCounts.qualified}</p></div>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-sm text-[var(--muted-ink)]">Waitlist</p><p className="mt-1 font-serif text-3xl">{statusCounts.waitlist}</p></div>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-sm text-[var(--muted-ink)]">Closed</p><p className="mt-1 font-serif text-3xl">{statusCounts.closed}</p></div>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-sm text-[var(--muted-ink)]">Marketing consent</p><p className="mt-1 font-serif text-3xl">{consentCount}</p></div>
        </div>

        <form className="mt-8 grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end" method="get">
          <label className="text-sm font-semibold text-[var(--ink)]">Search inquiries
            <input className="mt-1 w-full rounded-xl border border-[var(--input)] px-3 py-2 outline-none focus:border-[var(--orange)]" defaultValue={searchValue} name="q" placeholder="Name, email or phone" type="search" />
          </label>
          <label className="text-sm font-semibold text-[var(--ink)]">Stage
            <select className="mt-1 w-full rounded-xl border border-[var(--input)] bg-white px-3 py-2 outline-none focus:border-[var(--orange)]" defaultValue={selectedStatus} name="status">
              <option value="all">All stages</option>
              {inquiryStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <button className="rounded-full bg-[var(--orange)] px-4 py-2 text-sm font-bold text-white" type="submit">Apply</button>
            {(normalizedSearch || selectedStatus !== "all") && <a className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--ink)]" href="/admin/inquiries">Clear</a>}
          </div>
        </form>

        <div className="mt-8 space-y-5">
          {visibleInquiries.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--input)] bg-white p-10 text-center">
              <h2 className="font-serif text-2xl">{inquiries.length === 0 ? "No inquiries yet" : "No matching inquiries"}</h2>
              <p className="mt-2 text-[var(--muted-ink)]">{inquiries.length === 0 ? "New “Request a spot” submissions will appear here." : "Try another search or clear the current filters."}</p>
            </div>
          ) : visibleInquiries.map((item) => {
            const agreementReadiness = agreementReadinessByInquiry.get(item.id);
            if (!agreementReadiness) return null;
            return (
            <article key={item.id} className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--orange)]">Inquiry #{item.id}</p>
                  <h2 className="mt-1 font-serif text-2xl">{item.fullName}</h2>
                  <p className="mt-1 text-sm text-[var(--muted-ink)]">Submitted {new Date(item.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Indiana/Indianapolis" })}</p>
                </div>
                <StatusSelect id={item.id} initialStatus={item.status} />
              </div>

              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <a className="flex items-center gap-2 font-semibold hover:underline" href={`mailto:${item.email}`}><Mail className="h-4 w-4 text-[var(--orange)]" /> {item.email}</a>
                <span className="flex items-center gap-2"><Phone className="h-4 w-4 text-[var(--orange)]" /> {item.phone || "No phone provided"}</span>
                <span><strong>Departure:</strong> {departureLabels[item.departure] ?? item.departure}</span>
                <span className="flex items-center gap-2"><Users className="h-4 w-4 text-[var(--orange)]" /> {item.partySize} traveler{item.partySize === 1 ? "" : "s"}</span>
                <span><strong>Room:</strong> {item.roomPreference}</span>
                <span><strong>Trip contact:</strong> {item.contactConsent ? "Consented" : "Not recorded"}</span>
                <span><strong>Seller-of-travel screening:</strong> {item.sellerOfTravelStateResident ? stateLabels[item.residenceState ?? ""] ?? item.residenceState : "Not flagged"}</span>
                <span><strong>Marketing:</strong> {item.marketingConsent ? "Consented" : "No consent"}</span>
                <span><strong>MailerLite:</strong> {item.mailerLiteStatus.replaceAll("_", " ")}</span>
                <span><strong>Owner alert:</strong> {item.ownerNotificationStatus.replaceAll("_", " ")}</span>
              </div>
              {item.notes && <div className="mt-5 rounded-2xl bg-[var(--cream)] p-4"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--orange)]">Notes</p><p className="mt-2 whitespace-pre-wrap leading-7">{item.notes}</p></div>}
              <div className="mt-5">
                <TravelerListInvitationAction inquiryId={item.id} expectedPartySize={item.partySize} currentTravelerCount={(travelersByInquiry.get(item.id) ?? []).length} />
              </div>
              <div className="mt-5">
                <TravelerAgreementManager inquiryId={item.id} expectedPartySize={item.partySize} initialTravelers={travelersByInquiry.get(item.id) ?? []} agreementActive={agreementReadiness.agreementActive} acceptedTravelerIds={agreementReadiness.acceptedTravelerIds} />
              </div>
              <div className="mt-5">
                <DepositInvoiceAction
                  id={item.id}
                  partySize={item.partySize}
                  departure={item.departure}
                  acceptanceDate={acceptanceDate}
                  email={item.email}
                  initialStatus={item.squareDepositInvoiceStatus}
                  initialUrl={item.squareDepositInvoiceUrl}
                  agreementReady={agreementReadiness.readyForInvoice}
                  agreementReadinessMessage={agreementReadiness.message}
                />
              </div>
            </article>
          )})}
        </div>
      </div>
    </main>
  );
}
