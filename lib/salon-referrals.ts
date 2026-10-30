export const REFERRAL_COOKIE = "cp_travel_referral";
export const REFERRAL_COOKIE_SECONDS = 90 * 24 * 60 * 60;
export const referralCommissionPlans = {
  nailTechSplit: {
    referrerCents: 10000, shopOwnerCents: 10000, bonusEvery: 5, bonusCents: 10000,
    referrerLabel: "Nail tech",
    terms: "$100 to the referring nail tech and $100 to the shop owner per successful traveler. Each nail tech earns an additional $100 for every five of their own successful referrals, with no cap.",
    disclosure: "The referring nail tech and shop owner may earn commissions for a successful referral.",
  },
  directReferrer: {
    referrerCents: 20000, shopOwnerCents: 0, bonusEvery: 0, bonusCents: 0,
    referrerLabel: "Referrer",
    terms: "$200 per successful traveler, paid directly to the person who made the referral. No separate shop-owner commission or volume bonus.",
    disclosure: "The person who referred you may earn a commission for a successful referral.",
  },
} as const;
export const salonPartners = [
  { code: "gossip-nails", name: "Gossip Nails", logo: "/referrals/gossip-nails-logo.png", website: "https://gossipnailscolumbus.com/", creamSurface: false, commissionPlan: "nailTechSplit" },
  { code: "nails-station", name: "Nails Station & Spa", logo: "/referrals/nails-station-logo.png", website: "https://nailsstationandspa.com/", creamSurface: true, commissionPlan: "nailTechSplit" },
  { code: "cisco-barbershop", name: "Cisco Barbershop", logo: "/referrals/cisco-barbershop-logo.png", website: "https://www.ciscos.site/", creamSurface: false, commissionPlan: "directReferrer" },
  { code: "columbus-uppercuts", name: "Columbus Uppercuts", logo: "/referrals/columbus-uppercuts-logo.png", website: "https://www.columbusuppercuts.com/", creamSurface: false, commissionPlan: "directReferrer" },
  { code: "dorothys-playhouse", name: "Dorothy’s Playhouse", logo: "/referrals/dorothys-playhouse-logo.png", website: "https://www.dorothysplayhouse.com/", creamSurface: false, commissionPlan: "directReferrer" },
  { code: "taqueria-ramirez", name: "Taqueria Ramirez", logo: "/referrals/taqueria-ramirez-logo.webp", website: "https://www.facebook.com/TaqueriaRamirezFoodTruck/", creamSurface: false, commissionPlan: "directReferrer" },
  { code: "bon-gout", name: "Bon Gout", logo: "/referrals/bon-gout-logo.png", website: "", creamSurface: true, commissionPlan: "directReferrer" },
  { code: "jason-anderson", name: "Jason Anderson", logo: "/referrals/jason-anderson-name.svg", website: "", creamSurface: false, commissionPlan: "directReferrer" },
  { code: "gameday", name: "Gameday Men's Health", logo: "/referrals/gameday-logo.svg", website: "https://gamedaymenshealth.com/bloomington-in", creamSurface: false, commissionPlan: "directReferrer" },
] as const;
export type SalonPartner = typeof salonPartners[number];
export function getSalonPartner(code: unknown): SalonPartner | null {
  return typeof code === "string" ? salonPartners.find((partner) => partner.code === code) ?? null : null;
}
export function referralFromCookie(header: string | null): SalonPartner | null {
  const value = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${REFERRAL_COOKIE}=`))?.slice(REFERRAL_COOKIE.length + 1);
  return getSalonPartner(value);
}
export function validReferralDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
// Ninety calendar days, including the materials-received date, using Indiana date strings.
export function pilotLastDay(startDate: string): string {
  if (!validReferralDate(startDate)) throw new Error("Invalid pilot start date.");
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 89);
  return date.toISOString().slice(0, 10);
}
export function dateInPilot(startDate: string | null, date: string): boolean {
  return Boolean(startDate && validReferralDate(startDate) && validReferralDate(date)
    && date >= startDate && date <= pilotLastDay(startDate));
}
export function normalizeReferrerName(value: unknown): string | null {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const name = value.normalize("NFC").trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 120 ? name : null;
}
// Each entry represents one confirmed successful traveler at this partner.
// Missing recipients accrue base commission, but never an assumed volume bonus.
export function referralEarnings(partner: SalonPartner, successfulReferrers: readonly (string | null)[]) {
  const plan = referralCommissionPlans[partner.commissionPlan];
  const people = new Map<string, { name: string; successfulTravelers: number }>();
  let unassignedCount = 0;
  for (const value of successfulReferrers) {
    const name = normalizeReferrerName(value);
    if (!name) { unassignedCount++; continue; }
    const key = name.toLowerCase();
    const person = people.get(key) ?? { name, successfulTravelers: 0 };
    person.successfulTravelers++;
    people.set(key, person);
  }
  const referrers = [...people.values()].map((person) => {
    const baseCents = person.successfulTravelers * plan.referrerCents;
    const bonusCents = plan.bonusEvery ? Math.floor(person.successfulTravelers / plan.bonusEvery) * plan.bonusCents : 0;
    return { ...person, baseCents, bonusCents, totalCents: baseCents + bonusCents };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const referrerBaseCents = successfulReferrers.length * plan.referrerCents;
  const shopOwnerCents = successfulReferrers.length * plan.shopOwnerCents;
  const bonusCents = referrers.reduce((sum, person) => sum + person.bonusCents, 0);
  return { referrerBaseCents, shopOwnerCents, bonusCents, totalCents: referrerBaseCents + shopOwnerCents + bonusCents, unassignedCount, referrers };
}
