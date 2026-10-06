ALTER TABLE `agreement_acceptances` ADD `payment_schedule_acknowledged` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `health_fitness_acknowledged` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `liability_limit_acknowledged` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `safety_briefing_acknowledged` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `agreement_invitations` ADD `agreement_document_json` text;--> statement-breakpoint
ALTER TABLE `travelers` ADD `confirmed_trip_price_cents` integer;