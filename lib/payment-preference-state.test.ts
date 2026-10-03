import assert from "node:assert/strict";
import test from "node:test";
import {
  createPaymentPreferenceClientState,
  isPaymentPreferenceDraftUsable,
  reconcilePaymentPreferenceClientState,
  samePaymentPreferenceServerSnapshot,
  type PaymentPreferenceServerSnapshot,
} from "../app/admin/inquiries/payment-preference-state.ts";
import type {
  PaymentPreferenceGeneratedDraft,
  PaymentPreferenceInvitationState,
} from "../app/admin/inquiries/dashboard-types.ts";

const initialServer: PaymentPreferenceServerSnapshot = {
  bookingTotalCents: 575_000,
  paymentPreference: null,
  selectedAt: null,
  invoiceExists: false,
};

test("refresh with Payments open recognizes unchanged server state", () => {
  assert.equal(samePaymentPreferenceServerSnapshot(initialServer, { ...initialServer }), true);
});

test("customer submission synchronizes the saved preference and selection timestamp", () => {
  const current = createPaymentPreferenceClientState(initialServer);
  const selectedAt = "2026-10-03T18:00:00.000Z";
  const reconciled = reconcilePaymentPreferenceClientState(current, {
    ...initialServer,
    paymentPreference: "payment_plan",
    selectedAt,
  });

  assert.equal(reconciled.paymentPreference, "payment_plan");
  assert.equal(reconciled.selectedAt, selectedAt);
  assert.equal(reconciled.bookingTotal, "5750.00");
});

test("a refreshed server total replaces a clean local value", () => {
  const current = createPaymentPreferenceClientState(initialServer);
  const reconciled = reconcilePaymentPreferenceClientState(current, {
    ...initialServer,
    bookingTotalCents: 600_000,
  });

  assert.equal(reconciled.bookingTotal, "6000.00");
  assert.equal(reconciled.bookingTotalDirty, false);
});

test("a genuinely unsaved total survives refresh and another-tab total changes", () => {
  const current = {
    ...createPaymentPreferenceClientState(initialServer),
    bookingTotal: "5900.00",
    bookingTotalDirty: true,
  };
  const reconciled = reconcilePaymentPreferenceClientState(current, {
    ...initialServer,
    bookingTotalCents: 600_000,
  });

  assert.equal(reconciled.bookingTotal, "5900.00");
  assert.equal(reconciled.bookingTotalDirty, true);
});

test("an existing invoice discards an unsaved total in favor of persisted state", () => {
  const current = {
    ...createPaymentPreferenceClientState(initialServer),
    bookingTotal: "5900.00",
    bookingTotalDirty: true,
  };
  const reconciled = reconcilePaymentPreferenceClientState(current, {
    ...initialServer,
    bookingTotalCents: 600_000,
    invoiceExists: true,
  });

  assert.equal(reconciled.bookingTotal, "6000.00");
  assert.equal(reconciled.bookingTotalDirty, false);
});

test("a link replaced in another tab invalidates the older cached draft", () => {
  const cached = paymentDraft(7, "2026-10-03T18:00:00.000Z");
  const latest = invitationState(8, "2026-10-03T18:05:00.000Z");
  assert.equal(isPaymentPreferenceDraftUsable(cached, latest), false);
});

test("a newly generated local link survives until refreshed server props catch up", () => {
  const cached = paymentDraft(8, "2026-10-03T18:05:00.000Z");
  const staleServer = invitationState(7, "2026-10-03T18:00:00.000Z");
  assert.equal(isPaymentPreferenceDraftUsable(cached, staleServer), true);
});

test("revoked, expired, and completed links invalidate matching cached drafts", () => {
  const cached = paymentDraft(8, "2026-10-03T18:05:00.000Z");
  for (const reason of ["revoked", "expired", "completed"] as const) {
    const latest = invitationState(8, cached.createdAt, false);
    if (reason === "revoked") latest.revokedAt = "2026-10-03T18:10:00.000Z";
    if (reason === "completed") latest.completedAt = "2026-10-03T18:10:00.000Z";
    assert.equal(isPaymentPreferenceDraftUsable(cached, latest), false, reason);
  }
});

function paymentDraft(id: number, createdAt: string): PaymentPreferenceGeneratedDraft {
  return {
    invitationId: id,
    invitationUrl: `https://cookieparadisetravel.com/payment-preference/token-${id}`,
    primaryContactName: "Test Traveler",
    primaryContactEmail: "traveler@example.com",
    createdAt,
    expiresAt: "2026-10-10T18:00:00.000Z",
  };
}

function invitationState(id: number, createdAt: string, usable = true): PaymentPreferenceInvitationState {
  return {
    id,
    createdAt,
    expiresAt: "2026-10-10T18:00:00.000Z",
    completedAt: null,
    revokedAt: null,
    usable,
  };
}
