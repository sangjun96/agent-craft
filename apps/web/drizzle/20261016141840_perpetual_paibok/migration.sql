CREATE TABLE `bbox_runs` (
	`id` text PRIMARY KEY,
	`status` text NOT NULL,
	`target` text NOT NULL,
	`image` text NOT NULL,
	`created_at` integer NOT NULL,
	`finished_at` integer,
	`result` text,
	`usage` text,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `curriculum_runs` (
	`id` text PRIMARY KEY,
	`status` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer NOT NULL,
	`finished_at` integer,
	`result` text,
	`error` text
);
