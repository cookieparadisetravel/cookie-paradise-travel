CREATE TABLE `inquiry_owner_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_request_id` integer NOT NULL,
	`body` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`booking_request_id`) REFERENCES `booking_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inquiry_owner_notes_booking_created_idx` ON `inquiry_owner_notes` (`booking_request_id`,`created_at`);