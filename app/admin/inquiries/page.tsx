import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/owner-auth";
import { loadInquiryDashboardData } from "./dashboard-data";
import { InquiryDashboardClient } from "./inquiry-dashboard-client";
import { loadSalesProcesses } from "@/lib/inquiry-sales";
import { loadLeadInbox } from "@/lib/lead-inbox";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function InquiryDashboard() {
  const owner = await requireOwner("/admin/inquiries");
  if (!owner) notFound();
  const [{ acceptanceDate, inquiries, squareMode }, { leads }, salesProcesses] = await Promise.all([
    loadInquiryDashboardData(), loadLeadInbox(null), loadSalesProcesses(),
  ]);

  return (
    <InquiryDashboardClient
      acceptanceDate={acceptanceDate}
      inquiries={inquiries}
      ownerEmail={owner.email}
      squareMode={squareMode}
      guideRequests={leads}
      salesProcesses={salesProcesses}
    />
  );
}
