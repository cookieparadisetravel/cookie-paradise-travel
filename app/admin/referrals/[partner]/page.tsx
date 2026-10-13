import { notFound } from "next/navigation";
import TripPage from "@/app/components/trip-page";
import { getReferralPartner } from "@/lib/referral-partners";
import { requireOwner } from "@/lib/owner-auth";
export const dynamic = "force-dynamic";
export const metadata = { title: "Discover Southern Vietnam | Referral", robots: { index: false, follow: false } };
export default async function ReferralPage({ params }: { params: Promise<{ partner: string }> }) {
  const { partner } = await params;
  const referralPartner = getReferralPartner(partner);
  if (!referralPartner) notFound();
  if (!await requireOwner(`/admin/referrals/${partner}`)) notFound();
  return <TripPage referralPartner={referralPartner} referralPreview={true} />;
}
