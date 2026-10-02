import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentPlan, type PaymentPlan } from "./payment-schedule.ts";

type PaymentPlanInput = Parameters<typeof createPaymentPlan>[0];

function createCheckedPaymentPlan(input: PaymentPlanInput): PaymentPlan {
  const plan = createPaymentPlan(input);
  const scheduledTotal = plan.initialAmountCents
    + plan.installments.reduce((total, installment) => total + installment.amountCents, 0);
  assert.equal(scheduledTotal, input.bookingTotalCents, "The initial payment and installments must equal the booking total.");
  return plan;
}

test("creates the checked five-installment schedule", () => {
  const plan = createCheckedPaymentPlan({
    acceptanceDate: "2026-10-01",
    departure: "2027-06-01",
    bookingTotalCents: 1_725_000,
    partySize: 6,
  });

  assert.equal(plan.paymentType, "deposit");
  assert.equal(plan.depositAmountCents, 300_000);
  assert.equal(plan.initialAmountCents, 300_000);
  assert.equal(plan.finalPaymentDeadline, "2027-03-03");
  assert.deepEqual(plan.installments, [
    { dueDate: "2026-11-01", amountCents: 285_000 },
    { dueDate: "2026-12-01", amountCents: 285_000 },
    { dueDate: "2027-01-01", amountCents: 285_000 },
    { dueDate: "2027-02-01", amountCents: 285_000 },
    { dueDate: "2027-03-01", amountCents: 285_000 },
  ]);
});

test("uses full payment at the 90-day deadline", () => {
  const plan = createCheckedPaymentPlan({
    acceptanceDate: "2027-03-03",
    departure: "2027-06-01",
    bookingTotalCents: 1_000_001,
    partySize: 2,
  });

  assert.equal(plan.paymentType, "full");
  assert.equal(plan.initialAmountCents, 1_000_001);
  assert.equal(plan.finalPaymentDeadline, "2027-03-03");
  assert.deepEqual(plan.installments, []);
});

test("uses one balance payment when accepted 91 days before departure", () => {
  const plan = createCheckedPaymentPlan({
    acceptanceDate: "2027-03-02",
    departure: "2027-06-01",
    bookingTotalCents: 1_000_001,
    partySize: 2,
  });

  assert.deepEqual(plan.installments, [
    { dueDate: "2027-03-03", amountCents: 900_001 },
  ]);
});

test("uses one balance payment when accepted 120 days before departure", () => {
  const plan = createCheckedPaymentPlan({
    acceptanceDate: "2027-02-01",
    departure: "2027-06-01",
    bookingTotalCents: 1_000_001,
    partySize: 2,
  });

  assert.deepEqual(plan.installments, [
    { dueDate: "2027-03-03", amountCents: 900_001 },
  ]);
});

test("splits the balance across two monthly dates when accepted 150 days before departure", () => {
  const plan = createCheckedPaymentPlan({
    acceptanceDate: "2027-01-02",
    departure: "2027-06-01",
    bookingTotalCents: 1_000_001,
    partySize: 2,
  });

  assert.deepEqual(plan.installments, [
    { dueDate: "2027-02-02", amountCents: 450_000 },
    { dueDate: "2027-03-02", amountCents: 450_001 },
  ]);
});

test("clamps month-end installment dates", () => {
  const plan = createCheckedPaymentPlan({
    acceptanceDate: "2026-12-31",
    departure: "2027-06-01",
    bookingTotalCents: 1_000_001,
    partySize: 2,
  });

  assert.deepEqual(plan.installments, [
    { dueDate: "2027-01-31", amountCents: 450_000 },
    { dueDate: "2027-02-28", amountCents: 450_001 },
  ]);
});

test("limits a long payment schedule to twelve installments", () => {
  const plan = createCheckedPaymentPlan({
    acceptanceDate: "2026-01-17",
    departure: "2027-06-01",
    bookingTotalCents: 1_000_001,
    partySize: 2,
  });

  assert.equal(plan.installments.length, 12);
  assert.deepEqual(plan.installments.map((installment) => installment.dueDate), [
    "2026-02-17",
    "2026-03-17",
    "2026-04-17",
    "2026-05-17",
    "2026-06-17",
    "2026-07-17",
    "2026-08-17",
    "2026-09-17",
    "2026-10-17",
    "2026-11-17",
    "2026-12-17",
    "2027-01-17",
  ]);
  assert.deepEqual(plan.installments.map((installment) => installment.amountCents), [
    75_000,
    75_000,
    75_000,
    75_000,
    75_000,
    75_000,
    75_000,
    75_000,
    75_000,
    75_000,
    75_000,
    75_001,
  ]);
});

test("keeps October 31 schedules on each month's final valid day", () => {
  const plan = createCheckedPaymentPlan({
    acceptanceDate: "2026-10-31",
    departure: "2027-07-27",
    bookingTotalCents: 1_000_000,
    partySize: 2,
  });

  assert.deepEqual(plan.installments.map((installment) => installment.dueDate), [
    "2026-11-30",
    "2026-12-31",
    "2027-01-31",
    "2027-02-28",
    "2027-03-31",
  ]);
});

test("allows a booking total equal to the reservation deposit", () => {
  const plan = createCheckedPaymentPlan({
    acceptanceDate: "2026-10-01",
    departure: "2027-06-01",
    bookingTotalCents: 150_000,
    partySize: 3,
  });

  assert.equal(plan.paymentType, "deposit");
  assert.equal(plan.depositAmountCents, 150_000);
  assert.equal(plan.initialAmountCents, 150_000);
  assert.deepEqual(plan.installments, []);
});

test("rejects a booking total below the reservation deposit", () => {
  assert.throws(() => createPaymentPlan({
    acceptanceDate: "2026-10-01",
    departure: "2027-06-01",
    bookingTotalCents: 100_000,
    partySize: 3,
  }), {
    message: "The confirmed booking total cannot be less than the $1,500 reservation deposit.",
  });
});

test("rejects invalid calendar dates", () => {
  assert.throws(() => createPaymentPlan({
    acceptanceDate: "2026-10-01",
    departure: "2027-02-30",
    bookingTotalCents: 1_000_000,
    partySize: 2,
  }), {
    message: "The payment schedule dates are invalid.",
  });
});

test("rejects a departure on or before the acceptance date", () => {
  for (const departure of ["2027-06-01", "2027-05-31"]) {
    assert.throws(() => createPaymentPlan({
      acceptanceDate: "2027-06-01",
      departure,
      bookingTotalCents: 1_000_000,
      partySize: 2,
    }), {
      message: "The departure date must be after the booking acceptance date.",
    });
  }
});
