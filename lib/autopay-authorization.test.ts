import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTOPAY_AUTHORIZATION_VERSION,
  autopayAvailable,
  buildAutopayAuthorizationText,
  REQUIRED_AGREEMENT_VERSION,
} from "./autopay-authorization.ts";

test("builds the complete versioned Section 5(c) authorization text", () => {
  assert.equal(AUTOPAY_AUTHORIZATION_VERSION, "1.0");
  assert.equal(REQUIRED_AGREEMENT_VERSION, "1.0");
  assert.equal(
    buildAutopayAuthorizationText({
      cardholderName: "Jordan Sample",
      cardBrand: "VISA",
      last4: "1111",
      paymentCount: 3,
      totalCents: 237_500,
      finalDueDate: "2027-03-01",
    }),
    "I, Jordan Sample, authorize Cookie Paradise Travel Company LLC to charge my Visa card ending in 1111, saved with Square, for the remaining installments shown above: 3 payments totaling $2,375.00, each on its scheduled due date through March 1, 2027. No surcharge or fee will be added. The Company will not increase an installment, add a charge, or move a payment to an earlier date without my new written authorization. I can stop automatic payments by emailing trung@cookieparadise.co at least 3 business days before a charge; stopping automatic payments does not cancel the booking or change a payment deadline. If I am not the traveler, I authorize only these payments and do not accept the traveler's other contractual terms. This authorization is made under Section 5(c) of the Traveler Agreement, and I will receive a copy by email.",
  );
});

test("offers autopay only for the required active and completed agreement", () => {
  assert.equal(autopayAvailable({ agreementActive: true, readyForInvoice: true }), true);
  assert.equal(autopayAvailable({ agreementActive: false, readyForInvoice: true }), false);
  assert.equal(autopayAvailable({ agreementActive: true, readyForInvoice: false }), false);
});
