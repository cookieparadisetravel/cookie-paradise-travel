export const REFERRAL_COOKIE = "cp_travel_referral";
export const REFERRAL_COOKIE_SECONDS = 90 * 24 * 60 * 60;
export const salonPartners = [
  { code: "gossip-nails", name: "Gossip Nails", logo: "/referrals/gossip-nails-logo.png", website: "https://gossipnailscolumbus.com/", creamSurface: false },
  { code: "nails-station", name: "Nails Station & Spa", logo: "/referrals/nails-station-logo.png", website: "https://nailsstationandspa.com/", creamSurface: true },
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
export function referralEarnings(successfulTravelers: number) {
  if (!Number.isSafeInteger(successfulTravelers) || successfulTravelers < 0) throw new Error("Invalid traveler count.");
  const baseCents = successfulTravelers * 10000;
  const bonusCents = Math.floor(successfulTravelers / 5) * 10000;
  return { baseCents, bonusCents, totalCents: baseCents + bonusCents };
}
