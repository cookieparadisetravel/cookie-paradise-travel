import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const bookingRequests = sqliteTable("booking_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tripSlug: text("trip_slug").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().default(""),
  departure: text("departure").notNull(),
  roomPreference: text("room_preference").notNull(),
  partySize: integer("party_size").notNull(),
  notes: text("notes").notNull().default(""),
  contactConsent: integer("contact_consent", { mode: "boolean" }).notNull().default(false),
  contactConsentedAt: text("contact_consented_at"),
  sellerOfTravelStateResident: integer("seller_of_travel_state_resident", { mode: "boolean" }).notNull().default(false),
  residenceState: text("residence_state"),
  marketingConsent: integer("marketing_consent", { mode: "boolean" }).notNull().default(false),
  marketingConsentedAt: text("marketing_consented_at"),
  mailerLiteStatus: text("mailerlite_status").notNull().default("not_requested"),
  ownerNotificationStatus: text("owner_notification_status").notNull().default("pending"),
  confirmedBookingTotalCents: integer("confirmed_booking_total_cents"),
  paymentPreference: text("payment_preference"),
  paymentPreferenceSelectedAt: text("payment_preference_selected_at"),
  squareCustomerId: text("square_customer_id"),
  squareDepositOrderId: text("square_deposit_order_id"),
  squareDepositInvoiceId: text("square_deposit_invoice_id"),
  squareDepositInvoiceStatus: text("square_deposit_invoice_status").notNull().default("not_created"),
  squareDepositInvoiceVersion: integer("square_deposit_invoice_version"),
  squareDepositClaimedAt: text("square_deposit_claimed_at"),
  squareDepositAmountCents: integer("square_deposit_amount_cents"),
  squareDepositInvoiceUrl: text("square_deposit_invoice_url"),
  squareDepositCreatedAt: text("square_deposit_created_at"),
  companyAcceptedAt: text("company_accepted_at"),
  companyAcceptedBy: text("company_accepted_by"),
  status: text("status").notNull().default("new"),
  createdAt: text("created_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
});

export const travelers = sqliteTable("travelers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookingRequestId: integer("booking_request_id")
    .notNull()
    .references(() => bookingRequests.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  travelerType: text("traveler_type").notNull().default("adult"),
  dateOfBirth: text("date_of_birth"),
  guardianLegalName: text("guardian_legal_name"),
  guardianRelationship: text("guardian_relationship"),
  createdAt: text("created_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
}, (table) => [
  index("travelers_booking_request_idx").on(table.bookingRequestId),
]);

export const travelerListInvitations = sqliteTable("traveler_list_invitations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookingRequestId: integer("booking_request_id")
    .notNull()
    .references(() => bookingRequests.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  completedAt: text("completed_at"),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
}, (table) => [
  uniqueIndex("traveler_list_invitations_token_hash_unique").on(table.tokenHash),
  index("traveler_list_invitations_booking_request_idx").on(table.bookingRequestId),
]);

export const paymentPreferenceInvitations = sqliteTable("payment_preference_invitations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookingRequestId: integer("booking_request_id")
    .notNull()
    .references(() => bookingRequests.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  createdBy: text("created_by"),
  expiresAt: text("expires_at").notNull(),
  completedAt: text("completed_at"),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
}, (table) => [
  uniqueIndex("payment_preference_invitations_token_hash_unique").on(table.tokenHash),
  index("payment_preference_invitations_booking_request_idx").on(table.bookingRequestId),
]);

export const agreementInvitations = sqliteTable("agreement_invitations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  travelerId: integer("traveler_id")
    .notNull()
    .references(() => travelers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  agreementVersion: text("agreement_version").notNull(),
  agreementDocumentHash: text("agreement_document_hash").notNull(),
  recipientEmail: text("recipient_email"),
  invitationEmailSentAt: text("invitation_email_sent_at"),
  invitationEmailMessageId: text("invitation_email_message_id"),
  verificationCodeHash: text("verification_code_hash"),
  verificationCodeSentAt: text("verification_code_sent_at"),
  verificationCodeExpiresAt: text("verification_code_expires_at"),
  verificationAttempts: integer("verification_attempts").notNull().default(0),
  emailVerifiedAt: text("email_verified_at"),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default(sql.raw("CURRENT_TIMESTAMP")),
}, (table) => [
  uniqueIndex("agreement_invitations_token_hash_unique").on(table.tokenHash),
  index("agreement_invitations_traveler_idx").on(table.travelerId),
]);

export const agreementAcceptances = sqliteTable("agreement_acceptances", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invitationId: integer("invitation_id")
    .notNull()
    .references(() => agreementInvitations.id, { onDelete: "restrict" }),
  travelerId: integer("traveler_id")
    .notNull()
    .references(() => travelers.id, { onDelete: "restrict" }),
  agreementVersion: text("agreement_version").notNull(),
  agreementDocumentHash: text("agreement_document_hash").notNull(),
  signerType: text("signer_type").notNull(),
  signerLegalName: text("signer_legal_name").notNull(),
  travelerInitials: text("traveler_initials").notNull(),
  guardianRelationship: text("guardian_relationship"),
  minorDateOfBirth: text("minor_date_of_birth"),
  electronicSignatureConsent: integer("electronic_signature_consent", { mode: "boolean" }).notNull(),
  electronicRecordsDisclosureAccepted: integer("electronic_records_disclosure_accepted", { mode: "boolean" }).notNull().default(false),
  agreementConsent: integer("agreement_consent", { mode: "boolean" }).notNull(),
  depositAcknowledged: integer("deposit_acknowledged", { mode: "boolean" }).notNull(),
  cancellationAcknowledged: integer("cancellation_acknowledged", { mode: "boolean" }).notNull(),
  insuranceSelection: text("insurance_selection").notNull(),
  insuranceAcknowledged: integer("insurance_acknowledged", { mode: "boolean" }).notNull().default(false),
  releaseAcknowledged: integer("release_acknowledged", { mode: "boolean" }).notNull().default(false),
  agreementViewedToEnd: integer("agreement_viewed_to_end", { mode: "boolean" }).notNull().default(false),
  insuranceProvider: text("insurance_provider"),
  photoMediaOptIn: integer("photo_media_opt_in", { mode: "boolean" }).notNull().default(false),
  ipHash: text("ip_hash").notNull(),
  userAgent: text("user_agent").notNull(),
  recipientEmail: text("recipient_email"),
  agreementSnapshot: text("agreement_snapshot"),
  acceptanceRecordHash: text("acceptance_record_hash"),
  signedPdfBase64: text("signed_pdf_base64"),
  signedPdfSha256: text("signed_pdf_sha256"),
  confirmationEmailSentAt: text("confirmation_email_sent_at"),
  confirmationEmailMessageId: text("confirmation_email_message_id"),
  retentionUntil: text("retention_until"),
  acceptedAt: text("accepted_at").notNull(),
}, (table) => [
  uniqueIndex("agreement_acceptances_invitation_unique").on(table.invitationId),
  index("agreement_acceptances_traveler_idx").on(table.travelerId),
]);
