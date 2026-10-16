CREATE TABLE IF NOT EXISTS `consultation_bookings` (
	`email` text PRIMARY KEY NOT NULL,
	`observed_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `inquiry_reminders` (
	`email` text NOT NULL,
	`reminder_day` integer NOT NULL,
	`inquiry_id` integer NOT NULL,
	`claimed_at` text NOT NULL,
	`status` text NOT NULL,
	`sent_at` text,
	`message_id` text,
	`error` text,
	PRIMARY KEY(`email`, `reminder_day`),
	FOREIGN KEY (`inquiry_id`) REFERENCES `booking_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
