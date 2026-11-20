CREATE TABLE `profile_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`note` text,
	`source_name` text,
	`source_path` text,
	`source_sha256` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_versions_version_unique` ON `profile_versions` (`version`);