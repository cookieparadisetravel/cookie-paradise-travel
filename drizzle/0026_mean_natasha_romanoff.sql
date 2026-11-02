CREATE TABLE IF NOT EXISTS `inquiry_booking_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`sales_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`completed_at` text,
	`completion_nonce` text,
	`booking_request_id` integer,
	`email_status` text DEFAULT 'sending' NOT NULL,
	`email_sent_at` text,
	`email_message_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`sales_id`) REFERENCES `inquiry_sales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_request_id`) REFERENCES `booking_requests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `inquiry_booking_invitations_token_unique` ON `inquiry_booking_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `inquiry_booking_invitations_sales_idx` ON `inquiry_booking_invitations` (`sales_id`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `inquiry_sales` (
	`id` text PRIMARY KEY NOT NULL,
	`guide_lead_id` text,
	`booking_request_id` integer,
	`cycle_id` text DEFAULT 'initial' NOT NULL,
	`archived_at` text,
	`next_action` text DEFAULT '' NOT NULL,
	`follow_up_date` text,
	`consultation_booked_at` text,
	`consultation_starts_at` text,
	`consultation_completed_at` text,
	`calendar_checked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`guide_lead_id`) REFERENCES `trip_guide_leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_request_id`) REFERENCES `booking_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `inquiry_sales_guide_cycle_unique` ON `inquiry_sales` (`guide_lead_id`,`cycle_id`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `inquiry_sales_booking_unique` ON `inquiry_sales` (`booking_request_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `inquiry_sales_follow_up_idx` ON `inquiry_sales` (`follow_up_date`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `inquiry_sales_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`sales_id` text NOT NULL,
	`body` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`sales_id`) REFERENCES `inquiry_sales`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `inquiry_sales_notes_created_idx` ON `inquiry_sales_notes` (`sales_id`,`created_at`);