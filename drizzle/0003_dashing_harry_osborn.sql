ALTER TABLE `booking_requests` ADD `square_customer_id` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `square_deposit_order_id` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `square_deposit_invoice_id` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `square_deposit_invoice_status` text DEFAULT 'not_created' NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `square_deposit_amount_cents` integer;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `square_deposit_invoice_url` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `square_deposit_created_at` text;