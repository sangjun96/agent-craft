CREATE TABLE `resources` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`original_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer NOT NULL
);
