import assert from "node:assert/strict";
import { test } from "node:test";
import { getReferralPartner, isReferralPartnerActive, validateReferralSubmission } from "./referral-partners.ts";

test("salon identity is exact, isolated and allowlisted", () => {
  for (const id of ["gossip-nails", "nail-station-spa"]) {
    assert.equal(getReferralPartner(id)?.id, id);
    assert.ok(getReferralPartner(id)?.logo.endsWith(`${id}.png`));
    assert.equal(isReferralPartnerActive(id, undefined), false);
    assert.equal(isReferralPartnerActive(id, id), true);
    assert.equal(isReferralPartnerActive(id, id === "gossip-nails" ? "nail-station-spa" : "gossip-nails"), false);
  }
  for (const invalid of ["__proto__", "constructor", "Gossip Nails", "other", {}, ["gossip-nails"]]) {
    assert.equal(getReferralPartner(invalid), null);
    assert.ok(validateReferralSubmission({ referralPartner: invalid }, "gossip-nails,nail-station-spa"));
  }
});

test("previews cannot submit; direct traffic works without activation", () => {
  assert.equal(validateReferralSubmission({}), null);
  for (const value of [true, "true", "false", 1, null]) {
    assert.ok(validateReferralSubmission({ referralPreview: value }, "gossip-nails"));
  }
  assert.equal(validateReferralSubmission({ referralPartner: "gossip-nails", referralPreview: false }, "gossip-nails"), null);
});
