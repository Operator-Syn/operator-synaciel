-- Purpose: Normalize project ordering before cursor pagination.
-- Affected tables: Projects.
-- Data impact: Replaces only NULL display_order values with the existing default 0.
-- Compatibility: Existing project content and ordering values remain unchanged.
-- Rollback: Restore NULL values only with a reviewed forward migration if required.

UPDATE Projects
SET display_order = 0
WHERE display_order IS NULL;
