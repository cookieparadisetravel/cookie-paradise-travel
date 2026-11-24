import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPaymentPreference,
  combineTravelerPaymentPlans,
  createPaymentPlan,
  getFinalPaymentDeadline,
  isFullPaymentRequired,
  type PaymentPlan,
} from "./payment-schedule.ts";

type PaymentPlanInput = Parameters<typeof createPaymentPlan>[0];

function createCheckedPaymentPlan(input: PaymentPlanInput): PaymentPlan {
  const plan = createPaymentPlan(input);
  const scheduledTotal = plan.initialAmountCents
    + plan.installments.reduce((total, installment) => total + installment.amountCents, 0);
  assert.equal(scheduledTotal, input.bookingTotalCents, "The initial payment and installments must equal the booking total.");
  return plan;
}

test("uses a $500 deposit per traveler and finishes exactly two months before departure", () => {
  const plan = createCheckedPaymentPlan({ acceptanceDate: "2026-11-15", departure: "2027-06-01", bookingTotalCents: 287_500, partySize: 1 });
  assert.equal(plan.paymentType, "deposit");
  assert.equal(plan.initialAmountCents, 50_000);
  assert.equal(plan.finalPaymentDeadline, "2027-04-01");
  assert.deepEqual(plan.installments, [
    { dueDate: "2026-12-01", amountCents: 47_500 },
    { dueDate: "2027-01-01", amountCents: 47_500 },
    { dueDate: "2027-02-01", amountCents: 47_500 },
    { dueDate: "2027-03-01", amountCents: 47_500 },
    { dueDate: "2027-04-01", amountCents: 47_500 },
  ]);
});

test("requires full payment on or after the final deadline", () => {
  for (const acceptanceDate of ["2027-04-01", "2027-04-02", "2027-05-31"]) {
    const plan = createCheckedPaymentPlan({ acceptanceDate, departure: "2027-06-01", bookingTotalCents: 1_000_001, partySize: 2 });
    assert.equal(plan.paymentType, "full");
    assert.equal(plan.initialAmountCents, 1_000_001);
    assert.deepEqual(plan.installments, []);
  }
});

test("a booking just before the deadline has one balance payment", () => {
  const plan = createCheckedPaymentPlan({ acceptanceDate: "2027-03-31", departure: "2027-06-01", bookingTotalCents: 1_000_001, partySize: 2 });
  assert.equal(plan.initialAmountCents, 100_000);
  assert.deepEqual(plan.installments, [{ dueDate: "2027-04-01", amountCents: 900_001 }]);
});

test("monthly payments exclude the deposit date and reconcile rounding in the last payment", () => {
  const plan = createCheckedPaymentPlan({ acceptanceDate: "2027-02-01", departure: "2027-06-01", bookingTotalCents: 1_000_001, partySize: 2 });
  assert.deepEqual(plan.installments, [{ dueDate: "2027-03-01", amountCents: 450_000 }, { dueDate: "2027-04-01", amountCents: 450_001 }]);
});

