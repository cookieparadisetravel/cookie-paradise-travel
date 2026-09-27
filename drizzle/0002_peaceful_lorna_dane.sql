ALTER TABLE `booking_requests` ADD `contact_consent` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `contact_consented_at` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `seller_of_travel_state_resident` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `residence_state` text;