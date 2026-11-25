import { vietnamDepartures, departureForTiming } from "./trip-availability.ts";

export const tripGuideUrl = "https://cookieparadisetravel.com/vietnam-trip-guide.pdf";
export const retireeGuideUrl = "https://cookieparadisetravel.com/vietnam-retiree-trip-guide.pdf";
export const retireeOfferId = "retiree_december_2027";
export const retireeOfferSummary = "Retiree package: US$3,000 per traveler sharing a room, with all meals included during the eight-day Vietnam tour. December 27, 2027-January 3, 2028. International airfare is not included.";
export const tripGuideLandingUrl = "https://cookieparadisetravel.com/vietnam";
export const leadCities = ["Columbus", "Franklin", "Bloomington", "Indianapolis", "Carmel", "Westfield", "Other"] as const;
export const leadTimings = [vietnamDepartures[0].timing, ...vietnamDepartures.slice(1).map(item => item.timing), "not_sure", "future"] as const;
export const leadStages = ["new", "considering", "booking_in_progress", "waitlist", "closed"] as const;
export type LeadTiming = typeof leadTimings[number];
export type LeadSource = "website" | "meta";
export type LeadStage = typeof leadStages[number];
export type CampaignAttribution = {
  utmSource: string; utmMedium: string; utmCampaign: string; utmContent: string;
  utmTerm: string; audience: string; campaignId: string; adSetId: string; adId: string;
};
export const emptyAttribution: CampaignAttribution = { utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "", utmTerm: "", audience: "", campaignId: "", adSetId: "", adId: "" };
export function boundedText(value: unknown, length = 120) {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, length) : "";
}
export function campaignAttribution(input: unknown): CampaignAttribution {
  const value = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const result = { ...emptyAttribution };
  for (const key of Object.keys(result) as (keyof CampaignAttribution)[]) result[key] = boundedText(value[key], 120);
  result.audience = ["columbus", "franklin", "bloomington", "indianapolis", "carmel", "westfield"].includes(result.audience.toLowerCase()) ? result.audience.toLowerCase() : "";
  for (const key of ["campaignId", "adSetId", "adId"] as const) if (!/^\d{1,32}$/.test(result[key])) result[key] = "";
  return result;
}
export function attributionFromSearch(search: string) {
  const query = new URLSearchParams(search);
  return campaignAttribution({
    utmSource: query.get("utm_source"), utmMedium: query.get("utm_medium"), utmCampaign: query.get("utm_campaign"),
    utmContent: query.get("utm_content"), utmTerm: query.get("utm_term"), audience: query.get("audience"),
    campaignId: query.get("campaign_id"), adSetId: query.get("adset_id"), adId: query.get("ad_id"),
  });
}
export function guideTimingLabel(value: string) {
  return departureForTiming(value)?.dateRange ?? (value === "future" ? "A future departure" : "Still deciding");
}
export function leadStageLabel(value: string) {
  return ({ new: "New", contacted: "Contacted", consultation_booked: "Considering", considering: "Considering", booking_in_progress: "Booking in progress", waitlist: "Waitlist", reserved: "Reserved", closed: "Closed" } as Record<string, string>)[value] ?? value;
}

// Preserve old month-only answers while matching specific new dates first.
export function timingFromInterest(value: string): LeadTiming {
  const selected = value.trim().toLowerCase();
  if (selected.includes("future")) return "future";
  const exact = vietnamDepartures.find(item => item.timing === selected || item.departure === selected);
  if (exact) return exact.timing;
  const words = selected.replace(/[_–—-]/g, " ");
  const dated = vietnamDepartures.find(item => {
    const [month, day] = item.label.toLowerCase().replace(",", "").split(" ");
    return new RegExp(`\\b${month}\\s+${day}(?!\\d)`).test(words);
  });
  if (dated) return dated.timing;
  if (/^december(?: 2027)?$/.test(words)) return "december_2027";
  if (/^june(?: 2027)?$/.test(words)) return "june_2027";
  return "not_sure";
}
