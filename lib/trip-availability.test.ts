import assert from "node:assert/strict";
import test from "node:test";
import { availabilitySummary, countBookedSpots, type AvailabilityBooking } from "./trip-availability.ts";
const booking = (changes: Partial<AvailabilityBooking> = {}): AvailabilityBooking => ({
  partySize: 2, status: "booking_in_progress", squareEnvironment: "production", squareDepositInvoiceStatus: "unpaid", ...changes,
});
test("counts travelers in paid, deposit-paid and owner-reserved parties", () => {
  assert.equal(countBookedSpots([
    booking({ squareDepositInvoiceStatus: "paid" }),
    booking({ squareDepositInvoiceStatus: "partially_paid", partySize: 3 }),
    booking({ status: "reserved" }),
    booking(),
  ]), 7);
});
test("excludes sandbox, closed, waitlisted, refunded and canceled records", () => {
  for (const changes of [
    { squareEnvironment: "sandbox" }, { status: "closed" }, { status: "waitlist" },
    { squareDepositInvoiceStatus: "refunded" }, { squareDepositInvoiceStatus: "partially_refunded" },
    { squareDepositInvoiceStatus: "canceled" }, { squareDepositInvoiceStatus: "failed" },
    { partySize: -1 }, { partySize: 1.5 },
  ]) assert.equal(countBookedSpots([booking({ status: "reserved", ...changes })]), 0);
});
test("zero, full and over-capacity never produce negative remaining spots", () => {
  assert.deepEqual(availabilitySummary(0, 15), { booked: 0, capacity: 15, remaining: 15, tierTarget: 8, full: false });
  assert.equal(availabilitySummary(15, 15).full, true);
  assert.deepEqual(availabilitySummary(17, 15), { booked: 17, capacity: 15, remaining: 0, tierTarget: 15, full: true });
});

test("advances the displayed tier immediately at each pricing threshold", () => {
  for (const [booked, target] of [[0,8],[2,8],[7,8],[8,10],[9,10],[10,12],[11,12],[12,15],[14,15],[15,15],[17,15]]) {
    assert.equal(availabilitySummary(booked, 15).tierTarget, target, `${booked} booked`);
  }
  // If a booking is closed, the display returns to the appropriate earlier tier.
  assert.equal(availabilitySummary(7, 15).tierTarget, 8);
});
