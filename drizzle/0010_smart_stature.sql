ALTER TABLE `agreement_acceptances` ADD `minor_date_of_birth` text;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `electronic_records_disclosure_accepted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `insurance_acknowledged` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `release_acknowledged` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `agreement_viewed_to_end` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `recipient_email` text;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `agreement_snapshot` text;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `acceptance_record_hash` text;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `signed_pdf_base64` text;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `signed_pdf_sha256` text;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `confirmation_email_sent_at` text;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `confirmation_email_message_id` text;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `retention_until` text;--> statement-breakpoint
ALTER TABLE `agreement_invitations` ADD `recipient_email` text;--> statement-breakpoint
ALTER TABLE `agreement_invitations` ADD `invitation_email_sent_at` text;--> statement-breakpoint
ALTER TABLE `agreement_invitations` ADD `invitation_email_message_id` text;--> statement-breakpoint
ALTER TABLE `agreement_invitations` ADD `verification_code_hash` text;--> statement-breakpoint
ALTER TABLE `agreement_invitations` ADD `verification_code_sent_at` text;--> statement-breakpoint
ALTER TABLE `agreement_invitations` ADD `verification_code_expires_at` text;--> statement-breakpoint
ALTER TABLE `agreement_invitations` ADD `verification_attempts` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `agreement_invitations` ADD `email_verified_at` text;--> statement-breakpoint
ALTER TABLE `travelers` ADD `date_of_birth` text;