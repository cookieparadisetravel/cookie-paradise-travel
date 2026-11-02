CREATE TABLE IF NOT EXISTS `inquiry_followup_history` (
	`id` text PRIMARY KEY NOT NULL,
	`guide_lead_id` text,
	`booking_request_id` integer,
	`cycle_id` text NOT NULL,
	`event` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`sent_at` text,
	`message_id` text,
	`details_json` text,
	FOREIGN KEY (`guide_lead_id`) REFERENCES `trip_guide_leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_request_id`) REFERENCES `booking_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `inquiry_followup_history_guide_created_idx` ON `inquiry_followup_history` (`guide_lead_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `inquiry_followup_history_booking_idx` ON `inquiry_followup_history` (`booking_request_id`);
