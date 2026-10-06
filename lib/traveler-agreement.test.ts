import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPersonalizedTravelerAgreement,
  canonicalizeAgreement,
  currentTravelerAgreement,
  hashAgreementDocument,
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
});

test("builds a complete personalized installment Schedule 1", () => {
  const agreement = buildPersonalizedTravelerAgreement({
    travelerName: "Mary Ann Smith",
    departure: "2027-06-01",
    occupancy: "Private room supplement",
    tripPriceCents: 327_400,
    paymentPreference: "payment_plan",
    acceptanceDate: "2026-10-01",
  });
  const summary = agreement.sections.find((section) => section.heading === "Trip summary");
  const schedule = agreement.sections.find((section) => section.heading === "Schedule 1 — Individual Payment Schedule");
  assert.ok(summary);
  assert.ok(schedule);
  assert.match(canonicalizeAgreement(agreement), /Mary Ann Smith/u);
  assert.match(canonicalizeAgreement(agreement), /Private room supplement/u);
  const paymentTable = schedule.blocks.find((block) => block.type === "table");
  assert.ok(paymentTable && paymentTable.type === "table");
  assert.deepEqual(paymentTable.rows, [
    ["Reservation deposit", "$500.00", "2026-10-01", "Square invoice"],
    ["Installment 1", "$554.80", "2026-11-01", "Square invoice"],
    ["Installment 2", "$554.80", "2026-12-01", "Square invoice"],
    ["Installment 3", "$554.80", "2027-01-01", "Square invoice"],
    ["Installment 4", "$554.80", "2027-02-01", "Square invoice"],
    ["Installment 5", "$554.80", "2027-03-01", "Square invoice"],
  ]);
});

test("builds a full-payment Schedule 1", () => {
  const agreement = buildPersonalizedTravelerAgreement({
    travelerName: "Trung Le",
    departure: "2027-06-01",
    occupancy: "Shared double/twin room",
    tripPriceCents: 287_500,
    paymentPreference: "full",
    acceptanceDate: "2026-10-01",
  });
  const schedule = agreement.sections.find((section) => section.heading === "Schedule 1 — Individual Payment Schedule");
  const paymentTable = schedule?.blocks.find((block) => block.type === "table");
  assert.ok(paymentTable && paymentTable.type === "table");
  assert.deepEqual(paymentTable.rows, [["Full payment", "$2,875.00", "2026-10-01", "Square invoice"]]);
});

test("personalized document hashes change with the traveler terms", async () => {
  const common = {
    departure: "2027-06-01",
    occupancy: "Shared double/twin room",
    paymentPreference: "payment_plan" as const,
    acceptanceDate: "2026-10-01",
  };
  const first = buildPersonalizedTravelerAgreement({ ...common, travelerName: "First Traveler", tripPriceCents: 287_500 });
  const second = buildPersonalizedTravelerAgreement({ ...common, travelerName: "Second Traveler", tripPriceCents: 267_500 });
  assert.notEqual(await hashAgreementDocument(first), await hashAgreementDocument(second));
});
