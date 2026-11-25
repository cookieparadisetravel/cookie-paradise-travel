import assert from "node:assert/strict";
import test from "node:test";
import { decemberCampaignAttribution } from "./december-campaign.ts";
import { guideRequestSchema } from "./lead-request.ts";

test("direct landing requests retain the angle without inventing paid traffic", () => {
  for (const campaign of ["winter_escape", "gift_for_parents"] as const) {
    const result = decemberCampaignAttribution("", campaign);
    assert.equal(result.utmContent, campaign);
    assert.equal(result.utmCampaign, "vietnam_december_2027");
    assert.equal(result.utmSource, "");
    assert.equal(result.utmMedium, "");
  }
});

test("December inquiries accept the new cities and keep marketing optional", () => {
  for (const city of ["Indianapolis", "Carmel", "Westfield"]) {
    const parsed = guideRequestSchema.parse({
      fullName: "Example Traveler", email: "traveler@example.test", city,
      timing: "december_2027", contactConsent: true, marketingConsent: false,
      submissionId: crypto.randomUUID(), turnstileToken: "test-only",
    });
    assert.equal(parsed.city, city);
    assert.equal(parsed.timing, "december_2027");
    assert.equal(parsed.marketingConsent, false);
  }
});

test("real ad labels and the expanded Indiana audiences survive attribution", () => {
  for (const audience of ["indianapolis", "carmel", "westfield"]) {
    const result = decemberCampaignAttribution(`?utm_source=facebook&utm_medium=paid_social&utm_campaign=holiday_launch&utm_content=gift_v2&audience=${audience}&ad_id=12345`, "gift_for_parents");
    assert.equal(result.utmSource, "facebook");
    assert.equal(result.utmCampaign, "holiday_launch");
    assert.equal(result.utmContent, "gift_v2");
    assert.equal(result.audience, audience);
    assert.equal(result.adId, "12345");
  }
});
