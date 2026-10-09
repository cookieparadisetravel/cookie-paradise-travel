import assert from "node:assert/strict";
import test from "node:test";
import { getEarliestInvoiceDueDate } from "./square-invoice-state.ts";

test("returns the earliest Square invoice due date", () => {
  assert.equal(getEarliestInvoiceDueDate([
    { due_date: "2027-02-20" },
    { due_date: "2026-11-20" },
    { due_date: "2026-12-20" },
  ]), "2026-11-20");
});

test("returns null when Square supplies no due dates", () => {
  assert.equal(getEarliestInvoiceDueDate([{}, {}]), null);
});
