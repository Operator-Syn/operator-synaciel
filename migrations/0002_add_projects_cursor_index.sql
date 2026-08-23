-- Purpose: Add the stable project ordering index used by cursor pagination.
-- Affected tables: Projects.
-- Data impact: Schema-only index creation.
-- Compatibility: Existing project rows and API response data are unchanged.
-- Rollback: Drop idx_projects_display_order_id with a reviewed forward migration.

CREATE INDEX `idx_projects_display_order_id` ON `Projects` (`display_order`,`id`);
