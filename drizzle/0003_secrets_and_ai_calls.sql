CREATE TABLE `ai_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`layer` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cached_input_tokens` integer NOT NULL,
	`cost_usd` real,
	`duration_ms` integer NOT NULL,
	`outcome` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_calls_created_idx` ON `ai_calls` (`created_at`);--> statement-breakpoint
CREATE TABLE `secrets` (
	`name` text PRIMARY KEY NOT NULL,
	`ciphertext` blob NOT NULL,
	`hint` text NOT NULL,
	`updated_at` text NOT NULL
);