test("clamps month ends without letting February shift later monthly dates", () => {
  const plan = createCheckedPaymentPlan({ acceptanceDate: "2026-12-31", departure: "2027-07-31", bookingTotalCents: 1_000_001, partySize: 2 });
  assert.deepEqual(plan.installments.map(i => i.dueDate), ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31"]);
  assert.equal(plan.installments.at(-1)!.amountCents, 180_001);
});

test("two calendar months handles leap years, short months, and year boundaries", () => {
  assert.equal(getFinalPaymentDeadline("2028-04-30", "2027-12-01"), "2028-02-29");
  assert.equal(getFinalPaymentDeadline("2027-04-30", "2026-12-01"), "2027-02-28");
  assert.equal(getFinalPaymentDeadline("2027-01-31", "2026-10-01"), "2026-11-30");
});

test("limits a long schedule to twelve consecutive monthly installments ending at the deadline", () => {
  const plan = createCheckedPaymentPlan({ acceptanceDate: "2025-01-01", departure: "2027-06-01", bookingTotalCents: 1_000_001, partySize: 2 });
  assert.equal(plan.installments.length, 12);
  assert.equal(plan.installments[0].dueDate, "2026-05-01");
  assert.equal(plan.installments.at(-1)!.dueDate, "2027-04-01");
  assert.equal(plan.installments.at(-1)!.amountCents, 75_001);
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

test("converts an eligible installment schedule to full payment", () => {
  const standardPlan = createPaymentPlan({
    acceptanceDate: "2026-10-01",
    departure: "2027-06-01",
    bookingTotalCents: 1_725_000,
    partySize: 6,
  });
  const fullPaymentPlan = applyPaymentPreference(standardPlan, 1_725_000, "full");

  assert.equal(fullPaymentPlan.paymentType, "full");
  assert.equal(fullPaymentPlan.initialAmountCents, 1_725_000);
  assert.equal(fullPaymentPlan.remainingBalanceCents, 0);
  assert.deepEqual(fullPaymentPlan.installments, []);
  assert.equal(fullPaymentPlan.depositAmountCents, 300_000);
});

test("keeps the standard schedule when the customer selects installments", () => {
  const standardPlan = createPaymentPlan({
    acceptanceDate: "2026-10-01",
    departure: "2027-06-01",
    bookingTotalCents: 1_725_000,
    partySize: 6,
  });

  assert.strictEqual(applyPaymentPreference(standardPlan, 1_725_000, "payment_plan"), standardPlan);
});

test("combines compatible traveler schedules and reconciles to the booking total", () => {
  const firstPlan = createPaymentPlan({
    acceptanceDate: "2026-10-08",
    departure: "2027-06-01",
    bookingTotalCents: 287_500,
    partySize: 1,
  });
  const secondPlan = createPaymentPlan({
    acceptanceDate: "2026-10-08",
    departure: "2027-06-01",
    bookingTotalCents: 250_000,
    partySize: 1,
  });

  const combined = combineTravelerPaymentPlans([firstPlan, secondPlan], 537_500);

  assert.ok(combined);
  assert.equal(combined.initialAmountCents, 100_000);
  assert.equal(
    combined.initialAmountCents
      + combined.installments.reduce((sum, installment) => sum + installment.amountCents, 0),
    537_500,
  );
});

test("rejects traveler schedules with different installment counts", () => {
  const depositOnlyPlan = createPaymentPlan({
    acceptanceDate: "2026-10-08",
    departure: "2027-06-01",
    bookingTotalCents: 50_000,
    partySize: 1,
  });
  const installmentPlan = createPaymentPlan({
    acceptanceDate: "2026-10-08",
    departure: "2027-06-01",
    bookingTotalCents: 287_500,
    partySize: 1,
  });

  assert.equal(combineTravelerPaymentPlans([depositOnlyPlan, installmentPlan], 337_500), null);
});

test("rejects a combined traveler schedule that does not equal the booking total", () => {
  const plan = createPaymentPlan({
    acceptanceDate: "2026-10-08",
    departure: "2027-06-01",
    bookingTotalCents: 287_500,
    partySize: 1,
  });

  assert.equal(combineTravelerPaymentPlans([plan], 300_000), null);
});

test("identifies when the standard payment schedule must require full payment", () => {
  assert.equal(isFullPaymentRequired("2027-06-01", "2027-03-31"), false);
  assert.equal(isFullPaymentRequired("2027-06-01", "2027-04-01"), true);
  assert.equal(getFinalPaymentDeadline("2027-06-01", "2026-10-01"), "2027-04-01");
});

test("December departure uses its own October deadline and installments total the trip price", () => {
  const plan = createCheckedPaymentPlan({ bookingTotalCents: 287500, partySize: 1, departure: "2027-12-27", acceptanceDate: "2026-11-23" });
  assert.equal(plan.initialAmountCents, 50000);
  assert.equal(plan.finalPaymentDeadline, "2027-10-27");
  assert.equal(plan.installments.at(-1)?.dueDate, "2027-10-27");
  assert.equal(plan.installments.length, 12);
});


test("each added summer departure has its own deadline and a reconciled payment plan", () => {
  for (const [departure, deadline] of [["2027-06-15", "2027-04-15"], ["2027-06-29", "2027-04-29"], ["2027-07-13", "2027-05-13"], ["2027-07-27", "2027-05-27"], ["2027-08-10", "2027-06-10"]]) {
    const plan = createCheckedPaymentPlan({ departure, acceptanceDate: "2026-11-24", bookingTotalCents: 287500, partySize: 1 });
    assert.equal(plan.initialAmountCents, 50000);
    assert.equal(plan.finalPaymentDeadline, deadline);
    assert.equal(plan.installments.at(-1)?.dueDate, deadline);
  }
});
