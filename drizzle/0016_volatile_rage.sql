CREATE TABLE `autopay_authorization_invitations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_request_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`recipient_email` text NOT NULL,
	`expires_at` text NOT NULL,
	`invitation_email_sent_at` text,
	`invitation_email_message_id` text,
	`completed_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`booking_request_id`) REFERENCES `booking_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `autopay_authorization_invitations_token_hash_unique` ON `autopay_authorization_invitations` (`token_hash`);--> statement-breakpoint
CREATE INDEX `autopay_authorization_invitations_booking_request_idx` ON `autopay_authorization_invitations` (`booking_request_id`);