CREATE TABLE IF NOT EXISTS `trip_guide_submission_preferences` (
	`submission_id` text PRIMARY KEY NOT NULL,
	`contact_consent` integer NOT NULL,
	`followup_mode` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `trip_guide_submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
