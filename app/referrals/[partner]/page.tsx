import { notFound } from "next/navigation";
import TripPage from "@/app/components/trip-page";
import { getReferralPartner, isReferralPartnerActive } from "@/lib/referral-partners";
import { env } from "cloudflare:workers";
export const dynamic = "force-dynamic";
export const metadata = { title: "Discover Southern Vietnam | Referral", robots: { index: false, follow: false } };
export default async function ReferralPage({ params }: { params: Promise<{ partner: string }> }) {
  const { partner } = await params;
  const referralPartner = getReferralPartner(partner);
  if (!referralPartner) notFound();
  if (!isReferralPartnerActive(partner, (env as unknown as Record<string, string | undefined>).REFERRAL_ACTIVE_PARTNERS)) notFound();
  return <TripPage referralPartner={referralPartner} referralPreview={false} />;
}
