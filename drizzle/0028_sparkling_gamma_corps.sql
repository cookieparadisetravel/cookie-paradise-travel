CREATE TABLE IF NOT EXISTS `web_prospect_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`settings_json` text NOT NULL,
	`last_attempt_at` text,
	`lease_id` text,
	`lease_until` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `web_prospect_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`queries_completed` integer DEFAULT 0 NOT NULL,
	`results_checked` integer DEFAULT 0 NOT NULL,
	`candidates` integer DEFAULT 0 NOT NULL,
	`added` integer DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `web_prospect_runs_started_idx` ON `web_prospect_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `web_prospects` (
	`id` text PRIMARY KEY NOT NULL,
	`source_url` text NOT NULL,
	`source_host` text NOT NULL,
	`title` text NOT NULL,
	`excerpt` text NOT NULL,
	`source_date` text,
	`discovered_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`origin` text NOT NULL,
	`match_reason` text DEFAULT '' NOT NULL,
	`search_query` text DEFAULT '' NOT NULL,
	`target_year` integer NOT NULL,
	`person_name` text DEFAULT '' NOT NULL,
	`travel_timing` text DEFAULT '' NOT NULL,
	`party_size` text DEFAULT '' NOT NULL,
	`contact_channel` text DEFAULT '' NOT NULL,
	`fit` text DEFAULT 'review' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`follow_up_date` text,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `web_prospects_source_url_unique` ON `web_prospects` (`source_url`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `web_prospects_status_idx` ON `web_prospects` (`status`,`discovered_at`);