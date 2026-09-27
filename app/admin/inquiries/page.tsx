import { desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { LogOut, Mail, Phone, Users } from "lucide-react";
import { bookingRequests } from "@/db/schema";
import { getDb } from "@/db";
import { requireOwner } from "@/lib/owner-auth";
import { StatusSelect } from "./status-select";
import { DepositInvoiceAction } from "./deposit-invoice-action";

export const dynamic = "force-dynamic";

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

export default async function InquiryDashboard() {
  const owner = await requireOwner("/admin/inquiries");
  if (!owner) notFound();

  const inquiries = await getDb().select().from(bookingRequests).orderBy(desc(bookingRequests.createdAt));
  const newCount = inquiries.filter((item) => item.status === "new").length;
  const consentCount = inquiries.filter((item) => item.marketingConsent).length;

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
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-sm text-[var(--muted-ink)]">All inquiries</p><p className="mt-1 font-serif text-3xl">{inquiries.length}</p></div>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-sm text-[var(--muted-ink)]">New</p><p className="mt-1 font-serif text-3xl">{newCount}</p></div>
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5"><p className="text-sm text-[var(--muted-ink)]">Marketing consent</p><p className="mt-1 font-serif text-3xl">{consentCount}</p></div>
        </div>

        <div className="mt-8 space-y-5">
          {inquiries.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[var(--input)] bg-white p-10 text-center">
              <h2 className="font-serif text-2xl">No inquiries yet</h2>
              <p className="mt-2 text-[var(--muted-ink)]">New “Request a spot” submissions will appear here.</p>
            </div>
          ) : inquiries.map((item) => (
            <article key={item.id} className="rounded-3xl border border-[var(--line)] bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--orange)]">Inquiry #{item.id}</p>
                  <h2 className="mt-1 font-serif text-2xl">{item.fullName}</h2>
                  <p className="mt-1 text-sm text-[var(--muted-ink)]">Submitted {new Date(item.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</p>
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
                <DepositInvoiceAction
                  id={item.id}
                  partySize={item.partySize}
                  departure={item.departure}
                  email={item.email}
                  initialStatus={item.squareDepositInvoiceStatus}
                  initialUrl={item.squareDepositInvoiceUrl}
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
