// Only these public business identifiers are stored; no visitor IDs or tracking cookies.
export const referralPartners = {
  "gossip-nails": {
    id: "gossip-nails", name: "Gossip Nails",
    logo: "/referral-logos/gossip-nails.png", logoBackground: "#ffffff",
    website: "https://gossipnailscolumbus.com/",
  },
  "nail-station-spa": {
    id: "nail-station-spa", name: "Nail Station & Spa",
    logo: "/referral-logos/nail-station-spa.png", logoBackground: "#243746",
    website: "https://nailsstationandspa.com/",
  },
} as const;

export type ReferralPartnerId = keyof typeof referralPartners;
export type ReferralPartner = (typeof referralPartners)[ReferralPartnerId];

export function getReferralPartner(value: unknown): ReferralPartner | null {
  return typeof value === "string" && Object.hasOwn(referralPartners, value)
    ? referralPartners[value as ReferralPartnerId] : null;
}

// Explicitly activate each salon only after confirming participation and logo permission.
export function isReferralPartnerActive(value: unknown, activePartners: string | undefined) {
  const partner = getReferralPartner(value);
  return Boolean(partner && (activePartners ?? "").split(",").map((id) => id.trim()).includes(partner.id));
}

export function validateReferralSubmission(payload: Record<string, unknown>, activePartners?: string) {
  if (payload.referralPreview !== undefined && payload.referralPreview !== false) {
    return "Referral previews cannot submit inquiries.";
  }
  if (payload.referralPartner === undefined || payload.referralPartner === null || payload.referralPartner === "") return null;
  return isReferralPartnerActive(payload.referralPartner, activePartners)
    ? null : "This referral link is not active.";
}
