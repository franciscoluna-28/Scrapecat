CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`github_project_id` integer NOT NULL,
	`github_repository_name` text NOT NULL,
	`report_type` text NOT NULL,
	`original_markdown` text NOT NULL,
	`editable_markdown` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`branch` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
