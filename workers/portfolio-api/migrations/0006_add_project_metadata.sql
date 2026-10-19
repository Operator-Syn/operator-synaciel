-- Purpose: Add agent-facing categories, stack, and highlights to projects.
-- Affected tables: Projects.
-- Data impact: Schema-only columns with empty JSON-array defaults.
-- Compatibility: Existing project rows and API writes remain valid.
-- Rollback: Drop the three columns with a reviewed forward migration.

ALTER TABLE `Projects` ADD `categories` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `Projects` ADD `stack` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `Projects` ADD `highlights` text DEFAULT '[]' NOT NULL;
