import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardInquiry } from "../app/admin/inquiries/dashboard-types";
import type { GuideLeadRow } from "./lead-inbox";
import { buildInquiryFeed, feedCreatedAt, feedDeparture, feedIsActive, feedIsNew, feedMatchesSearch, feedStage } from "./inquiry-feed.ts";

const booking = (changes: Partial<DashboardInquiry> = {}) => ({ id: 1, email: "traveler@example.test", fullName: "Traveler Example", phone: "123", status: "considering", createdAt: "2026-11-01T12:00:00Z", departure: "2027-06-01", squareEnvironment: "production", ...changes }) as DashboardInquiry;
const guide = (changes: Partial<GuideLeadRow> = {}) => ({ id: crypto.randomUUID(), first_name: "Traveler Example", email: "traveler@example.test", phone: "123", city: "Not provided", source: "website", sources: "website", status: "new", travel_timing: "not_sure", booking_id: null, campaign: "Vietnam June", referral_code: null, ...changes }) as GuideLeadRow;

test("guide requests appear as active inquiries without fabricated bookings", () => {
  const lead = guide();
  const entries = buildInquiryFeed([], [lead]);
  assert.equal(entries.length, 1); assert.equal(entries[0].kind, "guide");
  assert.equal(feedIsActive(entries[0]), true); assert.equal(feedIsNew(entries[0]), true);
  assert.equal("inquiry" in entries[0], false);
  assert.equal(feedDeparture(entries[0]), "flexible");
});

test("matching production booking shows one row and preserves the guide and original booking", () => {
  const inquiry = booking({ email: " Traveler@Example.test " });
  const lead = guide({ booking_id: 1 });
  const entries = buildInquiryFeed([inquiry], [lead]);
  assert.equal(entries.length, 1); assert.equal(entries[0].kind, "booking");
  if (entries[0].kind !== "booking") throw new Error("Expected booking entry");
  assert.equal(entries[0].inquiry, inquiry); assert.equal(entries[0].guide, lead);
  assert.equal("guide" in inquiry, false);
  assert.equal(feedMatchesSearch(entries[0], "vietnam june"), true);
  assert.equal(feedIsNew(entries[0]), false);
});

test("unmatched, Sandbox, or closed bookings cannot hide an active guide request", () => {
  for (const inquiry of [booking({ id: 2 }), booking({ squareEnvironment: "sandbox" }), booking({ email: "other@example.test" }), booking({ status: "closed" })]) {
    const entries = buildInquiryFeed([inquiry], [guide({ booking_id: 1 })]);
    assert.equal(entries.length, 2); assert.equal(entries[1].kind, "guide");
    assert.equal(feedIsActive(entries[1]), true);
  }
  const entries = buildInquiryFeed([booking({ status: "closed" })], [guide({ status: "closed", booking_id: 1 })]);
  assert.equal(entries.length, 1); assert.equal(feedIsActive(entries[0]), false);
});

test("guide stages and search work in the common list without guessing a departure", () => {
  const entries = buildInquiryFeed([], [guide({ status: "contacted", city: "Bloomington" }), guide({ status: "consultation_booked", travel_timing: "june_2027" }), guide({ status: "closed", travel_timing: "future" })]);
  assert.deepEqual(entries.map(feedStage), ["considering", "considering", "closed"]);
  assert.deepEqual(entries.map(feedIsActive), [true, true, false]);
  assert.deepEqual(entries.map(feedDeparture), ["flexible", "2027-06-01", "flexible"]);
  assert.equal(feedMatchesSearch(entries[0], " BLOOMINGTON "), true);
  assert.equal(feedMatchesSearch(entries[0], "traveler@example.test"), true);
  assert.equal(feedMatchesSearch(entries[0], "missing"), false);
});


test("renewed guide requests resurface using their latest activity while retaining the original date", () => {
  const original="2026-10-01T12:00:00Z", renewed="2026-11-02T12:00:00Z";
  const lead=guide({ created_at: original, renewed_at: renewed });
  const entry=buildInquiryFeed([], [lead])[0];
  assert.equal(feedCreatedAt(entry),renewed); assert.equal(lead.created_at,original);
  const attached=buildInquiryFeed([booking()], [{ ...lead, booking_id: 1 }])[0];
  assert.equal(feedCreatedAt(attached),renewed); assert.equal(feedIsNew(attached),false);
});
