ALTER TABLE `booking_requests` ADD `installment_autopay_authorized` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `installment_autopay_authorized_at` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `installment_autopay_payer_name` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `installment_autopay_status` text DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `installment_autopay_card_brand` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `installment_autopay_card_last_4` text;--> statement-breakpoint
ALTER TABLE `booking_requests` ADD `installment_autopay_error` text;