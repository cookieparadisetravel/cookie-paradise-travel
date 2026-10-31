CREATE TABLE IF NOT EXISTS `trip_guide_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`city` text NOT NULL,
	`travel_timing` text NOT NULL,
	`referral_code` text,
	`source` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`contact_consented_at` text NOT NULL,
	`marketing_consent` integer DEFAULT false NOT NULL,
	`marketing_consented_at` text,
	`guide_email_status` text DEFAULT 'pending' NOT NULL,
	`guide_email_claimed_at` text,
	`guide_email_sent_at` text,
	`guide_email_message_id` text,
	`owner_notification_status` text DEFAULT 'pending' NOT NULL,
	`mailerlite_status` text DEFAULT 'not_requested' NOT NULL,
	`contacted_at` text,
	`consultation_booked_at` text,
	`stop_token` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `trip_guide_leads_email_unique` ON `trip_guide_leads` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `trip_guide_leads_stop_token_unique` ON `trip_guide_leads` (`stop_token`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `trip_guide_leads_created_idx` ON `trip_guide_leads` (`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trip_guide_reminders` (
	`lead_id` text NOT NULL,
	`reminder_day` integer NOT NULL,
	`status` text NOT NULL,
	`claimed_at` text NOT NULL,
	`sent_at` text,
	`message_id` text,
	PRIMARY KEY(`lead_id`, `reminder_day`),
	FOREIGN KEY (`lead_id`) REFERENCES `trip_guide_leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trip_guide_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`source` text NOT NULL,
	`form_id` text DEFAULT '' NOT NULL,
	`utm_source` text DEFAULT '' NOT NULL,
	`utm_medium` text DEFAULT '' NOT NULL,
	`utm_campaign` text DEFAULT '' NOT NULL,
	`utm_content` text DEFAULT '' NOT NULL,
	`utm_term` text DEFAULT '' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`campaign_id` text DEFAULT '' NOT NULL,
	`ad_set_id` text DEFAULT '' NOT NULL,
	`ad_id` text DEFAULT '' NOT NULL,
	`marketing_consent` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `trip_guide_leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `trip_guide_submissions_lead_idx` ON `trip_guide_submissions` (`lead_id`);
