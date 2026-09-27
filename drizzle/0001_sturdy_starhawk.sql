ALTER TABLE `booking_requests` ADD `marketing_consent` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `marketing_consented_at` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `mailerlite_status` text DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `owner_notification_status` text DEFAULT 'pending' NOT NULL;