CREATE TABLE IF NOT EXISTS `referral_recipients` (
	`traveler_id` integer PRIMARY KEY NOT NULL,
	`referrer_name` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`traveler_id`) REFERENCES `travelers`(`id`) ON UPDATE no action ON DELETE cascade
);
