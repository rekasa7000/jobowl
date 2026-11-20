CREATE TABLE `application_events` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`at` text NOT NULL,
	`kind` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `application_events_app_idx` ON `application_events` (`application_id`,`at`);--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`legacy_id` integer,
	`company` text NOT NULL,
	`position` text NOT NULL,
	`status` text NOT NULL,
	`channel` text NOT NULL,
	`date_applied` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_activity_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_legacy_id_unique` ON `applications` (`legacy_id`);--> statement-breakpoint
CREATE INDEX `applications_status_idx` ON `applications` (`status`);