import assert from "node:assert/strict";
import test from "node:test";
import { availabilitySummary, countBookedSpots, type AvailabilityBooking, vietnamDepartures, isVietnamDeparture } from "./trip-availability.ts";
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
test("eight guest capacity reports remaining places without pricing milestones", () => {
  assert.deepEqual(availabilitySummary(0, 8), { booked: 0, capacity: 8, remaining: 8, full: false });
  assert.deepEqual(availabilitySummary(4, 8), { booked: 4, capacity: 8, remaining: 4, full: false });
  assert.equal(availabilitySummary(8, 8).full, true);
  assert.deepEqual(availabilitySummary(9, 8), { booked: 9, capacity: 8, remaining: 0, full: true });
});

test("only the two open departures are accepted, including the trip across New Year", () => {
  assert.ok(isVietnamDeparture("2027-06-01"));
  assert.ok(isVietnamDeparture("2027-12-27"));
  assert.equal(isVietnamDeparture("2027-06-29"), false);
  assert.equal(isVietnamDeparture("2028-01-03"), false);
  const trip = vietnamDepartures.find(item => item.departure === "2027-12-27")!;
  assert.equal((Date.parse(trip.endDate) - Date.parse(trip.departure)) / 86400000 + 1, 8);
});
