type Residency = {
  sellerOfTravelStateResident: boolean;
  residenceState: string | null;
};

export const RESIDENCY_REVIEW_HOLD_MESSAGE = "Seller-of-travel residency screening requires owner review before agreements or payment steps are sent.";

// Keep the reported residence intact. California is approved for ordinary booking.
export function requiresResidencyReview(inquiry: Residency): boolean {
  return inquiry.sellerOfTravelStateResident && inquiry.residenceState?.trim().toUpperCase() !== "CA";
}

export function hasClearedCaliforniaResidencyHold(inquiry: Residency & {
  automatedBookingStatus: string;
  automatedBookingError: string | null;
}): boolean {
  return inquiry.residenceState?.trim().toUpperCase() === "CA"
    && inquiry.automatedBookingStatus === "blocked"
    && inquiry.automatedBookingError === RESIDENCY_REVIEW_HOLD_MESSAGE;
}
