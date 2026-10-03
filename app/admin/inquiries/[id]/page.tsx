import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/owner-auth";
import { loadInquiryDashboardData } from "../dashboard-data";
import { InquiryDashboardClient } from "../inquiry-dashboard-client";

export const dynamic = "force-dynamic";
export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

type DetailSection = "overview" | "travelers" | "payments" | "activity";

function isDetailSection(value: unknown): value is DetailSection {
  return value === "overview" || value === "travelers" || value === "payments" || value === "activity";
}

export default async function InquiryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id: rawId } = await params;
  const inquiryId = Number(rawId);
  if (!Number.isInteger(inquiryId) || inquiryId < 1) notFound();

  const owner = await requireOwner(`/admin/inquiries/${inquiryId}`);
  if (!owner) notFound();

  const { acceptanceDate, inquiries, squareMode } = await loadInquiryDashboardData();
  const inquiry = inquiries.find((item) => item.id === inquiryId);
  if (!inquiry) notFound();

  const requestedSection = (await searchParams).section;
  const initialDetailSection = isDetailSection(requestedSection) ? requestedSection : undefined;

  return (
    <InquiryDashboardClient
      acceptanceDate={acceptanceDate}
      initialDetailSection={initialDetailSection}
      initialInquiryId={inquiryId}
      inquiries={[inquiry]}
      ownerEmail={owner.email}
      squareMode={squareMode}
    />
  );
}
