import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateExpectedBookingTotalCents,
  automaticTravelerPriceCents,
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
  assert.deepEqual(publishedPerTravelerPricesCents, [287_500]);
  for (const price of [267_500, 260_500, 250_000]) assert.equal(isPublishedPerTravelerPriceCents(price), false);
});

test("uses the advertised price and only adds the private-room supplement when selected", () => {
  assert.equal(automaticTravelerPriceCents("shared"), 287_500);
  assert.equal(automaticTravelerPriceCents("private"), 327_400);
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
    bookingTotalCents: (2 * 287_500) + privateRoomSupplementCents,
    partySize: 2,
    preferredPrivateRoomCount: 0,
  }), {
    perTravelerPriceCents: 287_500,
    privateRoomCount: 1,
  });
});

test("individual bookings are allowed and parties cannot exceed eight", () => {
  for (const partySize of [1, 4, 8]) assert.equal(calculateExpectedBookingTotalCents({ partySize, perTravelerPriceCents: 287_500, privateRoomCount: 0 }), partySize * 287_500);
  assert.throws(() => calculateExpectedBookingTotalCents({ partySize: 9, perTravelerPriceCents: 287_500, privateRoomCount: 0 }));
});

test("all-meals upgrade adds $125 per traveler and combines with private rooms", () => {
  assert.equal(automaticTravelerPriceCents("shared", true), 300_000);
  assert.equal(automaticTravelerPriceCents("private", true), 339_900);
  assert.equal(calculateExpectedBookingTotalCents({ partySize: 2, perTravelerPriceCents: 287_500, privateRoomCount: 0, allMealsIncluded: true }), 600_000);
  assert.equal(calculateExpectedBookingTotalCents({ partySize: 2, perTravelerPriceCents: 287_500, privateRoomCount: 1, allMealsIncluded: true }), 639_900);
  assert.deepEqual(inferPriceCheckSelection({ bookingTotalCents: 639_900, partySize: 2, preferredPrivateRoomCount: 0, allMealsIncluded: true }), { perTravelerPriceCents: 287_500, privateRoomCount: 1 });
});
