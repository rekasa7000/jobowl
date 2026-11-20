CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`external_id` text NOT NULL,
	`url` text NOT NULL,
	`url_key` text NOT NULL,
	`apply_url` text,
	`apply_kind` text NOT NULL,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`location` text,
	`remote_mode` text NOT NULL,
	`employment_type` text,
	`salary_min` integer,
	`salary_max` integer,
	`salary_currency` text,
	`description` text NOT NULL,
	`posted_at` text,
	`first_seen_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	`content_hash` text NOT NULL,
	`state` text NOT NULL,
	`user_state` text NOT NULL,
	`dismiss_reason` text,
	`injection_flag` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_source_external_idx` ON `jobs` (`source_id`,`external_id`);--> statement-breakpoint
CREATE INDEX `jobs_url_key_idx` ON `jobs` (`url_key`);--> statement-breakpoint
CREATE INDEX `jobs_user_state_idx` ON `jobs` (`user_state`,`state`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`search_id` text NOT NULL,
	`profile_version` integer NOT NULL,
	`prompt_version` text NOT NULL,
	`content_hash` text NOT NULL,
	`score` integer NOT NULL,
	`result` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`search_id`) REFERENCES `searches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_job_search_idx` ON `matches` (`job_id`,`search_id`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`trigger` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`state` text NOT NULL,
	`stats` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `searches` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`titles` text NOT NULL,
	`must_have` text NOT NULL,
	`nice_to_have` text NOT NULL,
	`exclude_words` text NOT NULL,
	`exclude_companies` text NOT NULL,
	`locations` text NOT NULL,
	`remote_mode` text NOT NULL,
	`seniority` text NOT NULL,
	`salary_min` integer,
	`salary_currency` text,
	`max_age_days` integer NOT NULL,
	`min_score_notify` integer NOT NULL,
	`enabled` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`config` text NOT NULL,
	`enabled` integer NOT NULL,
	`last_run_at` text,
	`last_status` text,
	`last_error` text,
	`created_at` text NOT NULL
);
