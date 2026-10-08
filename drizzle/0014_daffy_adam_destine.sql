ALTER TABLE `booking_requests` ADD `booking_intent` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `automated_booking_status` text DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `automated_booking_error` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `automated_booking_updated_at` text;