export type DashboardTraveler = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  travelerType: string;
  dateOfBirth: string | null;
  guardianLegalName: string | null;
  guardianRelationship: string | null;
};

export type AgreementInvitationDelivery = {
  email: string;
  sentAt: string;
  expiresAt: string;
  revokedAt: string | null;
  acceptedAt: string | null;
};

export type GeneratedInvitationDraft = {
  invitationUrl: string;
  primaryContactName: string;
  primaryContactEmail: string;
};

export type PaymentPreferenceGeneratedDraft = GeneratedInvitationDraft & {
  invitationId: number;
  createdAt: string;
  expiresAt: string;
};

export type PaymentPreferenceInvitationState = {
  id: number;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
  revokedAt: string | null;
  usable: boolean;
};

export type DashboardInquiry = {
  id: number;
  fullName: string;
  email: string;
  phone: string;
  departure: string;
  roomPreference: string;
  partySize: number;
  notes: string;
  status: string;
  createdAt: string;
  contactConsent: boolean;
  contactConsentedAt: string | null;
  sellerOfTravelStateResident: boolean;
  residenceState: string | null;
  marketingConsent: boolean;
  marketingConsentedAt: string | null;
  mailerLiteStatus: string;
  ownerNotificationStatus: string;
  confirmedBookingTotalCents: number | null;
  paymentPreference: string | null;
  paymentPreferenceSelectedAt: string | null;
  squareDepositInvoiceId: string | null;
  squareDepositInvoiceStatus: string;
  squareDepositInvoiceUrl: string | null;
  squareDepositCreatedAt: string | null;
  squareDepositClaimIsStale: boolean;
  companyAcceptedAt: string | null;
  companyAcceptedBy: string | null;
  travelers: DashboardTraveler[];
  agreementActive: boolean;
  agreementReady: boolean;
  agreementReadinessMessage: string;
  acceptedTravelerIds: number[];
  agreementInvitationDeliveries: Record<number, AgreementInvitationDelivery>;
  latestTravelerListLinkCreatedAt: string | null;
  latestTravelerListCompletedAt: string | null;
  latestPaymentChoiceLinkCreatedAt: string | null;
  latestPaymentChoiceCompletedAt: string | null;
  latestPaymentChoiceInvitation: PaymentPreferenceInvitationState | null;
};

export type SquareMode = "sandbox" | "production";
