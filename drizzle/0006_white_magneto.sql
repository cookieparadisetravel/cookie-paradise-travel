CREATE TABLE `agreement_acceptances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invitation_id` integer NOT NULL,
	`traveler_id` integer NOT NULL,
	`agreement_version` text NOT NULL,
	`agreement_document_hash` text NOT NULL,
	`signer_type` text NOT NULL,
	`signer_legal_name` text NOT NULL,
	`traveler_initials` text NOT NULL,
	`guardian_relationship` text,
	`electronic_signature_consent` integer NOT NULL,
	`agreement_consent` integer NOT NULL,
	`deposit_acknowledged` integer NOT NULL,
	`cancellation_acknowledged` integer NOT NULL,
	`insurance_selection` text NOT NULL,
	`insurance_provider` text,
	`photo_media_opt_in` integer DEFAULT false NOT NULL,
	`ip_hash` text NOT NULL,
	`user_agent` text NOT NULL,
	`accepted_at` text NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `agreement_invitations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`traveler_id`) REFERENCES `travelers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agreement_acceptances_invitation_unique` ON `agreement_acceptances` (`invitation_id`);--> statement-breakpoint
CREATE INDEX `agreement_acceptances_traveler_idx` ON `agreement_acceptances` (`traveler_id`);--> statement-breakpoint
CREATE TABLE `agreement_invitations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`traveler_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`agreement_version` text NOT NULL,
	`agreement_document_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`traveler_id`) REFERENCES `travelers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agreement_invitations_token_hash_unique` ON `agreement_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `agreement_invitations_traveler_idx` ON `agreement_invitations` (`traveler_id`);--> statement-breakpoint
CREATE TABLE `travelers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_request_id` integer NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`traveler_type` text DEFAULT 'adult' NOT NULL,
	`guardian_legal_name` text,
	`guardian_relationship` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`booking_request_id`) REFERENCES `booking_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `travelers_booking_request_idx` ON `travelers` (`booking_request_id`);--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `company_accepted_at` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `company_accepted_by` text;