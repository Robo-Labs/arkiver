CREATE TABLE `arkive_metadata` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`arkive_id` text NOT NULL,
	`deployment_id` text NOT NULL,
	`deployment_stage` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chain_metadata` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chain` text NOT NULL,
	`highest_processed_block` text NOT NULL,
	`highest_fetched_block` text NOT NULL,
	`total_logs_fetched` integer NOT NULL,
	`total_logs_processed` integer NOT NULL,
	`total_blocks_fetched` integer NOT NULL,
	`total_blocks_processed` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `child_source` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`address` text NOT NULL,
	`contract` text NOT NULL,
	`chain` text NOT NULL,
	`start_block_height` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chain_metadata_chain_unique` ON `chain_metadata` (`chain`);