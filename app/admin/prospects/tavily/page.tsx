import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/owner-auth";
import { loadProspectDashboard } from "@/lib/web-prospect-service";
import { ProspectsClient } from "../prospects-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tavily prospects | Cookie Paradise Travel", robots: { index: false, follow: false } };
export default async function ProspectsPage() {
  if (!await requireOwner("/admin/prospects/tavily")) notFound();
  return <ProspectsClient provider="tavily" initial={await loadProspectDashboard(new URLSearchParams(), "tavily")} />;
}
