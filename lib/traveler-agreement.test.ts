import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import originalAgreement from "./traveler-agreement-v1.json" with { type: "json" };
import {
  buildPersonalizedTravelerAgreement,
  canonicalizeAgreement,
  currentTravelerAgreement,
  hashAgreementDocument,
  parseAgreementDocument,
} from "./traveler-agreement.ts";

test("Agreement 1.0 contains the approved contact, cancellation and safety terms", () => {
  const canonical = canonicalizeAgreement(currentTravelerAgreement);
  assert.equal(currentTravelerAgreement.version, "1.0");
  assert.equal(currentTravelerAgreement.effectiveDate, "October 6, 2026");
  assert.match(canonical, /3346 Cox Ln\., Columbus, IN 47203/u);
  assert.match(canonical, /trung@cookieparadise\.co/u);
  assert.match(canonical, /Package price per traveler/u);
  assert.match(canonical, /The greater of \$500 or 50% of that traveler’s Trip Price/u);
  assert.match(canonical, /cannabis or marijuana in any form/u);
  assert.match(canonical, /TO THE FULLEST EXTENT PERMITTED BY LAW/u);
  assert.doesNotMatch(canonical, /Blank or estimated entries do not authorize a charge/u);
});

test("includes the approved front-sheet summary without changing the full agreement", async () => {
  const agreement = buildPersonalizedTravelerAgreement({
    travelerName: "Summary Traveler", departure: "2027-06-01", occupancy: "Shared double/twin room", tripPriceCents: 287_500,
  });
  assert.deepEqual(agreement.sections.slice(1, -1), originalAgreement.sections);
  const summary = agreement.executiveSummary;
  assert.ok(summary);
  assert.equal(summary.items.length, 12);
  assert.match(summary.items.find((item) => item.label === "Price and room arrangements")!.text, /only to a traveler staying alone.*Couples can share a room with a queen bed or separate beds/u);
  assert.match(summary.items.find((item) => item.label === "If you cancel")!.text, /If you have paid less than that charge, you must pay the difference/u);
  const withoutSummary = { ...agreement };
  delete withoutSummary.executiveSummary;
  assert.notEqual(await hashAgreementDocument(agreement), await hashAgreementDocument(withoutSummary));
});

test("legacy saved agreements retain their exact contents and hash", async () => {
  const saved = JSON.stringify(originalAgreement);
  const parsed = parseAgreementDocument(saved);
  assert.ok(parsed);
  assert.equal(parsed.executiveSummary, undefined);
  assert.equal(canonicalizeAgreement(parsed), saved);
  assert.equal(await hashAgreementDocument(parsed), createHash("sha256").update(saved).digest("hex"));
});

test("builds a concise personalized agreement without an installment schedule", () => {
  const agreement = buildPersonalizedTravelerAgreement({
    travelerName: "Mary Ann Smith",
    departure: "2027-06-01",
    occupancy: "Private room supplement",
    tripPriceCents: 327_400,
  });
  const summary = agreement.sections.find((section) => section.heading === "Trip summary");
  const schedule = agreement.sections.find((section) => section.heading === "Schedule 1 — Individual Payment Schedule");
  assert.ok(summary);
  assert.equal(schedule, undefined);
  assert.match(canonicalizeAgreement(agreement), /Mary Ann Smith/u);
  assert.match(canonicalizeAgreement(agreement), /June 1, 2027/u);
  assert.doesNotMatch(canonicalizeAgreement(agreement), /2027-06-01/u);
  assert.match(canonicalizeAgreement(agreement), /Private room supplement/u);
  assert.match(canonicalizeAgreement(agreement), /\$3,274\.00/u);
  assert.match(canonicalizeAgreement(agreement), /Square’s hosted invoice and payment process/u);
});

test("personalized document hashes change with the traveler terms", async () => {
  const common = {
    departure: "2027-06-01",
    occupancy: "Shared double/twin room",
  };
  const first = buildPersonalizedTravelerAgreement({ ...common, travelerName: "First Traveler", tripPriceCents: 287_500 });
  const second = buildPersonalizedTravelerAgreement({ ...common, travelerName: "Second Traveler", tripPriceCents: 267_500 });
  assert.notEqual(await hashAgreementDocument(first), await hashAgreementDocument(second));
});
