import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/owner-auth";
import { loadLeadInbox } from "@/lib/lead-inbox";
import { LeadInboxClient } from "./lead-inbox-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guide leads | Cookie Paradise Travel", robots: { index: false, follow: false } };
export default async function LeadInbox({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (!await requireOwner("/admin/leads")) notFound();
  const raw = (await searchParams).page;
  const page = raw && /^\d{1,6}$/.test(raw) ? Math.max(1, Number(raw)) : 1;
  const data = await loadLeadInbox(page);
  return <LeadInboxClient {...data} page={page} />;
}
