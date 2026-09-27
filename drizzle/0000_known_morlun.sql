CREATE TABLE `booking_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trip_slug` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`departure` text NOT NULL,
	`room_preference` text NOT NULL,
	`party_size` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
