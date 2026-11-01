import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/owner-auth";
import { loadLeadInbox } from "@/lib/lead-inbox";
import { GuideRequestSummary } from "../../guide-request-summary";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inquiry details | Cookie Paradise Travel", robots: { index: false, follow: false } };

export default async function GuideInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  if (!await requireOwner(`/admin/inquiries/guide/${id}`)) notFound();
  const { leads } = await loadLeadInbox(null, { id });
  const lead = leads[0];
  if (!lead) notFound();
  return <main className="min-h-screen bg-[var(--sand)] px-5 py-8 text-[var(--ink)]"><div className="mx-auto max-w-[1500px]">
    {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Native navigation avoids the deployed vinext Link failure. */}
    <a className="inline-flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white px-4 text-sm font-bold" href="/admin/inquiries">← Back to inquiries</a>
    <p className="mt-7 text-xs font-extrabold uppercase tracking-widest text-[var(--orange)]">Owner dashboard</p><h1 className="mt-2 mb-6 font-serif text-3xl font-bold">Inquiry details</h1>
    <GuideRequestSummary key={`${lead.id}-${lead.status}`} lead={lead} />
  </div></main>;
}
