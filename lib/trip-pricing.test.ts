import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateExpectedBookingTotalCents,
  inferPriceCheckSelection,
  isPublishedPerTravelerPriceCents,
  privateRoomSupplementCents,
  publishedPerTravelerPricesCents,
} from "./trip-pricing.ts";

test("recognizes only the published per-traveler prices", () => {
  for (const price of publishedPerTravelerPricesCents) {
    assert.equal(isPublishedPerTravelerPriceCents(price), true);
  }
  assert.equal(isPublishedPerTravelerPriceCents(300_000), false);
});

test("calculates the expected group total with private-room supplements", () => {
  assert.equal(calculateExpectedBookingTotalCents({
    partySize: 2,
    perTravelerPriceCents: 287_500,
    privateRoomCount: 1,
  }), (2 * 287_500) + privateRoomSupplementCents);
});

test("rejects an invalid private-room supplement count", () => {
  assert.throws(() => calculateExpectedBookingTotalCents({
    partySize: 2,
    perTravelerPriceCents: 287_500,
    privateRoomCount: 3,
  }), { message: "The private-room supplement count is invalid." });
});

test("restores a published price check from an existing booking total", () => {
  assert.deepEqual(inferPriceCheckSelection({
    bookingTotalCents: (2 * 267_500) + privateRoomSupplementCents,
    partySize: 2,
    preferredPrivateRoomCount: 0,
  }), {
    perTravelerPriceCents: 267_500,
    privateRoomCount: 1,
  });
});
