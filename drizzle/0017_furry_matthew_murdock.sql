CREATE TABLE `autopay_authorizations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_request_id` integer NOT NULL,
	`invitation_id` integer NOT NULL,
	`status` text DEFAULT 'saving' NOT NULL,
	`cardholder_name` text NOT NULL,
	`cardholder_email` text NOT NULL,
	`consented_at` text NOT NULL,
	`consented_at_local` text NOT NULL,
	`ip_hash` text NOT NULL,
	`user_agent` text NOT NULL,
	`agreement_version` text NOT NULL,
	`authorization_version` text NOT NULL,
	`authorization_text` text NOT NULL,
	`square_customer_id` text NOT NULL,
	`square_card_id` text NOT NULL,
	`card_brand` text NOT NULL,
	`card_last_4` text NOT NULL,
	`square_invoice_id` text NOT NULL,
	`schedule_snapshot` text NOT NULL,
	`total_cents` integer NOT NULL,
	`final_due_date` text NOT NULL,
	`square_invoice_version_after_enable` integer,
	`confirmation_email_sent_at` text,
	`confirmation_email_error` text,
	`stop_requested_at` text,
	`stop_source` text,
	`stopped_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`booking_request_id`) REFERENCES `booking_requests`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`invitation_id`) REFERENCES `autopay_authorization_invitations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `autopay_authorizations_invitation_unique` ON `autopay_authorizations` (`invitation_id`);--> statement-breakpoint
CREATE INDEX `autopay_authorizations_booking_request_idx` ON `autopay_authorizations` (`booking_request_id`);--> statement-breakpoint
CREATE INDEX `autopay_authorizations_status_idx` ON `autopay_authorizations` (`status`);--> statement-breakpoint
CREATE TABLE `autopay_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`authorization_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`authorization_id`) REFERENCES `autopay_authorizations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `autopay_events_authorization_idx` ON `autopay_events` (`authorization_id`);--> statement-breakpoint
CREATE INDEX `autopay_events_event_type_idx` ON `autopay_events` (`event_type`);--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `installment_autopay_claimed_at` text;