CREATE TABLE IF NOT EXISTS `welcome_credit_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `welcome_credits` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	`consent_text` text NOT NULL,
	`terms_text` text NOT NULL,
	`sync_status` text DEFAULT 'pending' NOT NULL,
	`sync_attempt_at` text,
	`sync_lease` text,
	`redeemed_at` text,
	`booking_reference` text,
	`redeemed_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `welcome_credits_email_unique` ON `welcome_credits` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `welcome_credits_booking_reference_unique` ON `welcome_credits` (`booking_reference`);