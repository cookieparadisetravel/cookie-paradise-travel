CREATE TABLE `salon_referral_completions` (
	`traveler_id` integer PRIMARY KEY NOT NULL,
	`qualified_on` text NOT NULL,
	`successful` integer DEFAULT false NOT NULL,
	`reviewed_by` text NOT NULL,
	`reviewed_at` text NOT NULL,
	FOREIGN KEY (`traveler_id`) REFERENCES `travelers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `salon_referral_pilots` (
	`code` text PRIMARY KEY NOT NULL,
	`materials_received_on` text NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `referral_code` text;