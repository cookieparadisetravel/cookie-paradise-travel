import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/owner-auth";
import { loadInquiryDashboardData } from "./dashboard-data";
import { InquiryDashboardClient } from "./inquiry-dashboard-client";

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
  const { acceptanceDate, inquiries, squareMode } = await loadInquiryDashboardData();

  return (
    <InquiryDashboardClient
      acceptanceDate={acceptanceDate}
      inquiries={inquiries}
      ownerEmail={owner.email}
      squareMode={squareMode}
    />
  );
}
