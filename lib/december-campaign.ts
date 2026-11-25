import { attributionFromSearch } from "./trip-guide.ts";

export type DecemberCampaign = "winter_escape" | "gift_for_parents";

/** Keep direct landing-page inquiries identifiable without claiming they came from an ad. */
export function decemberCampaignAttribution(search: string, campaign: DecemberCampaign) {
  const attribution = attributionFromSearch(search);
  return {
    ...attribution,
    utmCampaign: attribution.utmCampaign || "vietnam_december_2027",
    utmContent: attribution.utmContent || campaign,
  };
}
