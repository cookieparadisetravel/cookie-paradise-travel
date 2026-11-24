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

test("all six summer departures and the year-end trip are accepted with eight-day itineraries", () => {
  const dates = ["2027-06-01", "2027-06-15", "2027-06-29", "2027-07-13", "2027-07-27", "2027-08-10", "2027-12-27"];
  assert.deepEqual(vietnamDepartures.map(item => item.departure), dates);
  for (const trip of vietnamDepartures) {
    assert.ok(isVietnamDeparture(trip.departure));
    assert.equal((Date.parse(trip.endDate) - Date.parse(trip.departure)) / 86400000 + 1, 8);
    assert.equal(trip.capacity, 8);
  }
  for (const date of ["2027-06-02", "2027-08-17", "2028-01-03"]) assert.equal(isVietnamDeparture(date), false);
});
