import test from "node:test";
import assert from "node:assert/strict";
import { autopayScheduleFingerprint } from "./square-autopay.ts";

test("creates a stable SHA-256 fingerprint from the card and exact schedule", async () => {
  const requests = [
    { uid: "installment-1", dueDate: "2026-11-08", amountCents: 79_167 },
    { uid: "installment-2", dueDate: "2026-12-08", amountCents: 79_166 },
  ];

  const first = await autopayScheduleFingerprint("ccof:sandbox-card", requests);
  const second = await autopayScheduleFingerprint("ccof:sandbox-card", requests);

  assert.match(first, /^[a-f0-9]{64}$/u);
  assert.equal(second, first);
});

test("changes when the card or any schedule field changes", async () => {
  const original = await autopayScheduleFingerprint("ccof:card-1", [
    { uid: "installment-1", dueDate: "2026-11-08", amountCents: 79_167 },
  ]);
  const differentCard = await autopayScheduleFingerprint("ccof:card-2", [
    { uid: "installment-1", dueDate: "2026-11-08", amountCents: 79_167 },
  ]);
  const differentSchedule = await autopayScheduleFingerprint("ccof:card-1", [
    { uid: "installment-1", dueDate: "2026-11-09", amountCents: 79_167 },
  ]);

  assert.notEqual(differentCard, original);
  assert.notEqual(differentSchedule, original);
});
