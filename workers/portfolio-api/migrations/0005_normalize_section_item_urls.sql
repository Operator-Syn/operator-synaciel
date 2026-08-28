-- Purpose: Remove surrounding whitespace from persisted section item URLs.
-- Affected tables: section_items.
-- Data impact: Trims spaces, tabs, carriage returns, and line feeds at URL boundaries.
-- Compatibility: Existing identifiers, ordering, labels, and content remain unchanged.
-- Rollback: Restore an affected URL through a reviewed forward-fix if whitespace was intentional.

UPDATE section_items
SET image_url = trim(image_url, char(9) || char(10) || char(13) || char(32))
WHERE image_url IS NOT NULL
  AND image_url <> trim(image_url, char(9) || char(10) || char(13) || char(32));

UPDATE section_items
SET target_url = trim(target_url, char(9) || char(10) || char(13) || char(32))
WHERE target_url IS NOT NULL
  AND target_url <> trim(target_url, char(9) || char(10) || char(13) || char(32));
