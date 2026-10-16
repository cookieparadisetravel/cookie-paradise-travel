CREATE TABLE IF NOT EXISTS `agreement_reminders` (
	`traveler_id` integer PRIMARY KEY NOT NULL,
	`invitation_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`first_email_sent_at` text NOT NULL,
	`claimed_at` text NOT NULL,
	`status` text NOT NULL,
	`sent_at` text,
	`message_id` text,
	`error` text,
	FOREIGN KEY (`traveler_id`) REFERENCES `travelers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invitation_id`) REFERENCES `agreement_invitations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `agreement_reminders_token_hash_unique` ON `agreement_reminders` (`token_hash`);
