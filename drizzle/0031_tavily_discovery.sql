CREATE TABLE IF NOT EXISTS `tavily_prospect_config` (
	`id` integer PRIMARY KEY NOT NULL,
	`settings_json` text NOT NULL,
	`last_attempt_at` text,
	`lease_id` text,
	`lease_until` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tavily_prospect_runs` (
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
CREATE INDEX IF NOT EXISTS `tavily_prospect_runs_started_idx` ON `tavily_prospect_runs` (`started_at`);