import assert from "node:assert/strict";
import test from "node:test";
import { getSquareInvoiceStatusPresentation } from "../app/admin/inquiries/square-invoice-status.ts";

const officialSquareStatuses = [
  "draft",
  "unpaid",
  "scheduled",
  "partially_paid",
  "paid",
  "partially_refunded",
  "refunded",
  "canceled",
  "failed",
  "payment_pending",
] as const;

test("maps every Square invoice status explicitly", () => {
  for (const status of officialSquareStatuses) {
    const presentation = getSquareInvoiceStatusPresentation(status);
    assert.equal(presentation.invoiceExists, true, status);
    assert.equal(presentation.label.startsWith("Unknown Square status"), false, status);
  }
});

test("does not mistake a saved preference for a Square invoice", () => {
  const presentation = getSquareInvoiceStatusPresentation("not_created");
  assert.equal(presentation.invoiceExists, false);
  assert.equal(presentation.needsAttention, false);
});

test("keeps an honest attention state for unknown Square statuses", () => {
  const presentation = getSquareInvoiceStatusPresentation("future_square_state");
  assert.equal(presentation.label, "Unknown Square status: future square state");
  assert.equal(presentation.needsAttention, true);
  assert.equal(presentation.tone, "danger");
});
