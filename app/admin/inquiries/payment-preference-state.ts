import type { PaymentPreference } from "@/lib/payment-schedule";
import type {
  PaymentPreferenceGeneratedDraft,
  PaymentPreferenceInvitationState,
} from "./dashboard-types";

export type PaymentPreferenceServerSnapshot = {
  bookingTotalCents: number | null;
  paymentPreference: string | null;
  selectedAt: string | null;
  invoiceExists: boolean;
};

export type PaymentPreferenceClientState = {
  bookingTotal: string;
  bookingTotalDirty: boolean;
  paymentPreference: PaymentPreference | null;
  selectedAt: string | null;
};

export function createPaymentPreferenceClientState(
  server: PaymentPreferenceServerSnapshot,
): PaymentPreferenceClientState {
  return {
    bookingTotal: formatBookingTotal(server.bookingTotalCents),
    bookingTotalDirty: false,
    paymentPreference: normalizePaymentPreference(server.paymentPreference),
    selectedAt: server.selectedAt,
  };
}

export function reconcilePaymentPreferenceClientState(
  current: PaymentPreferenceClientState,
  nextServer: PaymentPreferenceServerSnapshot,
): PaymentPreferenceClientState {
  const nextBookingTotal = formatBookingTotal(nextServer.bookingTotalCents);
  const preserveUnsavedTotal = current.bookingTotalDirty
    && !nextServer.invoiceExists
    && current.bookingTotal !== nextBookingTotal;

  return {
    bookingTotal: preserveUnsavedTotal ? current.bookingTotal : nextBookingTotal,
    bookingTotalDirty: preserveUnsavedTotal,
    paymentPreference: normalizePaymentPreference(nextServer.paymentPreference),
    selectedAt: nextServer.selectedAt,
  };
}

export function samePaymentPreferenceServerSnapshot(
  left: PaymentPreferenceServerSnapshot,
  right: PaymentPreferenceServerSnapshot,
) {
  return left.bookingTotalCents === right.bookingTotalCents
    && left.paymentPreference === right.paymentPreference
    && left.selectedAt === right.selectedAt
    && left.invoiceExists === right.invoiceExists;
}

export function isPaymentPreferenceDraftUsable(
  draft: PaymentPreferenceGeneratedDraft,
  latestInvitation: PaymentPreferenceInvitationState | null,
) {
  if (!latestInvitation) return true;
  if (draft.invitationId === latestInvitation.id) return latestInvitation.usable;

  const draftCreatedAt = Date.parse(draft.createdAt);
  const latestCreatedAt = Date.parse(latestInvitation.createdAt);
  return Number.isFinite(draftCreatedAt)
    && Number.isFinite(latestCreatedAt)
    && draftCreatedAt > latestCreatedAt;
}

export function formatBookingTotal(value: number | null) {
  return value && value > 0 ? (value / 100).toFixed(2) : "";
}

function normalizePaymentPreference(value: string | null): PaymentPreference | null {
  return value === "payment_plan" || value === "full" ? value : null;
}
