export const tripGuideUrl = "https://cookieparadisetravel.com/vietnam-trip-guide.pdf";
export const tripGuideLandingUrl = "https://cookieparadisetravel.com/vietnam";
export const leadCities = ["Columbus", "Franklin", "Bloomington", "Other"] as const;
export const leadTimings = ["june_2027", "not_sure", "future"] as const;
export const leadStages = ["new", "contacted", "consultation_booked", "considering", "booking_in_progress", "closed"] as const;
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
  result.audience = ["columbus", "franklin", "bloomington"].includes(result.audience.toLowerCase()) ? result.audience.toLowerCase() : "";
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
  return value === "june_2027" ? "June 1-8, 2027" : value === "future" ? "A future departure" : "Still deciding";
}
export function leadStageLabel(value: string) {
  return ({ new: "New", contacted: "Contacted", consultation_booked: "Consultation booked", considering: "Considering", booking_in_progress: "Booking in progress", closed: "Closed" } as Record<string, string>)[value] ?? value;
}
