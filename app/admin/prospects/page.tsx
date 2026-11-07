import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/owner-auth";
import { loadProspectDashboard } from "@/lib/web-prospect-service";
import { ProspectsClient } from "./prospects-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Web prospects | Cookie Paradise Travel", robots: { index: false, follow: false } };
export default async function ProspectsPage() {
  if (!await requireOwner("/admin/prospects")) notFound();
  return <ProspectsClient initial={await loadProspectDashboard()} />;
}
